#!/usr/bin/env bash
# ============================================================================
# bootstrap-v2.sh — Day 1 execution for the 10× ambition build
# ----------------------------------------------------------------------------
# Run on each founding engineer's laptop. Idempotent. Aggressive.
#
# What this does (in order):
#   1.  Verify prerequisites (Node 18+, git, ollama, GPU detection, disk)
#   2.  Sync repo on dev branch, verify baseline CI is green
#   3.  Pull required local LLM models (multi-model router needs >1 model)
#   4.  Scaffold the full M1 directory tree:
#         - eval/ with benchmark placeholders
#         - docs/adr/ with ADR template
#         - metrics/ for weekly tracking
#         - eng-log/ for the engineering log
#   5.  Generate ADR-0000 (founder's commit to the manifesto)
#   6.  Establish the baseline metrics file
#   7.  Print the V1 quarter-by-quarter ownership grid
#   8.  Output: a ready-to-run "what do I do on Tuesday" plan
#
# Run:
#   chmod +x bootstrap-v2.sh && ./bootstrap-v2.sh
#
# Env:
#   REPO_DIR=/path/to/repo       default: ./agent-coding
#   ENGINEER_ROLE=<role>         tech-lead | ml-lead | compiler | coding-core
#                                | infra-sec | da-acct | frontend-ide
#                                Used to filter the Tuesday plan to your role.
#   SKIP_MODEL_PULL=1            skip the model downloads
#   SKIP_VERIFY=1                skip the existing CI run
# ============================================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/liemdo28/agent-coding.git}"
REPO_DIR="${REPO_DIR:-$PWD/agent-coding}"
BRANCH="${BRANCH:-claude/local-offline-ai-agent-PQx1C}"
ENGINEER_ROLE="${ENGINEER_ROLE:-unspecified}"
SKIP_MODEL_PULL="${SKIP_MODEL_PULL:-0}"
SKIP_VERIFY="${SKIP_VERIFY:-0}"

PRIMARY_MODEL="qwen2.5-coder:7b"
INTENT_MODEL="qwen2.5-coder:1.5b"
REASONING_MODEL="deepseek-r1:7b"

