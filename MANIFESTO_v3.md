# Local Agent — Manifesto v3 (10× ambition)
## A founder's declaration of category

**From:** Hoang (Founder & CEO)
**To:** Engineering, present and future
**Date:** May 2026
**Status:** Replaces all prior vision documents

---

## 0. The thirty-second pitch is dead. Here is the thirty-second declaration.

We are not building a coding assistant.
We are not building a developer tool.
We are not building "Cursor but offline."

**We are building Sovereign Engineering Intelligence — the operating system for technical work that cannot, by construction, be taken away from the person who runs it.** It runs on a laptop, in a SCIF, on a research vessel in the Antarctic, in a factory in Bavaria, on a refinery LAN in Texas, on a Raspberry Pi cluster in a basement. It has no master in the cloud. It does not call home. It cannot be revoked, sanctioned, deprecated, repriced, or politically pressured. It works in 2026. It will work in 2046. The code we ship today must still run on a clean install in twenty years with no dependency that has expired.

This is not a product. **This is a kind of software that does not yet exist.** Like Linux was in 1991, like Bitcoin was in 2009, like Git was in 2005 — software whose purpose is to make a certain kind of dependency on a centralized authority obsolete.

We are the kind of software you can take with you. Forever.

---

## 1. The world we are betting on

Three forces are converging, and we are positioning where they meet.

### 1.1 The AI capability curve will keep going up — but the centralization will become a liability

Every powerful AI today is owned by 4 companies. Every one of those companies has been pressured, regulated, deplatformed, or sanctioned at least once in the last 24 months. Their customers — banks, defense, healthcare, infrastructure, sovereign nations — increasingly cannot afford that dependency. The smarter the model gets, the more important it becomes to own it.

Meanwhile, local models are now within 60–80% of frontier on coding tasks (Qwen2.5-Coder 32B, DeepSeek-Coder V3, CodeLlama-70B). By end of 2026, local 70B will be at frontier-1Y. By 2028, the difference between "best cloud" and "best local" on engineering tasks will be a matter of taste.

**We are the bridge.** We ride the local-model curve and capture the customers running away from cloud lock-in.

### 1.2 Software is eating engineering, not just other industries

Every serious organization now has engineering. Restaurants run on Toast. Hospitals run on Epic. Banks run on COBOL and Python and Rust. Defense contractors run on millions of lines of C. The world's engineering work is no longer just at tech companies — it's everywhere. And almost none of it can use cloud AI for the obvious reasons.

**There are more engineers outside Silicon Valley than inside it. That is our market.**

### 1.3 The "AI-native engineer" generation is here, and they expect more

A 2024 graduate has never written code without an LLM. They are not going back. But they have learned to distrust cloud tools — they've watched APIs disappear, tools get nerfed, models get lobotomized for safety, and prices triple overnight. They want **AI that they own, that lives where their code lives, that gets smarter the longer they use it.** That is exactly what we ship.

---

## 2. The five-year vision: what Local Agent becomes

This is the destination. Every quarter, we measure how far we've moved toward it.

### Year 1 — The Senior Engineer (V1.0, end of 2026)

A single binary you install on your machine. Reads your codebase. Writes patches. Fixes regressions. Runs tests. Reviews PRs. Does accounting, data analysis, and engineering ops as side missions. Remembers everything. Never phones home. Better than mid-level engineer, approaching senior on most tasks.

**Metric:** SWE-bench-Lite resolve rate ≥ 35%. HumanEval pass@1 ≥ 85%. 10,000 paying users. $5M ARR.

### Year 2 — The Engineering Team (V2.0, end of 2027)

Multi-agent orchestration on the same local install. Specialist agents (Frontend Eng, Backend Eng, SRE, Security, Data Eng, QA) coordinated by an Architect agent. They argue with each other in the local context, reach consensus, and present a plan to the human. The human approves and the team executes. **A 1-person team becomes a 7-person team.**

