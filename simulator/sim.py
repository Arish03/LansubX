"""
Lansub X Industrial Multi-Protocol Simulator (Milestone 5)
Generates realistic industrial physics and telemetry for all machine kinds:
1. Modbus TCP Server (Holding registers, Coils, thermal & speed dynamics)
2. OPC UA Server (CNC/Injection molding machine variables & writable nodes)
3. LoRaWAN ChirpStack Uplinks (Battery decay, diurnal climate, radio RSSI/SNR)
4. ESP32 IoT Direct Node (Telemetry, heap fragmentation, uptime, commands)
5. Sensor Controller Node (Tank level, pressures, digital I/O, commands)
6. Industrial PLC Direct Node (State machine, cycle counter, cycle times, commands)
"""

import asyncio
import json
import logging
import math
import os
import random
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import aiomqtt
from asyncua import Server as OpcuaServer
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.server import StartAsyncTcpServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("simulator")

# Environment & MQTT Broker Configuration
MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))
MQTT_USER = os.getenv("MQTT_BACKEND_USERNAME", "backend")
MQTT_PASS = os.getenv("MQTT_BACKEND_PASSWORD", "backend_secure_pass_123")

MODBUS_PORT = int(os.getenv("MODBUS_SERVER_PORT", 502))
OPCUA_PORT = int(os.getenv("OPCUA_SERVER_PORT", 4840))


# =====================================================================
# 1. Modbus TCP Industrial Machine Simulator (M5.1, M5.4)
# =====================================================================
async def run_modbus_server():
    """
    Simulates a heavy-duty industrial electric motor and pump over Modbus TCP.
    Slave 1:
      Holding Registers (0-6):
        0: temperature    (scaled x0.1, e.g. 720 = 72.0 °C)
        1: pressure       (scaled x0.01, e.g. 10130 = 101.30 bar)
        2: flow_rate      (scaled x0.1, e.g. 450 = 45.0 L/min)
        3: motor_speed    (scaled x1.0, e.g. 1450 RPM)
        4: motor_current  (scaled x0.01, e.g. 1250 = 12.50 A)
        5: vibration      (scaled x0.01, e.g. 25 = 0.25 mm/s)
        6: power          (scaled x0.1, e.g. 85 = 8.5 kW)
      Coils (0-1):
        0: running        (1 = Running, 0 = Stopped)
        1: fault          (1 = Fault Alarm, 0 = Healthy)
    """
    logger.info("Initializing Modbus TCP server on port %d...", MODBUS_PORT)

    initial_holding = [720, 10130, 450, 1450, 1250, 25, 85, 0, 0, 0]
    initial_coils = [1, 0, 0, 0, 0]  # Running=1, Fault=0

    block_hr = ModbusSequentialDataBlock(0, initial_holding)
    block_co = ModbusSequentialDataBlock(0, initial_coils)

    slave_context = ModbusSlaveContext(hr=block_hr, co=block_co)
    server_context = ModbusServerContext(slaves={1: slave_context}, single=False)

    # Physical state variables for continuous physics integration
    state = {
        "running": True,
        "fault": False,
        "temperature": 72.0,
        "target_speed": 1450.0,
        "current_speed": 1450.0,
        "pressure_phase": 0.0,
    }

    async def physics_loop():
        tick = 0
        while True:
            await asyncio.sleep(2.0)
            tick += 1

            # Read live coils to check if external client toggled running/fault
            coils = slave_context.getValues(1, 0, count=2)
            state["running"] = bool(coils[0])
            state["fault"] = bool(coils[1])

            # Motor Speed dynamics
            if state["running"] and not state["fault"]:
                state["target_speed"] = 1450.0 + random.uniform(-10.0, 10.0)
            else:
                state["target_speed"] = 0.0

            # Inertial speed ramping
            state["current_speed"] += (state["target_speed"] - state["current_speed"]) * 0.4
            speed_val = max(0.0, state["current_speed"])

            # Thermal model: heats up when speed > 500 RPM, cools toward 24°C ambient
            ambient = 24.0
            if speed_val > 500:
                heat_gen = 75.0 + (speed_val / 1450.0) * 8.0 + random.uniform(-0.5, 0.5)
                state["temperature"] += (heat_gen - state["temperature"]) * 0.08
            else:
                state["temperature"] += (ambient - state["temperature"]) * 0.05

            # Hydraulic pressure & flow rate dynamics
            state["pressure_phase"] += 0.2
            if speed_val > 500:
                pressure_bar = 101.3 + 4.5 * math.sin(state["pressure_phase"]) + random.uniform(-0.8, 0.8)
                flow_rate = 45.0 + 3.0 * math.cos(state["pressure_phase"] * 0.8) + random.uniform(-0.5, 0.5)
                current_amps = 12.5 + (speed_val / 1450.0) * 1.5 + random.uniform(-0.3, 0.3)
                vibration_mms = 0.25 + (speed_val / 1450.0) * 0.06 + random.uniform(-0.02, 0.02)
                power_kw = (current_amps * 400.0 * 1.732 * 0.85) / 1000.0
            else:
                pressure_bar = 1.0 + random.uniform(0.0, 0.2)
                flow_rate = 0.0
                current_amps = 0.3 + random.uniform(-0.05, 0.05)
                vibration_mms = 0.02 + random.uniform(0.0, 0.01)
                power_kw = 0.15

            # Convert to register integer values with scale factors:
            # temp x0.1 -> reg = temp * 10
            # pres x0.01 -> reg = pres * 100
            # flow x0.1 -> reg = flow * 10
            # speed x1 -> reg = speed
            # current x0.01 -> reg = current * 100
            # vib x0.01 -> reg = vib * 100
            # power x0.1 -> reg = power * 10
            hr_values = [
                int(round(state["temperature"] * 10)),
                int(round(pressure_bar * 100)),
                int(round(flow_rate * 10)),
                int(round(speed_val)),
                int(round(current_amps * 100)),
                int(round(vibration_mms * 100)),
                int(round(power_kw * 10)),
            ]
            slave_context.setValues(3, 0, hr_values)

    asyncio.create_task(physics_loop(), name="modbus_physics")
    logger.info("Modbus TCP server ready on 0.0.0.0:%d", MODBUS_PORT)
    await StartAsyncTcpServer(context=server_context, address=("0.0.0.0", MODBUS_PORT))


