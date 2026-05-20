#!/usr/bin/env bash
set -euo pipefail

PROXY_DIR="${AGENT_CODING_API_KEYS_DIR:-$HOME/Projects/agent-coding-api-keys}"
PROXY_FILE="$PROXY_DIR/proxy.js"

if [ ! -f "$PROXY_FILE" ]; then
  echo "AI proxy not found at: $PROXY_FILE" >&2
  echo "Move/create the local key bundle outside this repo, or set AGENT_CODING_API_KEYS_DIR." >&2
  exit 1
fi

cd "$PROXY_DIR"
exec node "$PROXY_FILE"
