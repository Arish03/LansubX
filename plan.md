# Lansub X: Implementation Plan

Related: `PRD.md`, `MVP.md`, `ARCHITECTURE.md`

---

## 1. Executive Summary & Goals
Lansub X is an industrial IoT platform providing a unified data intake, live monitoring, real-time alerting, and remote control system for heterogeneous factory devices and machinery.

### Core Objectives
1. **Unified Ingestion:** Ingest telemetry uniformly over MQTT via direct devices or gateway bridges (Modbus TCP, OPC UA, LoRa).
2. **Deterministic Processing:** Single ingestion pipeline (`process_telemetry`) handling device verification, metric persistence, alarm rule evaluation, and live fan-out.
3. **Real-Time Live Updates:** Decoupled WebSocket streaming through Redis pub/sub.
4. **Bi-Directional Control:** Command dispatch with status tracking (`sent` -> `acked`/`failed`) and automated timeout handling.
5. **Security by Default:** Authenticated MQTT broker with per-user ACLs, role-based REST APIs, JWT tokens, and strict owner data scoping.

---

## 2. Technology Stack & Directory Structure

| Component | Technology | Rationale |
|---|---|---|
| **API Backend** | Python 3.12, FastAPI, Pydantic v2 | High-performance asynchronous REST & WebSocket framework with automatic OpenAPI docs |
| **Database & ORM** | PostgreSQL 16, SQLAlchemy 2.0 (asyncio), Alembic | ACID-compliant relational data store with async driver (`asyncpg`) |
| **MQTT Broker** | Eclipse Mosquitto 2.0 | Lightweight, industry-standard MQTT broker with password files and ACL enforcement |
| **MQTT Client / Worker** | `aiomqtt` (AsyncIO MQTT) | Non-blocking MQTT worker integrated directly into FastAPI's lifespan |
| **Message Bus / Cache** | Redis 7 | High-throughput pub/sub for real-time WebSocket fan-out and device caching |
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, SWR, Recharts, Lucide Icons | Responsive modern industrial dashboard with live chart streaming |
| **Industrial Gateways** | Python (`pymodbus`, `asyncua`, `aiomqtt`) | Modular translation containers bridging Modbus TCP, OPC UA, and LoRaWAN to MQTT |
| **Orchestration** | Docker & Docker Compose | Containerized dev/prod environments with profiles (`gateway`, `sim`) |

### Repository Structure
```
lansubx/
├── .env.example
├── .env
├── .gitignore
├── docker-compose.yml
├── docker-compose.prod.yml
├── README.md
├── ARCHITECTURE.md
├── MVP.md
├── PRD.md
├── plan.md
├── docs/
│   └── decisions.md
├── scripts/
│   ├── add_mqtt_user.sh
│   └── acceptance_test.py
├── mosquitto/
│   ├── mosquitto.conf
│   ├── passwd
│   └── acl
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── security.py
│   │   ├── seed.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── gateway.py
│   │   │   ├── device.py
│   │   │   ├── template.py
│   │   │   ├── telemetry.py
│   │   │   ├── alarm.py
│   │   │   └── command.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── devices.py
│   │   │   ├── gateways.py
│   │   │   ├── templates.py
│   │   │   ├── rules.py
│   │   │   ├── alarms.py
│   │   │   ├── commands.py
│   │   │   ├── dashboard.py
│   │   │   └── ws.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── redis_bus.py
│   │       ├── telemetry.py
│   │       ├── rules.py
│   │       ├── events.py
│   │       └── mqtt_worker.py
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_devices.py
│       ├── test_telemetry.py
│       └── test_rules.py
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── src/
│       ├── middleware.ts
│       ├── lib/
│       │   ├── api.ts
│       │   ├── auth.ts
│       │   └── useLiveSocket.ts
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx
│           ├── login/
│           ├── dashboard/
│           ├── devices/
│           ├── alarms/
│           ├── rules/
│           ├── gateways/
│           └── settings/
├── gateway/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.yaml
│   └── gateway.py
└── simulator/
    ├── Dockerfile
    ├── requirements.txt
    └── sim.py
```

---

## 3. Detailed Milestone Roadmap

