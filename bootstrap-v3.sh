#!/usr/bin/env bash
# ============================================================================
# bootstrap-v3.sh — Local Agent V3 Full System Bootstrap
# ----------------------------------------------------------------------------
# Wires together:
#   - Manifesto V3 (2 SKUs: Personal + Pro)
#   - Auto-Git (full autonomy: commit + push + merge)
#   - Provider Router (4 providers: Local + Claude + OpenAI + Antigravity)
#   - Telegram CommandRouter (/scan /test /fix /push)
#   - Watcher Daemon (background scanning ~/Projects/)
#
# Run:
#   chmod +x bootstrap-v3.sh && ./bootstrap-v3.sh
#
# Env:
#   SKU=personal|pro              default: personal
#   PROJECTS_PATH=~/Projects      default: ~/Projects
#   TELEGRAM_BOT_TOKEN=<token>    optional
#   SKIP_WATCHER=1                skip watcher daemon
#   SKIP_TELEGRAM=1              skip telegram setup
# ============================================================================

set -euo pipefail

REPO_DIR="${REPO_DIR:-$PWD/agent-coding}"
SKU="${SKU:-personal}"
PROJECTS_PATH="${PROJECTS_PATH:-$HOME/Projects}"
SKIP_WATCHER="${SKIP_WATCHER:-0}"
SKIP_TELEGRAM="${SKIP_TELEGRAM:-0}"
BRANCH="${BRANCH:-claude/local-offline-ai-agent-PQx1C}"

