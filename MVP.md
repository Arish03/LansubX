# Lansub X: MVP Definition

## 1. MVP statement
**A logged-in user can connect a machine or device (through Modbus, OPC UA, LoRa, or direct MQTT), see its data live in the browser, get alarms when values go out of range, and send a command back.**

If this loop works end to end with real data, the MVP is done.

## 2. Who it is for
| User | Need |
|---|---|
| Plant/maintenance engineer | See machine values live, get alerted on faults |
| Operator | Watch status, acknowledge alarms, send simple commands |
| Admin | Add devices, manage users and roles |
| Viewer | Read-only monitoring |

## 3. What is IN the MVP
| Area | Included |
|---|---|
| Auth | Register first admin, login, JWT, roles (admin, engineer, operator, viewer) |
| Devices | Create, list, edit, delete; six kinds (esp32, sensor_controller, plc, modbus, opcua, lora); default data templates |
| Ingestion | MQTT worker, one function `process_telemetry`, numeric values only |
| Storage | PostgreSQL telemetry (one row per metric), history and latest-value APIs |
| Live | WebSocket per user, Redis fan-out |
| Alarms | Rules (> < >= <= ==), debounce, auto-resolve, acknowledge, resolve |
| Commands | Send to device over MQTT, ack tracking, timeout to failed |
| Gateways | Modbus TCP, OPC UA (polling), LoRa via ChirpStack; settings from `config.yaml` |
| Direct devices | ESP32 (sample code), sensor controller and PLC via MQTT settings |
| UI | Login, dashboard, devices list, add-device wizard, device detail with live chart and commands, alarms, rules, gateways, settings |
| Ops | Docker Compose, simulator, Alembic migrations, tests, production compose with HTTPS and MQTT TLS |

## 4. What is OUT of the MVP
| Excluded | Why / when |
|---|---|
| AI, Vision, CCTV, Edge menus | Not real features yet; add only when they work |
| Gateway config edited in the website | Post-MVP (gateway Phase 2) |
| Email/SMS/Telegram notifications | Post-MVP |
| Multi-tenant organizations | Post-MVP |
| Modbus write / OPC UA subscriptions | Post-MVP |
| Mobile app | Not planned |
| TimescaleDB, continuous aggregates | After real data volume is known |
| Audit log | Post-MVP |
| Dynamic Security plugin | Manual `add_mqtt_user.sh` is accepted for MVP |

## 5. MVP user stories (must have)
1. As an admin, I register and become the first admin.
2. As an engineer, I add a device by choosing a type and name, and receive a key (and a one-time secret for direct devices).
3. As an engineer, I see the default data template for the chosen type.
4. As a user, I see each device online or offline.
5. As a user, I open a device and see its latest values and a live chart.
6. As a user, I pick a time range and see history.
7. As an engineer, I create an alarm rule on a metric with a threshold, severity and debounce.
8. As an operator, I see a toast when an alarm opens and I can acknowledge it.
9. As a user, an alarm closes by itself when the value returns to normal.
10. As an operator, I send a command and see it become acked or failed.
11. As an admin, I assign roles; viewers cannot change anything.
12. As a user, I never see another user's devices or data.

## 6. MVP success criteria (acceptance)
- [ ] MQTT message to database row in under 1 second (local).
- [ ] Database row to browser chart in under 2 seconds.
- [ ] Anonymous MQTT and API access refused.
- [ ] User B cannot read user A's data (API and WebSocket).
- [ ] Alarm opens once, respects debounce, resolves automatically.
- [ ] Command round trip reaches `acked`; no answer becomes `failed`.
- [ ] Offline state agrees between REST and live feed.
- [ ] Modbus, OPC UA and LoRa simulators each produce visible data.
- [ ] System recovers after restarting mosquitto, backend and gateway.
- [ ] A clean machine runs everything from the README in 5 commands.

## 7. Scope guard (the "no" list)
Do not start any of these before the success criteria pass: new menus, new protocols, theme work, user profile photos, export/reports, analytics, anything marked OUT above.

## 8. MVP milestones
| Milestone | Week | Proof |
|---|---|---|
| M1 Secured broker + DB + login | 1 | Swagger works, anonymous refused |
| M2 First data stored | 2 | `mosquitto_pub` row appears in Postgres |
| M3 Alarms, live, commands | 3 | Alarm toast and command ack |
| M4 Usable UI | 5 | Full browser flow |
| M5 Three gateways | 7 | Simulated value from each protocol |
| M6 Release candidate | 8 | Acceptance script passes |

## 9. Estimated effort
About 96 hours plus 20-30% buffer (see `plan.md`).
