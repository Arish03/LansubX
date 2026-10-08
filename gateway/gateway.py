import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import yaml
import aiomqtt
from pymodbus.client import AsyncModbusTcpClient
from asyncua import Client as OpcuaClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
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
# 1. Modbus TCP Gateway Loop
# =====================================================================
async def run_modbus_loop(mqtt_client: aiomqtt.Client, cfg: dict):
    if not cfg.get("enabled", True):
        logger.info("Modbus gateway disabled.")
        return

    host = cfg.get("host", "simulator")
    port = cfg.get("port", 502)
    slave_id = cfg.get("slave_id", 1)
    device_key = cfg.get("device_key", "dev_modbus00001")
    interval = cfg.get("poll_interval_seconds", 5)
    holding_regs = cfg.get("holding_registers", [])
    coils = cfg.get("coils", [])

    logger.info("Starting Modbus TCP gateway for %s (%s:%s)...", device_key, host, port)

    while True:
        try:
            client = AsyncModbusTcpClient(host=host, port=port)
            connected = await client.connect()
            if not connected:
                logger.warning("Could not connect to Modbus server at %s:%s. Retrying in 5s...", host, port)
                await publish_mqtt(mqtt_client, f"lansubx/{device_key}/status", {"online": False, "source": "modbus"})
                await asyncio.sleep(5)
                continue

            logger.info("Connected to Modbus TCP server %s:%s", host, port)
            await publish_mqtt(mqtt_client, f"lansubx/{device_key}/status", {"online": True, "source": "modbus"})

            while True:
                values: Dict[str, float] = {}

                # Read holding registers block
                if holding_regs:
                    max_addr = max(r["address"] for r in holding_regs)
                    rr = await client.read_holding_registers(address=0, count=max_addr + 1, slave=slave_id)
                    if not rr.isError():
                        for reg in holding_regs:
                            addr = reg["address"]
                            scale = reg.get("scale", 1.0)
                            if addr < len(rr.registers):
                                raw_val = rr.registers[addr]
                                values[reg["metric"]] = round(raw_val * scale, 3)
                    else:
                        logger.warning("Modbus holding registers read error: %s", rr)

                # Read coils block
                if coils:
                    max_coil = max(c["address"] for c in coils)
                    cr = await client.read_coils(address=0, count=max_coil + 1, slave=slave_id)
                    if not cr.isError():
                        for c in coils:
                            addr = c["address"]
                            if addr < len(cr.bits):
                                values[c["metric"]] = 1.0 if cr.bits[addr] else 0.0

                if values:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    payload = {"ts": now_iso, "values": values}
                    await publish_mqtt(mqtt_client, f"lansubx/{device_key}/telemetry", payload)
                    logger.debug("Published Modbus telemetry for %s: %s", device_key, values)

                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Modbus gateway error: %s. Reconnecting in 5s...", e)
            await publish_mqtt(mqtt_client, f"lansubx/{device_key}/status", {"online": False, "source": "modbus"})
            await asyncio.sleep(5)


# =====================================================================
# 2. OPC UA Gateway Loop
# =====================================================================
async def run_opcua_loop(mqtt_client: aiomqtt.Client, cfg: dict):
    if not cfg.get("enabled", True):
        logger.info("OPC UA gateway disabled.")
        return

    endpoint_url = cfg.get("endpoint_url", "opc.tcp://simulator:4840")
    device_key = cfg.get("device_key", "dev_opcua000001")
    interval = cfg.get("poll_interval_seconds", 5)
    nodes = cfg.get("nodes", [])

    logger.info("Starting OPC UA gateway for %s (%s)...", device_key, endpoint_url)

    while True:
        try:
            async with OpcuaClient(url=endpoint_url, timeout=5) as client:
                logger.info("Connected to OPC UA server at %s", endpoint_url)
                await publish_mqtt(mqtt_client, f"lansubx/{device_key}/status", {"online": True, "source": "opcua"})

                while True:
                    values: Dict[str, float] = {}
                    for node_cfg in nodes:
                        node_id = node_cfg["node_id"]
                        metric = node_cfg["metric"]
                        try:
                            node = client.get_node(node_id)
                            val = await node.read_value()
                            if isinstance(val, bool):
                                values[metric] = 1.0 if val else 0.0
                            elif isinstance(val, (int, float)):
                                values[metric] = float(val)
                        except Exception as ne:
                            logger.debug("Could not read OPC UA node %s: %s", node_id, ne)

                    if values:
                        now_iso = datetime.now(timezone.utc).isoformat()
                        payload = {"ts": now_iso, "values": values}
                        await publish_mqtt(mqtt_client, f"lansubx/{device_key}/telemetry", payload)

                    await asyncio.sleep(interval)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("OPC UA gateway connection dropped: %s. Reconnecting in 5s...", e)
            await publish_mqtt(mqtt_client, f"lansubx/{device_key}/status", {"online": False, "source": "opcua"})
            await asyncio.sleep(5)


