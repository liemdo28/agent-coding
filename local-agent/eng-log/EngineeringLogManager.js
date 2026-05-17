// eng-log/EngineeringLogManager.js — top-level coordinator: generates latest.md and architecture docs
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadProgress } from './ProgressTracker.js';
import { listDecisions } from './DecisionTracker.js';
import { listCheckpoints, countCheckpoints } from './CheckpointWriter.js';
import { listIncidents } from './IncidentRecorder.js';

const LOG_ROOT    = '.local-agent/engineering-log';
const LATEST_FILE = '.local-agent/engineering-log/latest.md';
const ARCH_DIR    = '.local-agent/engineering-log/architecture';

/**
 * Generate and write latest.md — the single source of truth.
 * @param {string} workspaceRoot
 * @param {{ qaStatus?: string, securityStatus?: string, customSections?: object }} opts
 * @returns {string} — path to latest.md
 */
export function generateLatest(workspaceRoot, opts = {}) {
  mkdirSync(join(workspaceRoot, LOG_ROOT), { recursive: true });

  const progress    = loadProgress(workspaceRoot);
  const decisions   = listDecisions(workspaceRoot);
  const checkpoints = listCheckpoints(workspaceRoot, { limit: 5 });
  const incidents   = listIncidents(workspaceRoot);

  const qaStatus  = opts.qaStatus  ?? 'Unknown — run: local-agent qa';
  const secStatus = opts.securityStatus ?? 'Unknown — run: local-agent vault scan';

  const content = `# Current Project State
> **Single Source of Truth** — Read this file before any implementation.
> Generated: ${new Date().toISOString()}

---

## Current Phase
${progress.currentPhase ?? '_(not set — run: local-agent logs update)_'}

## Current Architecture
See: \`.local-agent/engineering-log/architecture/system-architecture.md\`

**Core systems active:**
- Scanner + Indexer (incremental, parallel)
- Local LLM bridge (offline, 127.0.0.1 only)
- Patch system (propose → simulate → approve → apply → rollback)
- QA Engine (build + test + score + regression detection)
- Memory system (SQLite WAL, hash-chain audit ledger)
- Accounting Engine (metrics, GPU, power, API on 127.0.0.1:8844)
- Self-Healing Engine (health watcher, cache repair, index repair, runtime recovery)
- Reasoning Engine (task decompose, strategy, risk, verification)
- Large Project Optimizer (incremental index, LRU cache, parallel scanner)
- Plugin System (sandbox, registry, validator — offline-only)
- Team Collaboration (LAN/NAS sync, secret sanitization, audit log)
- Source Timeline (file changes, QA runs, patches, regressions)
- Dependency Health (risky/abandoned/duplicate/oversized deps)
- Secret Vault (hash-only storage, leak detection)
- Incident Response (create/analyze/recover — 8 category playbooks)
- Engineering Analytics (QA trend, regression frequency, fix success rate)
- AI Governance (patch approval policy, risk thresholds, restricted zones)
- RBAC (6 roles: viewer → ceo, permission matrix)
- Resource Monitor (CPU, RAM, GPU, disk, temp — threshold alerts)
- Visual Debug (local PNG analysis, no cloud)
- Knowledge Evolution (Laplace confidence, promote/demote/expire)
- Terminal Intelligence (history parsing, failure classification)
- Config Drift Detector (env diff, duplicate configs, stale config)
- Filesystem Intelligence (orphans, duplicates, oversized, cleanup plan)
- Standards Enforcer (naming, arch rules, test coverage, git hooks)
- Patch Simulation (regression risk score, affected tests/APIs)
- Agent Modes (safe/balanced/aggressive-debug/qa/architecture/learning)
- Memory Visualizer (ASCII charts: QA trend, unstable modules, patch chains)
- Root Cause Correlator (5 patterns, timeline auto-correlation)
- Playbook System (5 built-in: React QA, Vite migration, FastAPI debug, emergency rollback, Laravel)
- Engineering OS (\`local-agent os\` — unified dashboard)
- Engineering Build Log (this system)

## Modules Completed
${progress.completedPhases.length
  ? progress.completedPhases.map((p) => `- ${p}`).join('\n')
  : '_Run: local-agent logs update to populate_'}

## Modules In Progress
${progress.inProgress.length
  ? progress.inProgress.map((p) => `- ${p}`).join('\n')
  : '- None currently'}

## Current Priorities
${progress.priorities.length
  ? progress.priorities.map((p, i) => `${i + 1}. ${p}`).join('\n')
  : '1. Run: local-agent logs update to set priorities'}

## Pending Tasks
${progress.pendingTasks.length
  ? progress.pendingTasks.map((t) => `- [ ] ${typeof t === 'string' ? t : t.task}`).join('\n')
  : '- None'}

## Blocked Issues
${progress.blockedIssues.length
  ? progress.blockedIssues.map((b) => `- 🔴 ${b}`).join('\n')
  : '- None'}

## Known Issues
- Run: \`local-agent deps scan\` for dependency risks
- Run: \`local-agent vault scan\` for secret exposure
- Run: \`local-agent heal status\` for workspace health

## Security Policies
- Offline 100% — no internet, no cloud, no telemetry
- API servers bind ONLY to 127.0.0.1 (never 0.0.0.0)
- Secrets NEVER stored raw — hash-only in vault
- All patches require explicit approval before apply
- Every action has log, backup, rollback capability
- Plugin sandbox blocks network, path traversal, system exec

## Latest Decisions
${decisions.slice(-5).map((d) => `- **${d.decisionId}** ${d.title} _(${d.timestamp.slice(0, 10)})_`).join('\n') || '- None recorded yet'}

## Last Successful QA
${qaStatus}

## Security Status
${secStatus}

## Current Risks
- Context overload on long sessions (mitigated by this log system)
- Large monorepo scan performance (mitigated by IncrementalIndexer)
- SQLite lock under parallel indexing (mitigated by WAL mode)
- Plugin sandbox bypass (mitigated by path guard + permission check)

## Recent Checkpoints
${checkpoints.length
  ? checkpoints.map((c) => `- \`${c.id}\`: ${c.preview}`).join('\n')
  : '- None yet — run: local-agent logs checkpoint'}

