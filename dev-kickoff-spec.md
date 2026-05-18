# Dev Kickoff Spec — Reality Check

**Repo:** `liemdo28/agent-coding`
**Checked branch:** `claude/local-offline-ai-agent-PQx1C`
**Local HEAD checked:** `e813d07`
**Latest remote branch observed:** `origin/claude/local-offline-ai-agent-PQx1C @ 9d00048`
**Main observed:** `main @ 80fbb4c`
**Status date:** 2026-05-18

This document records the actual repo state for the kickoff items. Most items are still planned work; this is an inventory, not a completion claim.

## Status Table

| Hạng mục | Trạng thái | Đường dẫn / Ghi chú |
|---|---|---|
| 8 ADR under `docs/architecture/adr/` | Đang làm, lệch path | `docs/architecture/adr/` does not exist. ADR content currently lives under `docs/adr/` with 2 files: `README.md`, `0000-manifesto-commitment.md`. Not 8 ADRs yet. |
| `ModelRouter` | Chưa bắt đầu | Expected `local-agent/llm/ModelRouter.js`; no real file found. |
| `EvalRunner` | Đang làm | M1 eval harness exists at `eval/runner.js`; older local Ollama evaluator exists at `local-agent/training/evaluationRunner.js`. The M1 harness is the relevant implementation. |
| `TreeSitterAdapter` | Chưa bắt đầu | Expected parser adapter not found; no tree-sitter dependency wired. |
| Acceptance scripts M1-M3 under `scripts/acceptance/` | Chưa bắt đầu / lệch path | `scripts/acceptance/` does not exist. Existing `scripts/m-verify/` contains M1-M12 files. |
| `npm run accept:m1`, `accept:m2`, `accept:m3` | Chưa bắt đầu | Scripts are missing from `package.json`. Running them returns `Missing script`. |
| M1 acceptance verifier | Đang làm, broken | `scripts/m-verify/m01-verify.sh` exists but has a broken shebang containing literal `\n`, so direct execution fails with `env: bash\n: No such file or directory`. |
| M2/M3 acceptance verifiers | Stub | `scripts/m-verify/m02-verify.sh` and `scripts/m-verify/m03-verify.sh` are explicit stubs and exit `2`. |
| HumanEval eval harness | Đang làm | `eval/runner.js`, `eval/vendor/humaneval-vendor.js`, and `eval/benchmarks/humaneval/README.md` exist. Dataset file `eval/benchmarks/humaneval/data/humaneval.json` was not present during check, so benchmark is not fully runnable offline yet. |
| Operational playbooks | Chưa bắt đầu as docs | `docs/playbooks/` does not exist. Code playbook modules exist under `local-agent/playbooks/`, but they are not the requested three operational docs. |
| Engineering handbook | Chưa bắt đầu | `docs/handbook/` does not exist. |
| PR template | Chưa bắt đầu | `.github/PULL_REQUEST_TEMPLATE.md` does not exist. |
| 16 JD files | Chưa bắt đầu | `docs/hr/jd/` does not exist. |
| Master index | Chưa bắt đầu | `docs/INDEX.md` does not exist. |

## Done

- M1 eval harness scaffold exists in `eval/`.
- HumanEval/MBPP vendor scripts exist.
- Benchmark README scaffolds exist for HumanEval, MBPP, SWE-bench-Lite, MultiPL-E, DS-1000, and CodeContests.
- ADR archive exists, but at `docs/adr/` rather than the requested `docs/architecture/adr/`.

## Not Started

- Move or reconcile ADR path with `docs/architecture/adr/`.
- Add the remaining ADRs to reach the requested 8.
- Implement `ModelRouter`.
- Implement `TreeSitterAdapter`.
- Create `scripts/acceptance/`.
- Wire `npm run accept:m1`, `accept:m2`, and `accept:m3`.
- Implement M2/M3 acceptance scripts.
- Add `docs/playbooks/`.
- Add `docs/handbook/`.
- Add `.github/PULL_REQUEST_TEMPLATE.md`.
- Add `docs/hr/jd/` with 16 JD files.
- Add `docs/INDEX.md`.

## Deviations From Plan

- Spec path says `docs/architecture/adr/`; repo uses `docs/adr/`.
- Spec says `scripts/acceptance/`; repo uses `scripts/m-verify/`.
- M1 is not fully complete even though the M1 eval framework exists. It still needs vendored offline datasets and an executed scorecard.
- `eval/vendor/*` downloads from the internet. For offline compliance, benchmark datasets should be vendored and committed or distributed as signed offline artifacts.