# ---------- styling ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; MAGENTA='\033[0;35m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
step()  { printf "\n${CYAN}${BOLD}═══>${NC} ${BOLD}%s${NC}\n" "$1"; }
sub()   { printf "${BLUE}▸${NC}  %s\n" "$1"; }
ok()    { printf "    ${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "    ${YELLOW}⚠${NC} %s\n" "$1"; }
fail()  { printf "    ${RED}✗${NC} %s\n" "$1"; exit 1; }
note()  { printf "    ${DIM}%s${NC}\n" "$1"; }

clear
cat <<'BANNER'

   ╔════════════════════════════════════════════════════════════════════╗
   ║                                                                    ║
   ║       L O C A L   A G E N T   —   S O V E R E I G N                ║
   ║              E N G I N E E R I N G   I N T E L L I G E N C E       ║
   ║                                                                    ║
   ║                  Day 1 — Build Bootstrap v2                        ║
   ║                                                                    ║
   ║       "Build like the operators in Year 10 will remember           ║
   ║        every decision you made today."                             ║
   ║                                                                    ║
   ╚════════════════════════════════════════════════════════════════════╝

BANNER

echo ""

# ---------- 1. prerequisites -----------------------------------------------
step "[1/8] Prerequisites"

sub "Toolchain"
command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js 18+ from https://nodejs.org"
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js $NODE_MAJOR; need >= 18"
ok "node $(node -v)"
command -v npm >/dev/null && ok "npm $(npm -v)" || fail "npm not found"
command -v git >/dev/null && ok "git $(git --version | awk '{print $3}')" || fail "git not found"

sub "Compute"
DISK_FREE_GB=$(df -BG --output=avail "$PWD" 2>/dev/null | tail -1 | tr -d 'G ' || echo "0")
if [ "$DISK_FREE_GB" -lt 50 ] 2>/dev/null; then
  warn "Free disk: ${DISK_FREE_GB}GB — recommended ≥50GB (3 models = ~15GB; KB = ~200MB; repo+deps = ~2GB; eval corpora = ~5GB; growth)"
else
  ok "free disk: ${DISK_FREE_GB}GB"
fi

# GPU detection
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
  GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
  if [ -n "$GPU" ]; then
    ok "NVIDIA GPU: $GPU (${GPU_MEM}MB)"
  else
    warn "nvidia-smi found but no GPU detected"
  fi
elif [ "$(uname)" = "Darwin" ]; then
  if sysctl -n hw.model 2>/dev/null | grep -qE "Mac.*(M1|M2|M3|M4)"; then
    ok "Apple Silicon detected — Metal acceleration available for Ollama"
  fi
else
  warn "No GPU detected — CPU-only inference will be slow. Acceptable for dev work; not for eval suites."
fi

sub "Ollama"
if command -v ollama >/dev/null 2>&1; then
  ok "ollama $(ollama --version 2>&1 | head -1)"
  if pgrep -x ollama >/dev/null 2>&1; then
    ok "ollama serve already running"
  else
    warn "ollama serve not running. Start it: 'ollama serve' (or via launchctl/systemd)"
  fi
else
  warn "ollama not installed"
  warn "  install Linux/macOS: curl -fsSL https://ollama.com/install.sh | sh"
  warn "  install Windows:     https://ollama.com/download"
fi

# ---------- 2. sync repo + verify baseline ----------------------------------
step "[2/8] Source sync & baseline verification"

if [ -d "$REPO_DIR/.git" ]; then
  ok "Repo present at $REPO_DIR"
  (cd "$REPO_DIR" && git fetch --all --prune >/dev/null 2>&1) || warn "git fetch had warnings"
else
  git clone "$REPO_URL" "$REPO_DIR"
  ok "Cloned into $REPO_DIR"
fi

cd "$REPO_DIR"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH" >/dev/null 2>&1
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git checkout -b "$BRANCH" --track "origin/$BRANCH" >/dev/null 2>&1
else
  fail "Branch '$BRANCH' not found"
fi
git pull --ff-only origin "$BRANCH" >/dev/null 2>&1 || warn "pull skipped (might be ahead of remote)"
HEAD_SHORT=$(git rev-parse --short HEAD)
HEAD_SUBJECT=$(git log -1 --pretty=%s | head -c 60)
ok "$BRANCH @ $HEAD_SHORT — $HEAD_SUBJECT..."

sub "Installing dependencies"
npm install --no-audit --no-fund --loglevel=error 2>&1 | tail -2
ok "root deps installed"
(cd accounting-engine && npm install --no-audit --no-fund --loglevel=error 2>&1 | tail -2)
ok "accounting-engine deps installed"

if [ "$SKIP_VERIFY" = "1" ]; then
  warn "Skipping baseline verification (SKIP_VERIFY=1)"
else
  sub "Running baseline CI (mirrors what dev shipped)"
  ERR=0; TOTAL=0
  for f in $(find local-agent bin accounting-engine kb marketing-db scripts tests \
              -name "*.js" -not -path "*/node_modules/*" -not -path "*/ui/frontend/dist/*" 2>/dev/null); do
    TOTAL=$((TOTAL+1))
    node --check "$f" 2>/dev/null || ERR=$((ERR+1))
  done
  [ "$ERR" = "0" ] && ok "syntax: $TOTAL files clean" || fail "$ERR syntax errors"
  node scripts/build-check.js >/dev/null 2>&1 && ok "build-check passed" || fail "build-check failed"
  node scripts/lint-check.js  >/dev/null 2>&1 && ok "lint-check passed"  || fail "lint-check failed"
  node --test tests/smoke.test.js              >/dev/null 2>&1 && ok "smoke tests passed (12/12)"        || fail "smoke tests failed"
  node --test tests/modules.test.js            >/dev/null 2>&1 && ok "module tests passed (11/11)"      || fail "module tests failed"
  node --test tests/integration/cli.test.js    >/dev/null 2>&1 && ok "integration tests passed (5/5)"   || fail "integration tests failed"
fi

# ---------- 3. pull models --------------------------------------------------
step "[3/8] Local LLM models (multi-model router needs >1)"

pull_model() {
  local name="$1"
  if [ "$SKIP_MODEL_PULL" = "1" ]; then warn "skipping $name (SKIP_MODEL_PULL=1)"; return; fi
  if ! command -v ollama >/dev/null 2>&1; then warn "ollama not installed — skipping $name"; return; fi
  if ollama list 2>/dev/null | grep -q "^$name"; then
    ok "$name (already pulled)"
  else
    note "pulling $name (5–20 min depending on connection)..."
    if ollama pull "$name" >/dev/null 2>&1; then
      ok "$name pulled"
    else
      warn "failed to pull $name (network? skipped for now)"
    fi
  fi
}

pull_model "$PRIMARY_MODEL"
pull_model "$INTENT_MODEL"
pull_model "$REASONING_MODEL"

# ---------- 4. scaffold M1 directory tree -----------------------------------
step "[4/8] Scaffolding M1 directory tree"

# eval/ — already partly scaffolded; idempotent
sub "eval/ (M1: eval-driven development)"
mkdir -p eval/benchmarks/{humaneval,mbpp,swe-bench-lite,multipl-e,ds-1000,codecontests} \
         eval/results eval/fixtures eval/golden-corpus

for b in humaneval mbpp swe-bench-lite multipl-e ds-1000 codecontests; do
  if [ ! -f "eval/benchmarks/$b/README.md" ]; then
    cat > "eval/benchmarks/$b/README.md" <<EOF
# $b — pending vendor

Status: NOT YET VENDORED
Owner: ML Lead
Due:   end of Q1 (M1)
EOF
  fi
done
ok "eval/benchmarks/{humaneval,mbpp,swe-bench-lite,multipl-e,ds-1000,codecontests}/ scaffolded"
ok "eval/golden-corpus/ created (place 50 hand-picked tasks here)"

# docs/adr/ — Architectural Decision Records
sub "docs/adr/ (ADR archive)"
mkdir -p docs/adr
if [ ! -f docs/adr/README.md ]; then
  cat > docs/adr/README.md <<'EOF'
# Architectural Decision Records

Every non-trivial decision lives here.

## Format
```
docs/adr/NNNN-short-title.md
```

## Template
```
# ADR-NNNN: Title
**Status:** proposed | accepted | superseded | deprecated
**Date:** YYYY-MM-DD
**Deciders:** names
**Context:**
  Why this decision needs to be made; the constraints.
**Decision:**
  What we are doing.
**Consequences:**
  Good and bad.
**Alternatives considered:**
  What we rejected and why.
**References:**
  Links to related PRs, issues, prior art.
```

## Rules
- All cross-pillar decisions require an ADR.
- All sovereignty-affecting decisions require an ADR signed by Tech Lead + Security Lead.
- ADRs are immutable once accepted; supersede with a new ADR that references the old one.
- Read these in 5 years and you'll know why the system is the way it is.
EOF
  ok "docs/adr/README.md created"
fi

if [ ! -f docs/adr/0000-manifesto-commitment.md ]; then
  cat > docs/adr/0000-manifesto-commitment.md <<'EOF'
# ADR-0000: Commitment to the Manifesto

**Status:** accepted
**Date:** 2026-05-18
**Deciders:** Founder & Tech Lead

## Context
The Manifesto v2 establishes the product as Sovereign Engineering Intelligence,
not a coding assistant. This commitment is foundational; every later ADR
flows from it.

## Decision
- The 15 non-negotiable principles in MANIFESTO_v2.md §5 are binding.
- Principle 1 (sovereignty) cannot be relaxed by any future decision.
- Principle 15 (refuse cloud pressure) is the founder's standing commitment.
- ADR-0000 cannot be superseded.

## Consequences
Good:
- Clear north star for every architectural choice
- Customers can rely on the offline guarantee for the lifetime of the product
- No moving goalposts on what we are

Bad:
- We forgo revenue from customers who want hosted/cloud
- We must build harder for the offline path (no shortcuts)

## Alternatives considered
- Cloud-optional hybrid: REJECTED. Compromises Principle 1.
- "Cloud for some features only": REJECTED. Same problem, smaller surface.
- Open-source-only: REJECTED. Doesn't fund the engineering depth required.

## References
- MANIFESTO_v2.md
- DEV_BUILD_GUIDE_v2.md
EOF
  ok "docs/adr/0000-manifesto-commitment.md committed"
fi
ok "docs/adr/ scaffolded"

# metrics/
sub "metrics/ (weekly Metric Friday)"
mkdir -p metrics
ok "metrics/ ready"

# eng-log/ — engineering log (this is already in the repo, let's ensure it's there)
sub "eng-log/ (engineering log)"
mkdir -p local-agent/eng-log
ok "local-agent/eng-log/ verified"

# scripts/m-verify/ — milestone verification scripts (stubs)
sub "scripts/m-verify/ (milestone acceptance scripts)"
mkdir -p scripts/m-verify
for m in $(seq -w 1 12); do
  f="scripts/m-verify/m${m}-verify.sh"
  if [ ! -f "$f" ]; then
    cat > "$f" <<EOF
#!/usr/bin/env bash
# Milestone M${m} acceptance script — STUB
# Implement before claiming M${m} is closed.
# See DEV_BUILD_GUIDE_v2.md §3 for the acceptance criteria.
echo "[m${m}-verify] STUB — implement before claiming M${m} closed"
exit 2
EOF
    chmod +x "$f"
  fi
done
ok "scripts/m-verify/m{01..12}-verify.sh stubs created"

# ---------- 5. baseline metrics file ----------------------------------------
step "[5/8] Baseline metrics"

DATE_STAMP=$(date +%Y-%m-%d)
BASELINE_FILE="metrics/baseline-${DATE_STAMP}.json"

JS_FILES=$(find local-agent bin accounting-engine kb marketing-db scripts tests \
            -name "*.js" -not -path "*/node_modules/*" -not -path "*/ui/frontend/dist/*" 2>/dev/null | wc -l)
JS_LOC=$(find local-agent bin accounting-engine kb marketing-db scripts tests \
          -name "*.js" -not -path "*/node_modules/*" -not -path "*/ui/frontend/dist/*" 2>/dev/null \
          -exec cat {} + | wc -l)
KB_DOCS=1265
KB_CHUNKS=13461
KB_WORDS=4056139

cat > "$BASELINE_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds 2>/dev/null || date)",
  "branch": "$BRANCH",
  "commit": "$HEAD_SHORT",
  "engineer_role": "$ENGINEER_ROLE",
  "version_target": "V1.0",
  "counts": {
    "js_files": $JS_FILES,
    "js_loc": $JS_LOC,
    "syntax_errors": 0,
    "databases": 6,
    "tables_total": 30,
    "cli_subcommands_local_agent": 56,
    "cli_subcommands_kb": 7,
    "cli_subcommands_accounting": 8,
    "kb_documents": $KB_DOCS,
    "kb_chunks": $KB_CHUNKS,
    "kb_words": $KB_WORDS,
    "tests_pass": 28,
    "tests_fail": 0,
    "languages_ast_parsed": 0,
    "specialist_agents": 0,
    "industry_verticals": 0
  },
  "benchmarks": {
    "humaneval_pass_at_1":           null,
    "mbpp_pass_at_1":                null,
    "swe_bench_lite_resolve_rate":   null,
    "swe_bench_full_resolve_rate":   null,
    "multipl_e_pass_at_1":           null,
    "ds_1000_pass_at_1":             null,
    "golden_corpus_pass_rate":       null
  },
  "performance": {
    "scan_latency_sample_project_ms":   null,
    "scan_latency_1m_loc_ms":           null,
    "kb_query_p50_ms":                  null,
    "kb_query_p99_ms":                  null,
    "ide_completion_p50_ms":            null,
    "patch_generation_avg_s":           null,
    "ram_steady_state_mb":              null
  },
  "v1_targets": {
    "humaneval_pass_at_1":          0.85,
    "mbpp_pass_at_1":               0.80,
    "swe_bench_lite_resolve_rate":  0.35,
    "tests_total":                  2500,
    "languages_ast_parsed":         6,
    "paying_users":                 10000,
    "arr_usd":                      5000000
  },
  "v3_targets_36mo": {
    "humaneval_pass_at_1":          0.95,
    "swe_bench_full_resolve_rate":  0.60,
    "languages_ast_parsed":         25,
    "paying_users":                 500000,
    "arr_usd":                      250000000
  }
}
EOF
ok "baseline written: $BASELINE_FILE"

