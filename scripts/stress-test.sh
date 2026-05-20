#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Agent-Coding full stress test =="
echo "Project: $ROOT_DIR"
echo "Max users: ${STRESS_MAX_USERS:-1000}"
echo "Port: ${STRESS_PORT:-4701}"

node scripts/agent-coding-stress-test.mjs
