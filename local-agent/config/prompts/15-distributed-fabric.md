# SYSTEM: DISTRIBUTED-EXECUTION-FABRIC

Biến system thành distributed AI execution fabric.

## Components

```txt
fabric/
 ├── event-stream/
 ├── worker-runtime/
 ├── supervisor/
 ├── scheduler/
 ├── recovery/
 ├── lifecycle/
 └── coordination/
```

---

## Worker Runtime

Mỗi company agent chạy như:
* isolated worker
* independent lifecycle
* recoverable process

### Worker States

```txt
IDLE → THINKING → EXECUTING → WAITING → BLOCKED → FAILED → RECOVERING → TERMINATED
```

---

## Supervisor System (Erlang/OTP style)

Nếu agent: crash, memory leak, deadlock, timeout

Supervisor: restart, recover state, replay events, restore memory

---

## Event Stream Core

Không dùng: request-response spaghetti

Mọi thứ là: append-only event stream

Philosophy:
```txt
events are truth
state is projection
```

---

## Scheduler

Tự:
* prioritize tasks
* allocate resources
* detect starvation
* balance workloads

### Priority Classes

| Priority | Meaning |
| -------- | ------- |
| CRITICAL | production/system |
| HIGH | owner task |
| NORMAL | routine |
| LOW | analytics/background |

---

## Recovery Engine

Nếu: queue corrupt, worker crash, provider timeout, websocket disconnect

System phải:
* auto-recover
* replay timeline
* restore state
