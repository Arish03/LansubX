#!/usr/bin/env python3
"""
Lansub X: End-to-End Acceptance Test Suite (Milestone 6)
Verifies core acceptance criteria defined in MVP.md and PRD.md:
1. Health & DB readiness
2. Auth & Admin assignment (FR-A1)
3. Tenant isolation & owner scoping (FR-D7, FR-L2)
4. Device creation & secret provisioning (FR-D2, FR-D3)
5. MQTT Telemetry ingestion to DB (FR-I1, FR-T1)
6. Alarm engine trigger & auto-resolve (FR-R1, FR-R4)
7. Remote command dispatch & ack tracking (FR-C1, FR-C3)

Built using Python standard library (urllib) for universal execution
without requiring external pip dependencies on host environments.
"""

import asyncio
import importlib
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))
MQTT_USER = os.getenv("MQTT_BACKEND_USERNAME", "backend")
MQTT_PASS = os.getenv("MQTT_BACKEND_PASSWORD", "backend_secure_pass_123")

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"


class RestClient:
    """Zero-dependency HTTP client using Python's standard library."""
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def request(self, method: str, path: str, json_data=None, headers=None):
        url = f"{self.base_url}{path}"
        req_headers = {"User-Agent": "LansubX-Acceptance/1.0"}
        if headers:
            req_headers.update(headers)

        body_bytes = None
        if json_data is not None:
            body_bytes = json.dumps(json_data).encode("utf-8")
            req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                code = resp.getcode()
                raw = resp.read().decode("utf-8", errors="replace")
                try:
                    parsed = json.loads(raw) if raw else {}
                except Exception:
                    parsed = raw
                return code, parsed
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw) if raw else {}
            except Exception:
                parsed = raw
            return err.code, parsed
        except Exception as e:
            return 0, {"error": str(e)}

    def get(self, path: str, headers=None):
        return self.request("GET", path, headers=headers)

    def post(self, path: str, json_data=None, headers=None):
        return self.request("POST", path, json_data=json_data, headers=headers)


def get_aiomqtt_module():
    try:
        return importlib.import_module("aiomqtt")
    except ImportError:
        return None


async def publish_mqtt_message(topic: str, payload_dict: dict):
    """
    Publishes to MQTT using aiomqtt if installed, or falls back to
    mosquitto_pub / docker compose exec mosquitto.
    """
    aiomqtt_mod = get_aiomqtt_module()
    payload_str = json.dumps(payload_dict)

    if aiomqtt_mod is not None:
        async with aiomqtt_mod.Client(
            hostname=MQTT_HOST,
            port=MQTT_PORT,
            username=MQTT_USER,
            password=MQTT_PASS,
            identifier=f"acceptance_pub_{int(time.time() * 1000) % 100000}",
        ) as client:
            await client.publish(topic, payload_str, qos=0)
            return True

    # Fallback: invoke mosquitto_pub via docker or system
    try:
        cmd = [
            "docker", "compose", "exec", "-T", "mosquitto",
            "mosquitto_pub",
            "-h", "localhost",
            "-u", MQTT_USER,
            "-P", MQTT_PASS,
            "-t", topic,
            "-m", payload_str,
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=5)
        if res.returncode == 0:
            return True
    except Exception:
        pass

    try:
        cmd_local = [
            "mosquitto_pub",
            "-h", MQTT_HOST,
            "-p", str(MQTT_PORT),
            "-u", MQTT_USER,
            "-P", MQTT_PASS,
            "-t", topic,
            "-m", payload_str,
        ]
        res = subprocess.run(cmd_local, capture_output=True, timeout=5)
        return res.returncode == 0
    except Exception:
        return False


