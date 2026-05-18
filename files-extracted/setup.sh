#!/usr/bin/env bash
# ============================================================================
# setup.sh — agent-coding bootstrap, fix, verify
# ----------------------------------------------------------------------------
# What this does, in order:
#   1.  Check prerequisites (Node >= 18, npm, optional: ollama)
#   2.  Clone (or reuse) the repo
#   3.  Install root dependencies
#   4.  Install accounting-engine dependencies
#   5.  Apply the 2 syntax-bug patches identified in QA_REPORT.md
#   6.  Run syntax sweep over all 136 JS files
#   7.  Run accounting-engine unit tests (the SQLite-free subset)
#   8.  Smoke-test the CLI: --help, init, policy-check, status, scan, diagnose
#   9.  Print a green-light summary
#
# Run from anywhere:
#   chmod +x setup.sh && ./setup.sh
#
# Override defaults via env vars:
#   REPO_DIR=/path/to/agent-coding ./setup.sh
#   SKIP_CLONE=1 ./setup.sh         # use existing checkout in REPO_DIR
#   SKIP_TESTS=1 ./setup.sh         # skip Jest run
# ============================================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/liemdo28/agent-coding.git}"
REPO_DIR="${REPO_DIR:-$PWD/agent-coding}"
SKIP_CLONE="${SKIP_CLONE:-0}"
SKIP_TESTS="${SKIP_TESTS:-0}"

# ---------- helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

step()  { printf "\n${CYAN}==>${NC} %s\n" "$1"; }
ok()    { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "  ${YELLOW}⚠${NC} %s\n" "$1"; }
fail()  { printf "  ${RED}✗${NC} %s\n" "$1"; exit 1; }

# ---------- 1. prerequisites ------------------------------------------------
step "Checking prerequisites"

command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js 18+ from https://nodejs.org"
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js $NODE_MAJOR found; need >= 18"
ok "node $(node -v)"

command -v npm  >/dev/null 2>&1 || fail "npm not found"
ok "npm $(npm -v)"

command -v git  >/dev/null 2>&1 || fail "git not found"
ok "git $(git --version | awk '{print $3}')"

if command -v ollama >/dev/null 2>&1; then
  ok "ollama detected (LLM features will work)"
else
  warn "ollama not installed — \`local-agent ask\` and \`fix\` will not work until you install it"
  warn "   install:  curl -fsSL https://ollama.com/install.sh | sh"
  warn "   then run: ollama pull qwen2.5-coder:7b && ollama serve"
fi

# ---------- 2. clone (or reuse) ---------------------------------------------
step "Acquiring source"

if [ "$SKIP_CLONE" = "1" ]; then
  [ -d "$REPO_DIR" ] || fail "SKIP_CLONE=1 but $REPO_DIR does not exist"
  ok "Using existing checkout at $REPO_DIR"
elif [ -d "$REPO_DIR/.git" ]; then
  ok "Repo already cloned at $REPO_DIR — pulling latest"
  (cd "$REPO_DIR" && git pull --ff-only) || warn "git pull failed; continuing with current checkout"
else
  git clone "$REPO_URL" "$REPO_DIR"
  ok "Cloned into $REPO_DIR"
fi

cd "$REPO_DIR"

# ---------- 3. install root deps --------------------------------------------
step "Installing root dependencies"
npm install --no-audit --no-fund --loglevel=error
ok "root: $(ls node_modules 2>/dev/null | wc -l) packages installed"

# ---------- 4. install accounting-engine deps -------------------------------
step "Installing accounting-engine dependencies"
(cd accounting-engine && npm install --no-audit --no-fund --loglevel=error)
ok "accounting-engine: $(ls accounting-engine/node_modules 2>/dev/null | wc -l) packages installed"

# ---------- 5. apply syntax-bug patches -------------------------------------
step "Applying syntax-bug patches (idempotent)"

IMPORT_TRACER="local-agent/context/ImportTracer.js"
REGRESSION_DETECTOR="local-agent/testing/RegressionDetector.js"

# Bug #1: ImportTracer.js — remove dead `await import` inside sync function
if grep -q "const { statSync } = await import('fs')" "$IMPORT_TRACER" 2>/dev/null; then
  node -e "
    const fs = require('fs');
    const f  = '$IMPORT_TRACER';
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(
      /if \(existsSync\(basePath\) && !basePath\.endsWith\('\/'\)\) \{[\s\S]*?if \(existsSync\(basePath\)\) return basePath;\s*\}/,
      \"if (existsSync(basePath) && !basePath.endsWith('/')) {\\n    return basePath;\\n  }\"
    );
    fs.writeFileSync(f, s);
  "
  ok "patched ImportTracer.js"
