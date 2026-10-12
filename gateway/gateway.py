"""
Lansub X Industrial Protocol Gateway (Milestone 5)
Translates Modbus TCP registers, OPC UA nodes, and LoRaWAN ChirpStack uplinks to MQTT.
Supports bi-directional remote commands and live status tracking (FR-G1 to FR-G5).
"""

import asyncio
import fnmatch
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import yaml
import aiomqtt
from pymodbus.client import AsyncModbusTcpClient
from asyncua import Client as OpcuaClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("gateway_service")

CONFIG_PATH = os.getenv("GATEWAY_CONFIG_PATH", "config.yaml")


def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        logger.error("Configuration file not found at %s", CONFIG_PATH)
        return {}
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


async def publish_mqtt(client: aiomqtt.Client, topic: str, payload: dict, qos: int = 0):
    try:
        await client.publish(topic, json.dumps(payload), qos=qos)
    except Exception as e:
        logger.error("Failed to publish to MQTT topic %s: %s", topic, e)


# =====================================================================
# 1. Modbus TCP Gateway Manager (M5.1, FR-G1)
# =====================================================================
class ModbusDeviceManager:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.device_key: str = cfg.get("device_key", "dev_modbus00001")
        self.host: str = os.getenv("MODBUS_SERVER_HOST", cfg.get("host", "simulator"))
        self.port: int = int(os.getenv("MODBUS_SERVER_PORT", cfg.get("port", 502)))
        self.slave_id: int = int(cfg.get("slave_id", 1))
        self.interval: float = float(cfg.get("poll_interval_seconds", 5.0))
        self.holding_regs: list = cfg.get("holding_registers", [])
        self.input_regs: list = cfg.get("input_registers", [])
        self.coils: list = cfg.get("coils", [])
        self.discrete_inputs: list = cfg.get("discrete_inputs", [])
        self.client: Optional[AsyncModbusTcpClient] = None
        self.is_connected: bool = False

    async def connect(self) -> bool:
        try:
            self.client = AsyncModbusTcpClient(host=self.host, port=self.port, timeout=5)
            self.is_connected = await self.client.connect()
            return self.is_connected
        except Exception as e:
            logger.warning("Error connecting to Modbus %s:%s: %s", self.host, self.port, e)
            self.is_connected = False
            return False

    async def close(self):
        self.is_connected = False
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
            self.client = None

    async def read_metrics(self) -> Dict[str, float]:
        if not self.client or not self.is_connected:
            return {}

        values: Dict[str, float] = {}

        # 1. Holding registers reading
        if self.holding_regs:
            try:
                max_addr = max(r["address"] for r in self.holding_regs)
                min_addr = min(r["address"] for r in self.holding_regs)
                count = max_addr - min_addr + 1
                rr = await self.client.read_holding_registers(
                    address=min_addr, count=count, slave=self.slave_id
                )
                if not rr.isError():
                    for reg in self.holding_regs:
                        addr = reg["address"]
                        offset = addr - min_addr
                        scale = float(reg.get("scale", 1.0))
                        if offset < len(rr.registers):
                            raw_val = rr.registers[offset]
                            values[reg["metric"]] = round(raw_val * scale, 3)
                else:
                    # Fallback to single register reads if block read failed
                    for reg in self.holding_regs:
                        s_rr = await self.client.read_holding_registers(
                            address=reg["address"], count=1, slave=self.slave_id
                        )
                        if not s_rr.isError() and len(s_rr.registers) > 0:
                            values[reg["metric"]] = round(s_rr.registers[0] * float(reg.get("scale", 1.0)), 3)
            except Exception as ex:
                logger.debug("Error reading holding registers for %s: %s", self.device_key, ex)

        # 2. Input registers reading
        if self.input_regs:
            try:
                for reg in self.input_regs:
                    ir = await self.client.read_input_registers(
                        address=reg["address"], count=1, slave=self.slave_id
                    )
                    if not ir.isError() and len(ir.registers) > 0:
                        values[reg["metric"]] = round(ir.registers[0] * float(reg.get("scale", 1.0)), 3)
            except Exception as ex:
                logger.debug("Error reading input registers for %s: %s", self.device_key, ex)

        # 3. Coils reading
        if self.coils:
            try:
                max_coil = max(c["address"] for c in self.coils)
                min_coil = min(c["address"] for c in self.coils)
                count = max_coil - min_coil + 1
                cr = await self.client.read_coils(address=min_coil, count=count, slave=self.slave_id)
                if not cr.isError():
                    for c in self.coils:
                        addr = c["address"]
                        offset = addr - min_coil
                        if offset < len(cr.bits):
                            values[c["metric"]] = 1.0 if cr.bits[offset] else 0.0
            except Exception as ex:
                logger.debug("Error reading coils for %s: %s", self.device_key, ex)

        # 4. Discrete inputs reading
        if self.discrete_inputs:
            try:
                for di in self.discrete_inputs:
                    dr = await self.client.read_discrete_inputs(
                        address=di["address"], count=1, slave=self.slave_id
                    )
                    if not dr.isError() and len(dr.bits) > 0:
                        values[di["metric"]] = 1.0 if dr.bits[0] else 0.0
            except Exception as ex:
                logger.debug("Error reading discrete inputs for %s: %s", self.device_key, ex)

        return values

    async def execute_command(self, action: str, params: dict) -> (bool, str):
        if not self.client or not self.is_connected:
            return False, "Modbus client not connected"

        try:
            if action in ("write_coil", "set_coil"):
                address = int(params.get("address", 0))
                val = bool(params.get("value", True))
                res = await self.client.write_coil(address=address, value=val, slave=self.slave_id)
                if res.isError():
                    return False, f"Modbus write coil error: {res}"
                return True, f"Coil {address} set to {val}"

            elif action in ("write_register", "set_register"):
                address = int(params.get("address", 0))
                val = int(params.get("value", 0))
                res = await self.client.write_register(address=address, value=val, slave=self.slave_id)
                if res.isError():
                    return False, f"Modbus write register error: {res}"
                return True, f"Register {address} set to {val}"

            elif action == "start":
                # By convention, coil 0 is 'running'
                res = await self.client.write_coil(address=0, value=True, slave=self.slave_id)
                if res.isError():
                    return False, f"Failed to start machine: {res}"
                return True, "Machine started (coil 0 = True)"

            elif action == "stop":
                res = await self.client.write_coil(address=0, value=False, slave=self.slave_id)
                if res.isError():
                    return False, f"Failed to stop machine: {res}"
                return True, "Machine stopped (coil 0 = False)"

            elif action == "reset_fault":
                # By convention, coil 1 is 'fault'
                res = await self.client.write_coil(address=1, value=False, slave=self.slave_id)
                if res.isError():
                    return False, f"Failed to reset fault: {res}"
                return True, "Fault reset (coil 1 = False)"

            else:
                return False, f"Unsupported Modbus action '{action}'"

        except Exception as e:
            return False, f"Modbus execution exception: {str(e)}"