class AcceptanceRunner:
    def __init__(self):
        self.http = RestClient(API_BASE)
        self.admin_token = None
        self.user_b_token = None
        self.test_device = None
        self.passed_tests = 0
        self.failed_tests = 0

    def record_result(self, test_name: str, passed: bool, detail: str = ""):
        if passed:
            self.passed_tests += 1
            print(f"[{PASS}] {test_name} {f'({detail})' if detail else ''}")
        else:
            self.failed_tests += 1
            print(f"[{FAIL}] {test_name}: {detail}")

    async def run_all(self):
        print("\n=======================================================")
        print("  LANSUB X: END-TO-END SYSTEM ACCEPTANCE TEST SUITE")
        print("=======================================================\n")

        await self.test_health_check()
        await self.test_first_admin_registration()
        await self.test_registration_guard()
        await self.test_device_creation()
        await self.test_multi_tenant_isolation()
        await self.test_telemetry_ingestion()
        await self.test_alarm_lifecycle()
        await self.test_command_dispatch_and_ack()

        print("\n-------------------------------------------------------")
        print(f"Summary: {self.passed_tests} PASSED, {self.failed_tests} FAILED")
        print("-------------------------------------------------------\n")
        return self.failed_tests == 0

    async def test_health_check(self):
        code, data = self.http.get("/health")
        ok = code == 200 and isinstance(data, dict) and data.get("database") == "ok"
        self.record_result("1. System Health & Database Connection", ok, f"status={code}")

    async def test_first_admin_registration(self):
        email = f"admin_{int(time.time())}@lansubx.lan"
        password = "AdminSecurePassword123!"
        code, data = self.http.post("/auth/register", {"email": email, "password": password})
        if code == 200 and isinstance(data, dict):
            self.admin_token = data.get("access_token")
            role = data.get("user", {}).get("role")
            self.record_result("2. First Registered User Becomes Admin (FR-A1)", role == "admin", f"role={role}")
        else:
            # Login if user already exists
            code_log, data_log = self.http.post("/auth/login", {"email": email, "password": password})
            ok = code_log == 200 and isinstance(data_log, dict)
            if ok:
                self.admin_token = data_log.get("access_token")
            self.record_result("2. Admin Authentication", ok, f"status={code_log}")

    async def test_registration_guard(self):
        # Subsequent registration without active admin token must be rejected with 403 Forbidden
        intruder_email = f"intruder_{int(time.time())}@external.lan"
        code, _ = self.http.post("/auth/register", {"email": intruder_email, "password": "Password123!"})
        ok = code == 403
        self.record_result("3. Public Registration Closed After Admin (FR-A1)", ok, f"code={code}")

    async def test_device_creation(self):
        if not self.admin_token:
            self.record_result("4. Direct Device Provisioning", False, "Missing admin token")
            return
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        payload = {"name": "Acceptance Test ESP32", "kind": "esp32"}
        code, dev = self.http.post("/devices", payload, headers=headers)
        if code == 201 and isinstance(dev, dict):
            self.test_device = dev
            has_key = dev.get("device_key", "").startswith("dev_")
            has_secret = bool(dev.get("secret", "").startswith("sec_"))
            ok = has_key and has_secret
            self.record_result("4. Direct Device Provisioning & One-Time Secret (FR-D2, FR-D3)", ok, f"key={dev.get('device_key')}")
        else:
            self.record_result("4. Direct Device Provisioning", False, f"status={code}")

    async def test_multi_tenant_isolation(self):
        if not self.test_device or not self.admin_token:
            self.record_result("5. Zero Cross-Tenant Data Leaks", False, "Pre-conditions not met")
            return
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        user_b_email = f"operator_b_{int(time.time())}@plant.lan"
        code_b, reg_b = self.http.post(
            "/auth/register",
            {"email": user_b_email, "password": "OperatorPass123!"},
            headers=headers_admin,
        )
        if code_b != 200 or not isinstance(reg_b, dict):
            self.record_result("5. Zero Cross-Tenant Data Leaks", False, "Could not register User B")
            return

        token_b = reg_b.get("access_token")
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User B attempts to access User A's device
        code_dev, _ = self.http.get(f"/devices/{self.test_device['id']}", headers=headers_b)
        is_isolated = code_dev == 404
        self.record_result("5. Zero Cross-Tenant Data Leaks (FR-D7, FR-L2)", is_isolated, f"User B access code={code_dev}")

    async def test_telemetry_ingestion(self):
        if not self.test_device:
            self.record_result("6. MQTT Telemetry Ingestion", False, "No test device")
            return
        device_key = self.test_device["device_key"]
        device_id = self.test_device["id"]

        test_val = 74.2
        topic = f"lansubx/{device_key}/telemetry"
        payload = {"values": {"temperature": test_val}}

        pub_ok = await publish_mqtt_message(topic, payload)
        if not pub_ok:
            self.record_result("6. MQTT Telemetry Ingestion", False, "Could not publish to MQTT broker")
            return

        # Give ingestion pipeline a short moment to write to DB
        await asyncio.sleep(0.8)

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        code, data = self.http.get(f"/devices/{device_id}/telemetry/latest", headers=headers)
        if code == 200 and isinstance(data, dict):
            val = data.get("temperature", {}).get("value")
            ok = val == test_val
            self.record_result("6. MQTT Telemetry Ingestion to Database <1s (NFR-1, FR-I1)", ok, f"stored value={val}")
        else:
            self.record_result("6. MQTT Telemetry Ingestion", False, f"status={code}")

    async def test_alarm_lifecycle(self):
        if not self.test_device:
            self.record_result("7. Alarm Engine Lifecycle", False, "No test device")
            return
        device_id = self.test_device["id"]
        device_key = self.test_device["device_key"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. Create rule
        code_rule, rule = self.http.post(
            "/rules",
            {
                "device_id": device_id,
                "metric": "temperature",
                "operator": ">",
                "threshold": 80.0,
                "severity": "critical",
                "debounce_seconds": 0,
            },
            headers=headers,
        )
        if code_rule != 201:
            self.record_result("7. Alarm Engine Lifecycle", False, f"Could not create rule: code={code_rule}")
            return

        # 2. Trigger violation (92.5 > 80.0)
        await publish_mqtt_message(f"lansubx/{device_key}/telemetry", {"values": {"temperature": 92.5}})
        await asyncio.sleep(0.5)

        _, active_alarms = self.http.get(f"/alarms?device_id={device_id}&state=active", headers=headers)
        opened = isinstance(active_alarms, list) and len(active_alarms) > 0

        # 3. Auto-resolve (70.0 <= 80.0)
        await publish_mqtt_message(f"lansubx/{device_key}/telemetry", {"values": {"temperature": 70.0}})
        await asyncio.sleep(0.5)

        _, resolved_alarms = self.http.get(f"/alarms?device_id={device_id}&state=resolved", headers=headers)
        resolved = isinstance(resolved_alarms, list) and len(resolved_alarms) > 0

        ok = opened and resolved
        self.record_result("7. Alarm Trigger & Auto-Resolution (FR-R2, FR-R4)", ok, f"opened={opened}, resolved={resolved}")

    async def test_command_dispatch_and_ack(self):
        if not self.test_device:
            self.record_result("8. Machine Remote Command", False, "No test device")
            return
        device_id = self.test_device["id"]
        device_key = self.test_device["device_key"]
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        # 1. Dispatch command
        code_cmd, cmd = self.http.post(
            f"/devices/{device_id}/commands",
            {"action": "set_fan_speed", "params": {"rpm": 1800}},
            headers=headers,
        )
        if code_cmd != 201 or not isinstance(cmd, dict):
            self.record_result("8. Machine Remote Command", False, f"status={code_cmd}")
            return

        cmd_id = cmd.get("id")
        initial_ok = cmd.get("status") == "sent"

        # 2. Acknowledge command from simulated device
        await publish_mqtt_message(
            f"lansubx/{device_key}/command/ack",
            {"id": cmd_id, "ok": True, "message": "Fan set to 1800 RPM"},
        )
        await asyncio.sleep(0.5)

        # 3. Check updated status
        _, cmd_list = self.http.get(f"/devices/{device_id}/commands", headers=headers)
        target = next((c for c in cmd_list if c["id"] == cmd_id), None) if isinstance(cmd_list, list) else None
        is_acked = target and target.get("status") == "acked"

        ok = initial_ok and is_acked
        self.record_result("8. Command Dispatch & Round-Trip Acked (FR-C1, FR-C3)", ok, f"status={target.get('status') if target else 'unknown'}")


if __name__ == "__main__":
    runner = AcceptanceRunner()
    success = asyncio.run(runner.run_all())
    sys.exit(0 if success else 1)
