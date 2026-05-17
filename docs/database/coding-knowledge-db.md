# Coding Knowledge DB

The Coding Knowledge DB is the local "coding brain" for the agent. It stores reusable engineering knowledge, not live agent state.

## Scope

The database should contain:

- Programming languages and framework guides.
- Build, runtime, dependency, auth, API, and deployment error patterns.
- Fix recipes with safe steps, verification, rollback, and risk level.
- Code examples that are original, short, licensed for internal use, and explained.
- QA/security checklists.
- Framework rules for React, Vite, Next.js, Astro, Laravel, FastAPI, WordPress, and related stacks.

## Core Schema

Minimum tables:

- `knowledge_items`
- `error_patterns`
- `code_examples`
- `fix_recipes`

Advanced intelligence adds:

- `error_clusters`
- `framework_rules`
- `project_fingerprints`
- `historical_fix_success`
- `historical_failures`
- `regression_patterns`
- knowledge graph edges connecting errors, frameworks, fixes, examples, QA checks, and project types.

## Ingestion Pipeline

Content must flow through:

```text
raw -> processed -> reviewed -> approved -> indexed
```

Raw content is never indexed directly. Supported inputs should include Markdown, JSON, JSONL, YAML, CSV, text, local docs, issue reports, QA reports, and fix history.

## Validation Rules

Reject any item that:

- Lacks title, problem, solution, verification, category, or language/framework context.
- Contains secrets, private keys, tokens, passwords, or unsafe commands.
- Requires internet at runtime.
- Copies long unlicensed code.
- Is too generic to help agent decisions.
- Duplicates an existing item without review.

## Search and Diagnosis

Required CLI/API behaviors:

- `coding-db search "vite build failed"`
- `coding-db error "Cannot find module"`
- `coding-db recipe "fix auth middleware"`
- `coding-db examples --language typescript --framework react`
- `coding-db qa "deployment checklist"`
- `coding-db diagnose ./build.log`
- `coding-db analyze-project ./my-project`
- `coding-db recommend-fix "Hydration failed"`
- `coding-db risk PATCH-001`
- `coding-db explain-cluster DEPENDENCY_RESOLUTION_ERROR`

Search ranking should combine keyword match, tags, framework match, error similarity, confidence score, historical success, project fingerprint, and risk.

## Phase Targets

- Phase 1: SQLite schema, CLI, local API, seed loader.
- Phase 2: ingestion, validation, review, approval, reports.
- Phase 3: ranked search, error normalization, local API.
- Phase 4: initial offline knowledge pack with at least 280 useful approved records.
- Phase 5: root cause, clustering, fix recommendation, project fingerprint, framework rules, regression risk, QA learning, knowledge graph.
- Phase 6: dashboard review workflow, backup/export, security audit, and governance integration.