# =====================================================================
# 2. OPC UA Gateway Manager (M5.2, FR-G2)
# =====================================================================
class OpcuaDeviceManager:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.device_key: str = cfg.get("device_key", "dev_opcua000001")
        self.endpoint_url: str = os.getenv("OPCUA_ENDPOINT_URL", cfg.get("endpoint_url", "opc.tcp://simulator:4840"))
        self.interval: float = float(cfg.get("poll_interval_seconds", 5.0))
        self.nodes: list = cfg.get("nodes", [])
        self.client: Optional[OpcuaClient] = None
        self.is_connected: bool = False

    async def connect(self) -> bool:
        try:
            self.client = OpcuaClient(url=self.endpoint_url, timeout=5)
            await self.client.connect()
            self.is_connected = True
            return True
        except Exception as e:
            logger.warning("Error connecting to OPC UA server at %s: %s", self.endpoint_url, e)
            self.is_connected = False
            return False

    async def close(self):
        self.is_connected = False
        if self.client:
            try:
                await self.client.disconnect()
            except Exception:
                pass
            self.client = None

    async def read_metrics(self) -> Dict[str, float]:
        if not self.client or not self.is_connected:
            return {}

        values: Dict[str, float] = {}
        for node_cfg in self.nodes:
            node_id = node_cfg["node_id"]
            metric = node_cfg["metric"]
            try:
                node = self.client.get_node(node_id)
                val = await node.read_value()
                if isinstance(val, bool):
                    values[metric] = 1.0 if val else 0.0
                elif isinstance(val, (int, float)):
                    values[metric] = round(float(val), 3)
            except Exception as ne:
                logger.debug("Could not read OPC UA node %s: %s", node_id, ne)

        return values

    async def execute_command(self, action: str, params: dict) -> (bool, str):
        if not self.client or not self.is_connected:
            return False, "OPC UA client not connected"

        try:
            if action in ("write_node", "set_variable"):
                node_id = params.get("node_id")
                val = params.get("value")
                if not node_id:
                    return False, "Missing node_id in params"
                node = self.client.get_node(node_id)
                await node.write_value(val)
                return True, f"Node {node_id} written with {val}"

            elif action == "start":
                # Find Running node or default
                node = self.client.get_node("ns=2;s=Running")
                await node.write_value(True)
                return True, "OPC UA machine started (Running = True)"

            elif action == "stop":
                node = self.client.get_node("ns=2;s=Running")
                await node.write_value(False)
                return True, "OPC UA machine stopped (Running = False)"

            elif action == "reset_fault":
                node = self.client.get_node("ns=2;s=Fault")
                await node.write_value(False)
                return True, "OPC UA fault reset (Fault = False)"

            elif action in ("set_speed", "set_motor_speed"):
                speed = float(params.get("speed", params.get("rpm", 1450.0)))
                node = self.client.get_node("ns=2;s=MotorSpeed")
                await node.write_value(speed)
                return True, f"OPC UA MotorSpeed set to {speed}"

            else:
                return False, f"Unsupported OPC UA action '{action}'"

        except Exception as e:
            return False, f"OPC UA execution exception: {str(e)}"


