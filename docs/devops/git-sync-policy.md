# Git Sync Policy

Main is the canonical branch. All valid branch work should be consolidated into `main` without force-push unless explicitly approved.

## Standard Sync Flow

```bash
git fetch --all --prune
git checkout main
git pull origin main
git branch -a
git status
```

Before merging, verify:

- Remote URL is correct.
- Current branch is not detached.
- No unfinished merge, rebase, or cherry-pick exists.
- No corrupted refs.
- Worktree does not contain accidental generated files.

## Branch Consolidation

Use normal merges for valid work:

```bash
git merge <branch>
```

After merge:

- Resolve conflicts carefully.
- Search for conflict markers.
- Validate build, tests, imports, dependency graph, and startup.
- Preserve newest valid implementation.
- Document removed/deprecated folders.

## Push Policy

- Do not force-push without approval.
- Do not push secrets or local-only configs.
- If GitHub rejects push because credentials lack scope, fix auth before retrying.
- Keep final status clean before handoff.

## Current Repository Note

At the time this documentation was imported, local `main` contained committed baseline work ahead of `origin/main`, but push was blocked by a GitHub token with no scopes.
