# Local Development Flow

This project is developed as a local-first engineering system.

## Daily Flow

1. Sync `main`.
2. Inspect repository structure.
3. Install dependencies only in declared package scopes.
4. Run audits.
5. Start local services on loopback.
6. Run CLI and API health checks.
7. Run QA.
8. Capture proof for UI/startup changes.
9. Commit with a focused message.
10. Push when GitHub auth allows.

## Package Scopes

- Root package: local agent CLI and backend dependencies.
- `accounting-engine/`: accounting engine CLI/API/tests.
- `local-agent/ui/frontend/`: Vite React dashboard frontend.

## Useful Commands

```bash
npm install
npm audit --audit-level=moderate
npm run dev -- --help
npm run ui:server -- --project .
```

```bash
cd accounting-engine
npm install
npm audit --audit-level=moderate
npm test
npm run api
```

```bash
cd local-agent/ui/frontend
npm install
npm audit --audit-level=moderate
npm run build
```

## Local Service Ports

- Local Agent UI/API backend: `127.0.0.1:4001`.
- Vite dev frontend: `127.0.0.1:3000`.
- Accounting API: `127.0.0.1:8844`.
- Future Coding DB API: `127.0.0.1:8765`.
- Ollama: `localhost:11434`.

## VS Code Workflow

- Open the repository root, not a nested clone.
- Keep terminal sessions rooted in the package scope being validated.
- Use the local agent CLI for scan, status, QA, and release checks.
- Treat generated `.local-agent/` reports as runtime evidence unless a document is intentionally promoted into `docs/`.
- Do not let extensions auto-format unrelated files during consolidation work.
