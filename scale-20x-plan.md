# Scale 20x Plan — Reality Check

**Repo:** `liemdo28/agent-coding`
**Checked branch:** `claude/local-offline-ai-agent-PQx1C`
**Local HEAD checked:** `e813d07`
**Latest remote branch observed:** `origin/claude/local-offline-ai-agent-PQx1C @ 9d00048`
**Status date:** 2026-05-18

This document records the actual scale-plan state. The repo does not yet contain the requested baseline report or G1-G4 rollout timeline.

## Status Table

| Hạng mục | Trạng thái | Đường dẫn / Ghi chú |
|---|---|---|
| Scale baseline report | Chưa bắt đầu | `reports/scale-baseline.md` does not exist. |
| G1-G4 timeline | Chưa bắt đầu | No G1-G4 timeline document was found. |
| First required action | Chưa bắt đầu | Create `reports/scale-baseline.md` before coding scale work. |

## Required Baseline Content

`reports/scale-baseline.md` should measure the current system before any scale work begins:

| Area | Metric |
|---|---|
| Repo size | JS files, LoC, package count, DB count |
| Build health | `npm run build`, `npm run lint`, root tests, integration tests |
| Accounting engine | 167-test suite status |
| KB | document count, chunk count, DB size, query latency if available |
| Agent runtime | command sandbox, audit logging, security check status |
| Eval | which benchmarks are scaffolded, which are runnable, which have data |
| Performance | scan latency, memory use, KB query p50/p95/p99 |
| CI | GitHub Actions status and native dependency build status |

## Proposed G1-G4 Timeline Placeholder

This is not yet implemented in the repo. A concrete plan should be added after the baseline is measured:

| Gate | Purpose | Exit Criteria |
|---|---|---|
| G1 | Baseline and correctness | `reports/scale-baseline.md` exists; build/lint/test status recorded; known blockers listed. |
| G2 | Runtime hardening | Sandbox, native dependency install, security report, and KB artifact flow are reproducible. |
| G3 | Eval and measurement | HumanEval/MBPP data available offline; scorecard generated; nightly eval plan documented. |
| G4 | Scale execution | Performance targets chosen; bottlenecks ranked; implementation work split into measurable tasks. |

## Current Assessment

Do not start broad scale code yet. The first real task is to create `reports/scale-baseline.md` from measured local and CI data, then use that report to decide G1-G4 dates and owners.