### Milestone 1: Secured Broker, Database & Authentication (M1)
**Goal:** Deliver foundation infrastructure, database schemas, secure MQTT broker configuration, and user authentication with role-based access control.
- [ ] **M1.1 Docker Compose & Environment Setup:**
  - Create `.env.example` and `.env` with secure default tokens and port definitions.
  - Configure `docker-compose.yml` for PostgreSQL 16, Redis 7, Mosquitto 2, and FastAPI backend.
- [ ] **M1.2 Mosquitto Broker Security & ACL Configuration:**
  - Create `mosquitto/mosquitto.conf` enforcing `allow_anonymous false`, persistent storage, and ACL logging.
  - Generate initial `mosquitto/passwd` with credentials for `backend` and `gateway`.
  - Configure `mosquitto/acl` enforcing topics for `backend` (`lansubx/#`), `gateway`, and device patterns (`%u`).
  - Create `scripts/add_mqtt_user.sh` to provision credentials securely.
- [ ] **M1.3 Database Architecture & Models:**
  - Initialize SQLAlchemy async engine, declarative Base, and async session generator.
  - Implement models: `User`, `Gateway`, `Device`, `DeviceTemplate`, `Telemetry`, `AlarmRule`, `Alarm`, `Command`.
  - Configure Alembic migrations for versioned schema tracking.
- [ ] **M1.4 Security & Authentication API:**
  - Implement password hashing (bcrypt) and JWT encode/decode routines.
  - Implement `POST /auth/register` (first user becomes Admin, subsequent registrations restricted or admin-only).
  - Implement `POST /auth/login` returning JWT bearer token.
  - Implement `GET /auth/me` and role-checking dependencies (`require_role("admin")`, etc.).
  - Implement user management endpoints: `GET /users`, `PUT /users/{id}`.
- [ ] **M1.5 Seed Data:**
  - Implement `backend/app/seed.py` to populate initial device templates for all 6 device kinds (Modbus, OPC UA, LoRa, ESP32, Sensor Controller, PLC).

### Milestone 2: Telemetry Ingestion Pipeline (M2)
**Goal:** Ingest MQTT telemetry, persist metrics into PostgreSQL, and expose REST retrieval APIs.
- [ ] **M2.1 MQTT Worker Core (`services/mqtt_worker.py`):**
  - Integrate worker in FastAPI lifespan using `aiomqtt`.
  - Subscribe to `lansubx/+/telemetry`, `lansubx/+/status`, and `lansubx/+/command/ack`.
  - Implement auto-reconnection with exponential backoff on broker drop.
- [ ] **M2.2 Ingestion Service (`services/telemetry.py`):**
  - Implement `process_telemetry(device_key, values, ts)`:
    - Look up device and verify ownership (with in-memory cache).
    - Drop unknown device keys safely without crashing.
    - Validate numeric-only values (converting bools to 1/0).
    - Insert batch telemetry records (`device_id, metric, value, ts`).
    - Update device `last_seen_at` and `is_online = true`.
- [ ] **M2.3 Telemetry REST APIs:**
  - `GET /devices/{id}/telemetry/latest`: Return most recent value per metric.
  - `GET /devices/{id}/telemetry`: Query historical values by metric and time range (`start`, `end`, `limit`).
  - `GET /devices/{id}/metrics`: List all metrics recorded for a device.
  - Owner scoping validation on every query.

### Milestone 3: Real-Time Live Feed, Alarms & Device Commands (M3)
**Goal:** Implement Redis live bus, WebSocket streaming, rule evaluation, alarm lifecycle, and bi-directional commands.
- [ ] **M3.1 Redis Pub/Sub Bus (`services/redis_bus.py`):**
  - Publish live events to Redis channel `live:{owner_id}`.
- [ ] **M3.2 WebSocket Endpoint (`routers/ws.py`):**
  - `/ws?token=<jwt>`: Authenticate and bind client to their owner's Redis stream.
  - Push real-time JSON frames: `telemetry`, `alarm`, `device_status`, `command_result`.
- [ ] **M3.3 Alarm Rules Engine (`services/rules.py`):**
  - Evaluate active rules on each telemetry packet (`>`, `<`, `>=`, `<=`, `==`).
  - Enforce debounce intervals (`debounce_seconds`) preventing alert spam.
  - Auto-resolve active alarms when telemetry values return to normal.
  - Alarm lifecycle management APIs: `GET /alarms`, `POST /alarms/{id}/ack`, `POST /alarms/{id}/resolve`.
  - Alarm rule configuration APIs: `POST/GET/PUT/DELETE /rules`.