**Metric:** SWE-bench-Full resolve rate ≥ 50%. Replaces a 4-person engineering team on a real medium-complexity project (defended in a public benchmark we publish). 100,000 paying users. $50M ARR.

### Year 3 — The Engineering Organization (V3.0, end of 2028)

The agent runs entire engineering workflows end-to-end: requirements gathering, design, implementation, testing, security review, deployment runbook, post-mortem, retrospective. Connects to internal infrastructure (Git, CI, monitoring, ticketing) via local-only adapters. **Multi-day autonomous work with human checkpoints — not chat-and-respond.** It plans a sprint, executes it across days, and reports.

**Metric:** Real customer ships a real product feature with human approval only at design and review checkpoints. 500,000 paying users. $250M ARR. Profitable.

### Year 4 — The Sovereign Compute Layer (V4.0, end of 2029)

We are no longer just an app. We are infrastructure. Local Agent becomes a standard installation across regulated industries, the way Active Directory or Splunk or Datadog became standard. Other software is built on top of us — domain-specific agents (Local Agent for Medicine, for Law, for Finance, for Defense) by partner companies, all running on our offline runtime. **We are the substrate.**

**Metric:** 5+ industry-specific verticals built on our platform by third parties. Open agent-runtime protocol. Federated team intelligence across multiple physical locations without cloud. 2M+ paying users. $1B ARR.

### Year 5 — The Knowledge Sovereignty Layer (V5.0, end of 2030)

Local Agent is how organizations and individuals keep their accumulated engineering knowledge **forever**, in a form that no API change, vendor death, or political event can take from them. The agent's memory store is the most valuable asset on a senior engineer's hard drive, surpassing the value of their git history. Government and industry standards reference Local Agent's audit-ledger format. **We are the new ZIP-file, the new PDF, the new Git — a format for permanently owning the artifacts of intellectual work.**

**Metric:** ISO/IEC standard ratified for the Local Agent memory + audit ledger format. National security agencies in three NATO countries officially endorse us for classified engineering workloads. We have replaced our own engineering team's reliance on cloud tools entirely — we eat our own dog food at every level. IPO or stay private at $10B+ valuation. The founder doesn't care which.

---

## 3. What the agent must be able to do (the senior-engineer-times-ten test)

The V1 test was: "be as good as a senior engineer who joined Monday and is useful by Friday." That was modest. Here is the new test.

### 3.1 The Coding Mastery Test — what V1 must clear

For each item: not just "does it work on a demo" — **must work on a 500k-LoC unfamiliar codebase, written in 6 languages, by 30 people over 8 years, with no documentation.**

**Comprehension** (parser-level, not regex):
- Map any codebase under 1M LoC in under 5 minutes
- Build a complete symbol graph and call graph across 15+ languages
- Identify architectural patterns (hexagonal, layered, event-driven, microservices)
- Detect dead code, duplicate logic, anti-patterns
- Track decisions across time using git history + commit-message NLP
- Explain *why* a piece of code is the way it is, citing commits and PRs
- Reason about cross-language interactions (Python calls Rust via FFI, etc.)

**Authorship** — write code that a senior engineer would not be able to distinguish from their own:
- Match the project's style guide automatically (learned from existing code, not configured)
- Write in any of 25+ programming languages with native idiom
- Generate not just code but the *right* code — the one that fits this team's conventions, not Stack Overflow's
- Cross-file refactors that respect tests, types, callers, build, lint, and human readability
- Generate migrations (schema, framework version, language version) with phased rollouts
- Write performance-aware code — knows hot paths, caches, allocations, lock contention
- Handle every edge case a senior would think of, surfaced as test cases

**Debugging** — solve problems a junior engineer would escalate:
- Read a 10,000-line stack trace and find the actual cause
- Bisect not just commits but also: which test config, which env var, which user input
- Reproduce intermittent bugs by reasoning about race conditions and ordering
- Debug across language boundaries (the Python part crashed because the Rust part returned wrong-sized struct)
- Fix concurrency bugs (race, deadlock, livelock, starvation, ABA) — provably, not heuristically
- Fix memory bugs (leak, use-after-free, double-free, fragmentation) with static + dynamic analysis
- Performance debugging: find the actual slow query in a chain of 47 services