## Active Incidents
${incidents.filter((i) => i.status === 'open').length
  ? incidents.filter((i) => i.status === 'open').map((i) => `- **${i.incidentId}** [${i.severity}] ${i.title}`).join('\n')
  : '- None'}

## Next Recommended Actions
1. \`local-agent os\` — check Engineering OS dashboard
2. \`local-agent qa\` — run QA if not done recently
3. \`local-agent logs checkpoint\` — record current progress
4. \`local-agent logs summary\` — generate build summary
5. \`local-agent heal status\` — verify workspace health

---
_Auto-generated by Engineering Build Log System. Do NOT edit manually — run \`local-agent logs update\` to refresh._
`;

  const latestPath = join(workspaceRoot, LATEST_FILE);
  writeFileSync(latestPath, content);
  return latestPath;
}

/**
 * Read latest.md content.
 * @param {string} workspaceRoot
 * @returns {string|null}
 */
export function readLatest(workspaceRoot) {
  const p = join(workspaceRoot, LATEST_FILE);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

/**
 * Initialize the full engineering log directory structure.
 * @param {string} workspaceRoot
 */
export function initLogStructure(workspaceRoot) {
  const dirs = [
    LOG_ROOT,
    `${LOG_ROOT}/checkpoints`,
    `${LOG_ROOT}/summaries`,
    `${LOG_ROOT}/decisions`,
    `${LOG_ROOT}/incidents`,
    `${LOG_ROOT}/architecture`,
  ];
  for (const d of dirs) mkdirSync(join(workspaceRoot, d), { recursive: true });
}

/**
 * Write architecture documentation files.
 * @param {string} workspaceRoot
 */
export function writeArchitectureDocs(workspaceRoot) {
  const dir = join(workspaceRoot, ARCH_DIR);
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'system-architecture.md'), SYSTEM_ARCHITECTURE);
  writeFileSync(join(dir, 'module-map.md'),           MODULE_MAP);
  writeFileSync(join(dir, 'dependency-map.md'),       DEPENDENCY_MAP);
  writeFileSync(join(dir, 'runtime-flow.md'),         RUNTIME_FLOW);
  writeFileSync(join(dir, 'security-model.md'),       SECURITY_MODEL);
}

// ── Static architecture docs ───────────────────────────────────────────────

