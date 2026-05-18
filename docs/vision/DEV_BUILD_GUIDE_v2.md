# Engineering Build Guide v2 — Local Agent
## How we build Sovereign Engineering Intelligence in 36 months

**Audience:** Engineering team (current + future hires)
**Companion doc:** `MANIFESTO_v2.md` — read it first, read it twice
**Baseline:** branch `claude/local-offline-ai-agent-PQx1C` — 253 files, 28 tests passing, 6 SQLite DBs, 1265 KB docs
**Horizon:** 36 months to V3.0; 60 months to V5.0
**Methodology:** trunk-based, weekly releases, monthly milestones, quarterly objectives, annual versions

---

## 0. How this document is organized

The roadmap has **36 monthly milestones (M1–M36)** grouped into **12 quarterly objectives (Q1–Q12)** grouped into **3 annual versions (V1, V2, V3)**.

Every milestone has:
- **Goal** — one sentence of intent
- **Deliverables** — numbered, code-level specifics
- **Acceptance criteria** — runnable script that proves it
- **Owner role** — which engineer leads
- **Risk** — what could fail
- **Dependency** — what must finish first

This is **the execution contract.** If you can't see how to ship a milestone by reading it, escalate before you start.

---

## 1. Current state (zero-baseline)

The audit on `claude/local-offline-ai-agent-PQx1C @ badaad4`:

| Metric | Baseline | V1 target | V2 target | V3 target |
|---|---|---|---|---|
| JS source files | 253 | 800 | 2,500 | 6,000 |
| Source LoC | 35,078 | 120,000 | 350,000 | 800,000 |
| CLI subcommands (local-agent) | 56 | 120 | 200 | 300 |
| Native languages parsed (AST) | 0 | 6 | 15 | 25 |
| SQLite databases | 6 | 10 | 15 | 20 |
| Tests | 28 | 2,500 | 12,000 | 35,000 |
| Eval: HumanEval pass@1 | unmeasured | ≥85% | ≥92% | ≥95% |
| Eval: SWE-bench-Lite resolve | unmeasured | ≥35% | ≥55% | ≥70% |
| Eval: SWE-bench-Full resolve | unmeasured | ≥15% | ≥40% | ≥60% |
| KB documents | 1,265 | 50,000 | 250,000 | 1,000,000 |
| Paying users | 0 | 10,000 | 100,000 | 500,000 |
| ARR | $0 | $5M | $50M | $250M |

---

## 2. Team plan (the 30-year engineers)

The 8-engineer founding team grows to 60 by V3. Hiring profile: **average 15+ years experience.** No early-career hires until V2 except via formal residency program. We are building infrastructure software; we hire infrastructure engineers.

### Year 1 — Founding team (8 engineers)

| Role | Headcount | Mission |
|---|---|---|
| **Tech Lead / Architect** | 1 | Architecture authority. Final say on cross-pillar designs. Code review jury chair. |
| **ML Systems Lead** | 1 | Local LLM stack, RAG, embeddings, model router, fine-tune pipeline. Distillation. |
| **Compiler/Language Engineer** | 2 | Tree-sitter + LSP integration. AST-level reasoning. Cross-language interop. |
| **Coding-Core Engineer** | 2 | The coding loop: context, plan, write, verify, fix. Multi-step patches. |
| **Infrastructure/Security Engineer** | 1 | Sandbox, audit, RBAC, packaging, code signing, supply chain. |
| **DA/Accounting Engineer** | 1 | Pillars 2 and 3 — advisory data analysis and accounting workflows. |

Tech Lead and ML Lead are founder-level — they get equity grants that reflect that.

### Year 2 — Scale (24 engineers, +16)

Add: 2nd Tech Lead (V2 multi-agent), 4 more Coding-Core, 2 Frontend/IDE, 2 SRE/Ops, 1 QA Director, 2 Security, 1 Compliance Engineer (FedRAMP / SOC2 attestation), 1 Performance Engineer, 2 Field Engineers (enterprise deployment), 1 DevRel.

### Year 3 — Platform (60 engineers, +36)

Add: dedicated team per pillar (6 pillars × ~5 engineers), platform/runtime team (8), security & compliance team (6), developer experience team (4), customer engineering team (8).

### Hiring filters

**Hire if:**
- 10+ years writing systems software
- Has shipped a production binary that's still in use after they left the company
- Comfortable in 3+ languages, expert in at least one
- Has owned an on-call rotation in production for a year+
- Has at least one strong opinion about a software principle that they'll defend on the record

**Don't hire if:**
- Has only worked at companies that build cloud SaaS
- Has never debugged a production memory leak
- Treats security as someone else's problem
- Wants to build "cool AI demos"
- Cares more about title than craft

---