# =====================================================================
# 3. LoRaWAN ChirpStack Bridge (M5.3, FR-G3)
# =====================================================================
class LoraBridge:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.enabled: bool = cfg.get("enabled", True)
        self.topic_pattern: str = cfg.get("chirpstack_uplink_topic", "application/+/device/+/event/up")
        self.dev_eui_map: Dict[str, str] = cfg.get("dev_eui_map", {})

    def matches_topic(self, topic: str) -> bool:
        # Match topic against MQTT wildcard pattern (e.g. application/+/device/+/event/up)
        # Convert MQTT pattern to fnmatch pattern (+ -> *, # -> *)
        fn_pattern = self.topic_pattern.replace("+", "*").replace("#", "*")
        return fnmatch.fnmatch(topic, fn_pattern)

    def process_uplink(self, payload: dict) -> Optional[Dict[str, Any]]:
        """
        Extracts devEui, resolves device_key, extracts numeric telemetry,
        and adds RSSI/SNR radio metadata.
        """
        dev_eui = payload.get("deviceInfo", {}).get("devEui") or payload.get("devEui")
        if not dev_eui:
            return None

        device_key = self.dev_eui_map.get(dev_eui)
        if not device_key:
            logger.debug("LoRa uplink ignored for unmapped DevEUI: %s", dev_eui)
            return None

        # Extract decoded object fields
        raw_object = payload.get("object", {})
        values: Dict[str, float] = {}
        for k, v in raw_object.items():
            if isinstance(v, (int, float)):
                values[k] = round(float(v), 3)
            elif isinstance(v, bool):
                values[k] = 1.0 if v else 0.0

        # Extract RSSI and SNR from rxInfo
        rx_info = payload.get("rxInfo", [])
        if rx_info and isinstance(rx_info, list) and len(rx_info) > 0:
            primary_gw = rx_info[0]
            if primary_gw.get("rssi") is not None:
                values["rssi"] = float(primary_gw["rssi"])
            if primary_gw.get("snr") is not None:
                values["snr"] = round(float(primary_gw["snr"]), 2)

        if not values:
            return None

        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "device_key": device_key,
            "telemetry_payload": {"ts": now_iso, "values": values},
        }


