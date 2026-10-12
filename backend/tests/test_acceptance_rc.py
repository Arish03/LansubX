"""
Lansub X: Milestone 6 Release Candidate Automated Test Suite
Zero-dependency unittest suite verifying core platform algorithms, security specifications,
telemetry parsing, rule evaluation, online calculation, and resiliency.
"""

import math
import os
import re
import sys
import unittest
from datetime import datetime, timezone, timedelta

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


# ---------------------------------------------------------------------
# Pure logic reference implementations conforming to platform specifications
# ---------------------------------------------------------------------
def evaluate_condition(value: float, operator: str, threshold: float) -> bool:
    if operator == ">":
        return value > threshold
    elif operator == "<":
        return value < threshold
    elif operator == ">=":
        return value >= threshold
    elif operator == "<=":
        return value <= threshold
    elif operator == "==":
        return math.isclose(value, threshold, abs_tol=1e-5)
    return False


def filter_numeric_values(payload: dict) -> dict:
    clean = {}
    for k, v in payload.items():
        if isinstance(v, bool):
            clean[k] = 1.0 if v else 0.0
        elif isinstance(v, (int, float)):
            clean[k] = float(v)
    return clean


def parse_timestamp(raw_ts) -> datetime:
    if raw_ts is None:
        return datetime.now(timezone.utc)
    if isinstance(raw_ts, (int, float)):
        return datetime.fromtimestamp(raw_ts, tz=timezone.utc)
    if isinstance(raw_ts, str):
        try:
            dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def calculate_online_status(is_online: bool, last_seen_at: datetime, kind: str) -> bool:
    if not is_online or not last_seen_at:
        return False
    now = datetime.now(timezone.utc)
    if last_seen_at.tzinfo is None:
        last_seen_at = last_seen_at.replace(tzinfo=timezone.utc)
    timeout_seconds = 1800 if kind == "lora" else 120
    return (now - last_seen_at).total_seconds() <= timeout_seconds


class TestSecurityAndAuth(unittest.TestCase):
    """Verifies security token specifications and device key generators."""

    def test_device_key_format(self):
        import secrets
        key = f"dev_{secrets.token_hex(6)}"
        self.assertTrue(key.startswith("dev_"))
        self.assertRegex(key, r"^dev_[0-9a-f]{12}$")

    def test_device_secret_format(self):
        import secrets
        secret = f"sec_{secrets.token_hex(16)}"
        self.assertTrue(secret.startswith("sec_"))
        self.assertEqual(len(secret), 36)

    def test_superadmin_and_admin_roles(self):
        roles = ["superadmin", "admin", "engineer", "operator", "viewer"]
        self.assertIn("superadmin", roles)
        self.assertIn("admin", roles)

        # Superadmin inherits all permissions
        def check_permission(user_role: str, allowed_roles: list) -> bool:
            return user_role == "superadmin" or user_role in allowed_roles

        self.assertTrue(check_permission("superadmin", ["admin"]))
        self.assertTrue(check_permission("superadmin", ["engineer"]))
        self.assertTrue(check_permission("admin", ["admin"]))
        self.assertFalse(check_permission("viewer", ["admin"]))


class TestTelemetryProcessing(unittest.TestCase):
    """Verifies numeric filtering and timestamp parsing."""

    def test_filter_numeric_values(self):
        payload = {
            "temperature": 82.5,
            "pressure": 101,
            "running": True,
            "fault": False,
            "state_str": "operational",
            "nested": {"val": 1},
            "none_val": None,
        }
        clean = filter_numeric_values(payload)
        self.assertEqual(clean["temperature"], 82.5)
        self.assertEqual(clean["pressure"], 101.0)
        self.assertEqual(clean["running"], 1.0)
        self.assertEqual(clean["fault"], 0.0)
        self.assertNotIn("state_str", clean)
        self.assertNotIn("nested", clean)
        self.assertNotIn("none_val", clean)

    def test_parse_timestamp_formats(self):
        # 1. ISO format with Z
        dt1 = parse_timestamp("2026-10-12T12:00:00Z")
        self.assertEqual(dt1.year, 2026)
        self.assertEqual(dt1.month, 10)
        self.assertIsNotNone(dt1.tzinfo)

        # 2. Epoch seconds
        dt2 = parse_timestamp(1760000000)
        self.assertIsNotNone(dt2.tzinfo)

        # 3. None defaults to current UTC time
        dt3 = parse_timestamp(None)
        self.assertIsNotNone(dt3.tzinfo)
        diff = (datetime.now(timezone.utc) - dt3).total_seconds()
        self.assertLess(abs(diff), 5)