- [ ] **M3.4 Device Commands Pipeline (`routers/commands.py`):**
  - `POST /devices/{id}/commands`: Insert command record with status `sent`.
  - Publish command payload to MQTT topic `lansubx/{device_key}/command`.
  - Handle `lansubx/{device_key}/command/ack` in worker; update status to `acked` or `failed`.
  - Command timeout background task: Mark unanswered commands as `failed` after timeout.

### Milestone 4: Next.js Frontend Application (M4)
**Goal:** Deliver a high-performance, responsive industrial web dashboard.
- [ ] **M4.1 App Shell, Navigation & Theme:**
  - Next.js 14 App Router, Tailwind CSS, Dark industrial aesthetic, responsive layout.
  - Auth context and protected routes middleware.
- [ ] **M4.2 Overview Dashboard:**
  - Device count, online/offline status stats, active alarms summary, recent events feed.
- [ ] **M4.3 Device Management & Onboarding Wizard:**
  - Device list with online indicators, kind badges, and last-seen timestamps.
  - Add-device wizard with kind selection, default template preview, and one-time MQTT secret modal.
- [ ] **M4.4 Device Detail View:**
  - Real-time telemetry metric cards.
  - Live charts with time-range selector (15m, 1h, 24h, 7d).
  - Bi-directional command dispatch console and audit log.
- [ ] **M4.5 Alarms & Rules UI:**
  - Live alarm feed with acknowledge and resolve actions.
  - Alarm rule builder (metric, operator, threshold, debounce, severity).

### Milestone 5: Gateways & Industrial Simulator (M5)
**Goal:** Deliver bridge containers for non-MQTT industrial machinery and demo data simulators.
- [ ] **M5.1 Modbus TCP Gateway:**
  - Poll holding registers and coils using `pymodbus`.
  - Scale raw registers according to configured mapping and publish to `lansubx/{key}/telemetry`.
  - Publish Last Will and status on disconnect/reconnect.
- [ ] **M5.2 OPC UA Gateway:**
  - Connect to OPC UA server using `asyncua`.
  - Read configured Node IDs on regular interval and publish telemetry.
- [ ] **M5.3 LoRa ChirpStack Bridge:**
  - Ingest ChirpStack MQTT uplinks, map `devEui` to `device_key`, extract decoded JSON values with RSSI and SNR.
- [ ] **M5.4 Multi-Protocol Simulator Container:**
  - Simulator generating realistic factory data for Modbus, OPC UA, LoRa, and direct ESP32 devices for local testing.

### Milestone 6: Release Candidate & Acceptance Verification (M6)
**Goal:** Validate all MVP acceptance criteria and harden deployment.
- [ ] Automated end-to-end acceptance script (`scripts/acceptance_test.py`).
- [ ] Verification of broker restart recovery and zero cross-tenant data leakage.
- [ ] Production compose configuration (`docker-compose.prod.yml`).

---

## 4. MQTT Broker Security & Topic Architecture

### Topic Structure
```
lansubx/{device_key}/telemetry     (Device/Gateway -> Broker -> Worker)
lansubx/{device_key}/status        (Device/Gateway -> Broker -> Worker)
lansubx/{device_key}/command       (Worker/Backend -> Broker -> Device/Gateway)
lansubx/{device_key}/command/ack   (Device/Gateway -> Broker -> Worker)
```

### Access Control Matrix
| User | Topic Pattern | Access |
|---|---|---|
| `backend` | `lansubx/#` | readwrite |
| `gateway` | `lansubx/+/telemetry`<br>`lansubx/+/status`<br>`lansubx/+/command/ack` | write |
| `gateway` | `lansubx/+/command` | read |
| Direct Device (`%u`) | `lansubx/%u/telemetry`<br>`lansubx/%u/status`<br>`lansubx/%u/command/ack` | write |
| Direct Device (`%u`) | `lansubx/%u/command` | read |
| Anonymous | Any | DENY |

---

## 5. REST & WebSocket API Specification

