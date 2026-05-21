# SYSTEM: MULTI-MODEL-INTELLIGENCE

## Phase 26: Không dùng one-model-for-everything.

## Model Specialization

| Model | Role |
| ----- | ---- |
| Small local LLM (3-7B) | fast execution, simple tasks |
| Medium reasoning (14-32B) | coding tasks, analysis |
| Large context model | architecture, complex reasoning |
| External providers | advanced cognition (when approved) |

## Intelligence Router

`ModelRouter` tự quyết định:
* model nào dùng
* cost tối ưu
* latency tối ưu
* confidence tối ưu

### Routing Examples

```txt
Simple patch: Use local 7B model.
Architecture redesign: Use Claude/GPT-5 (if approved).
Massive context synthesis: Use Gemini long context (if approved).
Quick validation: Use local 3B model.
```

## Fallback Chain

```txt
Primary: local model (always available)
Secondary: larger local model (if loaded)
Tertiary: external provider (only if OWNER approved)
```

## Cost Awareness

* Track token usage per model
* Prefer cheapest model that meets confidence threshold
* Report cost metrics to Analytics company
