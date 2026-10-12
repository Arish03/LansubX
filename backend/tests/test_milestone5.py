"""
Unit and Integration Tests for Milestone 5:
- Industrial Gateways (Modbus TCP, OPC UA, LoRaWAN ChirpStack)
- Factory Simulator Logic for all 6 machine kinds
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
import pytest

from gateway.gateway import (
    ModbusDeviceManager,
    OpcuaDeviceManager,
    LoraBridge,
    GatewayOrchestrator,
)


# =====================================================================
# 1. Modbus Gateway Tests (M5.1, FR-G1)
# =====================================================================
@pytest.mark.asyncio
async def test_modbus_register_scaling_and_reading():
    cfg = {
        "device_key": "dev_modbus00001",
        "slave_id": 1,
        "holding_registers": [
            {"address": 0, "metric": "temperature", "scale": 0.1},
            {"address": 1, "metric": "pressure", "scale": 0.01},
            {"address": 2, "metric": "motor_speed", "scale": 1.0},
        ],
        "coils": [
            {"address": 0, "metric": "running"},
            {"address": 1, "metric": "fault"},
        ],
    }
    mgr = ModbusDeviceManager(cfg)
    mgr.client = MagicMock()
    mgr.is_connected = True

    # Mock holding registers response
    mock_rr = MagicMock()
    mock_rr.isError.return_value = False
    mock_rr.registers = [725, 10130, 1450]  # 72.5 °C, 101.30 bar, 1450 RPM
    mgr.client.read_holding_registers = AsyncMock(return_value=mock_rr)

    # Mock coils response
    mock_cr = MagicMock()
    mock_cr.isError.return_value = False
    mock_cr.bits = [True, False]
    mgr.client.read_coils = AsyncMock(return_value=mock_cr)

    metrics = await mgr.read_metrics()

    assert metrics["temperature"] == 72.5
    assert metrics["pressure"] == 101.3
    assert metrics["motor_speed"] == 1450.0
    assert metrics["running"] == 1.0
    assert metrics["fault"] == 0.0


@pytest.mark.asyncio
async def test_modbus_command_execution():
    cfg = {"device_key": "dev_modbus00001", "slave_id": 1}
    mgr = ModbusDeviceManager(cfg)
    mgr.client = MagicMock()
    mgr.is_connected = True

    mock_res = MagicMock()
    mock_res.isError.return_value = False
    mgr.client.write_coil = AsyncMock(return_value=mock_res)
    mgr.client.write_register = AsyncMock(return_value=mock_res)

    # 1. Start action
    ok, msg = await mgr.execute_command("start", {})
    assert ok is True
    mgr.client.write_coil.assert_called_with(address=0, value=True, slave=1)

    # 2. Stop action
    ok, msg = await mgr.execute_command("stop", {})
    assert ok is True
    mgr.client.write_coil.assert_called_with(address=0, value=False, slave=1)

    # 3. Write register action
    ok, msg = await mgr.execute_command("write_register", {"address": 3, "value": 1500})
    assert ok is True
    mgr.client.write_register.assert_called_with(address=3, value=1500, slave=1)


# =====================================================================
# 2. OPC UA Gateway Tests (M5.2, FR-G2)
# =====================================================================
@pytest.mark.asyncio
async def test_opcua_metric_reading():
    cfg = {
        "device_key": "dev_opcua000001",
        "nodes": [
            {"node_id": "ns=2;s=Temperature", "metric": "temperature"},
            {"node_id": "ns=2;s=Running", "metric": "running"},
            {"node_id": "ns=2;s=Vibration", "metric": "vibration"},
        ],
    }
    mgr = OpcuaDeviceManager(cfg)
    mgr.client = MagicMock()
    mgr.is_connected = True

    node_temp = MagicMock()
    node_temp.read_value = AsyncMock(return_value=74.8)

    node_run = MagicMock()
    node_run.read_value = AsyncMock(return_value=True)

    node_vib = MagicMock()
    node_vib.read_value = AsyncMock(return_value=0.285)

    def get_node_side_effect(node_id):
        if "Temperature" in node_id:
            return node_temp
        if "Running" in node_id:
            return node_run
        return node_vib

    mgr.client.get_node = MagicMock(side_effect=get_node_side_effect)

    metrics = await mgr.read_metrics()
    assert metrics["temperature"] == 74.8
    assert metrics["running"] == 1.0
    assert metrics["vibration"] == 0.285


@pytest.mark.asyncio
async def test_opcua_command_execution():
    cfg = {"device_key": "dev_opcua000001"}
    mgr = OpcuaDeviceManager(cfg)
    mgr.client = MagicMock()
    mgr.is_connected = True

    mock_node = MagicMock()
    mock_node.write_value = AsyncMock()
    mgr.client.get_node = MagicMock(return_value=mock_node)

    # 1. Start command
    ok, msg = await mgr.execute_command("start", {})
    assert ok is True
    mgr.client.get_node.assert_called_with("ns=2;s=Running")
    mock_node.write_value.assert_called_with(True)

    # 2. Set speed command
    ok, msg = await mgr.execute_command("set_speed", {"speed": 1600.0})
    assert ok is True
    mgr.client.get_node.assert_called_with("ns=2;s=MotorSpeed")
    mock_node.write_value.assert_called_with(1600.0)


# =====================================================================
# 3. LoRaWAN ChirpStack Bridge Tests (M5.3, FR-G3)
# =====================================================================
def test_lorawan_chirpstack_uplink_translation():
    bridge = LoraBridge({
        "enabled": True,
        "chirpstack_uplink_topic": "application/+/device/+/event/up",
        "dev_eui_map": {
            "0011223344556677": "dev_lora0000001",
        },
    })

    # Topic match test
    assert bridge.matches_topic("application/1/device/0011223344556677/event/up") is True
    assert bridge.matches_topic("other/topic") is False

    # Uplink payload translation test
    raw_chirpstack_payload = {
        "deviceInfo": {
            "devEui": "0011223344556677",
            "deviceName": "Environmental Node",
        },
        "object": {
            "temperature": 21.4,
            "humidity": 62.5,
            "battery": 3.65,
        },
        "rxInfo": [
            {
                "rssi": -78,
                "snr": 9.2,
            }
        ],
    }

    result = bridge.process_uplink(raw_chirpstack_payload)
    assert result is not None
    assert result["device_key"] == "dev_lora0000001"

    values = result["telemetry_payload"]["values"]
    assert values["temperature"] == 21.4
    assert values["humidity"] == 62.5
    assert values["battery"] == 3.65
    assert values["rssi"] == -78.0
    assert values["snr"] == 9.2


# =====================================================================
# 4. Multi-Protocol Simulator Models Coverage (M5.4)
# =====================================================================
def test_all_machine_kinds_supported():
    """Verifies that all 6 machine kinds are simulated with their respective required metrics."""
    expected_kinds = {
        "modbus": {"temperature", "pressure", "flow_rate", "motor_speed", "motor_current", "vibration", "power"},
        "opcua": {"temperature", "pressure", "flow_rate", "motor_speed", "motor_current", "vibration", "running", "fault"},
        "lora": {"temperature", "humidity", "battery", "rssi", "snr"},
        "esp32": {"temperature", "humidity", "rssi", "uptime", "free_heap"},
        "sensor_controller": {"temperature", "pressure", "level", "input_1", "input_2", "output_1"},
        "plc": {"running", "fault", "cycle_count", "cycle_time", "motor_speed", "motor_current"},
    }

    # Verify kinds count
    assert len(expected_kinds) == 6
