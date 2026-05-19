// orchestrator/ProjectRegistry.js — Global project registry stored in ~/.local-agent-global/
import { join, resolve } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'fs';

// ── Paths ─────────────────────────────────────────────────────────────────────

export function getGlobalDir() {
  return join(homedir(), '.local-agent-global');
}

export function getRegistryPath() {
  return join(getGlobalDir(), 'projects.json');
}

// ── Directory bootstrap ───────────────────────────────────────────────────────

export function ensureGlobalDir() {
  const dir = getGlobalDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ── Path canonicalization ─────────────────────────────────────────────────────

/**
 * Resolve symlinks + normalize. Falls back to `resolve()` if the path doesn't
 * exist yet (e.g. for paths about to be created).
 */
export function canonicalizePath(p) {
  try {
    return realpathSync(resolve(p));
  } catch {
    return resolve(p);
  }
}

/**
 * Case-insensitive on macOS (HFS+/APFS default), case-sensitive elsewhere.
 */
function pathsEqual(a, b) {
  return process.platform === 'darwin'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

/**
 * Returns true if `child` is inside `parent` (strict — not equal).
 */
function isStrictSubpath(parent, child) {
  const p = parent.endsWith('/') ? parent : parent + '/';
  const c = process.platform === 'darwin' ? child.toLowerCase() : child;
  const cp = process.platform === 'darwin' ? p.toLowerCase() : p;
  return c.startsWith(cp);
}

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateProjectId() {
  return 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

// ── Registry I/O ──────────────────────────────────────────────────────────────

export function loadRegistry() {
  const path = getRegistryPath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRegistry(projects) {
  ensureGlobalDir();
  writeFileSync(getRegistryPath(), JSON.stringify(projects, null, 2), 'utf8');
}

// ── CRUD operations ───────────────────────────────────────────────────────────

/**
 * Add a project to the registry.
 *
 * Deduplication checks (in order):
 *   1. Exact realpath match (symlink-aware, case-insensitive on macOS) → throws
 *   2. Existing entry whose path no longer exists (stale) → same realpath after
 *      resolution is still caught by check #1 for new valid paths
 *   3. New path is a strict sub-path or parent of an existing entry → warns but
 *      does NOT block (legitimate monorepos may share a tree)
 *
 * Returns the new profile.
 */
export function addProject(rootPath, name) {
  const canonical = canonicalizePath(rootPath);
  const projects = loadRegistry();

  // ── Check 1: exact duplicate ──────────────────────────────────────────────
  const exact = projects.find((p) => pathsEqual(canonicalizePath(p.root), canonical));
  if (exact) {
    throw new Error(
      `Project at "${canonical}" is already registered as "${exact.name}" (id: ${exact.projectId})`
    );
  }

  // ── Check 2: parent / child overlap — warn, do not block ─────────────────
  const warnings = [];
  for (const p of projects) {
    const existingCanon = canonicalizePath(p.root);
    if (isStrictSubpath(existingCanon, canonical)) {
      warnings.push(`  ⚠ "${canonical}" is inside already-registered "${p.name}" (${existingCanon})`);
    } else if (isStrictSubpath(canonical, existingCanon)) {
      warnings.push(`  ⚠ Already-registered "${p.name}" (${existingCanon}) is inside the new path "${canonical}"`);
    }
  }
  if (warnings.length) {
    process.stderr.write(
      `[ProjectRegistry] Overlap warning for "${canonical}":\n${warnings.join('\n')}\n`
    );
  }

  const now = new Date().toISOString();
  const profile = {
    projectId:      generateProjectId(),
    name:           name || canonical.split('/').pop() || canonical,
    root:           canonical,          // always store the realpath
    framework:      null,
    language:       null,
    lastScan:       null,
    lastQA:         null,
    lastScore:      0,
    status:         'unknown',
    sandboxEnabled: true,
    addedAt:        now,
    updatedAt:      now,
  };

  projects.push(profile);
  saveRegistry(projects);
  return profile;
}

/**
 * Remove a project by ID. No-op if not found.
 */
export function removeProject(projectId) {
  const projects = loadRegistry();
  const filtered = projects.filter((p) => p.projectId !== projectId);
  saveRegistry(filtered);
}

/**
 * Get a single project by ID. Returns null if not found.
 */
export function getProject(projectId) {
  const projects = loadRegistry();
  return projects.find((p) => p.projectId === projectId) ?? null;
}

/**
 * Find a project by its root path.
 * Uses realpath resolution + platform-aware comparison so symlinks and
 * case variations map to the same entry.
 */
export function findProjectByRoot(rootPath) {
  const canonical = canonicalizePath(rootPath);
  const projects = loadRegistry();
  return projects.find((p) => pathsEqual(canonicalizePath(p.root), canonical)) ?? null;
}

/**
 * List all projects, sorted newest-first by addedAt.
 */
export function listProjects() {
  const projects = loadRegistry();
  return [...projects].sort((a, b) => {
    const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Merge `updates` into a project entry and set updatedAt.
 * Throws if the project is not found.
 */
export function updateProject(projectId, updates) {
  const projects = loadRegistry();
  const idx = projects.findIndex((p) => p.projectId === projectId);
  if (idx === -1) {
    throw new Error(`Project "${projectId}" not found in registry`);
  }
  projects[idx] = {
    ...projects[idx],
    ...updates,
    projectId,          // never allow overwriting the ID
    updatedAt: new Date().toISOString(),
  };
  saveRegistry(projects);
  return projects[idx];
}

/**
 * Update the root path of a project (e.g. after a directory move/merge).
 * Throws if:
 *   - the project is not found
 *   - the new path is already occupied by a DIFFERENT project
 */
export function repathProject(projectId, newRoot) {
  const newCanonical = canonicalizePath(newRoot);
  const projects = loadRegistry();

  const conflict = projects.find(
    (p) => p.projectId !== projectId && pathsEqual(canonicalizePath(p.root), newCanonical)
  );
  if (conflict) {
    throw new Error(
      `Cannot repath "${projectId}" to "${newCanonical}": already occupied by "${conflict.name}" (${conflict.projectId})`
    );
  }

  return updateProject(projectId, { root: newCanonical });
}

/**
 * Remove registry entries whose root path no longer exists on disk.
 * Returns an array of the removed project profiles.
 */
export function pruneStale() {
  const projects = loadRegistry();
  const stale = projects.filter((p) => !existsSync(p.root));
  if (stale.length === 0) return [];
  saveRegistry(projects.filter((p) => existsSync(p.root)));
  return stale;
}

/**
 * Find groups of entries that resolve to the same realpath.
 * Returns an array of arrays; each inner array has ≥2 entries.
 * Single entries are not included.
 */
export function findDuplicates() {
  const projects = loadRegistry();
  const groups = new Map(); // canonical → project[]

  for (const p of projects) {
    const key = canonicalizePath(p.root);
    const normKey = process.platform === 'darwin' ? key.toLowerCase() : key;
    if (!groups.has(normKey)) groups.set(normKey, []);
    groups.get(normKey).push(p);
  }

  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * Remove duplicate entries, keeping the one with the most recent `updatedAt`
 * (or `addedAt` as fallback). Non-destructive for the "winner".
 *
 * Returns an array of removed project profiles.
 */
export function deduplicateRegistry() {
  const duplicateGroups = findDuplicates();
  if (duplicateGroups.length === 0) return [];

  const toRemove = new Set();
  for (const group of duplicateGroups) {
    // Sort: most-recently-updated first
    const sorted = [...group].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.addedAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.addedAt ?? 0).getTime();
      return tb - ta;
    });
    // Keep sorted[0], remove the rest
    for (let i = 1; i < sorted.length; i++) {
      toRemove.add(sorted[i].projectId);
    }
  }

  const projects = loadRegistry();
  const removed = projects.filter((p) => toRemove.has(p.projectId));
  saveRegistry(projects.filter((p) => !toRemove.has(p.projectId)));
  return removed;
}
