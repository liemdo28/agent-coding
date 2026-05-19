# Advanced Project Merge Script

This repo includes a guarded consolidation script:

```bash
scripts/merge-projects-advanced.sh
```

## Safety Defaults

- Dry-run by default. Use `--apply` to make changes.
- Creates a timestamped backup before each copy/merge.
- Does not delete old source paths unless `--delete-sources` is explicitly set.
- Avoids dependency churn by default. Use `--npm-install` only when install/update is intended.
- Avoids Python auto-format by default. Use `--fix-python` only when `autopep8` changes are acceptable.

## Example

```bash
scripts/merge-projects-advanced.sh \
  --source /Users/dev1/Workspace \
  --source /Users/dev2/Projects \
  --target "$HOME/Projects"
```

Apply after reviewing the dry-run:

```bash
scripts/merge-projects-advanced.sh \
  --apply \
  --merge-git-history \
  --source /Users/dev1/Workspace \
  --source /Users/dev2/Projects \
  --target "$HOME/Projects"
```

Only move old source projects after a successful merge/copy:

```bash
scripts/merge-projects-advanced.sh \
  --apply \
  --delete-sources \
  --source /Users/dev1/Workspace
```

## Verification

The script can verify merged projects with:

- `python3 -m py_compile` for Python files
- `npm run lint`
- `npm run build`
- `npm test`

It runs these checks without installing packages unless `--npm-install` is provided.

## Git History Merge

When a destination project already has `.git` and a source project also has `.git`, `--merge-git-history` will:

1. Require a clean destination worktree.
2. Create a `backup/pre-merge-*` branch in the destination.
3. Add the source repo as a temporary remote.
4. Fetch the source branch.
5. Merge with `--allow-unrelated-histories`.
6. Remove the temporary remote after success.

If conflicts occur, the script stops and leaves the repository for manual conflict resolution.