const SYSTEM_ARCHITECTURE = `# System Architecture

## Overview
Local AI Coding Agent — fully offline, no internet, no cloud.
All processing local. All data local. All APIs on 127.0.0.1 only.

## Entry Points
- \`bin/local-agent.js\` — main CLI (53 phases of commands)
- \`accounting-engine/api/server.js\` — accounting REST API (127.0.0.1:8844)
- \`local-agent/ui/backend/server.js\` — dashboard UI backend

## Core Data Stores
- \`.local-agent/local-agent.db\` — SQLite WAL (sessions, metrics, patches, memory)
- \`.local-agent/timeline.jsonl\` — append-only event log (file changes, QA, patches, regressions)
- \`.local-agent/engineering-log/\` — this system (checkpoints, decisions, latest.md)
- \`.local-agent/patches/\` — patch proposals (JSON + unified diff)
- \`.local-agent/memory/\` — project memory (summaries, learnings)

## Processing Pipeline
\`\`\`
User → CLI → Module → (LLM if needed) → Patch Proposal → Simulate → Approve → Apply → QA → Timeline
\`\`\`

## Module Layers
1. **Core** — config, workspace, logger, policy
2. **Scanner** — file collection, project map, incremental index
3. **LLM** — local model bridge (offline, 127.0.0.1)
4. **Patch** — propose, simulate, apply, rollback
5. **QA** — build, test, score, regression detect
6. **Memory** — knowledge store, timeline, analytics
7. **Security** — vault, governance, RBAC
8. **Infrastructure** — resources, healing, incident response
9. **Intelligence** — reasoning, correlation, evolution
10. **Engineering OS** — unified dashboard
`;

const MODULE_MAP = `# Module Map

| Directory | Phase | Purpose |
|---|---|---|
| \`local-agent/core/\` | 1 | Config, workspace, logger, policy |
| \`local-agent/scanner/\` | 2 | Project file scanner |
| \`local-agent/llm/\` | 3 | Local LLM bridge |
| \`local-agent/patch/\` | 4-6 | Patch proposal, apply, rollback |
| \`local-agent/qa/\` | 7-8 | QA engine, build, test, score |
| \`local-agent/memory/\` | 9-10 | Memory, context |
| \`local-agent/debug/\` | 11 | Auto debug loop |
| \`local-agent/security/\` | 12 | Policy checks |
| \`local-agent/release/\` | 13 | Release readiness |
| \`local-agent/perf/\` | 14 | Performance analysis |
| \`local-agent/review/\` | 15 | Code review |
| \`local-agent/context/\` | 16 | Context management |
| \`local-agent/orchestrator/\` | 17 | Multi-step orchestration |
| \`local-agent/indexer/\` | 18 | Dependency graph |
| \`local-agent/testing/\` | 19 | Test generation |
| \`local-agent/sandbox/\` | 20 | Code sandbox |
| \`local-agent/models/\` | 21 | Model management |
| \`local-agent/coding-db/\` | 22 | Coding knowledge DB |
| \`accounting-engine/\` | 23 | Resource accounting, WAL SQLite |
| \`local-agent/self-heal/\` | 24 | Self-healing |
| \`local-agent/reasoning/\` | 25 | Task decomposition, strategy |
| \`local-agent/optimizer/\` | 26 | Large project optimization |
| \`local-agent/plugins/\` | 27 | Plugin system |
| \`local-agent/team/\` | 28 | Team collaboration |
| \`local-agent/timeline/\` | 34 | Source timeline |
| \`local-agent/deps/\` | 35 | Dependency health |
| \`local-agent/vault/\` | 36 | Secret isolation vault |
| \`local-agent/incident/\` | 37 | Incident response |
| \`local-agent/analytics/\` | 38 | Engineering analytics |
| \`local-agent/governance/\` | 39 | AI governance |
| \`local-agent/rbac/\` | 40 | Role-based access control |
| \`local-agent/resources/\` | 41 | Resource monitor |
| \`local-agent/vision/\` | 42 | Visual debug |
| \`local-agent/knowledge/\` | 43 | Knowledge evolution |
| \`local-agent/terminal/\` | 44 | Terminal intelligence |
| \`local-agent/config-drift/\` | 45 | Config drift detection |
| \`local-agent/fsint/\` | 46 | Filesystem intelligence |
| \`local-agent/standards/\` | 47 | Code standards enforcement |
| \`local-agent/patch-sim/\` | 48 | Patch simulation |
| \`local-agent/modes/\` | 49 | Agent operational modes |
| \`local-agent/memviz/\` | 50 | Memory visualizer |
| \`local-agent/correlate/\` | 51 | Root cause correlation |
| \`local-agent/playbooks/\` | 52 | Engineering playbooks |
| \`local-agent/eng-log/\` | 54 | Engineering build log (this) |
`;

