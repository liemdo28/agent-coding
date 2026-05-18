#!/usr/bin/env bash
# ======================================================
# Agent-Coding Production Setup and Verification
# Repo: https://github.com/liemdo28/agent-coding
#
# This script is intentionally aligned with the current repo:
# - Node/npm, not Bun
# - offline-first local agent, not cloud OpenAI by default
# - SQLite/local KB/accounting engine, not Prisma/Postgres/Redis
# ======================================================

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_ACCOUNTING=0
WITH_DOCKER=0
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
Usage: bash scripts/production-setup.sh [options]

Options:
  --with-accounting   Also run accounting-engine npm ci + full Jest suite.
  --with-docker       Build/start Docker only if Dockerfile/compose exists.
  --skip-install      Skip npm ci steps.
  -h, --help          Show this help.

Environment:
  NODE_ENV defaults to production.
  LOCAL_AGENT_OFFLINE defaults to true.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-accounting) WITH_ACCOUNTING=1 ;;
    --with-docker) WITH_DOCKER=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

log() {
  printf '\n[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

run() {
  printf '+ %s\n' "$*"
  "$@"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cd "$ROOT_DIR"

export NODE_ENV="${NODE_ENV:-production}"
export LOCAL_AGENT_OFFLINE="${LOCAL_AGENT_OFFLINE:-true}"
export NPM_CONFIG_AUDIT="${NPM_CONFIG_AUDIT:-false}"
export NPM_CONFIG_FUND="${NPM_CONFIG_FUND:-false}"

log "Validating runtime"
require_command node
require_command npm
node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 18) { console.error('Node >=18 required. Current: ' + process.version); process.exit(1); }"

log "Repository"
printf 'Root: %s\n' "$ROOT_DIR"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'Branch: %s\n' "$(git branch --show-current 2>/dev/null || true)"
  printf 'Commit: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || true)"
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "Installing root dependencies"
  run npm ci
fi

log "Generating local engineering log required by quality gate"
run node bin/local-agent.js logs update

log "Running root build, lint, and tests"
run npm run build
run npm run lint
run npm test
run npm run test:integration

log "Running quality gate"
run node local-agent/testing/test-runner.js --check-quality .

log "Running security and sandbox checks"
run node bin/local-agent.js security check .
run node --test --test-name-pattern "CommandPolicy|sandbox" tests/modules.test.js

log "Checking command runtime invariants"
grep -q "timeoutMs" local-agent/sandbox/sandbox.js
grep -q "checkCommand" local-agent/sandbox/sandbox.js
grep -q "maxLoops" local-agent/debug/RetryPlanner.js
grep -q "retryAttempts" local-agent/config/default.json

if [[ "$WITH_ACCOUNTING" -eq 1 ]]; then
  log "Verifying accounting-engine"
  if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    (cd accounting-engine && run npm ci)
  fi
  (cd accounting-engine && run npm test)
fi

log "Checking KB commands"
run npm run kb:stats

if [[ "$WITH_DOCKER" -eq 1 ]]; then
  log "Docker requested"
  require_command docker
  if [[ -f Dockerfile ]]; then
    run docker build -t agent-coding:latest .
  else
    echo "Dockerfile not found; skipping image build."
  fi

  if [[ -f docker-compose.yml || -f docker-compose.yaml || -f compose.yml || -f compose.yaml ]]; then
    if docker compose version >/dev/null 2>&1; then
      run docker compose up -d
    elif command -v docker-compose >/dev/null 2>&1; then
      run docker-compose up -d
    else
      echo "Docker Compose not found; skipping compose startup."
    fi
  else
    echo "Compose file not found; skipping compose startup."
  fi
fi

log "Production setup verification completed"
cat <<'EOF'

Next recommended production hardening items:
- Add a first-class benchmark npm script for coding-agent tasks.
- Promote command audit summaries into release reports.
- Add Dockerfile/compose only when runtime packaging is finalized.
- Keep offline policy as the default; require explicit opt-in for networked providers.
EOF