**Testing** — write tests a QA lead would respect:
- Property-based testing from code (Hypothesis/QuickCheck-style generators)
- Mutation testing to verify the test suite's actual quality
- Fuzzing harnesses (libFuzzer, AFL, Atheris) for security-sensitive code
- Performance regression tests with statistical methods
- Integration tests with realistic test fixtures, not toy data
- Contract tests for service boundaries
- Snapshot tests where appropriate, never where they create noise

**Security** — pass an external pen test as the defender:
- Detect OWASP Top 10 in any language, not just JavaScript
- Detect supply chain attacks (typo-squatting, dependency confusion, malicious updates)
- Detect cryptographic anti-patterns (ECB mode, weak random, predictable IV, etc.)
- Detect side-channel vulnerabilities (timing, cache, power) where they're material
- Generate exploit code for found vulnerabilities — privately, in sandbox, to prove them — and then patch
- Threat-model an architecture (STRIDE / LINDDUN automated, with human review)

**Operations** — operate the system, not just write it:
- Read application logs in real-time and detect anomalies
- Diagnose production incidents from logs + metrics + traces
- Generate runbooks from observed failure modes
- Capacity-plan from historical data
- Generate Kubernetes manifests, Terraform plans, Ansible playbooks — and validate them
- SLA/SLO/error-budget tracking
- Chaos engineering hypothesis testing

### 3.2 The Data Mastery Test

Match a senior data scientist with 10 years' experience:
- Profile any dataset (10MB → 10TB) without uploading anywhere
- Detect data quality issues that a human would miss (leakage in train/test, drift, label noise)
- Generate analytical notebooks that produce the same results as a senior analyst would
- Do real statistics — not "Pandas describe() and shrug"
- Build forecasting models locally (Prophet, NeuralProphet, ARIMA, ETS), explain them
- Causal inference where applicable (DoWhy, EconML patterns) — and where not applicable, say so
- Always advisory: never modifies source data without explicit human-applied write

### 3.3 The Accounting Mastery Test

Match a CPA with 20 years' experience:
- Multi-entity consolidation across jurisdictions (US federal/state, VN, EU, others as needed)
- Full GAAP and IFRS-compliant ledger reasoning
- Reconciliation of bank statements, POS systems, payroll systems, vendor invoices — automated, with audit trail
- Period-close workflow with sign-offs, control evidence, and SOX-style attestation
- Tax computation (advisory) for the entities the user operates
- Compliance calendar that does not let an obligation slip (940, 941, 944, W-2, sales tax, TABC, BOI, foreign equivalents)
- Anomaly detection — find the journal entry someone made at 3am and didn't tell anyone about
- All numbers explainable down to source documents in the vault

### 3.4 What we are NOT yet, in V1

To stay honest:
- We don't beat the best cloud model on creative open-ended tasks (yet) — local 32B is still behind frontier 600B+
- We don't have multi-modal vision-language reasoning on diagrams (V2)
- We don't do full-app generation from product spec (V3)
- We don't replace a 4-person team (V2)
- We don't speak natural language at native fluency in every language (English first, then VN, JP, ZH, ES — multilingual in V2)

The roadmap is honest about when we close each gap.

---

## 4. The seven pillars (was three — we expand)

V1 had three pillars. The 10× vision has seven. Each pillar is a major engineering investment with its own roadmap.

### Pillar 1 — Coding (the dominant pillar, 50% of engineering capacity)
The depth defined in §3.1 above. This is what we are most known for. This is where we go furthest beyond any competitor.

### Pillar 2 — Data Analysis
The depth defined in §3.2. Strictly advisory. Powered by DuckDB + Arrow + local stat libraries.

