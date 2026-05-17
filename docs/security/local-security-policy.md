# Local Security Policy

Security is built around local-only execution, explicit approval, auditability, and secret avoidance.

## Required Controls

- Bind APIs only to loopback.
- Disable telemetry and external analytics.
- Store audit logs locally.
- Keep ledgers append-only where practical.
- Mask or reject secrets in reports, knowledge items, and logs.
- Block unsafe commands in agent execution.
- Require manual approval for high-risk patches.

## Secret Handling

Reject or redact:

- API keys.
- GitHub tokens.
- Cloud provider credentials.
- Private keys.
- Passwords.
- JWT secrets.
- Database URLs with credentials.
- Raw `.env` content.

## Unsafe Command Classes

Treat destructive filesystem operations, privilege escalation, external downloads, network scans, remote shells, and production deploys as high-risk. They require explicit human approval and audit logging.

## Data Retention

- Raw resource samples: keep for 30-90 days by policy.
- Aggregated metrics: keep indefinitely.
- Audit logs: keep indefinitely.
- Patch ledger: keep indefinitely.
- QA ledger: keep indefinitely.
- Debug temp files: auto-clean after the configured policy window.
