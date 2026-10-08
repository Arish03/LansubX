# Lansub X: Architecture

Related: `PRD.md`, `MVP.md`, `plan.md`

## 1. Principles
1. **One door for data:** MQTT. After the gateway, every source looks the same.
2. **One function for ingestion:** `process_telemetry`.
3. **Fake data only in the simulator.**
4. **Real errors, never silent failures.**
5. **Secure by default:** broker auth and ACL from day one.
6. **Small, replaceable parts:** a new protocol is a new gateway loop only.

## 2. System context
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
                     |   MQTT worker    |  inside FastAPI process
                     +---+----------+---+
                         |          |
                  +------v--+   +---v-----+
                  |PostgreSQL|  |  Redis  |
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

## 3. Components
| Component | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js, TypeScript, Tailwind, SWR, recharts | Login, devices, live charts, alarms, commands |
| API | FastAPI | REST endpoints, auth, validation, owner scoping |
| MQTT worker | Python, aiomqtt (asyncio task started in `lifespan`) | Subscribes to telemetry, status, ack; calls services |
| Services | Python modules | `telemetry`, `rules`, `events`, `redis_bus` |
| Database | PostgreSQL 16, SQLAlchemy async, Alembic | Persistent data and migrations |
| Redis | Redis 7 pub/sub | Live fan-out from worker to WebSocket |
| Broker | Mosquitto 2 | Message transport, authentication, ACL |
| Gateways | Python containers (pymodbus, asyncua, aiomqtt) | Translate Modbus, OPC UA, LoRa to MQTT |
| Simulator | Python container (profile `sim`) | Demo data only |

## 4. Repository layout
```
lansubx/
  .env, .env.example, .gitignore, docker-compose.yml, README.md
  docs/decisions.md              topics and message shapes
  scripts/add_mqtt_user.sh
  mosquitto/{mosquitto.conf, acl, passwd}
  backend/
    app/
      main.py  config.py  db.py  security.py  seed.py
      models/__init__.py
      routers/{auth,devices,gateways,templates,rules,alarms,commands,ws}.py
      services/{redis_bus,telemetry,events,rules,mqtt_worker}.py
    alembic/  tests/  Dockerfile  requirements.txt
  frontend/src/{middleware.ts, lib/api.ts, lib/useLiveSocket.ts, app/...}
  gateway/{gateway.py, config.yaml, Dockerfile, requirements.txt}
  simulator/{sim.py, Dockerfile}
```

## 5. MQTT contract
| Direction | Topic | Publisher | Payload |
|---|---|---|---|
| Data | `lansubx/{device_key}/telemetry` | device or gateway | `{"ts": "ISO (optional)", "values": {"temperature": 71.2}}` |
| Status | `lansubx/{device_key}/status` | device or gateway | `{"online": true, "source": "modbus"}` |
| Command | `lansubx/{device_key}/command` | backend | `{"id": 12, "action": "set_output", ...}` |
| Ack | `lansubx/{device_key}/command/ack` | device or gateway | `{"id": 12, "ok": true}` |

- Devices set an MQTT **Last Will** on the status topic with `{"online": false}`.
- Telemetry values are numeric only; booleans are sent as 1/0.
- QoS 0 for telemetry, QoS 1 recommended for commands and acks (post-MVP tuning).

### Broker ACL
| MQTT user | Permissions |
|---|---|
| `backend` | read/write `lansubx/#` |
| `gateway` | write `lansubx/+/telemetry`, `+/status`, `+/command/ack`; read `lansubx/+/command` |
| direct device (username = device_key) | write own telemetry, status, ack; read own command (`%u` pattern) |
| anonymous | refused |

## 6. Data flows
### 6.1 Telemetry (the main pipe)
1. Device or gateway publishes to `lansubx/{key}/telemetry`.
2. Worker receives the message and parses JSON (errors logged, never crash).
3. `process_telemetry(device_key, values, ts)`:
   - find device (cached); unknown key is ignored
   - keep numeric values
   - insert one `telemetry` row per metric
   - update `last_seen_at`
   - publish `{"type":"telemetry", ...}` to Redis `live:{owner_id}`
   - evaluate alarm rules
4. WebSocket handler forwards Redis messages to that user's browser.

### 6.2 Alarm evaluation
For each enabled rule of the device whose metric is in the message:
- broken and no open alarm and outside debounce: open alarm, publish `alarm/opened`
- not broken and open alarm: set `resolved`, set `closed_at`, publish `alarm/resolved`
- broken and open alarm: nothing

### 6.3 Status
Status message updates `last_seen_at` when online and persists the online flag (including Last Will offline), then publishes `device_status`. REST computes `online` from the stored flag plus the timeout (120 s, LoRa 1800 s).

### 6.4 Commands
1. `POST /devices/{id}/commands` checks role and ownership.
2. Insert `commands` row (`sent`).
3. Publish to `lansubx/{key}/command` using a long-lived MQTT client.
4. Device answers on `command/ack`; worker sets `acked` or `failed` and publishes `command_result`.
5. A timeout job marks stale `sent` commands as `failed`.

### 6.5 Gateway read loops
| Gateway | Loop |
|---|---|
| Modbus | connect, verify, publish online; read register block (and coils) every interval, scale values, publish; on error publish offline and retry in 5 s |
| OPC UA | connect, read each Node ID every interval, convert to float, publish; reconnect on failure |
| LoRa | subscribe to ChirpStack uplinks, map `devEui` to `device_key`, publish decoded values plus rssi and snr |