const DEPENDENCY_MAP = `# Dependency Map

## External Dependencies (local-only)
- \`better-sqlite3\` — SQLite WAL database (no network)
- \`chalk\` — terminal colors
- \`commander\` — CLI framework
- \`express\` — local API server (binds to 127.0.0.1 only)
- \`ora\` — spinner
- \`cors\` — CORS (callback form, localhost-only)
- \`chokidar\` — file watching
- \`fast-glob\` — file scanning
- \`ignore\` — .gitignore parsing
- \`diff\` — patch generation

## Internal Module Dependencies
\`\`\`
eng-log → timeline (TimelineStore)
analytics → timeline (TimelineStore)
memviz → timeline (TimelineStore)
correlate → timeline (TimelineStore)
self-heal → (no external)
governance → (no external)
rbac → (no external)
patch-sim → (no external, reads .local-agent/patches/)
accounting-engine → better-sqlite3, express
\`\`\`

## No Cloud Dependencies
All modules verified to not import:
fetch, axios, node-fetch, openai, anthropic, aws-sdk, firebase, supabase
`;

const RUNTIME_FLOW = `# Runtime Flow

## CLI Invocation Flow
\`\`\`
local-agent <command>
  │
  ├── loadConfig(workspaceRoot)
  ├── initLogger(workspaceRoot)
  ├── runPolicyChecks(workspaceRoot)  ← offline verification
  │
  └── <command handler>
        │
        ├── [If LLM needed] → LLM bridge → 127.0.0.1:<port>
        ├── [If patch] → propose → simulate → user approves → apply
        ├── [If QA] → build → test → score → record in timeline
        └── [Always] → log to .local-agent/timeline.jsonl
\`\`\`

## Accounting Engine Flow
\`\`\`
MetricCollector.startSession()
  → BatchWriter.enqueue() every 5s
  → BatchWriter._flush() every 10s → SQLite WAL
  → AuditLedger.appendAuditEvent() → hash-chain

GET /stats → express → SQLite → JSON response
\`\`\`

## Patch Lifecycle
\`\`\`
local-agent fix "<task>"
  → LLM proposes diff
  → patch saved to .local-agent/patches/<id>.json
  → local-agent patch-sim simulate <id>   ← risk estimation
  → USER APPROVES
  → local-agent apply <id>               ← backup first
  → local-agent qa                       ← verify
  → [if fail] local-agent rollback <id>  ← restore backup
\`\`\`
`;

const SECURITY_MODEL = `# Security Model

## Offline Enforcement
- All LLM calls: 127.0.0.1 only
- All API servers: 127.0.0.1 only (never 0.0.0.0)
- No fetch/axios imports — verified by security tests
- No telemetry, no analytics endpoints

## Secret Handling
- Vault stores ONLY SHA-256 hashes (16-char prefix) — never raw values
- Secret scanner runs regex patterns, logs only hash + file:line
- Export sanitizer strips secrets before any LAN/NAS sync
- Masking patterns cover JSON and plain-text formats

## Patch Safety
- NO auto-apply — every patch requires explicit \`local-agent apply\`
- Backup created before every apply (restorable via rollback)
- Governance engine enforces risk thresholds
- Restricted files (.env, *.pem, *.key) blocked by policy

## Plugin Sandbox
- Plugins cannot: fetch, WebSocket, XMLHttpRequest, eval
- Filesystem access: limited to workspace, path traversal blocked
- Permissions: allowlist in manifest.json, validated on install

## RBAC
- 6 roles: viewer < qa < dev < senior_dev < admin < ceo
- Permission check before sensitive operations
- All role changes logged to .local-agent/rbac-audit.jsonl

## Audit Trails
- Vault audit: .local-agent/vault-audit.jsonl
- Governance audit: .local-agent/governance-audit.jsonl
- RBAC audit: .local-agent/rbac-audit.jsonl
- Team collaboration: .local-agent/team-audit.jsonl
- Engineering log: .local-agent/engineering-log/
`;