# =====================================================================
# 2. OPC UA Automated Equipment Simulator (M5.2, M5.4)
# =====================================================================
async def run_opcua_server():
    """
    Simulates a high-precision CNC Machining / Injection Molding Cell over OPC UA.
    Exposes nodes in namespace 'http://lansubx.io/simulation':
      ns=2;s=Temperature, Pressure, FlowRate, MotorSpeed, MotorCurrent, Vibration, Running, Fault
    """
    logger.info("Initializing OPC UA server on port %d...", OPCUA_PORT)
    server = OpcuaServer()
    await server.init()
    server.set_endpoint(f"opc.tcp://0.0.0.0:{OPCUA_PORT}/freeopcua/server/")
    server.set_server_name("Lansub X Automated Cell Simulator")

    idx = await server.register_namespace("http://lansubx.io/simulation")
    objects = server.nodes.objects
    machine = await objects.add_object(idx, "InjectionMoldingCell")

    v_temp = await machine.add_variable(idx, "Temperature", 72.5)
    v_pres = await machine.add_variable(idx, "Pressure", 101.3)
    v_flow = await machine.add_variable(idx, "FlowRate", 45.0)
    v_speed = await machine.add_variable(idx, "MotorSpeed", 1450.0)
    v_curr = await machine.add_variable(idx, "MotorCurrent", 12.5)
    v_vib = await machine.add_variable(idx, "Vibration", 0.28)
    v_run = await machine.add_variable(idx, "Running", True)
    v_fault = await machine.add_variable(idx, "Fault", False)

    # Enable write access for bidirectional command tests
    for var in [v_temp, v_pres, v_flow, v_speed, v_curr, v_vib, v_run, v_fault]:
        await var.set_writable()

    await server.start()
    logger.info("OPC UA server active at opc.tcp://0.0.0.0:%d", OPCUA_PORT)

    try:
        tick = 0
        while True:
            await asyncio.sleep(2.0)
            tick += 1

            # Check if external client set Running or Fault
            is_running = bool(await v_run.read_value())
            is_fault = bool(await v_fault.read_value())

            if is_running and not is_fault:
                # Manufacturing cycle progression (Clamping, Injection, Cooling)
                cycle_phase = (tick % 10) / 10.0
                pressure_val = round(95.0 + 15.0 * math.sin(cycle_phase * math.pi * 2) + random.uniform(-0.5, 0.5), 2)
                temp_val = round(72.0 + 3.5 * math.cos(cycle_phase * math.pi) + random.uniform(-0.3, 0.3), 2)
                flow_val = round(44.0 + 6.0 * math.sin(cycle_phase * math.pi) + random.uniform(-0.4, 0.4), 2)
                speed_val = round(1450.0 + random.uniform(-8.0, 8.0), 1)
                curr_val = round(12.5 + random.uniform(-0.4, 0.4), 2)
                vib_val = round(0.28 + random.uniform(-0.02, 0.02), 3)
            else:
                pressure_val = 1.0
                temp_val = round(23.5 + random.uniform(-0.2, 0.2), 2)
                flow_val = 0.0
                speed_val = 0.0
                curr_val = 0.2
                vib_val = 0.02

            await v_temp.write_value(temp_val)
            await v_pres.write_value(pressure_val)
            await v_flow.write_value(flow_val)
            await v_speed.write_value(speed_val)
            await v_curr.write_value(curr_val)
            await v_vib.write_value(vib_val)

    finally:
        await server.stop()