### Auth & Users
- `POST /auth/register`: `{ email, password, role? }` -> `{ user, access_token }`
- `POST /auth/login`: `{ email, password }` -> `{ access_token, token_type: "bearer" }`
- `GET /auth/me`: Authenticated user info
- `GET /users`: List users (Admin only)
- `PUT /users/{id}`: Update user role / active status (Admin only)

### Devices & Gateways
- `GET /devices`: List owner's devices
- `POST /devices`: Create device (`name, kind, gateway_id?`) -> returns `device_key` and one-time `secret` (for direct kinds)
- `GET /devices/{id}`: Device details
- `PUT /devices/{id}`: Update device name
- `DELETE /devices/{id}`: Delete device and cascade
- `GET /gateways`, `POST /gateways`, `DELETE /gateways/{id}`
- `GET /templates`: Default metric templates per device kind

### Telemetry & Live Data
- `GET /devices/{id}/telemetry/latest`: Latest values map
- `GET /devices/{id}/telemetry?metric=temp&start=...&end=...&limit=500`: Metric history
- `GET /devices/{id}/metrics`: Available metric names
- `WS /ws?token={jwt}`: WebSocket real-time event stream

### Alarms & Rules
- `GET /rules?device_id=...`: List rules
- `POST /rules`: Create rule
- `PUT /rules/{id}`, `DELETE /rules/{id}`
- `GET /alarms?state=active|acknowledged|resolved`: List alarms
- `POST /alarms/{id}/ack`: Acknowledge alarm
- `POST /alarms/{id}/resolve`: Manually resolve alarm

### Commands
- `POST /devices/{id}/commands`: `{ action, params }` -> dispatches to MQTT
- `GET /devices/{id}/commands`: Command history and ack status

---

## 6. Section 10: Debug Taps, Verification & Runbook

### MQTT Live Debug Taps
```bash
# Monitor all telemetry traffic
docker compose exec mosquitto mosquitto_sub -h localhost -u backend -P backend_secret -t "lansubx/#" -v

# Publish synthetic telemetry test
docker compose exec mosquitto mosquitto_pub -h localhost -u backend -P backend_secret \
  -t "lansubx/dev_test0001/telemetry" -m '{"values":{"temperature":82.5,"pressure":101.3}}'

# Publish status offline (simulating Last Will)
docker compose exec mosquitto mosquitto_pub -h localhost -u backend -P backend_secret \
  -t "lansubx/dev_test0001/status" -m '{"online":false}'
```

### PostgreSQL Direct Queries
```sql
-- Check device status and last seen
SELECT id, device_key, name, kind, is_online, last_seen_at FROM devices;

-- Inspect latest telemetry entries
SELECT d.device_key, t.metric, t.value, t.ts 
FROM telemetry t JOIN devices d ON t.device_id = d.id 
ORDER BY t.ts DESC LIMIT 20;

-- Check open alarms
SELECT a.id, d.device_key, r.metric, a.state, a.value, a.opened_at 
FROM alarms a JOIN devices d ON a.device_id = d.id JOIN alarm_rules r ON a.rule_id = r.id 
WHERE a.state != 'resolved';
```

### WebSocket Test Tap
```bash
# Connect to live feed using websocat or wscat
wscat -c "ws://localhost:8000/ws?token=<YOUR_JWT_TOKEN>"
```

---

## 7. Effort Estimation & Execution Sequence

| Phase | Description | Estimated Hours |
|---|---|---|
| **Phase 1 (M1)** | Docker Compose, Mosquitto Auth/ACL, Postgres Models, Seed, Auth API | 16h |
| **Phase 2 (M2)** | MQTT Ingestion Worker, `process_telemetry`, Telemetry DB APIs | 14h |
| **Phase 3 (M3)** | Redis Pub/Sub, WebSockets, Rules/Alarm Engine, Commands | 18h |
| **Phase 4 (M4)** | Next.js App, Auth, Live Charts, Device Management, Alarm Console | 24h |
| **Phase 5 (M5)** | Modbus/OPC UA/LoRa Gateways & Simulator | 16h |
| **Phase 6 (M6)** | Acceptance Test Suite, Hardening, Docs | 8h |
| **Total** | | **96h (+ buffer)** |