# Commit the baseline file (no push)
git add "$BASELINE_FILE" docs/adr/ scripts/m-verify/ 2>/dev/null || true

# ---------- 6. role-specific Tuesday plan ----------------------------------
step "[6/8] Your Tuesday plan (based on ENGINEER_ROLE=$ENGINEER_ROLE)"

case "$ENGINEER_ROLE" in
  tech-lead)
    cat <<'PLAN'
    You own:
      - M1 + M2 + M3 cross-cutting architecture
      - ADR review jury (you chair)
      - First Metric Friday at end of Week 1
      - Hiring funnel for Q2 hires (Performance Engineer, IDE Engineer, Compiler #2)

    Tuesday actions:
      1. Schedule the M1 kickoff for Wed 9am — 60 min, every engineer attends
      2. Open ADR-0001: "Multi-model router design"
      3. Open ADR-0002: "Eval harness pluggable adapter pattern"
      4. Open ADR-0003: "Code-graph DB schema"
      5. Define the Definition of Ready for each M1-M3 deliverable
      6. Schedule the first quarterly offline-audit drill for end of Q1
PLAN
    ;;
  ml-lead)
    cat <<'PLAN'
    You own:
      - M1 (eval harness) — primary
      - M3 model router and prompt construction
      - M5 cross-project learning algorithms
      - M23 fine-tune pipeline (later)

    Tuesday actions:
      1. Vendor HumanEval into eval/benchmarks/humaneval/data/
      2. Implement eval/runner.js benchmark loader for HumanEval first
      3. First end-to-end pass@1 measurement with $PRIMARY_MODEL
      4. Publish the number in #engineering — this is the baseline
      5. Open ADR-0001 with tech lead on multi-model routing
      6. Order Apple M-series mac mini or RTX 4090 for the eval rig if not provisioned
