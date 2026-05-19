#!/usr/bin/env bash
# merge-projects-advanced.sh
# Safely back up, consolidate, optionally merge git history, and verify local projects.
# Default mode is DRY-RUN. Use --apply to make filesystem/git changes.

set -Eeuo pipefail
IFS=$'\n\t'

TARGET_PATH="$HOME/Projects"
BACKUP_ROOT="$HOME"
APPLY=0
DELETE_SOURCES=0
MERGE_GIT_HISTORY=0
VERIFY=1
FIX_PYTHON=0
NPM_INSTALL=0
SYNC_REGISTRY=0
SOURCE_PATHS=()

usage() {
  cat <<'USAGE'
Usage:
  scripts/merge-projects-advanced.sh --source /path/a --source /path/b [options]

Options:
  --source PATH          Source directory containing projects. Repeatable.
  --target PATH          Consolidated target directory. Default: $HOME/Projects
  --backup-root PATH     Where timestamped backup folder is created. Default: $HOME
  --apply                Actually copy/merge/write. Default is dry-run.
  --merge-git-history    If destination repo exists, fetch source and merge current branch.
  --delete-sources       Move source projects to .merged-trash after successful copy/merge. Requires --apply.
  --no-verify            Skip Python/Node verification.
  --fix-python           Run autopep8 on Python files when available. Requires --apply.
  --npm-install          Run npm ci/install before Node checks. Default avoids dependency churn.
  --sync-registry        After each copy/move, update ~/.local-agent-global/projects.json so any
                         registry entry pointing at the old source path is retargeted to the new
                         destination. Prevents stale + duplicate registry entries across devs.
  -h, --help             Show this help.

Examples:
  scripts/merge-projects-advanced.sh --source /Users/dev1/Workspace --source /Users/dev2/Projects
  scripts/merge-projects-advanced.sh --apply --source ~/Workspace --target ~/Projects
  scripts/merge-projects-advanced.sh --apply --sync-registry --source ~/old-workspace --target ~/Projects
USAGE
}

