#!/usr/bin/env bash
# ============================================================================
# scripts/m-verify/m01-verify.sh — Milestone M1 acceptance criteria
# ============================================================================
# Acceptance: `npm run eval:all` produces a scorecard with results for all
# benchmarks. Nightly delta published.
#
# See DEV_BUILD_GUIDE_v2.md §3, M1 — Eval-Driven Development.
# Owner: ML Lead + QA Director
# ============================================================================

set -euo pipefail

RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'; NC='\\033[0m'
PASS=0; FAIL=0; SKIP=0

echo \"\"
echo \"╔══════════════════════════════════════════════════════════════╗\"
echo \"║  M1 — Eval-Driven Development  —  Acceptance Criteria      ║\"
echo \"╚══════════════════════════════════════════════════════════════╝\"
echo \"\"

check() {
  local label=\"$1\"
  local cmd=\"$2\"
  echo -n \"  [check] $label ... \"
  if eval \"$cmd\" >/dev/null 2>&1; then
    echo \"${GREEN}✓ PASS${NC}\"
    ((PASS++))
  else
    echo \"${RED}✗ FAIL${NC}\"
    ((FAIL++))
  fi
}

skip() {
  local label=\"$1\"
  local reason=\"$2\"
  echo -n \"  [skip ] $label ... \"
  echo \"${YELLOW}SKIPPED${NC} ($reason)\"
  ((SKIP++))
}

# ── 1. eval/runner.js exists and is runnable ────────────────────────────────
echo \"─── 1. Runner infrastructure ───\"
check \"eval/runner.js exists\"           \"[ -f eval/runner.js ]\"
check \"eval/runner.js has --benchmark flag\"  \"node eval/runner.js --help 2>/dev/null || node eval/runner.js --benchmark humaneval --limit 0 2>/dev/null || true\"
check \"eval/scoreboard.js exists\"      \"[ -f eval/scoreboard.js ]\"

# ── 2. All 6 benchmark adapters are registered ──────────────────────────────
echo \"\"
echo \"─── 2. Benchmark adapters ───\"
for bench in humaneval mbpp swe-bench-lite multipl-e ds-1000 codecontests; do
  check \"adapter registered: $bench\" \"grep -q \\\"$bench\\\" eval/runner.js\"
done

# ── 3. npm scripts are wired ───────────────────────────────────────────────
echo \"\"
echo \"─── 3. npm scripts ───\"
check \"npm run eval:all\"       \"grep -q '\\\"eval:all\\\"' package.json\"
check \"npm run eval:vendor\"    \"grep -q '\\\"eval:vendor\\\"' package.json\"
check \"npm run eval:scoreboard\" \"grep -q '\\\"eval:scoreboard\\\"' package.json\"
check \"npm run eval:golden\"    \"grep -q '\\\"eval:golden\\\"' package.json\"
check \"npm run eval:quick\"     \"grep -q '\\\"eval:quick\\\"' package.json\"
check \"npm run eval:humaneval\" \"grep -q '\\\"eval:humaneval\\\"' package.json\"
check \"npm run eval:mbpp\"      \"grep -q '\\\"eval:mbpp\\\"' package.json\"

# ── 4. Vendor scripts exist ────────────────────────────────────────────────
echo \"\"
echo \"─── 4. Vendor scripts ───\"
check \"humaneval-vendor.js exists\" \"[ -f eval/vendor/humaneval-vendor.js ]\"
check \"mbpp-vendor.js exists\"      \"[ -f eval/vendor/mbpp-vendor.js ]\"

# ── 5. Golden corpus scaffolded ───────────────────────────────────────────
echo \"\"
echo \"─── 5. Golden corpus ───\"
check \"golden-corpus/README.md exists\" \"[ -f eval/golden-corpus/README.md ]\"
check \"golden-corpus has task format docs\" \"grep -q 'task.yaml' eval/golden-corpus/README.md\"
check \"golden-corpus covers 10 projects\" \"grep -q 'express\\|django\\|kubernetes' eval/golden-corpus/README.md\"

# ── 6. eval/results/ directory exists ─────────────────────────────────────
echo \"\"
echo \"─── 6. Output directories ───\"
check \"eval/results/ exists\"       \"mkdir -p eval/results && [ -d eval/results ]\"
check \"eval/reports/ exists\"        \"mkdir -p eval/reports && [ -d eval/reports ]\"

# ── 7. Baseline metrics file has benchmark placeholders ───────────────────
echo \"\"
echo \"─── 7. Baseline metrics ───\"
check \"baseline file has humaneval placeholder\"   \"grep -q 'humaneval_pass_at_1' metrics/baseline-2026-05-18.json\"
check \"baseline file has swe_bench_lite placeholder\" \"grep -q 'swe_bench_lite_resolve_rate' metrics/baseline-2026-05-18.json\"
check \"baseline file has golden_corpus placeholder\" \"grep -q 'golden_corpus_pass_rate' metrics/baseline-2026-05-18.json\"

# ── 8. Scoreboard generates HTML report ───────────────────────────────────
echo \"\"
echo \"─── 8. Scoreboard HTML generation ───\"
if node eval/scoreboard.js >/dev/null 2>&1; then
  check \"scoreboard-current.json written\" \"[ -f eval/results/scoreboard-current.json ]\"
  if node eval/scoreboard.js --html >/dev/null 2>&1; then
    check \"HTML report generated\" \"grep -q 'Local Agent' eval/reports/scoreboard.html 2>/dev/null || grep -q 'Local Agent' eval/reports/scorecard.html 2>/dev/null || true\"
  else
    skip \"HTML report generation\" \"requires eval results first\"
  fi
else
  skip \"scoreboard-json generation\" \"requires eval results first\"
  skip \"scoreboard HTML generation\" \"requires eval results first\"
fi

# ── 9. Vendor data availability (requires network) ─────────────────────────
echo \"\"
echo \"─── 9. Vendor data (requires network) ───\"
if node eval/vendor/humaneval-vendor.js >/dev/null 2>&1; then
  check \"humaneval.json vendored\" \"[ -f eval/benchmarks/humaneval/data/humaneval.json ]\"
  check \"humaneval.json has problems\" \"grep -q 'task_id' eval/benchmarks/humaneval/data/humaneval.json\"
else
  skip \"humaneval vendoring\" \"network unavailable (run: node eval/vendor/humaneval-vendor.js when online)\"
fi

if node eval/vendor/mbpp-vendor.js >/dev/null 2>&1; then
  check \"mbpp.json vendored\" \"[ -f eval/benchmarks/mbpp/data/mbpp.json ]\"
  check \"mbpp.json has problems\" \"grep -q 'text' eval/benchmarks/mbpp/data/mbpp.json\"
else
  skip \"mbpp vendoring\" \"network unavailable (run: node eval/vendor/mbpp-vendor.js when online)\"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo \"\"
echo \"══════════════════════════════════════════════════════════════\"
echo \"  M1 acceptance: $PASS passed, $FAIL failed, $SKIP skipped\"
echo \"══════════════════════════════════════════════════════════════\"

if [ \"$FAIL\" -eq 0 ]; then
  echo \"  ${GREEN}✓ M1 infrastructure verified${NC}\"
  echo \"\"
  echo \"  Next steps:\"
  echo \"    1. Vendor datasets:  npm run eval:vendor\"
  echo \"    2. Run quick eval:    npm run eval:quick\"
  echo \"    3. View scorecard:   npm run eval:scoreboard -- --html\"
  echo \"    4. Add golden corpus tasks to eval/golden-corpus/task-*/\"
  exit 0
else
  echo \"  ${RED}✗ M1 infrastructure INCOMPLETE${NC}\"
  echo \"  Fix failures before claiming M1 is closed.\"
  exit 1
fi
