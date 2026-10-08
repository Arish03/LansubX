from datetime import datetime, timezone, timedelta
from app.services.telemetry import filter_numeric_values, parse_timestamp
from app.services.rules import evaluate_condition
from app.routers.devices import calculate_online_status
from app.models.device import Device


def test_filter_numeric_values():
    raw_payload = {
        "temperature": 72.5,
        "pressure": 101,
        "is_running": True,
        "has_error": False,
        "status_str": "operational",
        "nested": {"ignored": 12},
        "none_val": None,
    }
    clean = filter_numeric_values(raw_payload)

    assert clean["temperature"] == 72.5
    assert clean["pressure"] == 101.0
    assert clean["is_running"] == 1.0
    assert clean["has_error"] == 0.0
    assert "status_str" not in clean
    assert "nested" not in clean
    assert "none_val" not in clean


def test_parse_timestamp():
    # ISO string
    iso_ts = "2026-10-08T12:00:00+00:00"
    parsed = parse_timestamp(iso_ts)
    assert parsed.year == 2026
    assert parsed.tzinfo is not None

    # Epoch integer
    epoch_ts = 1760000000
    parsed_epoch = parse_timestamp(epoch_ts)
    assert parsed_epoch.tzinfo is not None

    # None defaults to current UTC time
    now_parsed = parse_timestamp(None)
    assert now_parsed.tzinfo is not None
    assert (datetime.now(timezone.utc) - now_parsed).total_seconds() < 5


def test_rule_conditions():
    # >
    assert evaluate_condition(80.0, ">", 75.0) is True
    assert evaluate_condition(70.0, ">", 75.0) is False

    # <
    assert evaluate_condition(10.0, "<", 15.0) is True
    assert evaluate_condition(20.0, "<", 15.0) is False

    # >=
    assert evaluate_condition(50.0, ">=", 50.0) is True
    assert evaluate_condition(49.9, ">=", 50.0) is False

    # <=
    assert evaluate_condition(30.0, "<=", 30.0) is True
    assert evaluate_condition(30.1, "<=", 30.0) is False

    # ==
    assert evaluate_condition(100.0, "==", 100.0) is True
    assert evaluate_condition(100.5, "==", 100.0) is False


def test_device_online_calculation():
    now = datetime.now(timezone.utc)

    # Online device with recent telemetry
    dev_online = Device(
        name="ESP32 Pump",
        device_key="dev_112233445566",
        kind="esp32",
        is_online=True,
        last_seen_at=now - timedelta(seconds=30),
    )
    assert calculate_online_status(dev_online) is True

    # Online flag set to False (e.g. MQTT Last Will received)
    dev_offline_flag = Device(
        name="ESP32 Pump",
        device_key="dev_112233445566",
        kind="esp32",
        is_online=False,
        last_seen_at=now - timedelta(seconds=10),
    )
    assert calculate_online_status(dev_offline_flag) is False

    # Standard device past 120s timeout
    dev_stale = Device(
        name="ESP32 Pump",
        device_key="dev_112233445566",
        kind="esp32",
        is_online=True,
        last_seen_at=now - timedelta(seconds=130),
    )
    assert calculate_online_status(dev_stale) is False

    # LoRa device with extended timeout (up to 1800s)
    dev_lora = Device(
        name="LoRa Flow Meter",
        device_key="dev_aabbccddeeff",
        kind="lora",
        is_online=True,
        last_seen_at=now - timedelta(seconds=600),
    )
    assert calculate_online_status(dev_lora) is True

    dev_lora_stale = Device(
        name="LoRa Flow Meter",
        device_key="dev_aabbccddeeff",
        kind="lora",
        is_online=True,
        last_seen_at=now - timedelta(seconds=1900),
    )
    assert calculate_online_status(dev_lora_stale) is False