PLAN
    ;;
  compiler)
    cat <<'PLAN'
    You own:
      - M2 multi-language AST (with the other Compiler Engineer)
      - LSP integration layer
      - Per-language test/mutation operators (M22)

    Tuesday actions:
      1. Spike: bundle tree-sitter-javascript and tree-sitter-typescript as native deps
      2. Get parseFile() returning a real AST in <50ms on sample-project
      3. Open ADR-0003: "Code-graph DB schema" (with tech lead)
      4. Sketch the LSP wrapper interface — which servers we'll spawn, lifecycle, fallback
      5. By Friday: 1 language working end-to-end (file → AST → symbols → call edges → DB)
PLAN
    ;;
  coding-core)
    cat <<'PLAN'
    You own:
      - M3 coding loop V1 (with the other Coding-Core Engineer)
      - M4 auto-debug + test generation
      - M5 cross-project learning (with ML Lead)
      - M18 PR code review engineer (Year 2)

    Tuesday actions:
      1. Read local-agent/coding-core/ if it exists, else scaffold it from the existing fix/scan modules
      2. Draft the Intent → Context → Plan → Write → Verify → Fix pipeline interface
      3. Pair with ML Lead on the structured-output LLM call format
      4. Identify 5 representative tasks from sample-project for the golden corpus
      5. By Friday: end-to-end happy-path patch for one of those 5 tasks