# =====================================================================
# 4. Gateway Orchestrator
# =====================================================================
class GatewayOrchestrator:
    def __init__(self, config: dict):
        self.config = config
        gateways = config.get("gateways", {})

        # Modbus devices
        modbus_cfg = gateways.get("modbus", {})
        self.modbus_managers: List[ModbusDeviceManager] = []
        if modbus_cfg.get("enabled", True):
            if "devices" in modbus_cfg and isinstance(modbus_cfg["devices"], list):
                for d_cfg in modbus_cfg["devices"]:
                    self.modbus_managers.append(ModbusDeviceManager(d_cfg))
            else:
                self.modbus_managers.append(ModbusDeviceManager(modbus_cfg))

        # OPC UA devices
        opcua_cfg = gateways.get("opcua", {})
        self.opcua_managers: List[OpcuaDeviceManager] = []
        if opcua_cfg.get("enabled", True):
            if "devices" in opcua_cfg and isinstance(opcua_cfg["devices"], list):
                for d_cfg in opcua_cfg["devices"]:
                    self.opcua_managers.append(OpcuaDeviceManager(d_cfg))
            else:
                self.opcua_managers.append(OpcuaDeviceManager(opcua_cfg))

        # LoRaWAN bridge
        lora_cfg = gateways.get("lora", {})
        self.lora_bridge = LoraBridge(lora_cfg) if lora_cfg.get("enabled", True) else None

        # Device mapping for command dispatch
        self.command_routes: Dict[str, Any] = {}
        for m in self.modbus_managers:
            self.command_routes[m.device_key] = m
        for o in self.opcua_managers:
            self.command_routes[o.device_key] = o

    async def run(self):
        mqtt_cfg = self.config.get("mqtt", {})
        mqtt_host = os.getenv("MQTT_BROKER_HOST", mqtt_cfg.get("host", "mosquitto"))
        mqtt_port = int(os.getenv("MQTT_BROKER_PORT", mqtt_cfg.get("port", 1883)))
        mqtt_user = os.getenv("MQTT_GATEWAY_USERNAME", mqtt_cfg.get("username", "gateway"))
        mqtt_pass = os.getenv("MQTT_GATEWAY_PASSWORD", mqtt_cfg.get("password", "gateway_secure_pass_123"))

        logger.info("Connecting Lansub X Gateway to Mosquitto at %s:%s as '%s'...", mqtt_host, mqtt_port, mqtt_user)

        while True:
            try:
                async with aiomqtt.Client(
                    hostname=mqtt_host,
                    port=mqtt_port,
                    username=mqtt_user,
                    password=mqtt_pass,
                    identifier=f"lansubx_gateway_{os.getpid()}",
                ) as client:
                    logger.info("Connected to Mosquitto MQTT broker successfully.")

                    # Subscribe to inbound command topics and LoRa uplink topics
                    await client.subscribe("lansubx/+/command")
                    if self.lora_bridge and self.lora_bridge.enabled:
                        await client.subscribe(self.lora_bridge.topic_pattern)
                        logger.info("Subscribed to LoRa uplinks on '%s'", self.lora_bridge.topic_pattern)

                    # Spawn worker loops
                    tasks = [
                        asyncio.create_task(self._mqtt_dispatcher(client), name="mqtt_dispatcher"),
                        asyncio.create_task(self._modbus_poller(client), name="modbus_poller"),
                        asyncio.create_task(self._opcua_poller(client), name="opcua_poller"),
                    ]

                    # Wait until any task faults or disconnects
                    await asyncio.gather(*tasks)

            except aiomqtt.MqttError as err:
                logger.warning("Gateway MQTT broker disconnected: %s. Reconnecting in 5s...", err)
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                logger.info("Gateway service shutting down gracefully.")
                await self._cleanup()
                break
            except Exception as e:
                logger.error("Unexpected error in gateway orchestrator: %s. Reconnecting in 5s...", e, exc_info=True)
                await asyncio.sleep(5)

    async def _cleanup(self):
        for m in self.modbus_managers:
            await m.close()
        for o in self.opcua_managers:
            await o.close()

    # -----------------------------------------------------------------
    # Central MQTT Inbound Dispatcher (Commands & LoRa Uplinks)
    # -----------------------------------------------------------------
    async def _mqtt_dispatcher(self, client: aiomqtt.Client):
        async for message in client.messages:
            try:
                topic_str = str(message.topic)
                raw_payload = message.payload.decode("utf-8")
                payload = json.loads(raw_payload) if raw_payload else {}

                # 1. Check LoRa uplink
                if self.lora_bridge and self.lora_bridge.matches_topic(topic_str):
                    result = self.lora_bridge.process_uplink(payload)
                    if result:
                        dev_key = result["device_key"]
                        telemetry_data = result["telemetry_payload"]
                        await publish_mqtt(client, f"lansubx/{dev_key}/telemetry", telemetry_data)
                        await publish_mqtt(client, f"lansubx/{dev_key}/status", {"online": True, "source": "lora"})
                        logger.info("Bridged LoRa telemetry for %s: %s", dev_key, telemetry_data["values"])
                    continue

                # 2. Check LansubX Device Command: lansubx/{device_key}/command
                parts = topic_str.split("/")
                if len(parts) == 3 and parts[0] == "lansubx" and parts[2] == "command":
                    target_key = parts[1]
                    manager = self.command_routes.get(target_key)
                    if not manager:
                        logger.debug("Command received for unknown gateway device %s", target_key)
                        continue

                    cmd_id = payload.get("id")
                    action = payload.get("action", "")
                    params = payload.get("params", {})

                    logger.info("Executing command %s ('%s') on gateway device %s...", cmd_id, action, target_key)
                    ok, msg = await manager.execute_command(action, params)

                    # Send ACK back to platform
                    ack_payload = {"id": cmd_id, "ok": ok, "message": msg}
                    await publish_mqtt(client, f"lansubx/{target_key}/command/ack", ack_payload)
                    logger.info("Published command ack for %s: ok=%s (%s)", target_key, ok, msg)

            except Exception as e:
                logger.error("Error processing MQTT message on topic %s: %s", message.topic, e)

    # -----------------------------------------------------------------
    # Modbus Poller Loop
    # -----------------------------------------------------------------
    async def _modbus_poller(self, client: aiomqtt.Client):
        if not self.modbus_managers:
            return

        while True:
            for mgr in self.modbus_managers:
                try:
                    if not mgr.is_connected:
                        connected = await mgr.connect()
                        if connected:
                            logger.info("Connected to Modbus TCP device %s at %s:%s", mgr.device_key, mgr.host, mgr.port)
                            await publish_mqtt(client, f"lansubx/{mgr.device_key}/status", {"online": True, "source": "modbus"})
                        else:
                            await publish_mqtt(client, f"lansubx/{mgr.device_key}/status", {"online": False, "source": "modbus"})
                            continue

                    values = await mgr.read_metrics()
                    if values:
                        now_iso = datetime.now(timezone.utc).isoformat()
                        payload = {"ts": now_iso, "values": values}
                        await publish_mqtt(client, f"lansubx/{mgr.device_key}/telemetry", payload)
                        logger.debug("Published Modbus telemetry for %s: %s", mgr.device_key, values)

                except Exception as ex:
                    logger.warning("Modbus polling error on %s: %s", mgr.device_key, ex)
                    await mgr.close()
                    await publish_mqtt(client, f"lansubx/{mgr.device_key}/status", {"online": False, "source": "modbus"})

            # Minimum sleep interval across active modbus devices
            sleep_time = min((m.interval for m in self.modbus_managers), default=5.0)
            await asyncio.sleep(sleep_time)

    # -----------------------------------------------------------------
    # OPC UA Poller Loop
    # -----------------------------------------------------------------
    async def _opcua_poller(self, client: aiomqtt.Client):
        if not self.opcua_managers:
            return

        while True:
            for mgr in self.opcua_managers:
                try:
                    if not mgr.is_connected:
                        connected = await mgr.connect()
                        if connected:
                            logger.info("Connected to OPC UA server %s at %s", mgr.device_key, mgr.endpoint_url)
                            await publish_mqtt(client, f"lansubx/{mgr.device_key}/status", {"online": True, "source": "opcua"})
                        else:
                            await publish_mqtt(client, f"lansubx/{mgr.device_key}/status", {"online": False, "source": "opcua"})
                            continue

                    values = await mgr.read_metrics()
                    if values:
                        now_iso = datetime.now(timezone.utc).isoformat()
                        payload = {"ts": now_iso, "values": values}
                        await publish_mqtt(client, f"lansubx/{mgr.device_key}/telemetry", payload)
                        logger.debug("Published OPC UA telemetry for %s: %s", mgr.device_key, values)

                except Exception as ex:
                    logger.warning("OPC UA polling error on %s: %s", mgr.device_key, ex)
                    await mgr.close()
                    await publish_mqtt(client, f"lansubx/{mgr.device_key}/status", {"online": False, "source": "opcua"})

            sleep_time = min((o.interval for o in self.opcua_managers), default=5.0)
            await asyncio.sleep(sleep_time)


# =====================================================================
# Main Entry Point
# =====================================================================
async def main():
    logger.info("Starting Lansub X Industrial Protocol Gateway Service...")
    cfg = load_config()
    orchestrator = GatewayOrchestrator(cfg)
    await orchestrator.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Gateway service stopped by operator.")