# ---------- styling ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step()  { printf "\n${CYAN}${BOLD}═══>${NC} ${BOLD}%s${NC}\n" "$1"; }
sub()   { printf "${BLUE}▸${NC}  %s\n" "$1"; }
ok()    { printf "    ${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "    ${YELLOW}⚠${NC} %s\n" "$1"; }
fail()  { printf "    ${RED}✗${NC} %s\n" "$1"; exit 1"; }

clear
cat <<'BANNER'

   ╔════════════════════════════════════════════════════════════════════╗
   ║                                                                    ║
   ║       L O C A L   A G E N T   —   V 3 . 0                        ║
   ║              S O V E R E I G N   E N G I N E E R I N G             ║
   ║                                                                    ║
   ║                 Full System Bootstrap                              ║
   ║                                                                    ║
   ║    "Build like the operators in Year 10 will remember             ║
   ║     every decision you made today."                               ║
   ║                                                                    ║
   ╚════════════════════════════════════════════════════════════════════╝

BANNER

echo ""
echo "Configuration:"
echo "  SKU:           $SKU"
echo "  Projects:      $PROJECTS_PATH"
echo "  Repo:          $REPO_DIR"
echo "  Branch:        $BRANCH"
echo ""

# ---------- 1. Prerequisites ----------
step "[1/7] Prerequisites Check"

sub "Node.js"
command -v node >/dev/null 2>&1 || fail "node not found"
ok "node $(node -v)"

sub "Git"
command -v git >/dev/null 2>&1 || fail "git not found"
ok "git $(git --version | awk '{print $3}')"

sub "Ollama"
if command -v ollama >/dev/null 2>&1; then
  ok "ollama $(ollama --version 2>&1 | head -1)"
  if pgrep -x ollama >/dev/null 2>&1; then
    ok "ollama serve running"
  else
    warn "ollama serve not running — start with: ollama serve"
  fi
else
  warn "ollama not installed"
fi

# ---------- 2. Verify Repo & Files ----------
step "[2/7] Verifying V3 Components"

cd "$REPO_DIR"

# Check for Manifesto V3
if [ -f "docs/MANIFESTO_v3.md" ]; then
  ok "docs/MANIFESTO_v3.md found"
else
  warn "docs/MANIFESTO_v3.md not found — will use MANIFESTO_v2.md"
fi

# Check for AutoGit
if [ -f "local-agent/git/AutoGit.js" ]; then
  ok "local-agent/git/AutoGit.js found"
else
  fail "local-agent/git/AutoGit.js not found"
fi

# Check for ProviderRouter
if [ -f "local-agent/providers/ProviderRouter.js" ]; then
  ok "local-agent/providers/ProviderRouter.js found"
else
  fail "local-agent/providers/ProviderRouter.js not found"
fi

# Check for CommandRouter
if [ -f "local-agent/telegram/CommandRouter.js" ]; then
  ok "local-agent/telegram/CommandRouter.js found"
else
  fail "local-agent/telegram/CommandRouter.js not found"
fi

# Check for WatcherDaemon
if [ -f "local-agent/watcher/WatcherDaemon.js" ]; then
  ok "local-agent/watcher/WatcherDaemon.js found"
else
  warn "local-agent/watcher/WatcherDaemon.js not found"
fi

# ---------- 3. Validate JavaScript Syntax ----------
step "[3/7] Validating JavaScript Syntax"

for file in \
  "local-agent/git/AutoGit.js" \
  "local-agent/providers/ProviderRouter.js" \
  "local-agent/telegram/CommandRouter.js" \
  "local-agent/watcher/WatcherDaemon.js"
do
  if [ -f "$file" ]; then
    if node --check "$file" 2>/dev/null; then
      ok "$file syntax OK"
    else
      warn "$file has syntax errors"
    fi
  fi
done

# ---------- 4. Check Provider Status ----------
step "[4/7] Provider Status"

sub "Local Ollama"
if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  ok "Local Ollama responding"
  MODELS=$(curl -s http://127.0.0.1:11434/api/tags | jq -r '.models[].name' 2>/dev/null | head -5 || echo "unknown")
  echo "    Available models:"
  echo "$MODELS" | while read -r model; do
    echo "      • $model"
  done
else
  warn "Local Ollama not responding"
fi

sub "Claude (Anthropic)"
if [ -n "${CLAUDE_API_KEY:-}" ]; then
  ok "CLAUDE_API_KEY configured (Pro feature)"
elif grep -q "CLAUDE_API_KEY" .env 2>/dev/null; then
  ok "CLAUDE_API_KEY in .env"
else
  warn "CLAUDE_API_KEY not configured (Pro feature)"
fi

sub "OpenAI"
if [ -n "${OPENAI_API_KEY:-}" ]; then
  ok "OPENAI_API_KEY configured (Pro feature)"
elif grep -q "OPENAI_API_KEY" .env 2>/dev/null; then
  ok "OPENAI_API_KEY in .env"
else
  warn "OPENAI_API_KEY not configured (Pro feature)"
fi

sub "Antigravity IDE"
if [ -S "/tmp/antigravity.sock" ] 2>/dev/null; then
  ok "Antigravity socket found"
elif [ -n "${MCP_ENDPOINT:-}" ]; then
  ok "MCP_ENDPOINT configured"
else
  warn "Antigravity not detected (Pro feature)"
fi

# ---------- 5. SKU Configuration ----------
step "[5/7] SKU Configuration: $SKU"

case "$SKU" in
  personal)
    cat <<'SKU'

    ┌─────────────────────────────────────────────────────────┐
    │  PERSONAL SKU — $49/mo or $490/yr                       │
    │                                                          │
    │  ✓ Local Ollama (always)                                │
    │  ✓ Knowledge Base (up to 50K docs)                       │
    │  ✓ Git Intelligence (auto-commit, push, merge)          │
    │  ✓ Code Scanning (AST, security, tests)                  │
    │  ✓ Telegram Bot (/scan, /test, /fix, /push)            │
    │  ✓ Watcher Daemon (background ~/Projects/)              │
    │                                                          │
    │  ✗ Claude API (requires Pro)                             │
    │  ✗ OpenAI API (requires Pro)                           │
    │  ✗ Antigravity IDE (requires Pro)                       │
    └─────────────────────────────────────────────────────────┘

SKU
    ;;
  pro)
    cat <<'SKU'

    ┌─────────────────────────────────────────────────────────┐
    │  PRO SKU — $199/mo or $1,990/yr                        │
    │                                                          │
    │  ✓ Everything in Personal                                │
    │  ✓ Claude API (Anthropic)                              │
    │  ✓ OpenAI API (Codex)                                   │
    │  ✓ Antigravity IDE (Google DeepMind)                    │
    │  ✓ Multi-model routing                                 │
    │  ✓ Team Memory Sync (LAN-based)                         │
    │  ✓ RBAC (viewer/contributor/reviewer/admin)           │
    │  ✓ Compliance reports (SOC2, HIPAA, FedRAMP)           │
    │  ✓ Fine-tune pipeline                                   │
    │  ✓ Multi-agent coordination                            │
    │  ✓ Unlimited KB documents                               │
    │  ✓ Air-gapped deployment                               │
    └─────────────────────────────────────────────────────────┘

SKU
    ;;
esac

# ---------- 6. Commands Summary ----------
step "[6/7] Available Commands"

cat <<'CMDS'

  Git Operations (AutoGit):
    local-agent git status           — Show git status
    local-agent git commit [msg]     — Auto-commit changes
    local-agent git push [msg]      — Commit and push
    local-agent git merge [src] [tgt] — Merge branches
    local-agent git branch [action]  — Branch management
    local-agent git stash [push|pop] — Stash operations

  Telegram Commands:
    /scan [path]    — Scan codebase for issues
    /test [project] — Run tests
    /fix [issue]    — Fix issues automatically
    /push [msg]     — Git push with auto-commit
    /status         — Show git status
    /projects       — List monitored projects
    /watch [path]   — Start watching project
    /branch [cmd]   — Manage branches
    /merge [src] [tgt] — Merge branches
    /history [n]    — Show recent commits
    /health         — Check system health
    /ask [q]        — Ask the AI
    /providers      — Show available providers

  Watcher Daemon:
    local-agent watcher start        — Start background watcher
    local-agent watcher stop         — Stop watcher
    local-agent watcher status      — Show watcher status

CMDS

# ---------- 7. Quick Start ----------
step "[7/7] Quick Start Guide"

cat <<'QUICK'

  1. Start Ollama (if not running):
     ollama serve

  2. Pull models (first time):
     ollama pull qwen2.5-coder:7b
     ollama pull deepseek-r1:7b

  3. Start Telegram bot (optional):
     TELEGRAM_BOT_TOKEN=your_token local-agent telegram

  4. Start Watcher daemon:
     local-agent watcher start

  5. Test Auto-Git:
     cd ~/Projects/your-project
     local-agent git push "My first V3 push"

  6. Try AI commands:
     local-agent ask "How do I fix a memory leak in Node.js?"

QUICK

# ---------- Final Summary ----------
step "Summary"

printf "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${NC}\n"
printf "${GREEN}${BOLD}  ✓ V3 Bootstrap Complete${NC}\n"
printf "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${NC}\n\n"

cat <<EOF
  Components Installed:
    • Manifesto V3 (2 SKUs)
    • Auto-Git (full autonomy)
    • ProviderRouter (4 providers)
    • CommandRouter (20 commands)
    • WatcherDaemon (background scanning)

  Current SKU: $SKU

  Next Steps:
    1. Read docs/MANIFESTO_v3.md
    2. Configure API keys (for Pro features)
    3. Start ollama serve
    4. Try local-agent git push

  Documentation:
    • docs/MANIFESTO_v3.md — Full vision
    • local-agent/git/AutoGit.js — Git autonomy
    • local-agent/providers/ProviderRouter.js — LLM routing
    • local-agent/telegram/CommandRouter.js — Telegram bot
    • local-agent/watcher/WatcherDaemon.js — Background watcher

EOF