# macOS Setup

## Prerequisites

- macOS with Xcode Command Line Tools.
- Node.js compatible with the repository engines.
- npm.
- Git and GitHub CLI.
- Optional: Ollama for local LLM use.

## Setup

```bash
git clone https://github.com/liemdo28/agent-coding.git
cd agent-coding
npm install
cd accounting-engine && npm install
cd ../local-agent/ui/frontend && npm install
```

## Validation

```bash
cd /path/to/agent-coding
npm audit --audit-level=moderate
npm run dev -- --help
npm run ui
```

```bash
cd accounting-engine
npm test
npm run api
```

```bash
cd ../local-agent/ui/frontend
npm run build
```

## Notes

- Native SQLite dependencies require a working compiler toolchain.
- Local APIs should bind only to loopback addresses.
- Do not commit `node_modules`, `.local-agent`, runtime databases, or generated logs.