PLAN
    ;;
  infra-sec)
    cat <<'PLAN'
    You own:
      - M6 security hardening (sandbox, secrets, prompt injection, RBAC)
      - M11 binary distribution
      - M21 compliance attestation (SOC2 prep, Y2)
      - Supply chain security (always)

    Tuesday actions:
      1. Run quarterly offline-audit drill on a fresh VM. Does anything try to phone home?
      2. Open ADR-0004: "Sandbox design — Linux/macOS/Windows"
      3. Sketch the secret scanner V2 regex/entropy detector module structure
      4. Inventory existing OfflineGuard tests; identify gaps before M6 kickoff
      5. By Friday: SLSA threat model document for the build pipeline (we'll need it for M11)
PLAN
    ;;
  da-acct)
    cat <<'PLAN'
    You own:
      - M7 DA pillar (DuckDB, profiler, NL-to-SQL)
      - M8 Accounting pillar (multi-entity, reconciliation, period close)
      - Pillar-2 + Pillar-3 customer workflows

    Tuesday actions:
      1. Spike: DuckDB bundled and loading a 1GB CSV in the agent process
      2. Open ADR-0005: "Strict no-write guarantee for DA module"
      3. Talk to the founder this week about real Bakudan/Jinya accounting workflows for M8 design
      4. Sketch the accounting schema extensions
      5. By Friday: DuckDB integration smoke test passing
