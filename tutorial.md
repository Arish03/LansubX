# Lansub X: Complete Platform Tutorial & Guide

Welcome to the **Lansub X** tutorial! This guide provides a comprehensive, end-to-end walkthrough of what Lansub X is, how its architecture functions, and how to use it to collect industrial telemetry, configure alert rules, monitor machines in real time, and dispatch remote commands.

---

## Table of Contents

1. [What is Lansub X?](#1-what-is-lansub-x)
   - [The Problem Lansub X Solves](#the-problem-lansub-x-solves)
   - [Key Capabilities](#key-capabilities)
2. [Core Concepts & Terminology](#2-core-concepts--terminology)
3. [System Architecture & Data Pipelines](#3-system-architecture--data-pipelines)
   - [High-Level Architecture](#high-level-architecture)
   - [Telemetry Ingestion Pipeline](#telemetry-ingestion-pipeline)
   - [Command & Control Pipeline](#command--control-pipeline)
4. [Step-by-Step Hands-On Tutorial](#4-step-by-step-hands-on-tutorial)
   - [Step 1: Installation & Quick Launch](#step-1-installation--quick-launch)
   - [Step 2: Database Initialization & Default Accounts](#step-2-database-initialization--default-accounts)
   - [Step 3: Exploring the Operator Dashboard](#step-3-exploring-the-operator-dashboard)
   - [Step 4: Device Templates & Provisioning](#step-4-device-templates--provisioning)
   - [Step 5: Publishing Simulated Live Telemetry](#step-5-publishing-simulated-live-telemetry)
   - [Step 6: Configuring Alarm Rules & Notifications](#step-6-configuring-alarm-rules--notifications)
   - [Step 7: Dispatching Remote Commands & Handling ACKs](#step-7-dispatching-remote-commands--handling-acks)
5. [Working with Industrial Protocols](#5-working-with-industrial-protocols)
   - [Modbus TCP Protocol Bridge](#modbus-tcp-protocol-bridge)
   - [OPC UA Industrial Automation Bridge](#opc-ua-industrial-automation-bridge)
   - [LoRaWAN (ChirpStack) Bridge](#lorawan-chirpstack-bridge)
   - [The Multi-Protocol Factory Simulator](#the-multi-protocol-factory-simulator)
6. [Security, Roles & MQTT Access Control](#6-security-roles--mqtt-access-control)
7. [Developer & Operator Cheat Sheet](#7-developer--operator-cheat-sheet)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)
9. [Related Documentation Links](#9-related-documentation-links)

---

## 1. What is Lansub X?

**Lansub X** is an enterprise-grade, open-architecture **Industrial Internet of Things (IIoT)** telemetry, supervisory control, and alarm monitoring platform.

### The Problem Lansub X Solves

In manufacturing plants and industrial facilities, machinery is often heterogeneous:
- **Legacy Equipment:** Heavy machinery, chillers, and CNC routers communicating via legacy protocols like **Modbus TCP** (raw register addresses) or **OPC UA** (complex node hierarchies).
- **Long-Range Sensors:** Environmental probes and fluid level sensors operating over low-power **LoRaWAN** wireless networks.
- **Modern Edge Devices:** ESP32 controllers, smart meters, and edge PLCs communicating over **MQTT**.

Historically, aggregating telemetry from these disjoint sources required expensive proprietary SCADA suites. Lansub X unifies all these sources into a **single, secure real-time event pipeline**:

```
+-------------------------------------------------------------+
|                     Industrial Field Floor                  |
|  [Modbus Meters]     [OPC UA Machines]     [LoRaWAN Probes] |
+---------+--------------------+---------------------+--------+
          |                    |                     |
          +------------+-------+-------+-------------+
                       |               |
                       v               v
               +---------------+ +---------------+
               | Lansub Gateway| | Direct MQTT   | (e.g. ESP32)
               +-------+-------+ +-------+-------+
                       |                 |
                       +--------+--------+
                                |
                                v
               +---------------------------------+
               |   Lansub X Core Cloud / On-Prem |
               |     (MQTT, Redis, Postgres)     |
               +----------------+----------------+
                                |
                                v
               +---------------------------------+
               |     Real-Time Web Dashboard     |
               +---------------------------------+
```

### Key Capabilities

- **Unified Ingestion:** A single MQTT contract standardizes all field telemetry into clean JSON payloads.
- **Sub-Second Live Streaming:** Combines Redis Pub/Sub with WebSockets to deliver live, animated sensor charts directly to the browser with zero polling lag.
- **Automated Alarm Engine:** Dynamic condition evaluation (`>`, `<`, `>=`, `<=`, `==`, `!=`) triggers visual alerts, logs incident timelines, and dispatches notifications when thresholds are breached.
- **Bidirectional Control:** Operators can trigger remote commands (valves, emergency stops, reboots, setpoints) with cryptographically secure delivery and execution confirmation (ACKs).
- **Multi-Tenant Security:** Role-based access control (Superadmin, Admin, Operator, Viewer) with per-device MQTT Access Control Lists (ACL).

---

## 2. Core Concepts & Terminology

Understanding these core primitives will make working with Lansub X straightforward:

| Concept | Description |
|---|---|
| **Device Key (`device_key`)** | A unique, immutable alphanumeric identifier (e.g., `esp32-press-01`, `chiller-modbus-01`) used as the primary routing key for MQTT topics and database records. |
| **Device Template** | A blueprint defining the telemetry schema (metrics, units, min/max limits) and supported remote commands for a class of machines. Devices inherit their configuration from templates. |
| **Gateway** | A lightweight protocol translation service that polls industrial protocols (Modbus, OPC UA, ChirpStack) and forwards normalized data to the central Mosquitto MQTT broker. |
| **Telemetry Payload** | A JSON object containing numeric metric values and an optional ISO timestamp sent from a machine or gateway. |
| **Status & LWT** | Heartbeat messages published to indicate device health. Devices register an MQTT **Last Will and Testament (LWT)** to notify the platform instantly if a connection drops unexpectedly. |
| **Alarm Rule** | An automated policy configured on a metric (e.g., `pressure > 85.0 PSI for 30s`) that produces active alarms and notifications. |
| **Remote Command & ACK** | An instruction dispatched from the UI to a device (e.g., `open_valve`, `reboot`). The device executes the action and replies with an acknowledgement (`ACK`). |

---

## 3. System Architecture & Data Pipelines

Lansub X follows a modular micro-service pattern designed for high throughput, fault tolerance, and clear separation of concerns.

### High-Level Architecture

```
  +-----------------------------------------------------------------+
  |                        FIELD INGESTION                          |
  |  [Modbus Gateway]        [OPC UA Gateway]      [Direct MQTT]    |
  |    (pymodbus)               (asyncua)             (ESP32)       |
  +--------+------------------------+--------------------+----------+
           |                        |                    |
           +------------------------+--------------------+
                                    |
                                    v
  +-----------------------------------------------------------------+
  |                       MOSQUITTO BROKER                          |
  |             Port 1883 (Plain) / Port 8883 (MQTTS TLS)           |
  |              - Per-device username/password & ACLs              |
  +---------------------------------+-------------------------------+
                                    |
                                    v
  +-----------------------------------------------------------------+
  |                   FASTAPI BACKEND & WORKER                      |
  |                                                                 |
  |   +-----------------------+           +----------------------+  |
  |   |   MQTT Worker Loop    |           |   REST API & Auth    |  |
  |   | (aiomqtt background)  |           | (JWT Token Security) |  |
  |   +-----------+-----------+           +----------+-----------+  |
  |               |                                  |              |
  |       +-------+-------+                  +-------+-------+      |
  |       v               v                  v               v      |
  |  [PostgreSQL]    [Redis Bus]       [PostgreSQL]    [Redis Bus]  |
  |  (Historical)    (Live Stream)     (State/Users)   (Pub/Sub)    |
  |                       |                                         |
  |                       v                                         |
  |              [WebSocket Server] (/ws/live)                      |
  +-----------------------+-----------------------------------------+
                          |
                          v
  +-----------------------------------------------------------------+
  |                      NEXT.JS DASHBOARD                          |
  |       Port 6001 - React 18, TailwindCSS, Recharts, SWR          |
  +-----------------------------------------------------------------+
```

### Telemetry Ingestion Pipeline

1. **Publish:** A device or gateway publishes telemetry to:
   ```
   lansubx/{device_key}/telemetry
   ```
2. **Authorize:** Mosquitto verifies the client's credentials and ACL (a device can only publish to its own topic).
3. **Ingest:** The FastAPI backend's persistent background worker (`mqtt_worker.py`) receives the payload.
4. **Persist:** The worker inserts the record into **PostgreSQL** in `telemetry_readings` for historical audit and reporting.
5. **Evaluate Rules:** The worker evaluates all active **Alarm Rules** for that device. If a metric breaches a threshold, an alarm is triggered and logged to `alarms`.
6. **Fan-Out:** The reading is published to the **Redis Pub/Sub** bus (`lansubx:live:{device_key}`).
7. **Broadcast:** The WebSocket server pushes the reading immediately to connected Next.js browser sessions.

### Command & Control Pipeline

1. **User Action:** An operator clicks a button (e.g., "Start Motor") in the Next.js UI.
2. **API Request:** Next.js sends an authenticated `POST /api/v1/commands` to FastAPI.
3. **Database Log:** FastAPI records the command with state `pending`.
4. **MQTT Dispatch:** FastAPI publishes the command payload to:
   ```
   lansubx/{device_key}/command
   ```
5. **Execution & Response:** The physical machine or gateway receives the command, executes it, and sends back an ACK to:
   ```
   lansubx/{device_key}/command/ack
   ```
6. **Confirmation:** The MQTT worker receives the ACK, updates the command status to `delivered`/`failed`, and notifies the frontend via WebSocket.

---

## 4. Step-by-Step Hands-On Tutorial

Follow this step-by-step tutorial to get Lansub X running from scratch on your machine.

### Step 1: Installation & Quick Launch

#### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- [Git](https://git-scm.com/) installed.

#### Launching the Stack
Clone the repository and spin up the complete environment using Docker Compose:

```bash
# 1. Clone the project repository
git clone https://github.com/Arish03/LansubX.git
cd LansubX

# 2. Set up environment variables from the template
cp .env.example .env

# 3. Build and run all services in detached mode
docker compose up -d --build
```

> [!TIP]
> This command boots 5 isolated containers:
> - **PostgreSQL 16** (mapped to port `5441`)
> - **Redis 7** (mapped to port `6385`)
> - **Mosquitto 2.0** (mapped to port `1883`)
> - **FastAPI Backend** (mapped to port `6500`)
> - **Next.js Web Dashboard** (mapped to port `6001`)

---

### Step 2: Database Initialization & Default Accounts

Once the containers are healthy, execute the database seed script to apply migrations, create default templates, and configure initial user accounts:

```bash
docker compose exec backend python -m app.seed
```

#### Pre-Configured Administrative Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Superadmin** | `superadmin@lansubx.io` | `SuperAdmin123!` | System configuration, user management, audit logs |
| **Admin** | `admin@lansubx.io` | `AdminPassword123!` | Device onboarding, alarm rules, command execution |

---

### Step 3: Exploring the Operator Dashboard

Open your web browser and navigate to:
👉 **[http://localhost:6001](http://localhost:6001)**

1. Sign in with `admin@lansubx.io` and `AdminPassword123!`.
2. You will be greeted by the **System Overview Dashboard**, featuring:
   - **Active Machine Counter:** Live count of online vs. offline machines.
   - **Critical Alarm Banner:** Immediate alert notifications.
   - **Device Inventory Table:** Real-time telemetry snapshots and quick-action links.

---

### Step 4: Device Templates & Provisioning

Before an IoT device can send data, it needs a **Template** and a **Device Registration**.

#### 1. Device Templates
Navigate to **Templates** in the navigation bar. You will see pre-seeded templates:
- **ESP32 Environmental Sensor:** (Metrics: `temperature`, `humidity`, `battery`, `heap_free`)
- **Industrial Sensor Controller:** (Metrics: `tank_level`, `flow_rate`, `inlet_pressure`, `outlet_pressure`)
- **Modbus Heavy Machinery:** (Metrics: `motor_speed`, `motor_current`, `vibration`, `power`)

#### 2. Provisioning a New Device
1. Navigate to **Devices** > Click **"+ Provision New Device"**.
2. Fill out the device attributes:
   - **Device Name:** `Assembly Line Pressure Sensor`
   - **Device Key:** `sensor-press-01` *(must be unique and URL-friendly)*
   - **Template:** Select *Industrial Sensor Controller*
   - **Protocol:** `mqtt`
3. Click **Create Device**.

---

### Step 5: Publishing Simulated Live Telemetry

To test data flow, you can simulate an IoT device publishing telemetry over MQTT.

#### Using `mosquitto_pub` CLI
If you have the Mosquitto client tools installed locally:

```bash
# Register MQTT credentials for your device (run inside container or via script):
docker compose exec mosquitto mosquitto_passwd -b /mosquitto/config/passwd sensor-press-01 Pass123!

# Publish simulated telemetry
mosquitto_pub -h localhost -p 1883 \
  -u "sensor-press-01" -P "Pass123!" \
  -t "lansubx/sensor-press-01/telemetry" \
  -m '{"values": {"tank_level": 74.5, "flow_rate": 18.2, "inlet_pressure": 42.0, "outlet_pressure": 38.5}}'
```

#### Using Python
Alternatively, publish using a lightweight Python script (`paho-mqtt`):

```python
import json
import time
import paho.mqtt.client as mqtt

client = mqtt.Client(client_id="sim-sensor")
client.username_pw_set("sensor-press-01", "Pass123!")
client.connect("localhost", 1883, 60)

print("Publishing telemetry...")
while True:
    payload = {
        "values": {
            "tank_level": 75.0,
            "flow_rate": 20.5,
            "inlet_pressure": 45.2,
            "outlet_pressure": 41.0
        }
    }
    client.publish("lansubx/sensor-press-01/telemetry", json.dumps(payload))
    time.sleep(2)
```

Now look at the **Device Detail Page** in the web dashboard: the live chart will immediately animate, updating in real time as points stream in!

---

### Step 6: Configuring Alarm Rules & Notifications

Lansub X allows you to set automated thresholds on any telemetry metric.

1. Navigate to **Alarm Rules** > Click **"+ Create Rule"**.
2. Select your device: `Assembly Line Pressure Sensor` (`sensor-press-01`).
3. Set the rule parameters:
   - **Metric:** `inlet_pressure`
   - **Condition:** `>`
   - **Threshold:** `50.0`
   - **Severity:** `Critical`
   - **Message:** `High Inlet Pressure Detected on Assembly Line!`
4. Click **Save Rule**.

#### Testing the Alarm
Publish a reading that exceeds `50.0`:

```bash
mosquitto_pub -h localhost -p 1883 \
  -u "sensor-press-01" -P "Pass123!" \
  -t "lansubx/sensor-press-01/telemetry" \
  -m '{"values": {"inlet_pressure": 55.4}}'
```

Within milliseconds:
- The top banner turns red with an **Active Critical Alarm**.
- An entry is logged in the **Alarms** tab with timestamp and severity.
- Operators can review the event and click **Acknowledge** or **Resolve**.

---

### Step 7: Dispatching Remote Commands & Handling ACKs

Lansub X supports supervisory remote control.

1. On the **Device Detail Page**, locate the **Remote Commands** panel.
2. Select an action from the dropdown (e.g., `open_valve`).
3. Enter optional parameters: `{"valve_id": 1, "percentage": 100}`.
4. Click **Send Command**.

The command is published to MQTT topic `lansubx/sensor-press-01/command`. The device executes the command and confirms with an ACK:

```bash
# Simulated Device ACK
mosquitto_pub -h localhost -p 1883 \
  -u "sensor-press-01" -P "Pass123!" \
  -t "lansubx/sensor-press-01/command/ack" \
  -m '{"id": 1, "ok": true, "message": "Valve 1 opened to 100%"}'
```

The UI instantly reflects the command status as **Delivered & Confirmed** with a green checkmark.

---

## 5. Working with Industrial Protocols

One of Lansub X's primary strengths is native support for standard factory floor protocols via lightweight gateway adapters.

### Modbus TCP Protocol Bridge

Modbus TCP communicates over TCP port `502` using 16-bit register addresses.

The Lansub X Modbus Gateway:
1. Connects to the Modbus PLC at `plc_ip:502`.
2. Reads holding registers (e.g., register `0` = temperature, register `1` = pressure).
3. Applies configured scale factors (e.g., divide raw integer by 10.0 to get float).
4. Packages the values into standard JSON and publishes to `lansubx/{device_key}/telemetry`.

```yaml
# Sample Gateway Configuration snippet (gateway/config.yaml)
modbus_devices:
  - device_key: "chiller-unit-01"
    host: "192.168.1.50"
    port: 502
    poll_interval_seconds: 2
    registers:
      - name: "temperature"
        address: 0
        scale: 0.1
      - name: "pressure"
        address: 1
        scale: 0.01
```

### OPC UA Industrial Automation Bridge

OPC UA is the standard for modern automated manufacturing (e.g., Siemens S7-1500, Beckhoff TwinCAT, Rockwell Automation).

The Lansub X OPC UA Gateway:
1. Establishes a secure session at `opc.tcp://machinery_ip:4840`.
2. Subscribes to monitored items using Node IDs (e.g., `ns=2;s=SpindleSpeed`).
3. Dispatches change notifications over MQTT instantly.

### LoRaWAN (ChirpStack) Bridge

For long-range battery-operated sensors in large warehouses or outdoor yards:
1. LoRaWAN gateways forward packets to a **ChirpStack** Network Server.
2. ChirpStack publishes device uplinks to its MQTT integration topic:
   ```
   application/{app_id}/device/{dev_eui}/event/up
   ```
3. The Lansub X LoRa bridge unpacks the binary base64 payload, extracts engineering units, and forwards them to Lansub X.

### The Multi-Protocol Factory Simulator

Lansub X includes a built-in multi-protocol simulator designed for testing, development, and customer demonstrations without requiring physical hardware:

```bash
# Start Lansub X with the full Industrial Simulator enabled:
docker compose --profile sim up -d
```

The simulator automatically generates realistic factory operational cycles:
- Modbus holding registers (heating/cooling cycles, motor RPM variation).
- OPC UA monitored nodes (state changes, alarms).
- Direct MQTT telemetry streams.

---

## 6. Security, Roles & MQTT Access Control

Security is integrated at every tier of the Lansub X architecture:

### 1. Web & API Security
- **JWT (JSON Web Tokens):** All REST and WebSocket connections require signed, expiring Bearer tokens.
- **Role Hierarchy:**
  - `superadmin`: Global oversight, user provisioning, system maintenance.
  - `admin`: Device creation, alarm threshold setup, command dispatch.
  - `operator`: Live monitoring, acknowledging alarms, basic commands.
  - `viewer`: Read-only access to dashboards and historical charts.

### 2. MQTT Broker Access Control Lists (ACL)
Mosquitto is strictly configured to disallow anonymous connections (`allow_anonymous false`):

| Client Type | Topic Filter | Access Permission |
|---|---|---|
| **Backend Service** | `lansubx/#` | Read & Write (Full Broker Access) |
| **Industrial Gateway** | `lansubx/+/telemetry`, `+/status`, `+/command/ack` | Write Only |
| **Industrial Gateway** | `lansubx/+/command` | Read Only |
| **Edge Device (`%u`)** | `lansubx/%u/telemetry`, `lansubx/%u/status`, `lansubx/%u/command/ack` | Write Only to Own Topics |
| **Edge Device (`%u`)** | `lansubx/%u/command` | Read Only from Own Topic |

> [!IMPORTANT]
> The dynamic `%u` rule guarantees that a compromised IoT device cannot snoop on or publish fake data for another device in the plant.

---

## 7. Developer & Operator Cheat Sheet

### Common Docker Commands

```bash
# Check status of all containers
docker compose ps

# View real-time logs from the backend API and MQTT worker
docker compose logs -f backend

# View Mosquitto broker connection logs
docker compose logs -f mosquitto

# Restart a specific service
docker compose restart backend

# Stop all containers
docker compose down
```

### Running Automated Test Suites

Lansub X includes an automated release acceptance test verifying database persistence, MQTT ingestion, alarm triggering, and WebSocket broadcasting:

```bash
# Run acceptance test inside the backend container:
docker compose exec backend python -m unittest tests/test_acceptance_rc.py
```

### Local Bare-Metal Development (Without Docker for Code)

You can run Postgres, Redis, and Mosquitto in Docker while developing the backend and frontend directly on your host machine:

```bash
# 1. Start database and broker dependencies
docker compose up -d postgres redis mosquitto

# 2. Run Backend (Terminal 1)
cd backend
python -m venv venv
.\venv\Scripts\activate   # Windows (or source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 6500

# 3. Run Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

---

## 8. Troubleshooting & FAQ

### 1. Why is my device showing as "Offline"?
- **Check MQTT Keepalive:** Devices must periodically publish telemetry or heartbeat pings. The platform marks a device offline if no messages arrive within the configured timeout window (default: 60 seconds).
- **Check Last Will (LWT):** Ensure your device configures an LWT message pointing to `lansubx/{device_key}/status` with payload `{"online": false}`.

### 2. Why is telemetry not appearing in the live chart?
- **Verify MQTT Topic:** Ensure the topic format matches exactly: `lansubx/{device_key}/telemetry`.
- **Verify Payload Format:** Payloads must be valid JSON with a `"values"` dictionary of numeric keys:
  ```json
  {"values": {"metric_name": 12.34}}
  ```
- **Check WebSocket Connection:** Open your browser's developer console (F12) > **Network** > **WS**. Verify that `ws://localhost:6500/ws/live` connects with HTTP status `101 Switching Protocols`.

### 3. Port Conflicts on Windows or Linux
If ports `5432` or `6379` are already in use by local services, note that Lansub X deliberately binds to alternate host ports:
- PostgreSQL Host Port: `5441`
- Redis Host Port: `6385`
- Backend API Host Port: `6500`
- Web UI Host Port: `6001`

---

## 9. Related Documentation Links

For more details on specific components, refer to the documentation files in the repository:

- [README.md](file:///e:/LansubX/README.md) – Project overview, networking tables, and Azure deployment guide.
- [HOW_TO_USE.md](file:///e:/LansubX/HOW_TO_USE.md) – Detailed operator guide with UI walkthroughs.
- [ARCHITECTURE.md](file:///e:/LansubX/ARCHITECTURE.md) – Technical architectural specifications, database schema, and module design.
- [PRD.md](file:///e:/LansubX/PRD.md) – Product requirements and system goals.
- [docs/decisions.md](file:///e:/LansubX/docs/decisions.md) – Architecture decision records (ADRs) and protocol design rationale.