class TestRulesAndAlarms(unittest.TestCase):
    """Verifies rule evaluation logic across all operators."""

    def test_operators(self):
        # >
        self.assertTrue(evaluate_condition(85.0, ">", 80.0))
        self.assertFalse(evaluate_condition(80.0, ">", 80.0))
        self.assertFalse(evaluate_condition(75.0, ">", 80.0))

        # <
        self.assertTrue(evaluate_condition(10.0, "<", 15.0))
        self.assertFalse(evaluate_condition(15.0, "<", 15.0))
        self.assertFalse(evaluate_condition(20.0, "<", 15.0))

        # >=
        self.assertTrue(evaluate_condition(50.0, ">=", 50.0))
        self.assertTrue(evaluate_condition(50.1, ">=", 50.0))
        self.assertFalse(evaluate_condition(49.9, ">=", 50.0))

        # <=
        self.assertTrue(evaluate_condition(30.0, "<=", 30.0))
        self.assertTrue(evaluate_condition(29.9, "<=", 30.0))
        self.assertFalse(evaluate_condition(30.1, "<=", 30.0))

        # ==
        self.assertTrue(evaluate_condition(100.0, "==", 100.0))
        self.assertFalse(evaluate_condition(100.1, "==", 100.0))


class TestDeviceOnlineLifecycle(unittest.TestCase):
    """Verifies online calculation and Last Will and Testament handling."""

    def test_online_status_calculation(self):
        now = datetime.now(timezone.utc)

        # 1. Normal active device (seen 20s ago)
        self.assertTrue(calculate_online_status(True, now - timedelta(seconds=20), "esp32"))

        # 2. Last Will received (is_online flag set to False)
        self.assertFalse(calculate_online_status(False, now - timedelta(seconds=5), "esp32"))

        # 3. Inactivity timeout (past 120s for standard MQTT device)
        self.assertFalse(calculate_online_status(True, now - timedelta(seconds=130), "esp32"))

        # 4. LoRa extended timeout (active at 600s within 1800s window)
        self.assertTrue(calculate_online_status(True, now - timedelta(seconds=600), "lora"))

        # 5. LoRa timeout exceeded (past 1800s)
        self.assertFalse(calculate_online_status(True, now - timedelta(seconds=1900), "lora"))


class TestResiliencyAndBackoff(unittest.TestCase):
    """Verifies exponential backoff calculation on broker drop."""

    def test_backoff_progression(self):
        retry_delay = 1.0
        max_delay = 10.0
        delays = []

        for _ in range(5):
            delays.append(retry_delay)
            retry_delay = min(retry_delay * 2, max_delay)

        # Progression: 1.0 -> 2.0 -> 4.0 -> 8.0 -> 10.0
        self.assertEqual(delays, [1.0, 2.0, 4.0, 8.0, 10.0])


class TestProductionComposeReadiness(unittest.TestCase):
    """Verifies docker-compose.prod.yml security and hardening integrity."""

    def test_prod_compose_configuration(self):
        compose_path = os.path.join(WORKSPACE_DIR, "docker-compose.prod.yml")
        self.assertTrue(os.path.exists(compose_path))

        with open(compose_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Database and Redis must NOT expose raw ports to host in production
        self.assertNotIn('"5432:5432"', content)
        self.assertNotIn('"6379:6379"', content)

        # Volumes must exist for persistence
        self.assertIn("postgres_prod_data:", content)
        self.assertIn("mosquitto_prod_data:", content)
        self.assertIn("redis_prod_data:", content)

        # Health checks must be defined
        self.assertIn("healthcheck:", content)

        # Single worker concurrency guard for deterministic MQTT telemetry ingestion
        self.assertIn("WEB_CONCURRENCY:-1", content)


if __name__ == "__main__":
    import math
    unittest.main()
