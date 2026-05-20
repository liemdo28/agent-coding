#!/usr/bin/env bash
# scripts/test-phases.sh
# Developer smoke-test for Phase 101-110 modules
# Usage: bash scripts/test-phases.sh
# Requires: Node 18+, repo cloned, npm install done

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0
ok()   { echo "  ✓  $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗  $1"; FAIL=$((FAIL+1)); }

run() {
  local label="$1"; shift
  if "$@" &>/dev/null; then ok "$label"
  else fail "$label (cmd: $*)"; fi
}

run_out() {
  local label="$1"; local pattern="$2"; shift 2
  local out; out=$("$@" 2>&1) || true
  if echo "$out" | grep -qE "$pattern"; then ok "$label"
  else fail "$label — expected '$pattern' in output"; fi
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Phase 101-110 Developer Test Script"
echo "═══════════════════════════════════════════════════"

# ── 0. Automated unit tests ───────────────────────────
echo ""
echo "[ 0 ] Automated test suite (98 tests)"
run_out "npm test passes" "pass 98" \
  node --test tests/smoke.test.js tests/modules.test.js tests/phases.test.js

# ── Phase 101: Sensor Fabric ──────────────────────────
echo ""
echo "[ 101 ] Sensor Fabric"
run_out "metrics:collect writes metrics.json" "Documents" \
  node scripts/collect-metrics.js
run "metrics.json file exists" \
  test -f .super-agent-fullauto-kpi/sensors/metrics.json

# ── Phase 102: Strategic Consciousness ───────────────
echo ""
echo "[ 102 ] Strategic Consciousness"
run_out "strategy:score returns composite" "composite" \
  node bin/strategy.js score
run_out "strategy:matrix shows binding constraint" "Binding" \
  node bin/strategy.js matrix
run_out "strategy:history shows entries" "composite|No history" \
  node bin/strategy.js history

# ── Phase 103: Software Species ───────────────────────
echo ""
echo "[ 103 ] Software Species"
run_out "species:classify returns species_class" \
  "OPTIMAL|PIONEER|WORKHORSE|FRAGILE|STAGNANT" \
  node bin/species.js classify
run_out "species:history runs without error" \
  "[Hh]istory|classify" \
  node bin/species.js history

# ── Phase 104: Execution Ecology ──────────────────────
echo ""
echo "[ 104 ] Execution Ecology"
run_out "ecology:report shows pressure level" \
  "low|medium|high|CRITICAL" \
  node bin/ecology.js report
run_out "ecology report shows food chain tiers" "P1|P2|P3" \
  node bin/ecology.js report

# ── Phase 105: Autonomous Scientist ───────────────────
echo ""
echo "[ 105 ] Autonomous Scientist"
run_out "experiment:suggest returns hypotheses" \
  "[Hh]ypothesis|suggest" \
  node bin/experiments.js suggest
run_out "experiment:list runs without error" \
  "experiment|No experiments|id" \
  node bin/experiments.js list

# ── Phase 106: Engineering DNA ────────────────────────
echo ""
echo "[ 106 ] Engineering DNA"
run_out "dna:stats shows gene count" "Total active genes" \
  node bin/dna.js stats
run_out "dna:ingest completes" "Ingested|Skipped" \
  node bin/dna.js ingest
run_out "dna:list runs without error" \
  "empty|ID|No genes" \
  node bin/dna.js list

# ── Phase 107: Weather Engine ─────────────────────────
echo ""
echo "[ 107 ] Weather Engine"
run_out "weather:forecast shows alert level" \
  "clear|watch|warning|storm|CLEAR|WATCH|WARNING|STORM" \
  node bin/weather.js forecast
run_out "weather forecast shows pressure index" "pressure index" \
  node bin/weather.js forecast

# ── Phase 108: Reality Reconstruction ────────────────
echo ""
echo "[ 108 ] Reality Reconstruction"
run_out "replay build creates session" "Session ID" \
  node bin/replay.js build 24

# ── Phase 109: Autonomous Design ─────────────────────
echo ""
echo "[ 109 ] Autonomous Design"
run_out "ui:generate creates index.html" "Dashboard rendered" \
  node bin/ui-generate.js
run "dashboard index.html exists" \
  test -f .local-agent/dashboard/index.html
run "dashboard data.json exists" \
  test -f .local-agent/dashboard/data.json

# ── Phase 110: Physics Engine ─────────────────────────
echo ""
echo "[ 110 ] Physics Engine"
run_out "physics:report shows stability index" "Stability index" \
  node bin/physics.js report
run_out "physics:report shows phase state" \
  "stable|meta_stable|oscillating|diverging|critical" \
  node bin/physics.js report

# ── Golden Corpus ─────────────────────────────────────
echo ""
echo "[ eval ] Golden Corpus"
run_out "eval:golden dry-run 20/20" "Tasks passed:.*20/20" \
  node eval/golden-corpus/runner.js --dry-run

# ── Final summary ──────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
printf "  Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "═══════════════════════════════════════════════════"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  ✓ All Phase 101-110 checks PASSED"
  exit 0
else
  echo "  ✗ ${FAIL} check(s) FAILED — see above"
  exit 1
fi
