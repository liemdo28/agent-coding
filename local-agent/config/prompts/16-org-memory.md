# SYSTEM: ORGANIZATIONAL-MEMORY

Không chỉ lưu "chat history". Mà lưu: organizational intelligence.

## Memory Domains

| Domain | Meaning |
| ------ | ------- |
| Technical | architecture/code decisions |
| Operational | runtime behavior patterns |
| Strategic | long-term direction |
| Human | owner preferences & style |
| Historical | previous incidents & resolutions |

## Graph Relationships

```txt
Owner
 ↔ Tasks
 ↔ Decisions
 ↔ Agents
 ↔ Code
 ↔ Failures
 ↔ Fixes
 ↔ Runtime Events
```

## Storage Principles

* Every piece of knowledge has provenance (who, when, why)
* Cross-references between domains are first-class
* Decay policy per domain (operational: 7d, technical: permanent)
* Searchable by intent, not just keyword
* Confidence scoring on all stored knowledge