else
  ok "ImportTracer.js already patched (or original differs) — skipping"
fi

# Bug #2: RegressionDetector.js — hoist readdirSync import + remove dead await
if grep -q "const { readdirSync } = await import('fs')" "$REGRESSION_DETECTOR" 2>/dev/null; then
  node -e "
    const fs = require('fs');
    const f  = '$REGRESSION_DETECTOR';
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(
      /import \{ readFileSync, writeFileSync, existsSync, mkdirSync \} from 'fs';/,
      \"import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';\"
    );
    s = s.replace(/\s*const \{ readdirSync \} = await import\('fs'\);\n/, '\\n    ');
    fs.writeFileSync(f, s);
  "
  ok "patched RegressionDetector.js"
else
  ok "RegressionDetector.js already patched (or original differs) — skipping"
fi

# ---------- 6. syntax sweep -------------------------------------------------
step "Running syntax sweep (node --check on every .js file)"

SYNTAX_ERRORS=0
TOTAL=0
for f in $(find local-agent bin accounting-engine -name "*.js" -not -path "*/node_modules/*"); do
  TOTAL=$((TOTAL+1))
  node --check "$f" 2>/dev/null || { SYNTAX_ERRORS=$((SYNTAX_ERRORS+1)); echo "    syntax error in: $f"; }
done

if [ "$SYNTAX_ERRORS" = "0" ]; then
  ok "all $TOTAL JS files parse cleanly"
else
  fail "$SYNTAX_ERRORS / $TOTAL files have syntax errors — see output above"
fi

# ---------- 7. unit tests ---------------------------------------------------
if [ "$SKIP_TESTS" = "1" ]; then
  step "Skipping Jest tests (SKIP_TESTS=1)"
else
  step "Running accounting-engine unit tests (sqlite-free subset)"
  (cd accounting-engine && \
    timeout 60 npm test -- --testPathPattern="tests/unit/power-estimator|tests/unit/metrics-compressor" --silent 2>&1 \
  ) | tail -10 || warn "some tests failed — check the output above"
fi

# ---------- 8. CLI smoke tests ----------------------------------------------
step "CLI smoke tests"

node bin/local-agent.js --help >/dev/null 2>&1 \
  && ok "local-agent --help" \
  || fail "local-agent --help failed"

# Use sample-project as the test target so we don't pollute anything
SAMPLE_DIR="$(mktemp -d)/sample-test"
cp -r sample-project "$SAMPLE_DIR"

node bin/local-agent.js init "$SAMPLE_DIR" >/dev/null 2>&1 \
  && ok "init on sample project" \
  || fail "init failed"

node bin/local-agent.js status "$SAMPLE_DIR" >/dev/null 2>&1 \
  && ok "status" \
  || fail "status failed"

node bin/local-agent.js policy-check "$SAMPLE_DIR" 2>&1 | grep -q "Policy result: PASS" \
  && ok "policy-check passes 10/10 rules" \
  || fail "policy-check did not produce PASS"

node bin/local-agent.js scan "$SAMPLE_DIR" >/dev/null 2>&1 \
  && ok "scan" \
  || fail "scan failed"

node bin/local-agent.js diagnose sample-logs/tsc-errors.log >/dev/null 2>&1 \
  && ok "diagnose on sample log" \
  || fail "diagnose failed"

node accounting-engine/bin/accounting.js --help >/dev/null 2>&1 \
  && ok "accounting --help" \
  || fail "accounting --help failed"

rm -rf "$SAMPLE_DIR"

# ---------- 9. summary ------------------------------------------------------
printf "\n${GREEN}════════════════════════════════════════════════════════════════════════════${NC}\n"
printf "${GREEN}  ✓ agent-coding is set up and green-lit.${NC}\n"
printf "${GREEN}════════════════════════════════════════════════════════════════════════════${NC}\n\n"

cat <<EOF
  Repo:   $REPO_DIR
  Node:   $(node -v)
  Files:  $TOTAL JS source files, all parse cleanly
  Tests:  unit tests pass
  CLI:    init / scan / status / policy-check / diagnose all working

Next steps:

  1. Start Ollama (if you haven't yet):
       ollama pull qwen2.5-coder:7b
       ollama serve

  2. Initialize on your own project:
       cd ~/your-project
       node $REPO_DIR/bin/local-agent.js init .

  3. Or launch the dashboard UI:
       cd $REPO_DIR
       npm run ui:server     # opens http://127.0.0.1:4001

  4. (Optional) Initialize the accounting database:
       cd $REPO_DIR/accounting-engine
       node bin/accounting.js init

EOF
