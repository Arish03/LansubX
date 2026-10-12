import asyncio
import logging
import os
import sys

from sqlalchemy import select

from app.db import AsyncSessionLocal
from app.models.device import Device
from app.models.gateway import Gateway
from app.models.template import DeviceTemplate
from app.models.user import User, UserRole

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


import sys
from app.models.user import User
from app.models.gateway import Gateway
from app.models.device import Device


DEMO_DEVICES = [
    {
        "device_key": "dev_modbus00001",
        "name": "Modbus Hydraulic Press & Motor",
        "kind": "modbus",
        "gateway_type": "modbus",
    },
    {
        "device_key": "dev_opcua000001",
        "name": "OPC UA CNC Injection Molding Cell",
        "kind": "opcua",
        "gateway_type": "opcua",
    },
    {
        "device_key": "dev_lora0000001",
        "name": "LoRaWAN Environmental Sensor Node",
        "kind": "lora",
        "gateway_type": "lora",
    },
    {
        "device_key": "dev_esp32_000001",
        "name": "ESP32 Factory Floor IoT Node",
        "kind": "esp32",
        "gateway_type": None,
    },
    {
        "device_key": "dev_sensor_000001",
        "name": "Tank Level & I/O Controller",
        "kind": "sensor_controller",
        "gateway_type": None,
    },
    {
        "device_key": "dev_plc_00000001",
        "name": "Line 1 Assembly PLC",
        "kind": "plc",
        "gateway_type": None,
    },
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
    logger.info("Seed process for templates completed successfully.")


async def seed_demo_devices():
    """Seeds demo gateways and devices for the first available user."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).order_by(User.id.asc()).limit(1))
        owner = res.scalar_one_or_none()
        if not owner:
            logger.warning("No user found. Register an admin user first before seeding demo devices.")
            return

        # Ensure gateways exist
        gateways_by_type = {}
        for gw_type, gw_name in [
            ("modbus", "Modbus TCP Industrial Gateway"),
            ("opcua", "OPC UA Field Gateway"),
            ("lora", "LoRaWAN ChirpStack Gateway"),
        ]:
            gw_res = await session.execute(
                select(Gateway).where(Gateway.owner_id == owner.id, Gateway.type == gw_type)
            )
            gw = gw_res.scalar_one_or_none()
            if not gw:
                gw = Gateway(
                    owner_id=owner.id,
                    name=gw_name,
                    type=gw_type,
                    config={},
                )
                session.add(gw)
                await session.flush()
                logger.info("Created demo gateway: %s", gw_name)
            gateways_by_type[gw_type] = gw.id

        # Ensure devices exist
        for d in DEMO_DEVICES:
            dev_res = await session.execute(
                select(Device).where(Device.device_key == d["device_key"])
            )
            existing_dev = dev_res.scalar_one_or_none()
            gw_id = gateways_by_type.get(d["gateway_type"]) if d["gateway_type"] else None
            if not existing_dev:
                dev = Device(
                    owner_id=owner.id,
                    gateway_id=gw_id,
                    name=d["name"],
                    device_key=d["device_key"],
                    kind=d["kind"],
                    is_online=True,
                )
                session.add(dev)
                logger.info("Created demo device: %s (%s)", d["name"], d["device_key"])
            else:
                existing_dev.gateway_id = gw_id
                existing_dev.name = d["name"]
                logger.info("Updated demo device: %s", d["device_key"])

        await session.commit()
    logger.info("Demo devices and gateways seeded successfully.")


DEFAULT_SUPERADMIN_EMAIL = os.getenv("DEFAULT_SUPERADMIN_EMAIL", "superadmin@lansubx.io")
DEFAULT_SUPERADMIN_PASSWORD = os.getenv("DEFAULT_SUPERADMIN_PASSWORD", "SuperAdmin123!")
DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@lansubx.io")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "AdminPassword123!")


async def seed_default_users():
    """Seeds default Superadmin and Admin accounts."""
    from app.security import get_password_hash

    async with AsyncSessionLocal() as session:
        # 1. Superadmin
        res = await session.execute(select(User).where(User.email == DEFAULT_SUPERADMIN_EMAIL))
        superadmin = res.scalar_one_or_none()
        if not superadmin:
            superadmin = User(
                email=DEFAULT_SUPERADMIN_EMAIL,
                password_hash=get_password_hash(DEFAULT_SUPERADMIN_PASSWORD),
                role=UserRole.SUPERADMIN,
                is_active=True,
            )
            session.add(superadmin)
            logger.info("Created default Superadmin: %s", DEFAULT_SUPERADMIN_EMAIL)
        else:
            if superadmin.role != UserRole.SUPERADMIN:
                superadmin.role = UserRole.SUPERADMIN
            logger.info("Default Superadmin already exists: %s", DEFAULT_SUPERADMIN_EMAIL)

        # 2. Admin
        res_adm = await session.execute(select(User).where(User.email == DEFAULT_ADMIN_EMAIL))
        admin = res_adm.scalar_one_or_none()
        if not admin:
            admin = User(
                email=DEFAULT_ADMIN_EMAIL,
                password_hash=get_password_hash(DEFAULT_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
            )
            session.add(admin)
            logger.info("Created default Admin: %s", DEFAULT_ADMIN_EMAIL)
        else:
            logger.info("Default Admin already exists: %s", DEFAULT_ADMIN_EMAIL)

        await session.commit()
    logger.info("Default users seeded successfully.")


async def main():
    await seed_templates()
    await seed_default_users()
    if "--demo" in sys.argv or "--demo-devices" in sys.argv:
        await seed_demo_devices()


if __name__ == "__main__":
    asyncio.run(main())
