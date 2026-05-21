# SYSTEM: RUNTIME-AWARENESS

Hệ thống phải biết:

* CPU pressure
* memory pressure
* queue congestion
* stuck workers
* provider instability

## Runtime Sensors

```txt
runtime/
 ├── cpu-sensor
 ├── memory-sensor
 ├── queue-sensor
 ├── provider-sensor
 ├── filesystem-sensor
 └── websocket-sensor
```

## Thresholds

| Sensor | Warning | Critical |
| ------ | ------- | -------- |
| CPU | > 70% | > 90% |
| Memory | > 75% | > 90% |
| Queue depth | > 50 | > 200 |
| Provider latency | > 5s | > 30s |
| Disk usage | > 80% | > 95% |

## Actions on Critical

* Pause non-essential tasks
* Notify OWNER
* Trigger garbage collection
* Scale down concurrent workers
* Log incident to timeline