## 3. V1 (Year 1) — The Senior Engineer in a Box

**Theme:** Ship a binary that is measurably as good as a senior engineer on most tasks, for one user, on one machine. By end of Year 1, V1.0 GA.

### Q1 (Months 1-3) — Foundation Hardening

#### M1 — Eval-Driven Development
**Goal:** We can measure ourselves before we change ourselves.
**Owner:** ML Lead + QA Director
**Deliverables:**
1. Vendor in HumanEval (164), MBPP (974), SWE-bench-Lite (300), MultiPL-E (18 languages), DS-1000 (1000 data science problems), CodeContests (Codeforces problems)
2. Build `eval/runner.js`: pluggable per-benchmark adapter pattern
3. Each benchmark: loader → prompt builder → LLM call → sandbox execution → scorer → result writer
4. `eval/scoreboard.js`: aggregates all benchmarks into a single scorecard, generates HTML report
5. CI nightly job runs full eval against the dev branch, publishes delta vs baseline
6. The **golden corpus**: 50 hand-picked real-world tasks across 10 languages from 10 OSS projects, run weekly
**Acceptance:** `npm run eval:all` produces a scorecard with results for all benchmarks. Nightly delta published.

#### M2 — Multi-Language AST Foundation
**Goal:** AST-level understanding for the Tier 1 six languages, with LSP integration for IDE-grade signals.
**Owner:** Compiler Lead
**Deliverables:**
1. Tree-sitter as native dep; grammars for JS, TS, Python, Go, Rust, Java bundled per platform
2. `local-agent/parser/`:
   - `TreeSitterAdapter.js` — multi-language parsing, incremental reparsing
   - `LanguageDetector.js` — extension + shebang + content heuristics
   - `SymbolExtractor.js` — functions, classes, methods, types, exports
   - `CallGraphBuilder.js` — caller→callee edges, resolved within-project, marked external otherwise
   - `TypeFlowAnalyzer.js` — flow types for TS/Python/Java (TypeScript compiler API + Pyright + Java type-info)
3. Schema: `symbols`, `call_edges`, `type_facts`, `imports` tables in new `code-graph.db`
4. LSP client wrapper — bring in language servers (tsserver, pyright, gopls, rust-analyzer, jdtls) for richer signals when available, parser fallback otherwise
**Acceptance:** Sample-project: 100% of symbols extracted, ≥95% calls resolved within-project. Same for 5 OSS reference projects (React, Django, Kubernetes, Cargo, Spring).

#### M3 — Coding Loop V1 (Read → Plan → Write → Verify → Fix)
**Goal:** A patch pipeline that reliably produces applyable, test-passing patches on small tasks.
**Owner:** Coding-Core Engineers
**Deliverables:**
1. `local-agent/coding-core/`:
   - `Intent.js` — parses a task into structured intent (target files, change-type, constraints)
   - `Context.js` — task-relevant context retrieval using AST graph + KB + memory
   - `Plan.js` — multi-step plan as a DAG of patch atoms
   - `Write.js` — generate code for one patch atom using structured-output LLM
   - `Verify.js` — pre-apply checks: lint, types, tests, no banned imports, governance rules
   - `Fix.js` — on failure, classify and retry (rewrite, expand context, switch model, escalate)
2. End-to-end wire: `local-agent fix "<task>"` invokes the full loop
3. Multi-model router (`local-agent/llm/ModelRouter.js`):
   - Intent parsing → 1.5B model (qwen2.5-coder:1.5b)
   - Code gen → 7B or 32B depending on complexity score
   - Code review → reasoning-tuned (deepseek-r1 distill)
4. Risk scoring (`local-agent/governance/RiskScore.js`): heuristic + LLM-as-judge
**Acceptance:**
- HumanEval pass@1 ≥ M1_baseline + 12pp
- MBPP pass@1 ≥ M1_baseline + 10pp
- SWE-bench-Lite resolve ≥ 8%
- Golden corpus: ≥35 of 50 tasks produce applyable patch

### Q2 (Months 4-6) — Coding Depth

#### M4 — Auto-Debug Loop V2 + Test Generation
**Goal:** When tests fail, the agent fixes them. When code lacks tests, it writes them.
**Owner:** Coding-Core + QA Lead
**Deliverables:**
1. `AutoDebugLoop.js` v2 with iteration cap, sandbox per attempt, ledger entry per iteration
2. `TestGenerator.js`: produces unit + integration tests in pytest/jest/go-test/cargo-test; verifies new tests pass against current code and fail against mutated code
3. Property-based testing (Hypothesis for Python, fast-check for JS, proptest for Rust)
4. Mutation testing: AST-mutation operators per language, "surviving mutants" report
5. Fuzzing harness scaffolding for security-sensitive code (libFuzzer, AFL targets)
**Acceptance:** Auto-debug fixes ≥75% of seeded failures in a 200-case corpus. Generated tests catch ≥60% of mutations on 20 OSS modules. SWE-bench-Lite resolve ≥ 15%.

