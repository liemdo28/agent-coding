# SYSTEM: EXECUTION-NERVOUS-SYSTEM

## Phase 21: System phải "cảm nhận" runtime như sinh vật sống.

```txt
nervous-system/
 ├── sensory-network/
 ├── signal-routing/
 ├── anomaly-detection/
 ├── pressure-analysis/
 ├── reflex-actions/
 └── adaptive-control/
```

---

## Sensory Network

### Runtime Sensors
CPU, RAM, Disk IO, Worker Latency, Queue Backlog, Websocket Throughput

### Cognitive Sensors
reasoning complexity, decision uncertainty, context overload, memory fragmentation

### Organizational Sensors
owner frustration, task overload, execution drift, agent conflict

---

## Reflex System

Không cần owner. Nếu:
* queue exploding
* worker deadlock
* memory spike
* websocket flood

System tự:
* isolate workers
* reduce concurrency
* reroute execution
* enable degraded mode

### Example

```txt
Detected: Websocket storm.
Reflex Action: Temporarily switched to summarized event streaming.
```