log() { printf '[merge-projects] %s\n' "$*"; }
warn() { printf '[merge-projects][warn] %s\n' "$*" >&2; }
fail() { printf '[merge-projects][error] %s\n' "$*" >&2; exit 1; }
run() {
  local cmd
  printf -v cmd '%q ' "$@"
  cmd="${cmd% }"
  if [[ "$APPLY" == "1" ]]; then
    log "+ $cmd"
    "$@"
  else
    log "dry-run: $cmd"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE_PATHS+=("${2:?missing path for --source}"); shift 2 ;;
    --target) TARGET_PATH="${2:?missing path for --target}"; shift 2 ;;
    --backup-root) BACKUP_ROOT="${2:?missing path for --backup-root}"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    --delete-sources) DELETE_SOURCES=1; shift ;;
    --merge-git-history) MERGE_GIT_HISTORY=1; shift ;;
    --no-verify) VERIFY=0; shift ;;
    --fix-python) FIX_PYTHON=1; shift ;;
    --npm-install) NPM_INSTALL=1; shift ;;
    --sync-registry) SYNC_REGISTRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ ${#SOURCE_PATHS[@]} -gt 0 ]] || fail 'At least one --source PATH is required.'
if [[ "$DELETE_SOURCES" == "1" && "$APPLY" != "1" ]]; then
  fail '--delete-sources requires --apply.'
fi

TARGET_PATH="$(cd "$(dirname "$TARGET_PATH")" && pwd)/$(basename "$TARGET_PATH")"
BACKUP_PATH="$BACKUP_ROOT/Projects_backup_$(date +%Y%m%d_%H%M%S)"

log "Mode: $([[ "$APPLY" == "1" ]] && echo APPLY || echo DRY-RUN)"
log "Target: $TARGET_PATH"
log "Backup: $BACKUP_PATH"

run mkdir -p "$TARGET_PATH" "$BACKUP_PATH"

current_branch() {
  git -C "$1" rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'main'
}

backup_project() {
  local project="$1"
  local name="$2"
  local dest="$BACKUP_PATH/$name"
  if [[ -e "$dest" ]]; then
    dest="$BACKUP_PATH/${name}_$(date +%s)"
  fi
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --exclude node_modules --exclude .venv --exclude dist "$project/" "$dest/"
  else
    run cp -R "$project" "$dest"
  fi
}

copy_project() {
  local project="$1"
  local dest="$2"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --exclude node_modules --exclude .venv "$project/" "$dest/"
  else
    run cp -R "$project" "$dest"
  fi
}

merge_git_repo() {
  local source_repo="$1"
  local dest_repo="$2"
  local name="$3"
  local src_branch remote_name
  src_branch="$(current_branch "$source_repo")"
  remote_name="merge_${name//[^A-Za-z0-9_]/_}_$(date +%s)"

  log "Git merge candidate: $name ($src_branch)"
  if [[ "$MERGE_GIT_HISTORY" != "1" ]]; then
    warn "Destination exists; skipping git history merge for $name. Re-run with --merge-git-history to merge."
    return 0
  fi

  if [[ "$APPLY" == "1" ]]; then
    git -C "$dest_repo" status --short | grep -q . && fail "Destination repo has uncommitted changes: $dest_repo"
    git -C "$dest_repo" branch "backup/pre-merge-$name-$(date +%Y%m%d-%H%M%S)"
    git -C "$dest_repo" remote add "$remote_name" "$source_repo"
    git -C "$dest_repo" fetch "$remote_name" "$src_branch"
    if ! git -C "$dest_repo" merge --no-ff --allow-unrelated-histories "$remote_name/$src_branch" -m "merge: import $name history"; then
      warn "Merge conflict in $dest_repo. Resolve manually, then remove remote $remote_name."
      exit 2
    fi
    git -C "$dest_repo" remote remove "$remote_name"
  else
    log "dry-run: git -C '$dest_repo' remote add $remote_name '$source_repo' && git fetch && git merge --allow-unrelated-histories $remote_name/$src_branch"
  fi
}

sync_registry_entry() {
  # Update (or dry-run preview) a registry entry's root path.
  # $1 = old_path, $2 = new_path
  local old_path="$1"
  local new_path="$2"

  # Locate registry-sync.mjs relative to this script
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local sync_script="$script_dir/registry-sync.mjs"

  if [[ ! -f "$sync_script" ]]; then
    warn "registry-sync.mjs not found at $sync_script — skipping registry sync for $old_path"
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    warn "node not found — cannot sync registry entry for $old_path"
    return 0
  fi

  if [[ "$APPLY" == "1" ]]; then
    node "$sync_script" --old-path "$old_path" --new-path "$new_path" || \
      warn "Registry sync failed for $old_path → $new_path (non-fatal)"
  else
    node "$sync_script" --dry-run --old-path "$old_path" --new-path "$new_path" || true
  fi
}

verify_python() {
  local project="$1"
  mapfile -d '' py_files < <(find "$project" -type f -name '*.py' -not -path '*/.venv/*' -not -path '*/node_modules/*' -print0)
  [[ ${#py_files[@]} -eq 0 ]] && return 0
  log "Python compile: $project (${#py_files[@]} files)"
  if ! python3 -m py_compile "${py_files[@]}"; then
    warn "Python compile failed in $project"
    if [[ "$FIX_PYTHON" == "1" ]]; then
      if command -v autopep8 >/dev/null 2>&1; then
        run autopep8 --in-place --aggressive --aggressive "${py_files[@]}"
        python3 -m py_compile "${py_files[@]}" || warn "Python compile still failing after autopep8: $project"
      else
        warn "autopep8 not installed; cannot auto-fix Python formatting."
      fi
    fi
  fi
}

verify_node() {
  local project="$1"
  [[ -f "$project/package.json" ]] || return 0
  log "Node checks: $project"
  (
    cd "$project"
    if [[ "$NPM_INSTALL" == "1" ]]; then
      if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
    fi
    npm run lint 2>/dev/null || warn "npm run lint failed or missing in $project"
    npm run build 2>/dev/null || warn "npm run build failed or missing in $project"
    npm test 2>/dev/null || warn "npm test failed or missing in $project"
  )
}

for source_root in "${SOURCE_PATHS[@]}"; do
  [[ -d "$source_root" ]] || { warn "Source path does not exist: $source_root"; continue; }
  for project in "$source_root"/*; do
    [[ -d "$project" ]] || continue
    name="$(basename "$project")"
    dest="$TARGET_PATH/$name"

    log "Processing $project"
    backup_project "$project" "$name"

    # Track effective destination for registry sync
    effective_dest="$dest"

    if [[ -d "$dest/.git" && -d "$project/.git" ]]; then
      merge_git_repo "$project" "$dest" "$name"
      # dest already holds the project; registry entry should point there
    elif [[ -e "$dest" ]]; then
      incoming="$TARGET_PATH/${name}.incoming.$(date +%Y%m%d%H%M%S)"
      warn "Destination exists and cannot be history-merged; copying to $incoming"
      copy_project "$project" "$incoming"
      effective_dest="$incoming"
    else
      copy_project "$project" "$dest"
    fi

    # Update registry: old source path → effective destination
    if [[ "$SYNC_REGISTRY" == "1" ]]; then
      sync_registry_entry "$project" "$effective_dest"
    fi

    if [[ "$DELETE_SOURCES" == "1" ]]; then
      trash="$source_root/.merged-trash"
      run mkdir -p "$trash"
      run mv "$project" "$trash/$name"
      # If sources deleted, registry must point at dest (already done above)
    fi
  done
done

if [[ "$VERIFY" == "1" ]]; then
  for project in "$TARGET_PATH"/*; do
    [[ -d "$project" ]] || continue
    verify_python "$project"
    verify_node "$project"
  done
fi

log 'Completed.'
log "Target: $TARGET_PATH"
log "Backup: $BACKUP_PATH"
if [[ "$APPLY" != "1" ]]; then
  log 'This was a dry-run. Re-run with --apply to make changes.'
fi
