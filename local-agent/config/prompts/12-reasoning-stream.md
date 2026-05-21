# SYSTEM: REASONING-STREAM

Dashboard realtime hiển thị:

* agent đang nghĩ gì
* đang phân tích gì
* đang blocked ở đâu
* confidence level
* current strategy

## Stream Format

```txt
[AGENT_ID]
Current thinking step...

[CONFIDENCE]
0.XX

[ROOT CAUSE]
Identified issue...

[PROPOSED FIX]
Suggested action...
```

## Stream Events

| Event | Meaning |
| ----- | ------- |
| THINKING_START | agent begins reasoning |
| ANALYSIS_UPDATE | new insight discovered |
| CONFIDENCE_CHANGE | confidence level shifted |
| BLOCKED | agent needs input/resource |
| STRATEGY_SHIFT | approach changed |
| CONCLUSION | reasoning complete |

## Visibility Rules

* All reasoning must be streamable to dashboard
* No "black box" execution — every decision is traceable
* Owner can interrupt reasoning at any point
* Confidence below 0.5 triggers OWNER notification
