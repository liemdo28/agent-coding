# Agent-Coding Performance Report
**Generated:** 2026-05-20T08:08:10.072Z

## Environment

- Node: v26.0.0
- CPU cores: 8
- Load average: 5.07, 22.26, 36.45
- Memory free/total: 1206MB / 16384MB
- Backend: http://127.0.0.1:4701

## Scenario Metrics

| Scenario | Requests | OK | Failed | Throughput/sec | Avg ms | P95 ms | Max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chat-session-create-100 | 100 | 100 | 0 | 1818.18 | 22 | 48 | 49 |
| chat-session-create-500 | 500 | 500 | 0 | 3125 | 28 | 146 | 152 |
| chat-session-list-1000 | 1000 | 1000 | 0 | 180.28 | 573 | 1161 | 5430 |
| task-assignment-10000 | 10000 | 10000 | 0 | 1790.83 | 88 | 168 | 357 |
| sandbox-execution-1000 | 1000 | 1000 | 0 | 2347.42 | 50 | 69 | 81 |
| simulation-worker-tiers | 240 | 240 | 0 | 458.02 | 150 | 196 | 323 |

## Runtime Snapshot

```json
{
  "ok": true,
  "uptimeSec": 13,
  "pid": 83957,
  "cpu": {
    "user": 6709772,
    "system": 1257188
  },
  "memory": {
    "rss": 131448832,
    "heapTotal": 51232768,
    "heapUsed": 19773240,
    "external": 2806015,
    "arrayBuffers": 354674
  },
  "counters": {
    "requests": 12843,
    "errors": 0,
    "sseConnections": 0,
    "jsonWrites": 912,
    "jsonWriteErrors": 0
  },
  "routes": [
    {
      "route": "POST /task",
      "count": 10002,
      "errors": 0,
      "avgMs": 0,
      "maxMs": 31
    },
    {
      "route": "GET /chat/sessions",
      "count": 1000,
      "errors": 0,
      "avgMs": 5,
      "maxMs": 170
    },
    {
      "route": "POST /execution",
      "count": 1000,
      "errors": 0,
      "avgMs": 0,
      "maxMs": 1
    },
    {
      "route": "POST /chat/sessions",
      "count": 600,
      "errors": 0,
      "avgMs": 0,
      "maxMs": 2
    },
    {
      "route": "POST /simulation",
      "count": 240,
      "errors": 0,
      "avgMs": 2,
      "maxMs": 6
    },
    {
      "route": "GET /health",
      "count": 1,
      "errors": 0,
      "avgMs": 3,
      "maxMs": 3
    }
  ],
  "projectRoot": "/Users/liemdo/Projects/agent-coding/.tmp-agent-stress-aAQhoe",
  "timestamp": "2026-05-20T08:08:22.890Z"
}
```