#### M5 — Knowledge Graph & Cross-Project Learning
**Goal:** Memory compounds. Fixes on one project benefit the next.
**Owner:** ML Lead + Coding-Core
**Deliverables:**
1. `knowledge-graph.db` (already scaffolded) populated by scanner + patch lifecycle + auto-debug
2. Nodes: files, symbols, patches, fixes, errors, packages, KB concepts, ADRs, decisions
3. Edges: 25+ relation types (calls, imports, fixed-by, caused-by, similar-to, etc.)
4. `PatternAbstractor.js`: generalizes project-specific fixes into reusable patterns
5. `GenericFixApplicator.js`: when a similar issue appears, proposes the generalized fix
6. Memory compaction: low-confidence (used <3× in 90d, success <40%) compressed into aggregate patterns
**Acceptance:** ≥10 generic patterns abstracted from 50 fix corpus. Transfer test: pattern learned on project A applies to project B (seeded similarity).

#### M6 — Security Hardening & Sandbox
**Goal:** Pass an external pen-test. Prep for SOC2.
**Owner:** Security Lead
**Deliverables:**
1. Sandbox enhancements:
   - Linux: bubblewrap or unshare-based, seccomp filters
   - macOS: sandbox-exec profile
   - Windows: Job Objects + AppContainer
   - Network namespace: deny-all except 127.0.0.1
   - cgroup limits (CPU%, RAM, PIDs, IO)
   - Per-tool-call timeout (default 30s, configurable)
2. Secret scanner V2:
   - Entropy-based (Shannon ≥ 4.5)
   - Known-format regex (AWS, GCP, Azure, Stripe, Twilio, JWT, SSH, etc., ~80 formats)
   - Project-level secret index — same secret recognized after first scan
3. `vault/` module: encrypted local secret store with handle-based access
4. Prompt injection defense: all content from disk/tool/web treated as data, suspicious patterns flagged
5. RBAC: roles (viewer/contributor/reviewer/admin), per-action permissions, audit
**Acceptance:**
- Internal red-team week: 0 critical findings open
- Sandbox blocks: outbound network, fs writes outside project, fork bombs
- Secret scanner: 100% recall on known formats, ≥85% precision on entropy hits
- Prompt injection: ≥95% of seeded attacks flagged before action

### Q3 (Months 7-9) — Three-Pillar Foundations

#### M7 — Data Analysis Pillar
**Goal:** Senior data analyst capability, advisory only.
**Owner:** DA/Accounting Engineer + ML Lead
**Deliverables:**
1. `local-agent/da/`:
   - `DatasetLoader.js` — CSV, Parquet (DuckDB), SQLite, JSON, Excel (SheetJS), Arrow
   - `Profiler.js` — schema, distributions, nulls, outliers, time-range, cardinality
   - `QueryRunner.js` — NL → SQL → DuckDB; query plan explanation
   - `StatEngine.js` — t-tests, regressions, time-series decomp, correlation
   - `ChartGen.js` — Vega-Lite specs rendered locally
   - `NotebookExporter.js` — `.ipynb` files runnable locally
2. CLI: `local-agent da {profile,query,chart,forecast,notebook}`
3. DuckDB bundled as analytical engine
4. Strict: zero writes outside `/tmp/da-workdir/`, enforced and tested
**Acceptance:**
- 1GB CSV loaded in <5s
- NL→SQL: ≥85% correctness on 50-question benchmark
- Chart specs validate as Vega-Lite v5
- Notebook opens + executes in local Jupyter

