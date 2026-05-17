# Phase Plan

This document breaks the roadmap into implementation checkpoints.

## Coding Knowledge DB

| Phase | Goal | Acceptance Signal |
| --- | --- | --- |
| 1 | SQLite schema, CLI, local API, seed data | DB initializes and local API health passes |
| 2 | Ingestion pipeline | Raw data moves through processed, reviewed, approved, indexed states |
| 3 | Ranked search | Search, error, recipe, examples, and QA queries return scored JSON |
| 4 | Initial knowledge pack | At least 280 useful approved records, no secrets, no unsafe commands |
| 5 | Advanced intelligence | Diagnosis, root cause, project fingerprint, risk, and graph responses work offline |
| 6 | Review dashboard | Team can review, approve, reject, search, audit, backup, and export knowledge |

## Engineering Accounting DB

| Phase | Goal | Acceptance Signal |
| --- | --- | --- |
| 1 | Foundation | SQLite DB, CLI, API, immutable logs, and basic stats work |
| 2 | Resource tracking | CPU/RAM/disk/GPU/model runtime samples are recorded offline |
| 3 | Patch and QA ledger | Patches, QA runs, rollbacks, approvals, and score changes are linked |
| 4 | Analytics dashboard | Project health, QA trends, bug cost, patch risk, model efficiency are visible |
| 5 | AI accounting intelligence | Failure forecasts and model/resource recommendations cite local evidence |
| 6 | Ecosystem governance | Event bus, policy engine, backup/restore, and approval gates are wired |

## Local Agent Integration

The agent should integrate each phase in this order:

1. Scan project and fingerprint stack.
2. Query Coding DB for known patterns and fixes.
3. Generate patch proposal.
4. Estimate risk and required QA.
5. Record patch event in Accounting DB.
6. Run QA.
7. Record QA/resource/model results.
8. Feed successful and failed outcomes back into local knowledge.

## Deployment and Automation Gates

Deployment readiness is a local QA decision before it is a hosting action. Future deployment automation must require:

- Clean Git status.
- No secret findings.
- Build and test pass.
- Startup proof for web/UI changes.
- Rollback plan.
- High-risk approval record.
- Accounting event for deployment start/completion/failure.
