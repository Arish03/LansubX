# Architecture Decision Records (ADRs) & Message Shapes

## 1. Architecture Decision Records

### ADR-1: MQTT as the Single Ingestion Ingress
- **Context:** Industrial devices utilize diverse protocols (Modbus, OPC UA, LoRaWAN, proprietary serial). Direct multi-protocol support in the core ingestion service creates tight coupling.
- **Decision:** Use MQTT as the singular ingestion door. All non-MQTT protocols must be bridged by dedicated gateway services that translate industrial payloads into standard Lansub X MQTT telemetry frames.
- **Consequences:** Clean separation of concerns; gateways can be developed, upgraded, and containerized independently.

### ADR-2: MQTT Ingestion Worker Embedded in FastAPI Lifespan
- **Context:** For the MVP, running a separate background worker container increases operational complexity and deployment friction.
- **Decision:** Embed an asynchronous `aiomqtt` worker loop directly into FastAPI's `lifespan` context.
- **Consequences:** Single container for API and ingestion; simplifies local setup and testing. Scale-out in future stages can decouple the worker into a standalone service utilizing shared subscriptions (`$share/`).

### ADR-3: Redis Pub/Sub for Live WebSocket Fan-Out
- **Context:** Need to stream real-time telemetry, alarm events, and command receipts to connected browser clients without overloading the primary database or tightly coupling WebSocket connections to MQTT connections.
- **Decision:** Worker publishes ingested events to Redis channels partitioned by owner ID (`live:{owner_id}`). WebSocket endpoints subscribe to the respective user channel and relay frames.
- **Consequences:** Lightweight, sub-millisecond fan-out. Missed messages during network disconnection are not replayed over Redis (historical catch-up is queried via REST).

### ADR-4: One Telemetry Row Per Metric
- **Context:** Heterogeneous industrial devices report different subsets of metrics dynamically. Fixed-schema wide tables (`col1, col2, ...`) require schema alterations for new sensor types.
- **Decision:** Store telemetry in a normalized narrow format: `(id, device_id, metric, value, ts)`.
- **Consequences:** Flexible metric schemas; indexed queries on `(device_id, metric, ts)`. Scalability path will adopt TimescaleDB hypertables or time-based partitioning as volume expands.

### ADR-5: Gateway Configuration in `config.yaml` for MVP
- **Context:** Full dynamic gateway configuration from the web UI requires complex database-to-gateway sync logic, configuration versioning, and remote restart hooks.
- **Decision:** Gateways read connection configurations, register maps, and polling intervals from `config.yaml` at startup for MVP (Phase 1).
- **Consequences:** Rapid, reliable MVP delivery. Phase 2 will transition configuration into the database with web UI editing.

### ADR-6: Password File & Static ACL for Mosquitto Broker
- **Context:** Dynamic security plugin for Mosquitto requires persistent SQLite/JSON dynamic plugins which add operational overhead.
- **Decision:** Use static Mosquitto password files and topic ACLs for MVP with a helper script (`scripts/add_mqtt_user.sh`).
- **Consequences:** Predictable, robust access control adhering to least privilege. Direct-device provisioning utilizes script-assisted password updates.

### ADR-7: JWT in Bearer Tokens and Cookies
- **Context:** Web application needs seamless authentication across both REST API calls and WebSocket connections.
- **Decision:** Issue standard JWT access tokens. REST requests send `Authorization: Bearer <token>`, WebSocket connects with `/ws?token=<token>`.

---

## 2. Topic Hierarchy & Message Shapes

### 2.1 Telemetry
- **Topic:** `lansubx/{device_key}/telemetry`
- **Direction:** Device / Gateway -> Broker -> Ingestion Worker
- **Payload:**
```json
{
  "ts": "2026-10-08T12:00:00Z",
  "values": {
    "temperature": 74.5,
    "pressure": 101.3,
    "motor_speed": 1450
  }
}
```
*Note: `ts` is optional; if omitted, the ingestion worker applies the current server UTC timestamp. All values must be numeric (booleans are converted to 1/0).*

### 2.2 Device Status & Last Will
- **Topic:** `lansubx/{device_key}/status`
- **Direction:** Device / Gateway -> Broker -> Ingestion Worker
- **Payload:**
```json
{
  "online": true,
  "source": "modbus"
}
```
*Note: Devices configure an MQTT Last Will and Testament (LWT) on this topic with `{"online": false}`.*

### 2.3 Device Command
- **Topic:** `lansubx/{device_key}/command`
- **Direction:** API Backend -> Broker -> Device / Gateway
- **Payload:**
```json
{
  "id": 42,
  "action": "set_speed",
  "params": {
    "target_rpm": 1200
  }
}
```

### 2.4 Command Acknowledgment
- **Topic:** `lansubx/{device_key}/command/ack`
- **Direction:** Device / Gateway -> Broker -> Ingestion Worker
- **Payload:**
```json
{
  "id": 42,
  "ok": true,
  "message": "Speed set to 1200 RPM"
}
```

### 2.5 Real-Time WebSocket Frames (Browser Client)
- **Endpoint:** `WS /ws?token={jwt}`
- **Telemetry Event:**
```json
{
  "type": "telemetry",
  "device_id": 1,
  "device_key": "dev_a1b2c3d4e5f6",
  "ts": "2026-10-08T12:00:00Z",
  "values": {
    "temperature": 74.5
  }
}
```
- **Alarm Event:**
```json
{
  "type": "alarm",
  "event": "opened",
  "alarm_id": 8,
  "device_id": 1,
  "metric": "temperature",
  "severity": "critical",
  "value": 92.4,
  "opened_at": "2026-10-08T12:00:00Z"
}
```
- **Device Status Event:**
```json
{
  "type": "device_status",
  "device_id": 1,
  "device_key": "dev_a1b2c3d4e5f6",
  "online": false
}
```
- **Command Result Event:**
```json
{
  "type": "command_result",
  "command_id": 42,
  "device_id": 1,
  "status": "acked"
}
```
