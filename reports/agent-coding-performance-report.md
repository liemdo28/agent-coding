# Agent-Coding Performance Report
**Generated:** 2026-05-20T03:06:36.414Z

## Environment

- Node: v25.8.0
- CPU cores: 8
- Load average: 13.00, 17.04, 16.79
- Memory free/total: 64MB / 16384MB
- Backend: http://127.0.0.1:4701

## Scenario Metrics

| Scenario | Requests | OK | Failed | Throughput/sec | Avg ms | P95 ms | Max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chat-session-create-100 | 100 | 100 | 0 | 684.93 | 58 | 131 | 133 |
| chat-session-create-500 | 500 | 500 | 0 | 1043.84 | 86 | 442 | 456 |
| chat-session-list-1000 | 1000 | 1000 | 0 | 213.04 | 530 | 653 | 4308 |
| task-assignment-10000 | 10000 | 10000 | 0 | 3459.01 | 46 | 60 | 105 |
| sandbox-execution-1000 | 1000 | 1000 | 0 | 3546.1 | 33 | 47 | 48 |
| simulation-worker-tiers | 240 | 240 | 0 | 588.24 | 116 | 217 | 250 |

## Runtime Snapshot

```json
{
  "ok": true,
  "uptimeSec": 9,
  "pid": 93337,
  "cpu": {
    "user": 6742666,
    "system": 1060291
  },
  "memory": {
    "rss": 126009344,
    "heapTotal": 51232768,
    "heapUsed": 20309992,
    "external": 2903118,
    "arrayBuffers": 454220
  },
  "counters": {
    "requests": 12843,
    "errors": 0,
    "sseConnections": 0,
    "jsonWrites": 882,
    "jsonWriteErrors": 0
  },
  "routes": [
    {
      "route": "POST /task",
      "count": 10002,
      "errors": 0,
      "avgMs": 0,
      "maxMs": 2
    },
    {
      "route": "GET /chat/sessions",
      "count": 1000,
      "errors": 0,
      "avgMs": 5,
      "maxMs": 22
    },
    {
      "route": "POST /execution",
      "count": 1000,
      "errors": 0,
      "avgMs": 0,
      "maxMs": 2
    },
    {
      "route": "POST /chat/sessions",
      "count": 600,
      "errors": 0,
      "avgMs": 1,
      "maxMs": 5
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
      "avgMs": 5,
      "maxMs": 5
    }
  ],
  "projectRoot": "/Users/liemdo/Projects/agent-coding/.tmp-agent-stress-A6eHHa",
  "timestamp": "2026-05-20T03:06:46.149Z"
}
```
