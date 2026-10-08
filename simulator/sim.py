import asyncio
import json
import logging
import math
import os
import random
import time
from datetime import datetime, timezone
import aiomqtt
from asyncua import Server as OpcuaServer
from asyncua.common.methods import uamethod
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusServerContext, ModbusSlaveContext
from pymodbus.server import StartAsyncTcpServer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("simulator")

MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))
MQTT_USER = os.getenv("MQTT_BACKEND_USERNAME", "backend")
MQTT_PASS = os.getenv("MQTT_BACKEND_PASSWORD", "backend_secure_pass_123")


# =====================================================================
# 1. Simulated Modbus TCP Server
# =====================================================================
async def run_modbus_server():
    logger.info("Initializing simulated Modbus TCP server on port 502...")

    # Slave 1 datablocks: holding registers (0-9), coils (0-9)
    # reg 0: temp (scaled x0.1), reg 1: pres (scaled x0.01), reg 2: flow (x0.1)
    # reg 3: speed (x1), reg 4: current (x0.01), reg 5: vib (x0.01), reg 6: power (x0.1)
    initial_holding = [720, 10130, 450, 1450, 1250, 25, 85, 0, 0, 0]
    initial_coils = [1, 0, 0, 0, 0]

    block_hr = ModbusSequentialDataBlock(0, initial_holding)
    block_co = ModbusSequentialDataBlock(0, initial_coils)

    slave_context = ModbusSlaveContext(hr=block_hr, co=block_co)
    server_context = ModbusServerContext(slaves={1: slave_context}, single=False)

    async def update_registers():
        tick = 0
        while True:
            await asyncio.sleep(2)
            tick += 1
            # Sine wave fluctuations
            temp = int(720 + 25 * math.sin(tick * 0.1) + random.randint(-5, 5))
            pres = int(10130 + 100 * math.cos(tick * 0.08) + random.randint(-15, 15))
            speed = int(1450 + random.randint(-8, 8))
            current = int(1250 + random.randint(-20, 20))
            vib = int(25 + random.randint(-3, 3))

            slave_context.setValues(3, 0, [temp, pres, 450, speed, current, vib, 85])

    asyncio.create_task(update_registers(), name="modbus_updater")

    logger.info("Modbus TCP server ready on 0.0.0.0:502")
    await StartAsyncTcpServer(context=server_context, address=("0.0.0.0", 502))


# =====================================================================
# 2. Simulated OPC UA Server
# =====================================================================
async def run_opcua_server():
    logger.info("Initializing simulated OPC UA server on port 4840...")
    server = OpcuaServer()
    await server.init()
    server.set_endpoint("opc.tcp://0.0.0.0:4840/freeopcua/server/")
    server.set_server_name("Lansub X Factory Simulation Server")

    uri = "http://lansubx.io/simulation"
    idx = await server.register_namespace(uri)

    objects = server.nodes.objects
    machine = await objects.add_object(idx, "InjectionMoldingMachine")

    v_temp = await machine.add_variable(idx, "Temperature", 72.5)
    v_pres = await machine.add_variable(idx, "Pressure", 101.3)
    v_flow = await machine.add_variable(idx, "FlowRate", 45.0)
    v_speed = await machine.add_variable(idx, "MotorSpeed", 1450.0)
    v_curr = await machine.add_variable(idx, "MotorCurrent", 12.5)
    v_vib = await machine.add_variable(idx, "Vibration", 0.28)
    v_run = await machine.add_variable(idx, "Running", True)
    v_fault = await machine.add_variable(idx, "Fault", False)

    await server.start()
    logger.info("OPC UA server running at opc.tcp://0.0.0.0:4840")

    try:
        tick = 0
        while True:
            await asyncio.sleep(2)
            tick += 1
            await v_temp.write_value(round(72.5 + 3.0 * math.sin(tick * 0.15) + random.uniform(-0.5, 0.5), 2))
            await v_pres.write_value(round(101.3 + 1.2 * math.cos(tick * 0.1) + random.uniform(-0.2, 0.2), 2))
            await v_speed.write_value(round(1450.0 + random.uniform(-5.0, 5.0), 1))
            await v_curr.write_value(round(12.5 + random.uniform(-0.3, 0.3), 2))
            await v_vib.write_value(round(0.28 + random.uniform(-0.02, 0.02), 3))
    finally:
        await server.stop()


# =====================================================================
# 3. Direct MQTT Devices & LoRa ChirpStack Uplinks Simulator
# =====================================================================
async def run_mqtt_devices_sim():
    logger.info("Starting direct MQTT & LoRa uplink simulator...")
    uptime_sec = 0

    while True:
        try:
            async with aiomqtt.Client(
                hostname=MQTT_HOST,
                port=MQTT_PORT,
                username=MQTT_USER,
                password=MQTT_PASS,
                identifier="lansubx_factory_simulator",
            ) as client:
                logger.info("Simulator connected to Mosquitto broker at %s:%s", MQTT_HOST, MQTT_PORT)

                while True:
                    await asyncio.sleep(5)
                    uptime_sec += 5
                    now_iso = datetime.now(timezone.utc).isoformat()

                    # 1. Direct ESP32 node
                    esp32_payload = {
                        "ts": now_iso,
                        "values": {
                            "temperature": round(23.5 + random.uniform(-0.8, 0.8), 2),
                            "humidity": round(54.0 + random.uniform(-2.0, 2.0), 1),
                            "rssi": round(-65.0 + random.uniform(-3.0, 3.0), 1),
                            "uptime": uptime_sec,
                            "free_heap": 184500 + random.randint(-500, 500),
                        },
                    }
                    await client.publish("lansubx/dev_esp32_000001/telemetry", json.dumps(esp32_payload))

                    # 2. Direct PLC node
                    plc_payload = {
                        "ts": now_iso,
                        "values": {
                            "running": 1.0,
                            "fault": 0.0,
                            "cycle_count": int(uptime_sec / 15),
                            "cycle_time": 14.8 + random.uniform(-0.5, 0.5),
                            "motor_speed": 1480 + random.randint(-10, 10),
                            "motor_current": round(14.2 + random.uniform(-0.4, 0.4), 2),
                        },
                    }
                    await client.publish("lansubx/dev_plc_00000001/telemetry", json.dumps(plc_payload))

                    # 3. LoRa ChirpStack Uplink event frame
                    lora_uplink = {
                        "deviceInfo": {
                            "devEui": "0011223344556677",
                            "deviceName": "Field Temp/Humidity Node",
                        },
                        "object": {
                            "temperature": round(21.4 + random.uniform(-0.5, 0.5), 2),
                            "humidity": round(62.0 + random.uniform(-1.5, 1.5), 1),
                            "battery": 3.65,
                        },
                        "rxInfo": [
                            {
                                "rssi": -78,
                                "snr": 9.2,
                            }
                        ],
                    }
                    await client.publish(
                        "application/1/device/0011223344556677/event/up",
                        json.dumps(lora_uplink),
                    )

        except aiomqtt.MqttError as err:
            logger.warning("Simulator MQTT error: %s. Retrying in 5s...", err)
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Simulator MQTT runner error: %s. Retrying in 5s...", e)
            await asyncio.sleep(5)


# =====================================================================
# Main Simulation Orchestrator
# =====================================================================
async def main():
    logger.info("Lansub X Industrial Machine Simulator starting...")
    await asyncio.gather(
        run_modbus_server(),
        run_opcua_server(),
        run_mqtt_devices_sim(),
    )


if __name__ == "__main__":
    asyncio.run(main())