# =====================================================================
# 3. LoRaWAN ChirpStack Bridge
# =====================================================================
async def run_lora_loop(mqtt_client: aiomqtt.Client, cfg: dict):
    if not cfg.get("enabled", True):
        logger.info("LoRa gateway disabled.")
        return

    topic = cfg.get("chirpstack_uplink_topic", "application/+/device/+/event/up")
    dev_eui_map = cfg.get("dev_eui_map", {})
    logger.info("Subscribing to LoRa uplinks on %s with %d EUI mappings...", topic, len(dev_eui_map))

    try:
        await mqtt_client.subscribe(topic)
        async for message in mqtt_client.messages:
            try:
                payload = json.loads(message.payload.decode("utf-8"))
                # Extract devEui
                dev_eui = payload.get("deviceInfo", {}).get("devEui") or payload.get("devEui")
                if not dev_eui:
                    continue

                device_key = dev_eui_map.get(dev_eui)
                if not device_key:
                    logger.debug("Ignored unmapped LoRa DevEUI: %s", dev_eui)
                    continue

                # Extract decoded object and radio stats
                raw_object = payload.get("object", {})
                values: Dict[str, float] = {}
                for k, v in raw_object.items():
                    if isinstance(v, (int, float)):
                        values[k] = float(v)
                    elif isinstance(v, bool):
                        values[k] = 1.0 if v else 0.0

                # Append RSSI and SNR if present in rxInfo
                rx_info = payload.get("rxInfo", [])
                if rx_info and isinstance(rx_info, list) and len(rx_info) > 0:
                    rssi = rx_info[0].get("rssi")
                    snr = rx_info[0].get("snr")
                    if rssi is not None:
                        values["rssi"] = float(rssi)
                    if snr is not None:
                        values["snr"] = float(snr)

                if values:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    out_payload = {"ts": now_iso, "values": values}
                    await publish_mqtt(mqtt_client, f"lansubx/{device_key}/telemetry", out_payload)
                    logger.info("Forwarded LoRa telemetry for %s: %s", device_key, values)

            except Exception as pe:
                logger.warning("Error parsing LoRa uplink message: %s", pe)

    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error("LoRa gateway error: %s", e)


# =====================================================================
# Main Gateway Service Orchestrator
# =====================================================================
async def main():
    config = load_config()
    mqtt_cfg = config.get("mqtt", {})
    mqtt_host = os.getenv("MQTT_BROKER_HOST", mqtt_cfg.get("host", "mosquitto"))
    mqtt_port = int(os.getenv("MQTT_BROKER_PORT", mqtt_cfg.get("port", 1883)))
    mqtt_user = os.getenv("MQTT_GATEWAY_USERNAME", mqtt_cfg.get("username", "gateway"))
    mqtt_pass = os.getenv("MQTT_GATEWAY_PASSWORD", mqtt_cfg.get("password", "gateway_secure_pass_123"))

    logger.info("Lansub X Gateway Service starting...")

    while True:
        try:
            logger.info("Connecting to Mosquitto broker at %s:%s as '%s'...", mqtt_host, mqtt_port, mqtt_user)
            async with aiomqtt.Client(
                hostname=mqtt_host,
                port=mqtt_port,
                username=mqtt_user,
                password=mqtt_pass,
                identifier="lansubx_gateway_service",
            ) as client:
                logger.info("Connected to Mosquitto successfully.")

                gateways = config.get("gateways", {})
                modbus_cfg = gateways.get("modbus", {})
                opcua_cfg = gateways.get("opcua", {})
                lora_cfg = gateways.get("lora", {})

                tasks = [
                    asyncio.create_task(run_modbus_loop(client, modbus_cfg), name="modbus_loop"),
                    asyncio.create_task(run_opcua_loop(client, opcua_cfg), name="opcua_loop"),
                    asyncio.create_task(run_lora_loop(client, lora_cfg), name="lora_loop"),
                ]

                await asyncio.gather(*tasks)

        except aiomqtt.MqttError as err:
            logger.warning("Gateway MQTT broker dropped: %s. Reconnecting in 5s...", err)
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            logger.info("Gateway service stopped.")
            break
        except Exception as e:
            logger.error("Unexpected error in gateway runner: %s. Reconnecting in 5s...", e, exc_info=True)
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
