# Lansub X: User & Operator Guide (HOW TO USE)

Welcome to **Lansub X**, an open, real-time Industrial IoT (IIoT) platform built for factory floor monitoring, alerting, and remote machine control. 

This guide walks you through setup, device provisioning, rule creation, live monitoring, and troubleshooting.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Quick Launch with Docker](#2-quick-launch-with-docker)
3. [Running Locally for Development](#3-running-locally-for-development)
4. [First-Time Walkthrough (The First 15 Minutes)](#4-first-time-walkthrough-the-first-15-minutes)
   - [Step 1: Create Your Admin Account](#step-1-create-your-admin-account)
   - [Step 2: Initialize Device Templates](#step-2-initialize-device-templates)
   - [Step 3: Provision a New Device](#step-3-provision-a-new-device)
   - [Step 4: Register Device Credentials in Mosquitto](#step-4-register-device-credentials-in-mosquitto)
   - [Step 5: Publish Live Telemetry](#step-5-publish-live-telemetry)
   - [Step 6: Configure Alarm Rules](#step-6-configure-alarm-rules)
   - [Step 7: Monitor via Web Dashboard](#step-7-monitor-via-web-dashboard)
   - [Step 8: Send Remote Commands](#step-8-send-remote-commands)
5. [Connecting Industrial Gateways](#5-connecting-industrial-gateways)
   - [Modbus TCP](#modbus-tcp)
   - [OPC UA](#opc-ua)
   - [LoRaWAN (ChirpStack)](#lorawan-chirpstack)
6. [Simulating Factory Equipment](#6-simulating-factory-equipment)
7. [Running Acceptance Tests](#7-running-acceptance-tests)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. Prerequisites

- **Docker Desktop** (version 24+ with Docker Compose v2)
- **Git**
- *(Optional for bare-metal dev)*:
  - Python 3.11+
  - Node.js 18+ & npm
  - Mosquitto clients (`mosquitto_sub`, `mosquitto_pub`)

---

## 2. Quick Launch with Docker

The fastest way to run Lansub X is via Docker Compose:

```bash
# 1. Copy the environment configuration
cp .env.example .env

# 2. Start all platform services (Postgres, Redis, Mosquitto, API, Web UI)
docker compose up -d --build

# 3. Seed starter device templates
docker compose exec backend python -m app.seed
```

### Accessing Platform Endpoints:
- **Web UI:** [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Swagger:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/health](http://localhost:8000/health)
- **MQTT Broker:** `localhost:1883`

---

## 3. Running Locally for Development

If you prefer running services outside containers while keeping DB and Broker in Docker:

```bash
# Start infrastructure only
docker compose up -d postgres redis mosquitto

# Backend (Terminal 1)
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

---

## 4. First-Time Walkthrough (The First 15 Minutes)

### Step 1: Create Your Admin Account
1. Open [http://localhost:3000/login](http://localhost:3000/login) in your browser.
2. Click **"Need an account? Register"**.
3. Register your email and password (e.g. `admin@lansubx.io` / `Password123!`).
4. **Automatic Admin Assignment:** The very first registered user in the database is automatically granted the `admin` role. Subsequent registrations are assigned the `operator` role.

---

### Step 2: Initialize Device Templates
Lansub X supports structured templates for common industrial equipment:
- `direct_esp32`: Direct MQTT sensor node (temperature, humidity, battery).
- `sensor_controller`: Multi-channel sensor controller (vibration, pressure, temperature).
- `modbus_tcp_meter`: Gateway-bridged energy & power analyzer.
- `opcua_cnc`: Gateway-bridged CNC machine / robotics controller.
- `lorawan_environmental`: ChirpStack LoRaWAN environmental sensor (30-min heartbeat).
- `plc_mqtt`: Direct MQTT industrial PLC (state, cycle time, fault flags).

To seed or refresh templates at any time:
```bash
docker compose exec backend python -m app.seed
```

---

### Step 3: Provision a New Device
1. Navigate to **Devices** ([http://localhost:3000/devices](http://localhost:3000/devices)).
2. Click **"Add Device"**.
3. Select a template (e.g. `ESP32 Sensor Node`).
4. Enter a name (e.g. `Furnace Monitor 1`) and a unique key (or leave blank to auto-generate, e.g. `dev_esp32_01`).
5. Click **Create Device**.
6. **Important Security Notice:** The modal will display a **One-Time Device Secret** (e.g. `sec_8f921...`). 
   - Store this secret securely. The backend only stores a cryptographic SHA-256 hash.

---

### Step 4: Register Device Credentials in Mosquitto
Direct MQTT devices authenticate with Mosquitto using their `device_key` as username and the secret generated in Step 3.

**On Linux / macOS:**
```bash
./scripts/add_mqtt_user.sh <device_key> <secret>
```

**On Windows PowerShell:**
```powershell
.\scripts\add_mqtt_user.ps1 <device_key> <secret>
```

*Example:*
```powershell
.\scripts\add_mqtt_user.ps1 dev_esp32_01 sec_8f921a9...
```
This updates Mosquitto's password file and dynamically reloads ACLs without dropping active broker connections.

---

### Step 5: Publish Live Telemetry

You can publish telemetry from hardware, a simulator, or `mosquitto_pub`:

#### Using Mosquitto CLI:
```bash
docker compose exec mosquitto mosquitto_pub \
  -h localhost \
  -u dev_esp32_01 \
  -P sec_8f921a9... \
  -t "lansubx/dev_esp32_01/telemetry" \
  -m '{"values":{"temperature":84.2,"humidity":45.1,"vibration":0.12}}'
```

#### MQTT Topic Contract:
| Topic | Purpose | Payload Schema |
|---|---|---|
| `lansubx/{device_key}/telemetry` | Telemetry Data | `{"ts": "2026-10-08T12:00:00Z (optional)", "values": {"metric_name": 123.4}}` |
| `lansubx/{device_key}/status` | Connection Status / LWT | `{"online": true}` or `{"online": false}` |
| `lansubx/{device_key}/command` | Inbound Platform Commands | `{"id": 42, "action": "set_valve", "value": 1}` |
| `lansubx/{device_key}/command/ack`| Command Acknowledgment | `{"id": 42, "ok": true, "error": null}` |

---

### Step 6: Configure Alarm Rules
1. Navigate to **Alarm Rules** ([http://localhost:3000/rules](http://localhost:3000/rules)).
2. Click **"New Rule"**.
3. Choose your device, enter a rule name (e.g. `High Furnace Temp`).
4. Select metric: `temperature`, condition: `>`, threshold: `80.0`.
5. Set **Debounce Period (seconds)**: e.g. `10` (the metric must stay above 80 for 10s before triggering).
6. Select **Severity**: `critical`.
7. Click **Save Rule**.

**Auto-Resolution:** When temperature drops back below `80.0`, the system automatically resolves the alarm and stamps the resolution timestamp.

---

### Step 7: Monitor via Web Dashboard
1. Open the **Dashboard** ([http://localhost:3000/dashboard](http://localhost:3000/dashboard)):
   - **Total Devices & Online Status**: Dynamically calculated based on last telemetry/status timestamps.
   - **Active Alarms Counter**: Color-coded by warning and critical levels.
   - **Commands Dispatched**: Status breakdown (pending, delivered, acknowledged, failed).
2. Click on any device to open the **Device Detail View**:
   - **Live Metric Cards**: Current temperature, humidity, pressure, etc.
   - **Real-Time Interactive Graph**: Live streaming time-series line chart (recharts) updating over WebSockets.
   - **Historical Selector**: View 1h, 6h, 24h, or 7d telemetry trends.

---

### Step 8: Send Remote Commands
1. In the **Device Detail View**, scroll to the **Remote Machine Commands** panel.
2. Select an action (e.g. `reboot`, `set_output`, `set_fan_speed`) and enter optional payload parameters.
3. Click **Dispatch Command**.
4. The command status will update in real-time:
   - `PENDING` -> Sent to database.
   - `DELIVERED` -> Emitted to Mosquitto topic `lansubx/{device_key}/command`.
   - `ACKNOWLEDGED` -> Device confirmed execution with `lansubx/{device_key}/command/ack`.
   - `EXPIRED` -> Automatically marked expired if no ACK is received within timeout (default 30s).

---

## 5. Connecting Industrial Gateways

For equipment that cannot run an MQTT client directly (legacy PLCs, power meters, OPC UA servers), Lansub X provides the **Protocol Gateway**:

```
[Modbus TCP / RS485] ----\
[OPC UA Server]      -----> [ Lansub X Gateway ] -----> [ Mosquitto MQTT ]
[LoRaWAN ChirpStack] ----/
```

### Starting the Gateway Container:
```bash
docker compose --profile gateway up -d
```

### Gateway Configuration (`gateway/config.yaml`):

#### Modbus TCP:
```yaml
modbus:
  enabled: true
  host: "simulator" # IP or hostname of PLC/meter
  port: 502
  devices:
    - device_key: "dev_modbus_meter"
      slave_id: 1
      poll_interval_sec: 2
      registers:
        - name: "active_power"
          type: "holding"
          address: 100
          scale: 0.1
        - name: "grid_frequency"
          type: "holding"
          address: 102
          scale: 0.01
```

#### OPC UA:
```yaml
opcua:
  enabled: true
  endpoint: "opc.tcp://simulator:4840"
  devices:
    - device_key: "dev_opcua_cnc"
      poll_interval_sec: 2
      nodes:
        - name: "spindle_speed"
          node_id: "ns=2;s=CNC.SpindleSpeed"
        - name: "axis_vibration"
          node_id: "ns=2;s=CNC.Vibration"
```

#### LoRaWAN (ChirpStack):
```yaml
chirpstack:
  enabled: true
  mqtt_broker: "mosquitto"
  uplink_topic: "application/+/device/+/event/up"
```

---

## 6. Simulating Factory Equipment

If you do not have physical hardware connected, you can run the built-in multi-protocol factory simulator:

```bash
docker compose --profile sim up -d
```

The simulator creates:
- A **Modbus TCP Server** on port 502 simulating energy meters and motor drives.
- An **OPC UA Server** on port 4840 (`opc.tcp://localhost:4840`) exposing industrial CNC and robot nodes.
- Direct **MQTT simulated sensors** emitting periodic temperature, humidity, and vibration readings with realistic industrial noise and occasional alarm spikes.

---

## 7. Running Acceptance Tests

Lansub X includes an automated end-to-end acceptance suite verifying all 8 core MVP requirements:

```bash
# Run against the running cluster
python scripts/acceptance_test.py
```

### Verified Acceptance Criteria:
1. System Health & Database connectivity (`/health`).
2. First-user Admin registration & password hashing.
3. Registration lock: public self-registration disabled once admin exists.
4. Device creation, template association, and one-time secret generation.
5. Strict tenant isolation (User B cannot view or control User A's devices).
6. MQTT Telemetry ingestion to PostgreSQL and Redis live stream.
7. Alarm engine threshold trigger, debouncing, and auto-resolution.
8. Remote machine command dispatch, MQTT routing, and ACK state transition.

---

## 8. Troubleshooting & FAQs

### Q: Why does my device show "Offline"?
- Standard MQTT devices are marked offline if no message is received within **120 seconds**.
- LoRaWAN devices have a longer battery-saving window of **1800 seconds (30 minutes)**.
- Ensure the device publishes a periodic status heartbeat or regular telemetry.

### Q: Mosquitto logs say `Connection Refused: not authorised`
- Ensure the device credentials have been added to Mosquitto:
  ```powershell
  .\scripts\add_mqtt_user.ps1 <device_key> <secret>
  ```
- Check that the topic matches the device ACL pattern: `lansubx/<device_key>/#`. Devices cannot publish to topics belonging to other device keys.

### Q: Live charts are not updating in the browser
- Check that Redis is running (`docker compose ps redis`).
- Verify that your browser can reach the WebSocket endpoint at `ws://localhost:8000/ws?token=<JWT_TOKEN>`.
- In the browser dev tools console, verify that no authentication errors are logged.

### Q: How do I reset the database to a clean state?
```bash
docker compose down -v
docker compose up -d
docker compose exec backend python -m app.seed
```