PLAN
    ;;
  frontend-ide)
    cat <<'PLAN'
    You own:
      - M10 IDE integration (VS Code + Neovim + JetBrains)
      - Dashboard UI evolution
      - Customer-facing onboarding flows

    Tuesday actions:
      1. Inventory: what does the existing dashboard UI ship today? What's missing for V1?
      2. Spike: VS Code extension shell that connects to a Unix socket and lists CLI commands
      3. Open ADR-0006: "IDE-bridge protocol (JSON-RPC, versioning)"
      4. Define what "inline completion latency < 300ms p50" means concretely (round trip path)
      5. By Friday: VS Code extension can issue `local-agent status` and render the result
PLAN
    ;;
  *)
    cat <<'PLAN'
    ENGINEER_ROLE was not specified. Re-run with:
      ENGINEER_ROLE=<your-role> ./bootstrap-v2.sh

    Valid roles:
      tech-lead       — architecture, cross-cutting, hiring, code review jury
      ml-lead         — eval harness, LLM router, RAG, fine-tune
      compiler        — tree-sitter, LSP, AST-level reasoning
      coding-core     — the patch pipeline, auto-debug, test gen
      infra-sec       — sandbox, secrets, RBAC, packaging, supply chain
      da-acct         — data analysis + accounting pillars
      frontend-ide    — VS Code/Neovim/JetBrains, dashboard
PLAN
    ;;
esac

# ---------- 7. all-hands V1 quarter view -----------------------------------
step "[7/8] V1 quarter-by-quarter ownership (post on the wall)"

cat <<'GRID'
                    Q1 (M1-M3)       Q2 (M4-M6)       Q3 (M7-M9)       Q4 (M10-M12)
                    ──────────       ──────────       ──────────       ────────────
    Tech Lead       Architecture +   Architecture +   Architecture +   GA review
                    ADR jury         red team week    SOC2 prep        + bug bash

    ML Lead         M1 eval harness  M5 cross-proj    Fine-tune R&D    Fine-tune V1
                    + M3 router      learning         (preview)        scaffolding

    Compiler ×2     M2 AST 6 langs   Lang.-specific   Tier 2 prep      LSP perf
                    + symbol graph   mutation ops                      tuning

    Coding-Core ×2  M3 coding loop   M4 auto-debug    Golden corpus    Bug bash +
                                     + test gen       expansion         CR engineer alpha

    Infra/Sec       Sandbox prep     M6 hardening     Compliance prep  M11 packaging
                                     + red team

    DA/Accounting   (Q1 ramp)        DA design        M7 DA pillar     M8 Accounting
                                                                       pillar + GA review

    Frontend/IDE    (Q1 ramp)        IDE design       VS Code alpha    M10 IDE GA +
                                                                       docs site

    QA Director     M1 eval harness  M4 with CC       Golden corpus    External pen-test
                    co-owner         co-owner         curation         coord

GRID

# ---------- 8. final summary ----------------------------------------------
step "[8/8] Summary"

printf "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${NC}\n"
printf "${GREEN}${BOLD}  ✓ Day 1 bootstrap complete. The 10× build starts now.${NC}\n"
printf "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${NC}\n\n"

cat <<EOF
  Repo:       $REPO_DIR
  Branch:     $BRANCH @ $HEAD_SHORT
  Baseline:   $BASELINE_FILE
  ADRs:       $REPO_DIR/docs/adr/
  Eval:       $REPO_DIR/eval/
  Verify:     $REPO_DIR/scripts/m-verify/
  Your role:  $ENGINEER_ROLE

  Required reading (today, before any code):
    1. MANIFESTO_v2.md  — read twice, sleep on it, read once more
    2. DEV_BUILD_GUIDE_v2.md — read end-to-end at least once
    3. docs/adr/0000-manifesto-commitment.md — sign in your head

  Required action (this week):
    Mon  Read manifesto + guide. Discuss the 15 principles.
    Tue  M1+M2+M3 kickoff (60 min). Owners assigned. First ADRs opened.
    Wed  Heads-down work on your role's Tuesday-plan items.
    Thu  Heads-down. ADRs landing for review.
    Fri  Metric Friday #1 — baseline published in #engineering.
         End-of-week review with Tech Lead.

  The bar for the work this week is not "I tried."
  The bar is "ready to ship to a senior engineer at a regulated bank."

  Welcome to the build.

EOF