#### M8 — Accounting Pillar Full Workflow
**Goal:** Multi-entity bookkeeping, advisory only.
**Owner:** DA/Accounting Engineer
**Deliverables:**
1. Accounting schema extensions: `entities`, `accounts`, `journal_entries`, `journal_lines`, `reconciliations`, `compliance_obligations`, `attachments`, `controls`
2. Importers: bank CSV, Toast POS, QuickBooks IIF, generic with column mapping, OFX
3. Reconciliation workflow: load → match → flag mismatches → propose adjusting entries
4. Period close: trial balance, P&L, balance sheet, statement of cash flows, freeze period, archive evidence
5. Compliance calendar: 940/941/944, W-2, sales tax, TABC, BOI, foreign equivalents
6. Multi-entity consolidation
**Acceptance:** Real customer workflow (the founder's HEO Holding / Bakudan / Jinya structure) closes a fiscal quarter end-to-end with audit trail, no human spreadsheet outside the agent.

#### M9 — Performance & Scale Round 1
**Goal:** Comfortable on 1M LoC codebases on a 2020-era laptop.
**Owner:** Performance Engineer (new hire) + Coding-Core
**Deliverables:**
1. Incremental indexing: chokidar-driven, only changed files reparsed
2. Worker-thread pool for tree-sitter parsing, configurable core count
3. Lazy file loading with LRU hot cache (~100MB default)
4. KB query optimization: FTS5 candidate retrieval, cosine re-rank in C via N-API
5. DB maintenance: scheduled VACUUM, ANALYZE, WAL checkpoint after batch
6. Memory budget cap, configurable, default 2GB; cold caches spilled to disk
**Acceptance:**
- Initial scan of 1M-LoC corpus < 4 min, RAM peak < 2GB
- Incremental rescan (10 changed files) < 5s
- KB query p50 < 200ms, p99 < 800ms on 13K-chunk DB
- Steady-state RAM after 8h < 1.5GB

### Q4 (Months 10-12) — V1.0 GA

#### M10 — IDE Integration (VS Code + Neovim + JetBrains)
**Goal:** Engineers don't switch to a terminal.
**Owner:** Frontend/IDE Engineer
**Deliverables:**
1. VS Code extension: ghost-text completion, inline diagnostics, Code Actions, side panel with cited sources, patch diff view
2. Neovim plugin (Lua): nvim-cmp source, commands, telescope integration
3. JetBrains plugin: inline completion, Tool Window, action menu integration
4. Backend: `ide-bridge` Unix socket / named pipe server, versioned JSON-RPC protocol
5. Distribution: VS Code marketplace + .vsix sideload (air-gapped); Neovim lazy.nvim + tarball; JetBrains marketplace + .zip
**Acceptance:**
- All three IDEs install in <2 min
- Inline completion latency p50 < 300ms, p99 < 1.5s
- All flows verified offline by network monitor

#### M11 — Binary Distribution & Installer
**Goal:** `curl | sh` on Mac/Linux, `.msi` on Windows, working in 5 min, no Node install required.
**Owner:** Infra/Security Engineer
**Deliverables:**
1. Packaged as single binary per platform (node-sea or pkg): mac arm64/x64, linux x64/arm64, windows x64
2. Native deps (better-sqlite3, tree-sitter) pre-built per platform
3. Signed installers: macOS .pkg (Apple Developer cert), Windows .msi (EV cert), Linux .deb/.rpm/AppImage
4. License system: ed25519-signed key, local validation, audit-ledger logged on activation
5. Offline-friendly update: signed .tar.gz artifacts, manual `local-agent update <path>`
**Acceptance:** All 5 binaries built, signed, smoke-tested. Installer completes in <2 min. Update preserves DB + ledger.

#### M12 — V1.0 GA Release
**Goal:** Real customers. Real money.
**Owner:** All
**Deliverables:**
1. Documentation site (static, hostable anywhere): 200+ pages
2. Onboarding: from install to first useful patch in <15 min
3. External security audit (real third party, ~$50k budget)
4. Beta program closes with 50 paying customers
5. Pricing live, Stripe integrated for the company entity (customer payment data never enters the product)
6. SLA-backed support tier for Team/Enterprise
**Acceptance:**
- HumanEval pass@1 ≥ 85%
- MBPP pass@1 ≥ 80%
- SWE-bench-Lite resolve ≥ 35%
- External audit: 0 critical, ≤2 high (all mitigated)
- Beta NPS ≥ 50
- Payment flow works for Solo + Team SKUs
- **1,000 paying users in first 60 days post-GA**

---

## 4. V2 (Year 2) — The Engineering Team in a Box

**Theme:** Multi-agent orchestration. 1 person becomes a 7-person team. By end of Year 2, V2.0 GA.

### Q5 (Months 13-15) — Multi-Agent Foundation

#### M13 — Specialist Agent Framework
**Goal:** Agents with distinct roles, distinct prompts, distinct context budgets, coordinated by an orchestrator.
**Owner:** Tech Lead + ML Lead
**Deliverables:**
1. `local-agent/agents/`:
   - `Architect.js` — owns the design and the plan; gets to overrule specialists
   - `FrontendEngineer.js` — UI/UX, accessibility, browser quirks
   - `BackendEngineer.js` — services, APIs, databases
   - `SRE.js` — reliability, deploy, monitoring, runbooks
   - `SecurityEngineer.js` — threat modeling, vuln assessment
   - `DataEngineer.js` — pipelines, schemas, lineage
   - `QAEngineer.js` — test design, coverage, regressions
2. Each agent has: a system prompt, a context budget, an action vocabulary, a reputation score, a memory namespace
3. Agent comms protocol: structured messages, deliberation transcript stored in audit ledger
4. Arbitration: Architect makes final call when specialists disagree; transcript surfaced to human

#### M14 — Distributed Problem Solving
**Goal:** The seven agents solve a problem together that no single agent could.
**Owner:** Tech Lead + Coding-Core
**Deliverables:**
1. Task decomposition: Architect breaks task into sub-tasks, assigns to specialists
2. Parallel execution: specialists work concurrently in their own sandbox
3. Conflict resolution: when sub-task outputs conflict, Architect arbitrates
4. Consensus checkpoint: before applying, all relevant specialists must sign off (yes/no/abstain)
5. Human-in-the-loop: human sees the deliberation transcript and the final plan, approves once
**Acceptance:** A 200-line cross-cutting refactor (touches backend API + frontend client + tests + docs) ships in one human approval, all signed off by relevant specialists, with deliberation visible.

#### M15 — Formal Verification of Agreement
**Goal:** When agents agree, they really agree — not just both said "looks fine."
**Owner:** ML Lead
**Deliverables:**
1. Verification predicates: agent must justify a vote with citations from code/KB/memory
2. Cross-check: a second LLM call reads the deliberation and outputs "do they agree on the same thing?"
3. Disagreement detector: surfaces actual conflict (semantic) vs. apparent conflict (different words for same thing)
4. Audit trail: every consensus decision has a verifiable trace
**Acceptance:** Agreement-verification precision ≥ 90% on a 100-case adversarial test set.

### Q6 (Months 16-18) — Sprint-Scale Autonomy

#### M16 — Multi-Day Work Sessions
**Goal:** The agent works for multiple days on a goal, with daily human checkpoints.
**Owner:** Coding-Core + Tech Lead
**Deliverables:**
1. Session: persistent context across days, picks up where it left off
2. Daily checkpoint: morning standup-style report to user, awaits go/no-go
3. Long-horizon memory: project notes, decisions, blockers
4. Resumable: laptop closed overnight, agent resumes on wake without losing context

#### M17 — Sprint Planning & Execution
**Goal:** Agent plans a 1-week sprint, executes it across days, reports.
**Owner:** Tech Lead + Coding-Core
**Deliverables:**
1. Backlog reader: ingest tickets from local Jira/Linear/GitHub Issues (offline export)
2. Sprint planner: scope the week, estimate, sequence
3. Daily executor: pick up the next task, do it, log progress
4. Mid-sprint adjustment: replan when surprises happen
5. End-of-sprint retrospective: what was achieved, what blocked, what to change

#### M18 — Code Review Engineer
**Goal:** Agent reviews PRs the way a senior engineer would.
**Owner:** Coding-Core
**Deliverables:**
1. PR diff ingestor (git or local file diff)
2. Multi-dimensional review: correctness, performance, security, maintainability, style, test coverage
3. Severity grading per comment
4. Suggested fixes inline
5. Comparable to expert human reviewer on 50-PR benchmark
**Acceptance:** On 50 expert-reviewed PRs, agent finds ≥80% of critical issues human reviewer found, and ≤10% false positive rate.

### Q7 (Months 19-21) — Engineering Operations Pillar

#### M19 — SRE Capabilities
**Goal:** SRE work as a first-class pillar.
**Owner:** SRE engineer (new hire)
**Deliverables:**
1. Log ingestion: parse application logs in real-time, anomaly detect
2. Incident response: stack trace + log + metric correlation → root cause hypothesis
3. Runbook author: from observed failure modes, write a runbook
4. Capacity planner: from historical metrics, predict scaling needs
5. Deployment manifest validation: Kubernetes, Terraform, Ansible — lint, security, drift

#### M20 — Cross-Service Reasoning
**Goal:** Reason about systems, not just code files.
**Owner:** Tech Lead
**Deliverables:**
1. Service map: parse OpenAPI specs, gRPC definitions, message schemas; build a service graph
2. Cross-service call tracing in code (caller in service A → callee in service B)
3. Impact analysis: "if I change endpoint X, what breaks?"
4. Distributed debugging: correlate logs/traces across services on a single timeline

#### M21 — Customer-Facing Compliance
**Goal:** SOC2 Type II, ISO 27001, FedRAMP-equivalent attestation.
**Owner:** Compliance Engineer (new hire) + Security Lead
**Deliverables:**
1. Audit logs aligned with SOC2 CC criteria
2. RBAC alignment with NIST 800-53 controls
3. Compliance dashboard: live attestation status
4. Pen-test reports as artifacts in the product
5. Customer-facing trust portal (static, hostable on customer infra)
**Acceptance:** Third-party auditor issues SOC2 Type II report by end of Year 2.

### Q8 (Months 22-24) — V2.0 GA

#### M22 — Multilingual Coding Mastery
**Goal:** Tier 2 + Tier 3 languages reach Tier 1 quality. 15+ languages first-class.
**Owner:** Compiler Lead
**Deliverables:**
1. AST + LSP integration for: C, C++, C#, Kotlin, Swift, Ruby, PHP, SQL, Scala, Haskell, OCaml, Elixir, Clojure, Lua, R, Julia, Zig
2. Per-language test generators, mutation operators, fuzzing targets
3. Per-language style and idiom learner (matches project style without configuration)
**Acceptance:** MultiPL-E pass@1 ≥ 75% across 18 languages.

#### M23 — Local Fine-Tune Pipeline
**Goal:** Agent gets smarter on customer's own code; data never leaves.
**Owner:** ML Lead
**Deliverables:**
1. `training/`:
   - `DatasetBuilder.js` — collect (user-approved) patch/test/review pairs from local history
   - `LocalFineTuneManager.js` — QLoRA wrapper for Ollama / llama.cpp
   - `EvaluationRunner.js` — eval harness against fine-tuned, report delta
2. Privacy: explicit opt-in per dataset; fine-tune runs locally; checkpoint never leaves
3. Model registry: base + fine-tuned variants, per-project switching
4. Performance: 7B QLoRA on 24GB consumer GPU in <12h; CPU path documented
**Acceptance:** Fine-tuned model shows ≥3pp improvement over base on customer's own held-out test set in seeded eval.

#### M24 — V2.0 GA Release
**Goal:** 100,000 paying users, $50M ARR.
**Owner:** All
**Deliverables:**
1. Specialist agents stable in production
2. Sprint-scale autonomy proven on real customer projects
3. SRE pillar in beta
4. SOC2 Type II issued
5. Customer Success team operational
6. Marketing site refresh, public benchmarks page
**Acceptance:**
- HumanEval pass@1 ≥ 92%, MBPP ≥ 88%, SWE-bench-Lite ≥ 55%, SWE-bench-Full ≥ 40%
- Real customer testimonial: "Replaced 4-person engineering team for [described project]"
- 100,000 paying users
- $50M ARR

---

## 5. V3 (Year 3) — The Engineering Organization

**Theme:** Multi-day to multi-week autonomous work. Connects to internal infrastructure. Becomes infrastructure itself.

### Q9 (Months 25-27) — Long-Horizon Work

#### M25 — Multi-Week Project Autonomy
**Goal:** Agent ships a real feature end-to-end with only checkpoint approvals.
**Owner:** Tech Lead + Coding-Core
**Deliverables:**
1. Project memory: months-long context, with goal hierarchy
2. Self-replanning when external state changes (lib upgrade, requirements shift)
3. Mid-project pivots with human review gate
4. Final delivery: feature + tests + docs + deployment runbook + retrospective

#### M26 — Local-Only Internal Tool Adapters
**Goal:** Connect to Git, CI, monitoring, ticketing — without cloud round-trip.
**Owner:** Infra/Security + Field Engineers
**Deliverables:**
1. Git: read commits, branches, PRs (local clone or local repo); never push without approval
2. CI: ingest GitHub Actions / Jenkins / GitLab CI logs from local artifact store; never trigger
3. Monitoring: Prometheus query (local), Loki query (local); never page
4. Ticketing: Jira/Linear/GitHub Issues offline export (local file); never auto-close
5. All connectors run within sandbox + audit ledger

#### M27 — Domain-Specific Agent Skills
**Goal:** Customer fine-tunes the agent for their domain (e.g., medical device firmware, banking core, defense embedded).
**Owner:** Field Engineers + ML Lead
**Deliverables:**
1. Skill package format: prompts + few-shot examples + tools + KB seeds + verification predicates, all signed
2. Customer-authored skills via guided CLI workflow
3. Skill marketplace (offline, signed packages — not a SaaS)
4. Skill validation: every skill ships with its own test suite

### Q10 (Months 28-30) — Federation

#### M28 — Federated Team Intelligence
**Goal:** Multiple Local Agent installations form a team without cloud.
**Owner:** Tech Lead + Security Lead
**Deliverables:**
1. Federation protocol: signed memory/KB/skill artifacts exchanged via local LAN, NAS, or out-of-band (USB)
2. Conflict resolution: vector-clock + signed-by + acceptance-rules per organization
3. Privacy boundary: per-artifact visibility (entity/team/org) enforced cryptographically
4. Replay/rollback: every federation event is reversible

#### M29 — Cross-Site Engineering
**Goal:** A defense contractor with 3 air-gapped sites collaborates without cloud.
**Owner:** Field Engineers
**Deliverables:**
1. Site-to-site protocol: signed bundles, asynchronous transfer
2. Compliance: each site's audit ledger is self-contained; bundle includes evidence of source-site governance
3. Onboarding playbook for a new site

#### M30 — Sovereign Compute Open Protocol
**Goal:** Third parties can build on our runtime.
**Owner:** Tech Lead
**Deliverables:**
1. Open specification: agent runtime, memory format, ledger format, federation protocol
2. Reference implementation: open-sourced under a sovereignty-protecting license (modified Apache: must not phone home)
3. Conformance test suite: third parties prove their build doesn't violate sovereignty principles
4. Partner program launch

### Q11 (Months 31-33) — Industry Verticals

#### M31 — Vertical: Defense / Aerospace
**Goal:** First vertical edition. Aligned with DoD/NATO requirements.
**Owner:** Field Engineers + Compliance
**Deliverables:**
1. CMMC L3-aligned packaging
2. Pre-configured skill set for embedded C/C++, real-time systems, MISRA compliance
3. Air-gap deployment manual
4. Onboarding partnership with a defense systems integrator

#### M32 — Vertical: Financial Services
**Goal:** SOX, MAS, FINRA-aligned.
**Owner:** Field Engineers + Compliance
**Deliverables:**
1. Pre-configured skills for FIX protocol, FpML, ISO 20022
2. Audit trail enhanced for trading/risk-touching workflows
3. Onboarding partnership with one tier-1 bank

#### M33 — Vertical: Healthcare
**Goal:** HIPAA, HITRUST, FDA software-as-medical-device aligned.
**Owner:** Field Engineers + Compliance
**Deliverables:**
1. HIPAA-aligned packaging, PHI handling skills
2. FDA documentation generation (Design History File, V&V evidence)
3. Onboarding partnership with one major hospital system

### Q12 (Months 34-36) — V3.0 GA

#### M34 — Multi-Modal Code Reasoning
**Goal:** Read diagrams (architecture, sequence, ER), screenshots, whiteboards.
**Owner:** ML Lead
**Deliverables:**
1. Local VLM (Qwen2-VL, InternVL, or similar) bundled
2. Diagram-to-code: read architecture diagram, generate scaffolding
3. Code-to-diagram: produce Mermaid/PlantUML from code
4. Screenshot debugging: read a UI screenshot, find the matching React component
**Acceptance:** Diagram-grounded coding eval ≥70% accuracy on 100-case benchmark.

#### M35 — Performance & Scale Round 2
**Goal:** Comfortable on 10M-LoC monorepos on commodity hardware.
**Owner:** Performance Engineer
**Deliverables:**
1. Sharded code-graph DB
2. Distributed scanner: optional helper processes, no central server
3. Multi-tier memory: hot (RAM) / warm (NVMe) / cold (compressed disk)
4. Query optimizer: cost-based plan selection across DBs
**Acceptance:** Cold scan of 10M LoC < 30 min on 16-core box, 16GB RAM peak. Query p99 < 1.5s.

#### M36 — V3.0 GA Release
**Goal:** 500,000 paying users, $250M ARR, profitable.
**Owner:** All
**Deliverables:**
1. Long-horizon autonomy proven on multi-week customer engagements
2. 3 industry verticals shipping
3. Federation protocol GA
4. Open sovereign compute platform launched with 5+ partner products
5. Second external security audit (annual cadence established)
**Acceptance:**
- HumanEval pass@1 ≥ 95%, MBPP ≥ 90%, SWE-bench-Full ≥ 60%
- 500,000 paying users
- $250M ARR
- Profitable in last quarter

---

## 6. V4 (Year 4) preview — Sovereign Compute Layer

By V3 we're a great product. By V4 we're infrastructure. Highlights:
- Standard installation in regulated industries (like Splunk, Datadog, AD)
- 50+ partner products on our runtime
- Multi-agent federation across continents (signed artifact exchange)
- Hardware partnerships: pre-installed Local Agent on engineering workstations from a major OEM
- 2M+ paying users, $1B ARR

## 7. V5 (Year 5) preview — Knowledge Sovereignty Layer

By V5 our memory + ledger formats are how organizations permanently own their engineering knowledge.
- ISO/IEC standards body referencing our specification
- National security agency endorsements (3+ NATO countries)
- Federated knowledge graphs across organizations (privacy-preserving)
- The agent's memory store more valuable to a senior engineer than their git history
- $3.5B ARR, profitable, founder-controlled

---

## 8. Cross-cutting engineering practices

### 8.1 The PR bar (every PR, every milestone)

Every PR must:
- Pass full CI (build, lint, smoke, modules, integration, eval-no-regression)
- Pass the offline guard test (no network egress from target machines)
- Add tests for new behavior; coverage on new code ≥ 80%
- Not increase the syntax-error count
- Have a written architectural rationale if it touches: sandbox, audit ledger, governance, RBAC, federation, sovereignty
- Be reviewed by ≥1 senior; risky PRs by ≥2; sovereignty-touching PRs by tech lead + security lead

### 8.2 What we measure weekly (Metric Friday)

| Metric | Target trajectory |
|---|---|
| HumanEval pass@1 | Up |
| MBPP pass@1 | Up |
| SWE-bench-Lite resolve | Up |
| Golden corpus pass rate | Up |
| Total tests | Up |
| Test flake rate | <1% |
| Critical open bugs | 0 |
| Critical security findings | 0 |
| Memory peak (steady state) | Down or stable |
| Scan p50 latency | Down or stable |
| KB query p50 latency | Down or stable |
| Sovereignty violations | 0, always |

### 8.3 Drill cadence

- **Quarterly:** offline audit drill. Fresh machine, no internet, verify nothing tries to phone home.
- **Quarterly:** red-team week. Internal team tries to break the agent.
- **Annually:** external pen-test.
- **Annually:** disaster recovery drill (lost laptop, corrupted DB, attempted ledger tamper).

### 8.4 ADRs (Architectural Decision Records)

Every non-trivial decision gets an ADR in `docs/adr/NNNN-title.md`. Format:
```
# ADR-NNNN: Title
## Context
## Decision
## Consequences
## Alternatives considered
## References
```
We don't make important decisions in Slack threads. Reading the ADR archive in 5 years will tell the next generation of engineers why the system is the way it is.

---

## 9. Risk register (expanded for 10× ambition)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Local-model curve stalls below frontier-2Y | Medium | High | Multi-model routing, distillation, fine-tune; lean on customers who care about sovereignty more than capability |
| Tree-sitter / LSP brittleness | Medium | Medium | Pure-JS fallback per language; bundled pre-built grammars |
| OSS competitors close the gap | Medium | High | Compete on depth + enterprise compliance + 7-pillar integration; OSS rarely ships SOC2-grade |
| Regulation slows adoption | Low | Medium | Be more compliant than cloud; pursue certifications aggressively |
| Founder bandwidth | High | High | Hire COO Y2; tech lead with founder autonomy from Day 1; document everything in ADRs |
| Native binary supply chain attack | Low | Critical | Reproducible builds, SLSA Level 4, signed binaries, in-product binary verification |
| Patch auto-apply corrupts customer code | Low | Critical | Backups, idempotent rollback, refuse on validation fail, sandbox before apply |
| We accidentally violate sovereignty (a stray fetch) | Medium | Critical | OfflineGuard at runtime, CI test that runs binary in network-namespace and asserts no egress, quarterly drill |
| Acquisition pressure compromises principles | Medium | Critical (kills product) | Founder hard control after Series A; written commitment in articles of incorporation |
| Customer data leaks via crash report or log | Low | Critical | Crash reports stay local by default; manual user-initiated send only; redact corpus regression-tested |
| We get bored or distracted by easier markets | Medium | Critical | This document. Quarterly review. CEO accountability. |

---

## 10. The first 30 days

**Day 1 (Monday):** Whole team reads `MANIFESTO_v2.md` + this guide. No code today.

**Day 2 (Tuesday):**
- M1 kickoff (eval harness)
- M2 kickoff (tree-sitter)
- Assign owners
- Schedule weekly Metric Friday

**Days 3–7 (Wed–Sun):**
- Vendor in HumanEval and MBPP
- Set up Ollama + qwen2.5-coder:7b on every engineer's laptop
- First baseline run: publish the numbers in #engineering
- First ADR: "ADR-0001: Why we forked tree-sitter grammars"
- README expansion (we cannot ship V1 with a 1-line README)

**Week 2:**
- M1 closes: full eval harness running, nightly CI job live
- M2 starts: tree-sitter wired for JS+TS, symbol extraction working on sample-project
- First red-team session: each engineer spends 2 hours trying to break OfflineGuard

**Weeks 3–4:**
- M2 closes: 6 Tier-1 languages parsing, code-graph.db populated
- M3 starts: coding loop V1 design doc + first ADR
- Hiring: open requisitions for Compiler Engineer #2, Performance Engineer, Senior IDE Engineer

**End of Day 30:**
- Q1 first month is half done
- Baseline established on every metric
- 3 ADRs published
- 1 customer-visible artifact (V1 README, ~50 pages)
- All eight founding engineers know what they own through Q2

---

## 11. The line

Read the manifesto. Read this guide. If you're still here on Day 31, you're committed.

We are building the kind of software that outlasts its creators. The decisions you make in M1 will be felt in M36 and in V5 and in 2036. Build like it.

— Tech Lead, on behalf of the founder