# =====================================================================
# 3. Direct MQTT Devices & ChirpStack LoRaWAN Uplinks Simulator
# =====================================================================
class DirectDevicesSimulator:
    def __init__(self):
        self.uptime_sec = 0

        # State for PLC
        self.plc_running = 1.0
        self.plc_fault = 0.0
        self.plc_cycle_count = 0
        self.plc_last_cycle_time = 14.8

        # State for Sensor Controller
        self.sensor_output_1 = 0.0
        self.tank_level = 68.5

        # State for ESP32
        self.esp32_uptime = 0

    async def run(self):
        logger.info("Starting Direct MQTT & LoRaWAN Uplink Simulator...")

        while True:
            try:
                logger.info("Simulator connecting to Mosquitto at %s:%d as '%s'...", MQTT_HOST, MQTT_PORT, MQTT_USER)
                async with aiomqtt.Client(
                    hostname=MQTT_HOST,
                    port=MQTT_PORT,
                    username=MQTT_USER,
                    password=MQTT_PASS,
                    identifier=f"lansubx_sim_{os.getpid()}",
                ) as client:
                    logger.info("Simulator connected to Mosquitto successfully.")

                    # Subscribe to command topics for direct devices
                    await client.subscribe("lansubx/dev_esp32_000001/command")
                    await client.subscribe("lansubx/dev_sensor_000001/command")
                    await client.subscribe("lansubx/dev_plc_00000001/command")

                    # Publish online status for all simulated devices
                    await client.publish("lansubx/dev_esp32_000001/status", json.dumps({"online": True, "source": "sim"}))
                    await client.publish("lansubx/dev_sensor_000001/status", json.dumps({"online": True, "source": "sim"}))
                    await client.publish("lansubx/dev_plc_00000001/status", json.dumps({"online": True, "source": "sim"}))

                    tasks = [
                        asyncio.create_task(self._command_listener(client), name="sim_cmd_listener"),
                        asyncio.create_task(self._telemetry_publisher(client), name="sim_telem_publisher"),
                    ]
                    await asyncio.gather(*tasks)

            except aiomqtt.MqttError as err:
                logger.warning("Simulator MQTT connection dropped: %s. Reconnecting in 5s...", err)
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                logger.info("Simulator MQTT tasks cancelled.")
                break
            except Exception as e:
                logger.error("Simulator MQTT runner error: %s. Retrying in 5s...", e, exc_info=True)
                await asyncio.sleep(5)

    # -----------------------------------------------------------------
    # Command Listener & Responder
    # -----------------------------------------------------------------
    async def _command_listener(self, client: aiomqtt.Client):
        async for message in client.messages:
            try:
                topic = str(message.topic)
                raw = message.payload.decode("utf-8")
                payload = json.loads(raw) if raw else {}
                cmd_id = payload.get("id")
                action = payload.get("action", "")
                params = payload.get("params", {})

                parts = topic.split("/")
                device_key = parts[1] if len(parts) >= 2 else ""

                logger.info("Simulated device %s received command %s: '%s'", device_key, cmd_id, action)

                ok = True
                reply_msg = f"Action '{action}' executed successfully"

                # Handle ESP32 commands
                if device_key == "dev_esp32_000001":
                    if action == "reboot":
                        self.esp32_uptime = 0
                        reply_msg = "ESP32 rebooted. Uptime reset to 0s."
                    elif action == "ping":
                        reply_msg = "pong"
                    else:
                        reply_msg = f"ESP32 command '{action}' processed."

                # Handle Sensor Controller commands
                elif device_key == "dev_sensor_000001":
                    if action in ("set_output", "toggle_output"):
                        channel = params.get("channel", "output_1")
                        state_val = float(params.get("state", 1.0 if self.sensor_output_1 == 0 else 0.0))
                        self.sensor_output_1 = state_val
                        reply_msg = f"Relay channel {channel} set to {int(state_val)}"
                    else:
                        reply_msg = f"Sensor controller command '{action}' processed."

                # Handle PLC commands
                elif device_key == "dev_plc_00000001":
                    if action == "start":
                        self.plc_running = 1.0
                        self.plc_fault = 0.0
                        reply_msg = "PLC cycle started (running=1)."
                    elif action == "stop":
                        self.plc_running = 0.0
                        reply_msg = "PLC stopped (running=0)."
                    elif action == "reset_fault":
                        self.plc_fault = 0.0
                        reply_msg = "PLC fault cleared."
                    elif action in ("emergency_stop", "e_stop"):
                        self.plc_running = 0.0
                        self.plc_fault = 1.0
                        reply_msg = "PLC Emergency Stop triggered (fault=1)."
                    else:
                        reply_msg = f"PLC command '{action}' processed."

                # Send Command ACK frame
                ack_payload = {"id": cmd_id, "ok": ok, "message": reply_msg}
                await client.publish(f"lansubx/{device_key}/command/ack", json.dumps(ack_payload))
                logger.info("Sent command ack for %s: %s", device_key, ack_payload)

            except Exception as e:
                logger.error("Error processing simulated device command: %s", e)

    # -----------------------------------------------------------------
    # Telemetry Emitter (ESP32, Sensor Controller, PLC, LoRaWAN)
    # -----------------------------------------------------------------
    async def _telemetry_publisher(self, client: aiomqtt.Client):
        while True:
            await asyncio.sleep(4.0)
            self.uptime_sec += 4
            self.esp32_uptime += 4
            now_iso = datetime.now(timezone.utc).isoformat()

            # ---------------------------------------------------------
            # 1. ESP32 Direct MQTT Sensor Node
            # ---------------------------------------------------------
            esp32_payload = {
                "ts": now_iso,
                "values": {
                    "temperature": round(23.4 + random.uniform(-0.6, 0.6), 2),
                    "humidity": round(52.5 + random.uniform(-1.5, 1.5), 1),
                    "rssi": round(-64.0 + random.uniform(-3.0, 3.0), 1),
                    "uptime": self.esp32_uptime,
                    "free_heap": 184000 + random.randint(-800, 800),
                },
            }
            await client.publish("lansubx/dev_esp32_000001/telemetry", json.dumps(esp32_payload))

            # ---------------------------------------------------------
            # 2. Digital & Analog Sensor Controller
            # ---------------------------------------------------------
            # Slowly oscillate tank level
            self.tank_level = round(60.0 + 15.0 * math.sin(self.uptime_sec * 0.03) + random.uniform(-0.2, 0.2), 1)
            sensor_payload = {
                "ts": now_iso,
                "values": {
                    "temperature": round(68.2 + random.uniform(-1.0, 1.0), 2),
                    "pressure": round(5.2 + random.uniform(-0.3, 0.3), 2),
                    "level": self.tank_level,
                    "input_1": 1.0 if (self.uptime_sec % 8) < 4 else 0.0,  # Part sensor toggles
                    "input_2": 1.0,  # Safety door closed
                    "output_1": self.sensor_output_1,
                },
            }
            await client.publish("lansubx/dev_sensor_000001/telemetry", json.dumps(sensor_payload))

            # ---------------------------------------------------------
            # 3. Industrial PLC Node
            # ---------------------------------------------------------
            if self.plc_running > 0.5 and self.plc_fault < 0.5:
                # Increment cycle count every ~15 seconds
                if self.uptime_sec % 16 == 0:
                    self.plc_cycle_count += 1
                    self.plc_last_cycle_time = round(14.8 + random.uniform(-0.4, 0.4), 2)
                motor_speed = 1480 + random.randint(-12, 12)
                motor_current = round(14.2 + random.uniform(-0.5, 0.5), 2)
            else:
                motor_speed = 0
                motor_current = 0.4

            plc_payload = {
                "ts": now_iso,
                "values": {
                    "running": self.plc_running,
                    "fault": self.plc_fault,
                    "cycle_count": self.plc_cycle_count,
                    "cycle_time": self.plc_last_cycle_time,
                    "motor_speed": motor_speed,
                    "motor_current": motor_current,
                },
            }
            await client.publish("lansubx/dev_plc_00000001/telemetry", json.dumps(plc_payload))

            # ---------------------------------------------------------
            # 4. LoRaWAN ChirpStack Uplink Event Frame
            # ---------------------------------------------------------
            # Emit LoRa packet every 8 seconds (simulating 10-min industrial heartbeats compressed for test)
            if self.uptime_sec % 8 == 0:
                lora_uplink = {
                    "deviceInfo": {
                        "applicationId": "1",
                        "deviceName": "Environmental Node Zone 3",
                        "devEui": "0011223344556677",
                    },
                    "object": {
                        "temperature": round(21.5 + random.uniform(-0.4, 0.4), 2),
                        "humidity": round(61.0 + random.uniform(-1.2, 1.2), 1),
                        "battery": 3.64,
                    },
                    "rxInfo": [
                        {
                            "gatewayId": "aa555a0000000001",
                            "rssi": -76 + random.randint(-2, 2),
                            "snr": round(9.0 + random.uniform(-0.5, 0.5), 1),
                        }
                    ],
                }
                await client.publish(
                    "application/1/device/0011223344556677/event/up",
                    json.dumps(lora_uplink),
                )


# =====================================================================
# Main Simulation Orchestrator
# =====================================================================
async def main():
    logger.info("=======================================================")
    logger.info("   LANSUB X: MULTI-PROTOCOL FACTORY SIMULATOR (M5)")
    logger.info("=======================================================")

    direct_sim = DirectDevicesSimulator()

    await asyncio.gather(
        run_modbus_server(),
        run_opcua_server(),
        direct_sim.run(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Simulator halted by operator.")
