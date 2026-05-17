# Engineering Accounting DB

The Engineering Accounting DB is the local operational intelligence system. If the Coding Knowledge DB is the brain, the Accounting DB is the audit and measurement layer.

## Purpose

Track:

- AI model runtime and resource usage.
- CPU, RAM, disk IO, GPU, VRAM, power estimate, token estimate, and storage growth.
- Patch lifecycle and risk.
- QA workload, score, failures, reruns, and trends.
- Rollbacks and regression impact.
- Bug cost and recurring issue cost.
- Local model performance and efficiency.
- Immutable audit events.

## Core Tables

Minimum canonical tables:

- `agent_sessions`
- `resource_usage` / `resource_samples`
- `model_runtime_usage`
- `patch_transactions`
- `qa_runs` / `qa_transactions`
- `rollback_transactions`
- `bug_costs`
- `model_performance`
- `audit_logs`

## Patch Lifecycle

```text
GENERATED -> REVIEWED -> APPROVED -> APPLIED -> QA_RUNNING -> QA_PASSED -> DEPLOY_READY -> DEPLOYED
```

Failure path:

```text
GENERATED -> APPLIED -> QA_FAILED -> ROLLED_BACK -> NEEDS_REWORK
```

Every patch must have a stable ID, files changed, LOC added/removed, risk level, approval status, QA linkage, and rollback history.

## Resource Tracking

The monitor should run offline and sample every 1-5 seconds when active. Windows support is a priority, with graceful fallback when GPU data is unavailable.

Required CLI:

- `accounting monitor start`
- `accounting monitor stop`
- `accounting monitor status`
- `accounting resources --session sess_001`
- `accounting resources --project rawwebsite`

## Analytics

Project Health Score should combine:

- QA stability: 30%
- Patch success: 20%
- Rollback rate: 15%
- Bug recurrence: 15%
- Resource efficiency: 10%
- Security/audit risk: 10%

Future intelligence should include failure forecasting, regression prediction, model selection advice, resource optimization, bug cost forecasting, and root-cause accounting.

## API and Dashboard

The Accounting API is localhost-only, currently centered on `127.0.0.1:8844`.

Expected endpoint families:

- `/stats`
- `/sessions`
- `/patches`
- `/qa`
- `/models`
- `/costs`
- `/risks`
- `/analytics/overview`
- `/analytics/project-health`
- `/analytics/qa-trends`
- `/analytics/patch-risk`
- `/analytics/bug-cost`
- `/analytics/model-efficiency`
- `/analytics/resource-cost`

Dashboard views should cover overview, projects, sessions, resources, patches, QA, bugs, models, risks, reports, CEO summary, and developer detail.
