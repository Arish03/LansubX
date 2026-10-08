import asyncio
import logging
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.template import DeviceTemplate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

DEFAULT_TEMPLATES = [
    {
        "kind": "modbus",
        "name": "Modbus Industrial Machine",
        "config": {
            "protocol": "modbus_tcp",
            "default_port": 502,
            "slave_id": 1,
            "poll_interval_seconds": 5,
            "holding_registers": [
                {"address": 0, "metric": "temperature", "scale": 0.1, "unit": "°C"},
                {"address": 1, "metric": "pressure", "scale": 0.01, "unit": "bar"},
                {"address": 2, "metric": "flow_rate", "scale": 0.1, "unit": "L/min"},
                {"address": 3, "metric": "motor_speed", "scale": 1.0, "unit": "RPM"},
                {"address": 4, "metric": "motor_current", "scale": 0.01, "unit": "A"},
                {"address": 5, "metric": "vibration", "scale": 0.01, "unit": "mm/s"},
                {"address": 6, "metric": "power", "scale": 0.1, "unit": "kW"},
            ],
            "coils": [
                {"address": 0, "metric": "running"},
                {"address": 1, "metric": "fault"},
            ]
        }
    },
    {
        "kind": "opcua",
        "name": "OPC UA Connected Equipment",
        "config": {
            "protocol": "opcua",
            "endpoint_url": "opc.tcp://opcua-server:4840",
            "security_mode": "None",
            "poll_interval_seconds": 5,
            "nodes": [
                {"node_id": "ns=2;s=Temperature", "metric": "temperature", "unit": "°C"},
                {"node_id": "ns=2;s=Pressure", "metric": "pressure", "unit": "bar"},
                {"node_id": "ns=2;s=FlowRate", "metric": "flow_rate", "unit": "L/min"},
                {"node_id": "ns=2;s=MotorSpeed", "metric": "motor_speed", "unit": "RPM"},
                {"node_id": "ns=2;s=MotorCurrent", "metric": "motor_current", "unit": "A"},
                {"node_id": "ns=2;s=Vibration", "metric": "vibration", "unit": "mm/s"},
                {"node_id": "ns=2;s=Running", "metric": "running"},
                {"node_id": "ns=2;s=Fault", "metric": "fault"},
            ]
        }
    },
    {
        "kind": "lora",
        "name": "LoRaWAN Sensor Node (ChirpStack)",
        "config": {
            "protocol": "lorawan",
            "network_server": "ChirpStack",
            "device_class": "A",
            "band": "IN865",
            "expected_interval_seconds": 600,
            "metrics": [
                {"field": "temperature", "unit": "°C"},
                {"field": "humidity", "unit": "%"},
                {"field": "battery", "unit": "V"},
                {"field": "rssi", "unit": "dBm"},
                {"field": "snr", "unit": "dB"},
            ]
        }
    },
    {
        "kind": "esp32",
        "name": "ESP32 IoT Direct Node",
        "config": {
            "protocol": "mqtt_direct",
            "poll_interval_seconds": 5,
            "metrics": [
                {"field": "temperature", "unit": "°C"},
                {"field": "humidity", "unit": "%"},
                {"field": "rssi", "unit": "dBm"},
                {"field": "uptime", "unit": "s"},
                {"field": "free_heap", "unit": "bytes"},
            ]
        }
    },
    {
        "kind": "sensor_controller",
        "name": "Digital & Analog Sensor Controller",
        "config": {
            "protocol": "mqtt_direct",
            "poll_interval_seconds": 5,
            "metrics": [
                {"field": "temperature", "unit": "°C"},
                {"field": "pressure", "unit": "bar"},
                {"field": "level", "unit": "%"},
                {"field": "input_1", "unit": "state"},
                {"field": "input_2", "unit": "state"},
                {"field": "output_1", "unit": "state"},
            ]
        }
    },
    {
        "kind": "plc",
        "name": "Industrial PLC Direct MQTT",
        "config": {
            "protocol": "mqtt_direct",
            "poll_interval_seconds": 2,
            "metrics": [
                {"field": "running", "unit": "binary"},
                {"field": "fault", "unit": "binary"},
                {"field": "cycle_count", "unit": "count"},
                {"field": "cycle_time", "unit": "s"},
                {"field": "motor_speed", "unit": "RPM"},
                {"field": "motor_current", "unit": "A"},
            ]
        }
    }
]


async def seed_templates():
    async with AsyncSessionLocal() as session:
        for tpl in DEFAULT_TEMPLATES:
            result = await session.execute(
                select(DeviceTemplate).where(DeviceTemplate.kind == tpl["kind"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                new_tpl = DeviceTemplate(
                    kind=tpl["kind"],
                    name=tpl["name"],
                    config=tpl["config"],
                )
                session.add(new_tpl)
                logger.info("Added default device template for '%s'", tpl["kind"])
            else:
                existing.name = tpl["name"]
                existing.config = tpl["config"]
                logger.info("Updated default device template for '%s'", tpl["kind"])

        await session.commit()
    logger.info("Seed process completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_templates())
