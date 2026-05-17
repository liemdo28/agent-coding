# Source Consolidation

This workflow defines how to clean a repository before feature development continues.

## Audit

Run:

```bash
git fetch --all --prune
git branch -a
git status
git remote -v
find . -name ".git"
find . -name "package.json"
find . -name "package-lock.json"
find . -name "node_modules"
find . -name ".DS_Store"
```

Check for:

- Nested repositories.
- Duplicated root structures.
- Duplicate lockfiles without package scopes.
- Accidental `node_modules`.
- `.DS_Store`, temp files, logs, caches.
- Broken symlinks.
- Unfinished merge, rebase, or cherry-pick.

## Cleanup Rules

Remove:

- Accidental nested clones.
- Temporary artifacts.
- Invalid generated build/cache output.
- Orphaned local virtual environments.
- Broken symlinks.

Do not remove:

- Real source.
- Configuration.
- Environment examples.
- Documentation.
- Architecture specs.

## Consolidation

- Preserve newest valid implementation.
- Compare duplicates before deleting.
- Merge valid branches into `main`.
- Verify no conflict markers.
- Validate install, audit, build, tests, startup, and internal links.

## Report

Every consolidation should produce:

- Removed files.
- Merged files.
- Conflicting files.
- Deprecated folders.
- Remaining architecture risks.