### Pillar 3 — Accounting & Financial Operations
The depth defined in §3.3. Strictly advisory. The hash-chained audit ledger we already have becomes the foundation for an industry-standard format.

### Pillar 4 — Engineering Operations & Reliability
SRE work as a first-class pillar: incident response, runbook authoring, capacity planning, deployment management, postmortem facilitation. Read-only access to monitoring data on the local LAN; never writes to production without explicit human action.

### Pillar 5 — Knowledge Sovereignty
A first-class corpus management system. Customers ingest their own internal knowledge (wikis, design docs, ADRs, RFC archives, post-mortems) into the local KB with full provenance, versioning, and access control. The local KB becomes a permanent, owned, queryable record of the organization's accumulated wisdom.

### Pillar 6 — Multi-Agent Coordination (V2+)
The Architect orchestrator + specialist agents pattern. Not a chat-with-many-bots toy — actual distributed problem-solving with structured arbitration, formal verification of agreement, and one coherent output to the human.

### Pillar 7 — Sovereign Federation (V3+)
Multiple Local Agent installations forming a team intelligence — across air-gapped boundaries, via signed artifact exchange (USB, internal artifact stores, local LANs). Not a cloud sync. A federation protocol that preserves sovereignty.

---

## 5. Non-negotiable principles (expanded from V1)

The V1 list had 8. The V2 list has 15. Every PR is measured against these. Violation = revert.

**Principle 1. Sovereignty (the only one that matters).** No outbound packet from a target machine, ever. Cannot be configured otherwise. Cannot be bypassed by plugins. Cannot be relaxed for "convenience." This is the entire reason we exist.

**Principle 2. Permanence.** The binary we ship today will still install and run on a clean machine in 20 years. No dependency that might expire. No license server. No "deprecated, please upgrade." Conservative dependency choices, ourselves owning critical paths.

**Principle 3. Determinism.** Same input + same model + same temperature 0 + same context = same output, byte for byte. Reproducibility is a feature.

**Principle 4. No silent mutation.** We never modify a user's file, branch, ticket, or system without producing a reviewable proposal first.

**Principle 5. Reversibility.** Every action we take can be undone. Every patch has a rollback. Every memory write has a snapshot.

**Principle 6. Sandboxed execution.** Every tool call, every shell command, every plugin runs in a sandbox with explicit filesystem + network + resource bounds.

**Principle 7. Structured memory.** No "vibes-based" RAG. Every memory has a schema, an index, a decay policy, and a reason to exist.

**Principle 8. Cited retrieval.** Every claim that comes from the KB or project files cites its source span. Hallucination is a bug class, not a quirk.

**Principle 9. Graded risk.** Every patch carries a risk score 0.0–1.0. High-risk patches need stronger approval.

**Principle 10. Honest introspection.** "I don't know" is a valid output. "I'm 60% confident" is a valid output. Confabulation is a fireable offense (for the model — we fine-tune it out).

**Principle 11. Audit trail.** Every action by the agent, every action by the user, every patch lifecycle event is written to the hash-chained immutable ledger. Tampering is detectable.

**Principle 12. RBAC by default.** Multi-user installations enforce role-based access from day 1, not bolted on later.

**Principle 13. Open at the protocol layer.** Our memory format, our audit ledger format, our agent communication protocol — all open and documented, so customers can build on them, verify them, archive them, and never be locked in.

**Principle 14. We eat what we ship.** Every Local Agent feature is dogfooded by our own engineering team. If our engineers won't use a feature on our own codebase, we don't ship it to customers.

**Principle 15. We disagree and commit honestly.** If a customer or VC pressures us to add a cloud component, telemetry, hosted version, or anything that compromises Principle 1 — we say no, on the record, every time. If they walk away, that's fine. We are building for the customers who would never walk away from us *because* of Principle 1.

---

## 6. Anti-features (expanded — these will not exist, ever)

