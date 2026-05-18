# Scale Baseline Report
> Generated: 2026-05-18 | Branch: `claude/local-offline-ai-agent-PQx1C`
> Pre-requisite for scale-20x-plan execution. Covers all 3 dimensions required to unlock G1.

---

## Dimension 1 — Data Coverage (KB)

| Metric | Current | G1 Target | Gap |
|---|---|---|---|
| Documents | 1,265 | 5,000 | +3,735 |
| Chunks | 13,461 | ~53,000 | +39,539 |
| Words | 4,056,139 | ~17M | +13M |
| Domains | 10 | 10 | ✓ |
| Source types | 1 (Wikipedia only) | ≥3 | +2 |
| Avg docs/domain | 126 | 500 | +374/domain |

**Current state:** Wikipedia CC BY-SA 4.0 only. All 10 domains have coverage but are thin (avg 126 docs, vs 500 needed for meaningful depth). Next batch adds ~350 new Wikipedia titles + MDN Web Docs (CC BY-SA 2.5) for the coding domain.

**Blocker to G1 data target:** None. Pipeline is idempotent. Add titles → run `kb:ingest` → done.

---

## Dimension 2 — Capability (Benchmarks)

| Benchmark | Current | V1 Target | Status |
|---|---|---|---|
| HumanEval pass@1 | NOT MEASURED | 0.85 | Blocked: no LLM endpoint |
| MBPP pass@1 | NOT MEASURED | 0.80 | Blocked: no LLM endpoint |
| SWE-bench Lite resolve rate | NOT MEASURED | 0.35 | Blocked: no LLM + sandbox |
| Golden corpus pass rate | NOT MEASURED | TBD | Blocked: no tasks authored |
| Tests passing | 28/28 (100%) | 2,500 total | Gap: need 2,472 more tests |

**Datasets vendored and committed:**
- `eval/benchmarks/humaneval/data/humaneval.json` — 164 problems (MIT)
- `eval/benchmarks/mbpp/data/mbpp.json` — 974 problems (CC BY 4.0)

**What's missing to measure benchmarks:**
The eval harness (`eval/runner.js`) is scaffolded with all 6 benchmark adapters registered. To get actual numbers, the harness needs to be wired to a local LLM (Ollama, llama.cpp, or similar). The benchmark eval runs offline once the model is loaded.

**Recommended next step for G1 capability baseline:**
1. Point `eval/runner.js` to `OLLAMA_BASE_URL=http://localhost:11434` (or llama.cpp server)
2. Run `npm run eval:quick` (5 problems per benchmark = fast sanity check)
3. Run `npm run eval:all` for full baseline (~2-4 hours depending on model speed)

---

## Dimension 3 — Performance

| Metric | Measured | V1 Target | Status |
|---|---|---|---|
| Scan latency (317 JS files, ~35k LOC) | **9,494 ms** | < 5,000 ms | ❌ 1.9x over target |
| Scan latency extrapolated 1M LOC | ~270,000 ms | < 120,000 ms | ❌ needs optimization |
| KB query p50 (FTS5 + TF-IDF, 1,265 docs) | **106 ms** | < 200 ms | ✓ |
| KB query p99 | **373 ms** | < 500 ms | ✓ |
| RAM steady state | **43 MB** | < 512 MB | ✓ |
| IDE completion p50 | NOT MEASURED | < 200 ms | Blocked: no IDE plugin yet |
| Patch generation avg | NOT MEASURED | < 30 s | Blocked: no LLM endpoint |

**Scan latency analysis:**
Current 9.5s for 317 files = ~30ms/file. Primary bottleneck is `node --check` spawned per file in `lint-check.js`. This runs a separate Node.js process per file, which has ~15ms startup overhead per invocation. Fix: batch files or use a persistent worker. This is a M1 optimization task.

**KB query latency:**
p50=106ms, p99=373ms on a 1,265-doc corpus. As corpus grows to 5,000+ docs, p99 may increase. Current architecture (FTS5 → top-50 candidates → TF-IDF rerank) should scale well since FTS5 is O(log n) and rerank is bounded by 50 candidates.

---

## Proposed G1-G4 Timeline

> Based on the 3-dimension baseline above. G = Gate (phase unlock condition).

### G1 — Data + Infrastructure Gate (Target: 4 weeks)
**Unlock condition:** All 3 dimensions have measurable numbers (no NOT_MEASURED).

| Task | Status | Effort |
|---|---|---|
| Expand KB to 3,000+ docs | Ready to run (`kb:ingest`) | 1 day |
| Add ≥2 non-Wikipedia source types | MDN fetcher coded, ready | 3 days |
| Wire LLM endpoint for eval harness | Needs Ollama/llama.cpp setup | 2 days |
| Run full benchmark baseline (eval:all) | Blocked on above | 4h machine time |
| Fix scan latency (batch lint) | Code change in lint-check.js | 1 day |
| Author 20 golden corpus tasks | Manual effort | 3 days |

**G1 numeric thresholds:**
- KB docs ≥ 3,000 across 10 domains
- At least 1 benchmark with a real number (not NOT_MEASURED)
- Scan latency < 5,000ms for 35k LOC
- All tests green on CI

---

### G2 — Benchmark Baseline Gate (Target: 8 weeks)
**Unlock condition:** All 7 benchmark metrics have real numbers.

| Threshold | Metric |
|---|---|
| HumanEval pass@1 ≥ 0.30 | (baseline — any working LLM) |
| MBPP pass@1 ≥ 0.35 | (baseline) |
| SWE-bench Lite ≥ 0.05 | (baseline — hard even for frontier models) |
| Golden corpus ≥ 0.50 | (our own tasks, should be achievable) |
| Test suite ≥ 200 tests | (expand unit + integration tests) |

---

### G3 — Performance Gate (Target: 16 weeks)
**Unlock condition:** All performance metrics hit V1 targets.

| Threshold | Metric |
|---|---|
| Scan latency < 5,000ms for 35k LOC | Requires batched lint / AST workers |
| KB query p50 < 50ms (at 5k docs) | May need query result caching |
| HumanEval pass@1 approaching 0.60 | Model quality improvement |
| Languages AST parsed ≥ 3 | JS + Python + one more |

---

### G4 — V1 Ship Gate (Target: 24 weeks)
**Unlock condition:** All V1 targets met.

| V1 Target | Threshold |
|---|---|
| HumanEval pass@1 | ≥ 0.85 |
| MBPP pass@1 | ≥ 0.80 |
| SWE-bench Lite | ≥ 0.35 |
| Tests total | ≥ 2,500 |
| Languages AST | ≥ 6 |
| Paying users | ≥ 10,000 |

---

## Summary — What's Blocking Scale

| Blocker | Impact | Fix |
|---|---|---|
| No LLM inference endpoint | All benchmark dimensions blocked | Set up Ollama locally; takes 1 day |
| Scan latency 2x over target | Performance gate blocked | Batch `node --check` calls in lint-check.js |
| Only 1 KB source type | Data depth limited | MDN fetcher ready; run `kb:ingest` |
| 0 golden corpus tasks | Can't measure own-task pass rate | Author 20 tasks (3 days) |
| 28 tests vs 2,500 target | Test gate blocked | Systematic unit test expansion needed |

**Recommendation:** The scale-20x code work should NOT start until G1 is cleared. G1 requires ~2 weeks of infra setup (LLM endpoint + benchmark run + KB expansion), not code. Start there.

---

*This report is an input to scale-20x-plan.md. Update when each gate is cleared.*
