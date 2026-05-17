# Agent Coding Documentation

This documentation set is the canonical planning source imported from the shared ChatGPT architecture session: <https://chatgpt.com/s/cd_6a092b3d06048191ab704fd165a8a8da>.

The repository is organized around a local-first AI engineering ecosystem: a local coding agent, an offline coding knowledge database, an engineering accounting database, QA intelligence, and governance policies that keep source code, telemetry, credentials, and operational records on the developer machine or trusted local infrastructure.

## Documentation Map

| Area | Document |
| --- | --- |
| System architecture | [System Overview](architecture/system-overview.md) |
| Local agent | [Local AI Agent](architecture/local-ai-agent.md) |
| Offline constraints | [Offline-First Policy](architecture/offline-first-policy.md) |
| Coding knowledge DB | [Coding Knowledge DB](database/coding-knowledge-db.md) |
| Engineering accounting DB | [Engineering Accounting DB](database/engineering-accounting-db.md) |
| QA architecture | [QA System Overview](qa/qa-system-overview.md) |
| Phase plan | [Phase Plan](phases/phase-plan.md) |
| Git policy | [Git Sync Policy](devops/git-sync-policy.md) |
| Local dev flow | [Local Development Flow](devops/local-development-flow.md) |
| Setup | [Mac](setup/mac-setup.md), [Windows](setup/windows-setup.md), [Ollama](setup/ollama-setup.md) |
| Security | [Local Security Policy](security/local-security-policy.md) |
| Consolidation workflow | [Source Consolidation](workflows/source-consolidation.md) |
| Roadmap | [Master Roadmap](roadmap/master-roadmap.md) |

## Canonical Principles

- Runtime must be local/offline unless a human explicitly performs a source-sync operation.
- Local APIs bind only to loopback addresses.
- Knowledge and accounting databases use SQLite first.
- Raw imported data is never indexed directly; it must pass validation and approval.
- Patches, QA runs, rollbacks, model usage, and resource samples should become auditable local events.
- High-risk patch automation must require manual approval.