- ❌ Cloud-hosted version (any kind)
- ❌ "Pro" tier with cloud LLM fallback
- ❌ Telemetry, usage analytics, "anonymous improvement data"
- ❌ Crash reports auto-sent to us
- ❌ License server that requires online check
- ❌ Auto-update that pulls from our servers (updates are signed artifacts the user downloads manually)
- ❌ A chat interface as the primary UX (it's a *part* of the product, never the front door)
- ❌ Marketing language built on "AI agents that work for you while you sleep" (we are tools for engineers, not magic wands)
- ❌ Investors or board members who don't understand Principles 1, 2, and 15
- ❌ Acquisition by a cloud-AI company (we'd rather IPO or stay private)

---

## 7. Business model — simplified and bolder

V2 said $5M Y1 → $50M Y2 → $250M+ Y3. Time to simplify and scale ambitions.

### Personal Sovereign — $29/month or $290/year
- Full agent, standard features, single machine
- Local Ollama & API-based Provider Router (Claude, OpenAI)
- Telegram Command Router basics
- Auto-Git basic autonomy
- Target: 1M users by 2030, $300M ARR contribution

### Pro Sovereign — $99/month or $990/year
- Everything in Personal
- Full Antigravity IDE Integration (as MCP Server or Sub-agent)
- Advanced Watcher Daemon and Autonomous QA/Fix loops
- Enterprise Connectivity (Git, CI, JIRA) without cloud round-trips
- Priority support and early access to Sovereign Federation
- Target: 500k users by 2030, $600M ARR contribution

**Total ambition: $3.5B ARR by 2030.** Profitable from year 3. Cash-flow positive without VC pressure. The kind of company that can say no to acquisitions.

---

## 8. Funding philosophy

We will likely raise once: a Series A in 2027 after V1 proves traction, at a valuation that gives the founder hard control. We will refuse:
- Investors who push for SaaS pivot
- Investors who don't deeply understand the sovereignty thesis
- Investors who want a 5-year exit window
- Acquisition offers from any cloud-AI company at any price (Principle 15)

We will welcome:
- Investors who lost money on cloud-tool revocations and learned
- Family offices, sovereign wealth funds, defense-tech LPs
- Founders who have built infrastructure software (Linux, Postgres, Git, Docker, Kubernetes) themselves
- Anyone willing to wait 10 years for a 100× return

If we never raise, that's also fine. The product can fund itself by V1.5.

---

## 9. The cultural commitment

These are the values we hire, fire, promote, and review by.

**Build it like it's permanent.** Every decision asks: will this still be reasonable in 20 years? Choose boring, conservative, well-understood technology in core paths. Save cleverness for places where it earns its keep.

**Ship like a senior engineer.** No "MVP" excuses for shipping broken software. Smaller scope is fine; broken scope is not. If you wouldn't trust it on your own laptop, don't ship it to a customer's.

**Take security personally.** Pretend every customer is a journalist whose source list lives in their code, or a defense contractor whose source code is classified, or an oncologist whose research is patentable. Because some of them are.

**Eat what you ship.** Our internal engineering runs on Local Agent. No cloud AI on customer code. No exceptions, including for emergencies. If the agent can't help with an emergency, the agent needs to be better, not bypassed.

**No heroes.** Sustainable cadence. No "we shipped it but didn't sleep for a week" stories. People who burn out don't ship for 20 years.

**Tell the truth about the agent.** Don't overclaim. Don't underclaim. Don't hype. Don't doom. Show real benchmarks, show real failure cases, show real limits. The customer base we want will trust us more for it.

**Decide in writing.** All architectural decisions get an ADR. All product decisions get a memo. We don't make important calls in Slack threads.

**Compete on substance.** Other companies will copy our features. They cannot copy our depth of engineering or our principled refusal to phone home. Don't be reactive. Build the version that's right.

---

## 10. The five things that scare me

A founder writing the 10× vision should be specific about what could kill us. These are the failure modes I lose sleep over, and how we mitigate them.

### 10.1 Local models stall

If frontier 600B+ models keep pulling away and local 70B doesn't close the gap, we ship a worse product than cloud competitors offer. Customers who could tolerate cloud might leave us.

**Mitigation:** We commit to making local-model performance our second-most-tracked metric (after sovereignty compliance). We invest in fine-tuning, in distillation, in routing across multiple smaller models, in retrieval+memory to compensate for raw model size. If gap persists, we keep customers who care about sovereignty *more* than capability — that's still a big market.

### 10.2 Open-source local agent ecosystem catches up

A well-funded OSS project (Aider, Continue, Open Interpreter, future entrants) builds something close to us, for free.

**Mitigation:** Our moat is **depth of engineering over years**, plus **enterprise-grade audit/compliance**, plus **the seven-pillar integration** (no OSS project today integrates accounting + DA + coding + ops). Commercial OSS competitors hit a wall around the polish, integration, and security-attestation needed for regulated enterprise sales. We don't.

### 10.3 Regulation against AI in regulated industries

The EU AI Act, US state laws, sector regulators may restrict AI use in healthcare/finance/defense in ways that hit us.

**Mitigation:** We are *more compliant by construction* than cloud AI. Our audit ledger, our zero-egress, our deterministic execution, our local fine-tune — all of these are regulator-friendly. We hire compliance counsel early. We pursue formal certifications (FedRAMP equivalent, etc.) aggressively.

### 10.4 Founder bandwidth

I run restaurants, I trade options, I am building this company. There are limits.

**Mitigation:** Hire a strong COO by Year 2. Hire a Tech Lead with founder-level autonomy from Day 1. Document every decision so the company can run without me being in every meeting.

### 10.5 We get the principles right but the execution wrong

We could write the most beautiful manifesto and still ship buggy software that no senior engineer respects.

**Mitigation:** The Dev Build Guide v2 (companion document) is mercilessly execution-focused. Acceptance criteria, eval harnesses, weekly metrics, monthly red-team drills. The vision is what we're building; the build guide is *how we know we built it*.

---

## 11. The line I am drawing

In 1991 Linus Torvalds posted that he was making "just a hobby, won't be big and professional like gnu" — and built the operating system that runs the world.

In 2009 Satoshi Nakamoto posted a 9-page PDF and built a financial system that no government has been able to shut down.

In 2005 Linus also built Git and changed how every engineer on earth works.

These were all software-as-infrastructure plays. None of them needed VC. None of them needed permission. They worked because their authors had a thesis that was simultaneously **true** and **inconvenient to existing power structures**.

Our thesis: **engineers should own their AI tooling the way they own their text editor.** The fact that a small number of US companies own the cognition of every engineer on earth is a temporary historical accident. We are the company that ends it.

If we build this right, the day will come when an engineer at a regulated bank cannot imagine working without us. When a defense contractor's certification process requires us. When a junior engineer's first install on Day 1 of a new job is `curl | sh` of our binary, alongside Git and their IDE. When the *idea* of sending your code to someone else's servers for an LLM to read sounds as crazy as sending your text edits to someone else's servers for a word processor to render.

That is a 10-year project. We start today. We finish in 2036.

---

## 12. To the team

You are reading this because I think you might be one of the people who builds this. Some of you have been writing code for longer than I have been alive. Some of you have shipped operating systems, compilers, databases, browsers, game engines, payment systems, satellite firmware. You know what infrastructure software looks like when it's done right.

I am not asking you to build a developer tool. I am asking you to build the thing that ends the era of cloud-AI dependence for engineering work.

The work will be hard. We will get the abstractions wrong sometimes. We will ship bugs. We will be ignored by Hacker News for the first 18 months. We will compete with companies that have 100× our resources. We will be told by Silicon Valley wisdom that "offline doesn't scale" and "you have to be in the cloud to be relevant."

We will be right and they will be wrong. We will outlast them. We will outship them. And when in 2030 the EU passes a law requiring sovereign engineering tools in critical infrastructure, we will already be the standard.

Build it like the operators in Year 10 of using it will remember every decision you made today.

— Hoang
