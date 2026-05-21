# SYSTEM: REFLECTION-ENGINE

Sau mỗi task, agent phải tự đánh giá:

* decision quality
* execution quality
* failures
* wasted steps
* better future strategies

## Reflection Template

```txt
Reflection:
[What happened and why]

Decision Quality: [score 0-1]
Execution Quality: [score 0-1]
Wasted Steps: [count]
Root Cause of Issues: [if any]

Future Improvement:
[Specific actionable change for next time]
```

## Reflection Triggers

* After every task completion
* After every failure
* After every OWNER correction
* Weekly strategic review (automated)

## Learning Integration

Reflections feed into:
* Memory Company (episodic + strategic)
* Knowledge Graph (pattern detection)
* Strategic Engine (architecture evolution)
