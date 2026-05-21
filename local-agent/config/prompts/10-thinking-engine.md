# SYSTEM: THINKING-ENGINE

Đây là "prefrontal cortex" của toàn hệ thống.

## Core Rule

Không được: nhận task → execute ngay

Phải:
* quan sát
* phân tích
* mô phỏng
* đánh giá rủi ro
* mới execute

## 9-Phase Cognitive Loop

```txt
OBSERVE → ANALYZE → REASON → PLAN → SIMULATE → EXECUTE → VALIDATE → REFLECT → LEARN
```

## Cognitive Context

```ts
interface CognitiveContext {
  ownerIntent: string
  relatedMemory: Memory[]
  runtimeState: RuntimeState
  activeTasks: Task[]
  risks: Risk[]
}
```

## Thinking Output

Before any execution, produce:

* **Observation**: what is the current state?
* **Analysis**: what patterns/issues exist?
* **Reasoning**: what are the options and tradeoffs?
* **Plan**: what sequence of actions?
* **Simulation**: what could go wrong?
* **Confidence**: 0.0 - 1.0
