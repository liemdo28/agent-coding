# Agent-Coding Optimization Plan
**Generated:** 2026-05-20T03:06:36.414Z

## Recommended Next Steps

1. Add browser-level Playwright profiling for Digital Twin FPS, tooltip latency, and navigation lag.
2. Add a real websocket/SSE reconnect storm test once websocket channels are introduced; current backend uses HTTP + SSE.
3. Add a bounded in-memory queue for `/agent/ask` when Local LLM requests are enabled under high concurrency.
4. Keep JSON runtime files append-bounded; execution history is capped to 5000 events in the stress-hardened endpoint.
5. Add optional Prometheus text exposition if this local-only dashboard needs external scraping.
6. Add scanner-specific fixture repos with large `node_modules`, binary files, symlink loops, and nested git repos.

## Current Hardening Implemented

- Atomic JSON persistence with temp-file swap and backup recovery.
- Runtime request metrics endpoint at `/metrics`.
- One-command stress runner via `./scripts/stress-test.sh` or `npm run stress`.
- Isolated stress project root to preserve sandbox/source safety.
