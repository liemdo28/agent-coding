# Security Policy

## Overview

The local-agent is designed with a security-first, offline-only architecture. All code execution, data processing, and AI inference occur entirely on the local machine. This document describes the security principles, controls, and operational guidelines that govern the agent.

---

## 1. No Internet Access Policy

The agent enforces a strict no-network policy at the application layer:

- All LLM inference is performed by a locally-running model server (Ollama). The configured `baseUrl` defaults to `http://localhost:11434` and must never point to an external host.
- The `offline: true` flag is set in `local-agent/config/default.json` and **cannot be overridden** by project-level configuration. The config loader re-enforces it on every load.
- The `llm.offlineOnly: true` flag is similarly enforced and re-applied after any config merge.
- The sandbox command runner blocks all network utilities from execution (see Section 5 below).
- No HTTP client, fetch wrapper, or external API client is initialized at runtime.

**Verification:** Run `local-agent status` and confirm `offline: true` and `telemetry: false` are shown.

---

## 2. No Telemetry

- `telemetry: false` is enforced unconditionally in the config loader and cannot be set to `true` by any project or user configuration file.
- No usage metrics, error reports, crash dumps, or behavioral analytics are collected.
- No third-party analytics libraries (e.g., Segment, Mixpanel, Sentry) are included in the dependency tree.
- All logging is written exclusively to the local file `.local-agent/logs/agent.log` within the project workspace.

---

## 3. No Cloud Sync

- `cloudSync: false` is enforced unconditionally by the config loader.
- No cloud storage providers (S3, GCS, Azure Blob, Dropbox, etc.) are integrated.
- No backup or report data is transmitted off the local machine.
- Project maps, indexes, patches, and reports remain in the local `.local-agent/` workspace directory.

---

## 4. Workspace Sandboxing

The agent operates within a defined workspace root (the target project directory):

- The `.local-agent/` subdirectory is created within the target project and contains all agent state (index, logs, backups, patches, reports, memory).
- The sandbox command runner enforces that the `cwd` option for any spawned process resolves to a path **within** the workspace root. Path traversal attempts (e.g., `cwd: "../../etc"`) are rejected with an error before execution.
- File scanning is bounded to the project root; symlinks are not followed by default (`followSymlinks: false`).
- Large files exceeding `maxFileSizeBytes` (default 1 MB) are skipped during scanning.

---

## 5. Command Allowlist

The sandbox enforces an explicit allowlist of permitted executables. Only these commands may be spawned:

```
npm, npx, yarn, pnpm, node,
python, python3, pip, pip3, pytest,
jest, mocha, vitest,
tsc, eslint, prettier
```

**Blocklisted commands** (always rejected, regardless of arguments):

```
curl, wget, fetch, ssh, scp, rsync, ftp, sftp,
nc, netcat, telnet, nmap, ping, traceroute,
dig, nslookup, sudo, su, chmod, chown,
rm -rf /, mkfs, dd
```

The sandbox also:
- Spawns processes with `shell: false` to prevent shell injection attacks.
- Passes `stdio: ['ignore', 'pipe', 'pipe']` — no stdin is provided to child processes.
- Enforces a timeout (default 60 seconds) after which the process receives `SIGTERM`, then `SIGKILL`.
- Truncates output at `maxOutputBytes` (default 1 MB) to prevent memory exhaustion.

---

## 6. Audit Logging

All agent actions are logged with ISO 8601 timestamps to `.local-agent/logs/agent.log`:

- Command invocations and outcomes (success/failure, exit code, duration)
- Scan operations (file count, size, timestamp)
- Config load events
- Workspace initialization events
- Security rejections (blocked commands, path traversal attempts)

Log files are stored locally and are excluded from version control via `.local-agent/.gitignore`.

---

## 7. Data Retention

- Log files accumulate in `.local-agent/logs/`. Configure rotation or periodic cleanup externally (e.g., `logrotate`).
- Project memory entries are bounded by `memory.maxEntries` (default 10,000) and `memory.retentionDays` (default 90 days).
- Backups stored in `.local-agent/backups/` should be pruned periodically. No automatic pruning is performed in Phase 1.
- All retained data is stored exclusively on the local filesystem.

---

## 8. Secret Exclusion

The scanner explicitly excludes the following from indexing and project maps:

- `.env` files (only `.env.example` and `.env.sample` are read, and only for structure — not values)
- `*.lock` files (lockfiles can contain hashes that look like secrets)
- Private key files (e.g., `*.pem`, `*.key`) are not targeted by the scanner

**Recommended practice:** Add `secrets/`, `*.pem`, `*.key`, `*.env` to your project's `.local-agent/config.json` scanner ignore list if your repository contains sensitive files.

The agent never transmits file contents externally. All AI context is sent only to the local model server at `localhost`.

---

## 9. Dependency Supply Chain

- All npm dependencies are pinned to specific semver ranges in `package.json`.
- Run `npm audit` before deploying in sensitive environments.
- The dependency tree consists of well-established, widely-audited packages: `commander`, `chalk`, `ora`, `fast-glob`, `ignore`, `better-sqlite3`, `diff`, `chokidar`.
- No obfuscated, minified, or dynamically-downloaded code is used.

---

## 10. Reporting Security Issues

This project is fully local and does not have an external bug bounty program. If you discover a security issue, please open an issue in the project repository or notify the maintainers directly.
