# QA System Overview

The QA system verifies that agent changes are correct, reversible, secure, and compatible with offline local operation.

## QA Philosophy

- QA is not just pass/fail. It is intelligence for future fixes.
- Every QA run should be linked to a patch, project, session, model, risk score, and accounting event where possible.
- QA reports should feed the Coding Knowledge DB so recurring failures become searchable fix patterns.
- Regressions and rollbacks are first-class signals.

## Required QA Checks

- Build check.
- Lint and typecheck.
- Unit/integration tests.
- Route and API checks.
- Button/user-flow checks where UI exists.
- Login and role permission checks.
- SEO, performance, and accessibility checks where relevant.
- Secret scan.
- Environment and dependency validation.
- Deployment-readiness checks.
- Rollback and backup checks.
- Offline policy and no-internet-runtime checks.
- Workspace sandbox checks.

## QA Accounting

Track:

- Total tests, passed tests, failed tests, warnings, and duration.
- QA score before and after patch.
- Flaky tests and repeated failures.
- Regression result.
- Failed fix attempts and successful fixes.
- Recommended follow-up tests.

## Risk Analysis

High-risk areas include:

- Auth and permissions.
- Routing.
- Environment configuration.
- Payment and financial flows.
- Deployment scripts.
- Database schema and migrations.

High-risk patches require manual approval and a rollback plan.
