# Lansub X: Industrial IoT Platform

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Mosquitto](https://img.shields.io/badge/Mosquitto-2.0-red.svg)](https://mosquitto.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

**Lansub X** is an enterprise-grade Industrial IoT (IIoT) telemetry, alerting, and supervisory control platform. It bridges legacy field machinery (**Modbus TCP**, **OPC UA**, **LoRaWAN ChirpStack**) and modern smart edge devices (**ESP32**, **PLCs**, **Sensor Controllers**) into a unified real-time event pipeline powered by MQTT, Redis Pub/Sub, PostgreSQL, FastAPI, and Next.js.

> 💡 **New to Lansub X?** Check out the complete **[tutorial.md](tutorial.md)** for a friendly architecture explainer and hands-on getting-started guide!
> 📖 **Operator & User Guide:** For an end-to-end guided walkthrough with screenshots, user creation, device provisioning, MQTT credentials, live streaming charts, and remote control, check out **[HOW_TO_USE.md](HOW_TO_USE.md)**.

---

## Table of Contents

- [1. Architecture Overview](#1-architecture-overview)
- [2. Platform Networking & Port Map](#2-platform-networking--port-map)
- [3. Azure VM Network Security Group (NSG) Configuration](#3-azure-vm-network-security-group-nsg-configuration)
- [4. Default Platform Credentials](#4-default-platform-credentials)
- [5. Quick Start (Docker Compose)](#5-quick-start-docker-compose)
- [6. Industrial Protocols & Simulator](#6-industrial-protocols--simulator)
- [7. MQTT Topic & Payload Contracts](#7-mqtt-topic--payload-contracts)
- [8. Real-Time Telemetry & Alarm Engine](#8-real-time-telemetry--alarm-engine)
- [9. Running Locally for Development](#9-running-locally-for-development)
- [10. Production Deployment & Hardening](#10-production-deployment--hardening)
- [11. Acceptance Testing & Verification](#11-acceptance-testing--verification)
- [12. Repository Structure](#12-repository-structure)
- [13. Documentation Index](#13-documentation-index)

---

## 1. Architecture Overview

```
 [ Field Machinery & Direct Sensors ]
 +------------------+   +-------------------+   +--------------------+
 | Modbus TCP Meter |   | OPC UA CNC Machine|   | ChirpStack LoRaWAN |
 +--------+---------+   +---------+---------+   +---------+----------+
          |                       |                       |
          +---------> [ Lansub X Gateway ] <--------------+
                             |  (MQTT Bridge)
 +--------------------+      |
 | Direct MQTT Device | -----+
 | (ESP32, PLCs)      |
 +--------------------+
          |
          v
 +---------------------------------------------------------------+
 |                     Mosquitto MQTT Broker                    |
 |                    (Port 1883 / TLS 8883)                    |
 +-------------------------------+-------------------------------+
                                 |
                                 v
 +---------------------------------------------------------------+
 |                FastAPI Backend (Port 6500)                    |
 |                                                               |
 |  +-----------------------+         +-----------------------+  |
 |  | MQTT Telemetry Worker |         | REST API & Auth Engine|  |
 |  +-----------+-----------+         +-----------+-----------+  |
 |              |                                 |              |
 |              v                                 v              |
 |      [ PostgreSQL 16 ]                 [ Redis Pub/Sub ]      |
 |      (Storage: 5441)                   (Live Bus: 6385)       |
 |                                                |              |
 |                                                v              |
 |                                        [ WebSocket Server ]   |
 +------------------------------------------------+--------------+
                                                  |
                                                  v
 +---------------------------------------------------------------+
 |                  Next.js Dashboard (Port 6001)                |
 |    - Live Streaming Charts          - Active Alarm Banners    |
 |    - Remote Command Dispatch        - Multi-Tenant Isolation |
 +---------------------------------------------------------------+
```

---

## 2. Platform Networking & Port Map

Lansub X uses a standardized, non-conflicting port mapping layout:

| Layer | Port | Protocol | Service / Component | Visibility / Role |
|---|---|---|---|---|
| **User & Operator Interfaces** | **`6001`** | HTTP | **Web Browser Dashboard** (Next.js) | Public / Operator Browser |
| | **`6500`** | HTTP / WS | **REST API & WebSocket Live Stream** (FastAPI) | Public / Client REST & WS |
| **Data Ingestion Bus** | **`1883`** | TCP | **Mosquitto MQTT Broker** (Plain) | Public / Factory Devices |
| | **`8883`** | TCP (TLS) | **Mosquitto MQTT Broker** (Encrypted) | Optional MQTTS |
| **Infrastructure (Internal)** | **`5441`** | TCP | **PostgreSQL Database** | Host mapped (`5441:5432`) / Internal |
| | **`6385`** | TCP | **Redis Live Stream & State Cache** | Host mapped (`6385:6379`) / Internal |
| **Industrial Field Protocols** | **`502`** | TCP | **Modbus TCP Machinery** (Simulator/Gateway) | Field / Industrial Devices |
| | **`4840`** | TCP | **OPC UA Automated Equipment** (`opc.tcp://`) | Field / Industrial Automation |

---

## 3. Azure VM Network Security Group (NSG) Configuration

When deploying Lansub X to an **Azure Virtual Machine**, configure your **Network Security Group (NSG) Inbound Security Rules** as follows:

### Summary: How Many Ports to Add in Azure NSG?
- **Standard Cloud Deployment:** **4 Inbound Ports** (`22`, `6001`, `6500`, `1883`)
- **With Encrypted MQTT (TLS):** **5 Inbound Ports** (`22`, `6001`, `6500`, `1883`, `8883`)
- **With Field Gateway / Simulator Exposed to Factory Network:** **Up to 7 Inbound Ports** (`+ 502`, `+ 4840`)
- **Strictly Prohibited on Public Internet:** `5441` (Postgres) and `6385` (Redis) must **NEVER** be opened to `0.0.0.0/0`.

### Recommended Azure Inbound Security Rules Table

| Priority | Rule Name | Port / Range | Protocol | Source | Destination | Action | Purpose / Rationale |
|:---:|---|---|:---:|---|---|:---:|---|
| **100** | `Allow-SSH-Admin` | `22` | TCP | `My_IP_Address` *(or VPN)* | Any | **Allow** | VM terminal administration. Restrict to admin IP. |
| **200** | `Allow-HTTP-Dashboard` | `6001` | TCP | `Internet` *(or Corporate IP)* | Any | **Allow** | Web browser access to Next.js operator dashboard. |
| **210** | `Allow-API-WebSocket` | `6500` | TCP | `Internet` *(or Corporate IP)* | Any | **Allow** | REST API endpoints (`/docs`, `/api`) & live WebSockets (`/ws`). |
| **300** | `Allow-MQTT-Telemetry` | `1883` | TCP | `Internet` *(or Plant Gateway IP)* | Any | **Allow** | Device telemetry uplinks and remote command execution. |
| **310** | `Allow-MQTTS-TLS` *(opt)* | `8883` | TCP | `Internet` *(or Plant Gateway IP)* | Any | **Allow** | Encrypted TLS telemetry if SSL certificate is mounted. |
| **400** | `Allow-Modbus-TCP` *(opt)* | `502` | TCP | `Plant_Gateway_Subnet` | Any | **Allow** | Only if simulator or field PLC bridges cross WAN/VPN. |
| **410** | `Allow-OPC-UA` *(opt)* | `4840` | TCP | `Plant_Gateway_Subnet` | Any | **Allow** | Only if OPC UA servers cross WAN/VPN. |
| **900** | `Deny-Postgres-Direct` | `5441` | TCP | Any | Any | **Deny** | Keep database closed to the internet. Docker bridges internally. |
| **910** | `Deny-Redis-Direct` | `6385` | TCP | Any | Any | **Deny** | Keep Redis message bus closed to the internet. |

> 🔒 **Security Best Practice:** In production, route ports `6001` and `6500` through an Azure Application Gateway or NGINX reverse proxy with TLS certificates on standard ports `80` / `443`.

---

## 4. Default Platform Credentials

Lansub X automatically provisions pre-seeded administrative credentials upon initialization:

| Role | Email | Password | Scope & Permissions |
|---|---|---|---|
| **Superadmin** | `superadmin@lansubx.io` | `SuperAdmin123!` | System-wide oversight, user role promotions, audit management |
| **Admin** | `admin@lansubx.io` | `AdminPassword123!` | Device provisioning, gateway config, alarm rule creation |

*Once an administrative user exists, self-registration is automatically locked to prevent unauthorized public onboarding.*

---

## 5. Quick Start (Docker Compose)

Launch the entire stack (Postgres, Redis, Mosquitto, Backend, Frontend) with 5 commands:

```bash
# 1. Clone repository & configure environment
git clone https://github.com/Arish03/LansubX.git
cd LansubX
cp .env.example .env

# 2. Start all platform services
docker compose up -d --build

# 3. Seed default device templates & admin credentials
docker compose exec backend python -m app.seed

# 4. Run automated acceptance verification
docker compose exec backend python -m unittest tests/test_acceptance_rc.py

# 5. Access the applications
# Web Dashboard:  http://localhost:6001
# OpenAPI Docs:    http://localhost:6500/docs
# API Health:      http://localhost:6500/health
```

---

## 6. Industrial Protocols & Simulator

Lansub X ships with containerized protocol bridges and a multi-protocol industrial machine simulator.

### Running with Gateways and Simulators

```bash
# Start Core Platform + Protocol Gateway
docker compose --profile gateway up -d

# Start Core Platform + Multi-Protocol Factory Simulator
docker compose --profile sim up -d

# Start All Services simultaneously
docker compose --profile gateway --profile sim up -d
```

### Supported Machine Types

1. **Direct MQTT Sensor (ESP32):**
   - Telemetry: `temperature`, `humidity`, `battery`, `heap_free`.
   - Commands: `reboot`, `set_interval`.
2. **Industrial Sensor Controller:**
   - Telemetry: `tank_level`, `flow_rate`, `inlet_pressure`, `outlet_pressure`.
   - Commands: `open_valve`, `close_valve`, `calibrate`.
3. **Modbus TCP Machinery (Port 502):**
   - Reads holding registers (0–6): `temperature`, `pressure`, `flow_rate`, `motor_speed`, `motor_current`, `vibration`, `power`.
   - Coils: `running`, `fault`.
   - Commands: `start`, `stop`, `write_register`.
4. **OPC UA Automated CNC Equipment (Port 4840):**
   - Nodes: `ns=2;s=Temperature`, `ns=2;s=Pressure`, `ns=2;s=SpindleSpeed`, `ns=2;s=Vibration`, `ns=2;s=Running`.
   - Commands: `start`, `stop`, `set_speed`.
5. **LoRaWAN ChirpStack Bridge:**
   - Subscribes to `application/+/device/+/event/up`.
   - Decodes base64 payload, extracts battery & environmental sensor data, and enriches telemetry with gateway radio metrics (`rssi`, `snr`).
6. **Industrial PLC Node:**
   - Telemetry: `state`, `cycle_count`, `cycle_time_ms`, `fault_code`.
   - Commands: `start_cycle`, `emergency_stop`, `reset_fault`.

---

## 7. MQTT Topic & Payload Contracts

All messaging is routed through the Mosquitto broker under the `lansubx/` hierarchy:

| Topic | Direction | Payload Example |
|---|---|---|
| `lansubx/{device_key}/telemetry` | Device -> Platform | `{"ts": "2026-10-12T12:00:00Z", "values": {"temperature": 78.4, "pressure": 101.3}}` |
| `lansubx/{device_key}/status` | Device -> Platform | `{"online": true, "source": "modbus"}` |
| `lansubx/{device_key}/command` | Platform -> Device | `{"id": 101, "action": "set_valve", "value": 1}` |
| `lansubx/{device_key}/command/ack` | Device -> Platform | `{"id": 101, "ok": true, "error": null}` |

### Last Will and Testament (LWT)
Direct devices configure an MQTT Last Will on `lansubx/{device_key}/status`:
```json
{"online": false}
```

### Dynamic Device Provisioning Script
Direct devices authenticate using their `device_key` and a unique secret. Register them instantly without broker restarts:

**Linux / macOS:**
```bash
./scripts/add_mqtt_user.sh <device_key> <secret>
```

**Windows PowerShell:**
```powershell
.\scripts\add_mqtt_user.ps1 <device_key> <secret>
```

---

## 8. Real-Time Telemetry & Alarm Engine

1. **Ingestion & Live Bus:**
   - The FastAPI MQTT worker listens to `lansubx/+/telemetry`.
   - Each data point is saved to PostgreSQL and simultaneously pushed to Redis Pub/Sub channel `channel:telemetry:{device_key}`.
2. **WebSocket Streaming:**
   - Browser clients subscribe via `ws://localhost:6500/ws?token=<JWT_TOKEN>`.
   - Updates stream live with sub-100ms latency to Recharts graphs.
3. **Automated Alarm Engine:**
   - Supports `>`, `<`, `>=`, `<=`, `==`, `!=` conditions.
   - **Debouncing:** Metrics must persist beyond the defined `debounce_seconds` window before firing.
   - **Auto-Resolution:** When values normalize, alarms automatically resolve and stamp `resolved_at`.

---

## 9. Running Locally for Development

To run backend and frontend natively while keeping databases in Docker:

```bash
# 1. Start core data stores
docker compose up -d postgres redis mosquitto

# 2. Terminal 1: Backend
cd backend
python -m venv .venv
.\.venv\Scripts\activate      # Windows
# source .venv/bin/activate    # Linux/macOS
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 6500

# 3. Terminal 2: Frontend
cd frontend
npm install
npm run dev
# Running on http://localhost:6001
```

---

## 10. Production Deployment & Hardening

Lansub X uses a single unified `docker-compose.yml` for both development and production:

```bash
docker compose up -d --build
```

### Hardening Features
- **Zero Exposed Raw Database Ports:** Postgres and Redis have no host port bindings. They communicate solely over the isolated internal Docker bridge network.
- **Worker Concurrency Guard:** Single worker concurrency (`WEB_CONCURRENCY=1`) avoids duplicated MQTT ingestion streams.
- **Restricted Mosquitto ACLs:** Devices can only read/write topics matching their unique `device_key`.
- **Argon2 / BCrypt Password Hashing:** User passwords and device secrets are stored with salt hashes.
- **Production Health Checks:** Self-healing Docker health checks restart failing services automatically.

---

## 11. Acceptance Testing & Verification

Run the automated test suites to verify system integrity:

```bash
# 1. Milestone 5 Gateway & Simulator Test Suite (8/8 Checks)
python scripts/test_milestone5.py

# 2. Production Acceptance & Hardening Unit Tests (9/9 Checks)
python -m unittest backend/tests/test_acceptance_rc.py

# 3. End-to-End Live Cluster Acceptance Test
python scripts/acceptance_test.py
```

---

## 12. Repository Structure

```
LansubX/
├── .env.example                # Sample environment configuration
├── docker-compose.yml          # Unified all-in-one compose stack
├── README.md                   # Project overview & deployment guide
├── HOW_TO_USE.md               # 15-minute step-by-step operator walkthrough
├── PRD.md                      # Product Requirements Document
├── ARCHITECTURE.md             # System Architecture & Technical Specifications
├── plan.md                     # Roadmap and milestone tracking
│
├── backend/                    # FastAPI Application
│   ├── Dockerfile              # Exposes 6500
│   ├── alembic/                # Database migrations
│   ├── app/
│   │   ├── main.py             # Lifespan, CORS & router aggregation
│   │   ├── config.py           # Pydantic environment settings
│   │   ├── seed.py             # Default superadmin & templates seeder
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── routers/            # Auth, Devices, Telemetry, Rules, Alarms, Commands
│   │   └── services/           # MQTT worker, Redis pub/sub, Alarm engine
│   └── tests/                  # Unit and integration test suites
│
├── frontend/                   # Next.js 14 Web Dashboard
│   ├── Dockerfile              # Exposes 6001
│   ├── package.json            # Scripts: dev -p 6001, start -p 6001
│   ├── next.config.js          # Reverse proxy rewrites to backend:6500
│   └── src/
│       ├── app/                # App router (login, dashboard, devices, rules, settings)
│       ├── components/         # Reusable UI components & navigation
│       └── lib/                # API client & live WebSocket hook
│
├── gateway/                    # Multi-Protocol Industrial Gateway
│   ├── Dockerfile
│   ├── config.yaml             # Modbus, OPC UA, LoRaWAN mapping config
│   └── gateway.py              # Protocol translation to MQTT
│
├── simulator/                  # Multi-Machine Industrial Simulator
│   ├── Dockerfile              # Exposes 502 (Modbus) & 4840 (OPC UA)
│   └── sim.py                  # Generates physical telemetry & physics
│
├── mosquitto/                  # Mosquitto MQTT Configuration
│   ├── mosquitto.conf          # Broker configuration & persistence
│   └── acl                     # Dynamic topic access control lists
│
└── scripts/                    # Platform utilities
    ├── add_mqtt_user.sh        # Linux MQTT provisioning script
    ├── add_mqtt_user.ps1       # Windows MQTT provisioning script
    ├── acceptance_test.py      # E2E acceptance test runner
    └── test_milestone5.py      # Gateway & simulator validation suite
```

---

## 13. Documentation Index

- **[tutorial.md](tutorial.md)** — Architectural walkthrough and hands-on step-by-step tutorial.
- **[HOW_TO_USE.md](HOW_TO_USE.md)** — Step-by-step user onboarding, UI navigation, and device creation.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Architectural design, database schema, and component lifecycles.
- **[PRD.md](PRD.md)** — Requirements, acceptance criteria, and user personas.
- **[MVP.md](MVP.md)** — Scope boundaries and core deliverable specs.
- **[plan.md](plan.md)** — Milestone execution checklist.
