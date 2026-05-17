# Offline-First Policy

Offline-first means the system can run without internet during normal development, QA, diagnosis, and dashboard usage. Internet is only acceptable for explicit human-directed source sync or dependency installation.

## Runtime Requirements

- Bind local services to `127.0.0.1`, `localhost`, or `::1`.
- Store knowledge, accounting, reports, and audit data locally.
- Use local model servers such as Ollama or LM Studio.
- Avoid telemetry, remote analytics, remote logging, and cloud prompt calls.
- Keep local source and operational records private.

## Prohibited Runtime Behavior

- Required external downloads.
- External `curl`, `wget`, telemetry, analytics, or remote callback requirements.
- Storage of API keys, passwords, tokens, private keys, or secrets.
- Public network binding such as `0.0.0.0` unless separately reviewed and approved.
- Copying long copyrighted code from external projects into the knowledge base.

## Approved Local Services

- Local Agent UI backend: `127.0.0.1:4001`.
- Accounting API: `127.0.0.1:8844`.
- Future Coding DB API: `127.0.0.1:8765`.
- Local LLM endpoint: default `http://localhost:11434`.

## Review Rule

Any feature that introduces network access, shared storage, remote execution, or automatic patch application must include a security review and an audit event.
