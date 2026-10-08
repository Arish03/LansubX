# Lansub X: Industrial IoT Platform

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Mosquitto](https://img.shields.io/badge/Mosquitto-2.0-red.svg)](https://mosquitto.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

Lansub X is a modern industrial IoT platform designed to collect, process, alert, and visualize real-time telemetry from heterogeneous factory machinery (Modbus TCP, OPC UA, LoRaWAN) and direct MQTT devices (ESP32, Sensor Controllers, PLCs).

> 💡 **New to Lansub X?** Check out the step-by-step **[Operator & User Guide (HOW_TO_USE.md)](HOW_TO_USE.md)** for a guided 15-minute walkthrough covering user creation, device provisioning, MQTT credentials, live charts, and remote control.

---

## Architecture Overview

```
 Gateways (read machines)            Direct devices (speak MQTT)
 +-----------------+                 +--------------------+
 | Modbus gateway  |                 | ESP32              |
 | OPC UA gateway  |                 | Sensor controller  |
 | LoRa gateway    |                 | PLC with MQTT      |
 +--------+--------+                 +---------+----------+
          \                                    /
           +--------------- MQTT -------------+
                              |
                     +--------v---------+
                     | Mosquitto broker |
                     +--------+---------+
                              |
                     +--------v---------+
                     |   MQTT worker    |  (FastAPI lifespan)
                     +---+----------+---+
                         |          |
                  +------v--+   +---v-----+
                  |PostgreSQL|  |  Redis  | (Live Pub/Sub)
                  +------+---+  +---+-----+
                         |          |
                     +---v----------v---+
                     | FastAPI REST + WS|
                     +---------+--------+
                               |
                     +---------v--------+
                     |  Next.js frontend|
                     +------------------+
 Commands: Frontend -> REST -> Mosquitto -> Device or Gateway
```

---

## Quick Start (5 Commands)

Get up and running on any machine with Docker and Docker Compose:

```bash
# 1. Clone & prepare environment
cp .env.example .env

# 2. Start core services (Postgres, Redis, Mosquitto, Backend API, Frontend)
docker compose up -d --build

# 3. Seed default device templates
docker compose exec backend python -m app.seed

# 4. Run backend test suite
docker compose exec backend pytest

# 5. Access the platform
# Web Dashboard: http://localhost:3000
# OpenAPI Docs:   http://localhost:8000/docs
```

---

## Ingestion & MQTT Contracts

All machine data flows into Mosquitto under the `lansubx/` topic namespace:

| Topic | Direction | Content |
|---|---|---|
| `lansubx/{device_key}/telemetry` | Device -> Platform | `{"ts": "ISO (opt)", "values": {"temperature": 72.5}}` |
| `lansubx/{device_key}/status` | Device -> Platform | `{"online": true, "source": "modbus"}` |
| `lansubx/{device_key}/command` | Platform -> Device | `{"id": 1, "action": "set_output", "value": 1}` |
| `lansubx/{device_key}/command/ack` | Device -> Platform | `{"id": 1, "ok": true}` |

### Last Will & Testament (LWT)
Direct devices and gateways configure an MQTT Last Will on `lansubx/{device_key}/status` with payload:
```json
{"online": false}
```

---

## Provisioning Direct MQTT Devices

Direct MQTT devices authenticate with their `device_key` as username and a generated secret. Use the provisioning script to register credentials in Mosquitto:

**Linux / macOS:**
```bash
./scripts/add_mqtt_user.sh <device_key> <secret>
```

**Windows PowerShell:**
```powershell
.\scripts\add_mqtt_user.ps1 <device_key> <secret>
```

---

## Live Debug Taps

```bash
# Monitor all MQTT telemetry & events
docker compose exec mosquitto mosquitto_sub -h localhost -u backend -P backend_secure_pass_123 -t "lansubx/#" -v

# Inject test telemetry
docker compose exec mosquitto mosquitto_pub -h localhost -u backend -P backend_secure_pass_123 \
  -t "lansubx/dev_test0001/telemetry" -m '{"values":{"temperature":82.5,"pressure":101.3}}'

# View backend logs in real-time
docker compose logs -f backend
```

---

## Industrial Gateways & Simulators

To run the industrial protocol gateways or multi-machine simulator:

```bash
# Start Modbus/OPC UA/LoRa gateway
docker compose --profile gateway up -d

# Start simulated devices for end-to-end testing
docker compose --profile sim up -d
```

---

## Acceptance Testing

Verify all 8 core MVP requirements (health, auth, tenant isolation, device provisioning, MQTT ingestion, alarms lifecycle, and command acks):

```bash
python scripts/acceptance_test.py
```

---

## Documentation Links

- [HOW_TO_USE.md](file:///e:/LansubX/HOW_TO_USE.md) - **Complete User & Operator Guide (Step-by-step walkthrough)**
- [PRD.md](file:///e:/LansubX/PRD.md) - Product Requirements Document
- [MVP.md](file:///e:/LansubX/MVP.md) - MVP Definition & Scope Guard
- [ARCHITECTURE.md](file:///e:/LansubX/ARCHITECTURE.md) - System Architecture & Component Design
- [plan.md](file:///e:/LansubX/plan.md) - Detailed Implementation Roadmap & Milestone Guide
- [decisions.md](file:///e:/LansubX/docs/decisions.md) - Architecture Decision Records & Message Specs