## 7. Data model
```
users(id, email unique, password_hash, role, is_active)
gateways(id, owner_id -> users, name, type, config JSON)
devices(id, owner_id -> users, name, device_key unique, kind,
        gateway_id -> gateways null, secret_hash null,
        last_seen_at null, is_online bool)
device_templates(id, kind unique, name, config JSON)
telemetry(id, device_id -> devices cascade, ts, metric, value)
    index (device_id, metric, ts)
alarm_rules(id, device_id -> devices cascade, metric, operator, threshold,
            severity, debounce_seconds, enabled)
alarms(id, rule_id -> alarm_rules cascade, device_id -> devices cascade,
       state [active|acknowledged|resolved], value, opened_at, closed_at null)
commands(id, device_id -> devices cascade, payload JSON,
         status [sent|acked|failed], created_at)
```
`is_online` is the addition over the original guide so Last Will state is persisted.

Growth plan: one row per metric is simple but large. Start with retention (90 days) and batch inserts; move to TimescaleDB hypertables or partitioning when volume requires.

## 8. API surface
| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh` (P1) |
| Users | `GET /users`, `PUT /users/{id}` (admin) |
| Devices | `POST/GET /devices`, `GET/PUT/DELETE /devices/{id}` |
| Telemetry | `GET /devices/{id}/telemetry/latest`, `GET /devices/{id}/telemetry`, `GET /devices/{id}/metrics` |
| Gateways | `POST/GET /gateways`, `DELETE /gateways/{id}` |
| Templates | `GET /templates` |
| Rules | `POST/GET/PUT/DELETE /rules` |
| Alarms | `GET /alarms`, `POST /alarms/{id}/ack`, `POST /alarms/{id}/resolve` |
| Commands | `POST /devices/{id}/commands`, `GET /devices/{id}/commands` |
| Dashboard | `GET /dashboard` |
| System | `GET /health`, `WS /ws?token=` |

### WebSocket messages
```
{"type":"telemetry","device_id":1,"device_key":"dev_x","ts":"...","values":{...}}
{"type":"alarm","event":"opened|resolved","alarm_id":5,"device_id":1,...}
{"type":"device_status","device_id":1,"online":false}
{"type":"command_result","command_id":12,"status":"acked"}
```

## 9. Security architecture
| Layer | Control |
|---|---|
| Broker | `allow_anonymous false`, password file, ACL per user, TLS (8883) in production |
| API | JWT (HS256), bcrypt, role checks via `require_role`, owner scoping on every query, rate limit on login |
| WebSocket | Token required; per-user Redis channel; ticket auth later to keep tokens out of logs |
| Secrets | `.env` never committed; device secret shown once, only hash stored; provisioning script should avoid exposing secrets in process lists (use stdin/env) |
| Network | Postgres and Redis not exposed publicly; CORS allow-list; HTTPS via Caddy or Nginx |
| Roles | admin, engineer, operator, viewer (see `PRD.md`) |
| Known gaps | `gateway` user can write for any device (fix with per-gateway users/ACL); JS-set cookie (move to httpOnly) |

## 10. Deployment
### Development
`docker compose up -d` starts postgres, redis, mosquitto, backend (with `--reload`), frontend. Profiles `gateway` and `sim` start only on request.

### Production
- `docker-compose.prod.yml`: no DB/Redis ports, no reload, built frontend.
- Caddy or Nginx for HTTPS in front of frontend and API.
- Mosquitto with TLS on 8883.
- Daily `pg_dump`, restore tested; telemetry retention job.
- Single-server sizing target: 100 devices at 5 s intervals.

## 11. Reliability and failure behavior
| Failure | Expected behavior |
|---|---|
| Broker restarts | Worker, gateways, devices reconnect automatically |
| Worker receives bad JSON | Logged, message dropped, worker continues |
| Database briefly down | Worker logs error per message; compose restarts services; consider buffering later |
| Redis down | Data still stored; live feed pauses and resumes |
| Machine unreachable | Gateway publishes offline, retries every 5 s |
| WebSocket drops | Client reconnects every 3 s |
| Device stops (Last Will) | Status offline persisted and pushed |

## 12. Observability
- Structured logs from backend, worker and gateway (`docker compose logs -f <service>`).
- Debug taps: `mosquitto_sub -t "lansubx/#" -v`, `websocat`, SQL queries (see `plan.md` section 10).
- Later: Prometheus metrics (messages per second, worker lag, DB insert time) and Grafana.

## 13. Scalability path
| Stage | Change |
|---|---|
| More messages | Batch inserts, device cache, Timescale hypertable |
| More workers | Shared subscriptions (`$share/`) so several workers split the load |
| More tenants | Organization model above owner_id |
| More protocols | New gateway loop only; contract unchanged |
| Config in UI | Gateway Phase 2: config in DB, gateway loads from backend |

## 14. Architecture decisions
| # | Decision | Reason | Trade-off |
|---|---|---|---|
| ADR-1 | MQTT as the only ingestion door | Uniform pipeline; any source can be added | Extra hop for HTTP-only devices (can add an HTTP-to-MQTT bridge) |
| ADR-2 | Worker inside the FastAPI process | Fewer containers, simple start | Scale-out later needs a separate worker |
| ADR-3 | Redis pub/sub for live feed | Decouples worker from WebSocket handlers | Not durable; missed messages are not replayed (history comes from REST) |
| ADR-4 | One telemetry row per metric | Simple queries, flexible metrics | Large table; needs retention/Timescale |
| ADR-5 | Gateway config in `config.yaml` first | Fast MVP | Duplicate entry until Phase 2 |
| ADR-6 | Mosquitto password file + ACL | Simple and secure enough for MVP | Manual provisioning; Dynamic Security later |
| ADR-7 | JWT in a cookie readable by JS (MVP) | Works with Next.js middleware quickly | XSS exposure; move to httpOnly cookie |
