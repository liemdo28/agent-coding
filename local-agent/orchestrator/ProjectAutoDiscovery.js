// orchestrator/ProjectAutoDiscovery.js
// Scans workspace roots, auto-registers new git repos, detects shared deps,
// and builds KnowledgeGraph edges between related projects.

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import {
  loadRegistry, addProject, findProjectByRoot, updateProject,
  canonicalizePath,
} from './ProjectRegistry.js';

// ── Default scan roots ────────────────────────────────────────────────────────

export const DEFAULT_ROOTS = [
  join(homedir(), 'Projects'),
  join(homedir(), 'Documents'),
  join(homedir(), 'Developer'),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function gitRemote(dir) {
  try {
    return execSync('git remote get-url origin', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { return null; }
}

function gitHead(dir) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { return null; }
}

function detectFramework(dir, pkg) {
  if (!pkg) {
    if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'requirements.txt'))) return 'python';
    if (existsSync(join(dir, 'go.mod'))) return 'go';
    if (existsSync(join(dir, 'Cargo.toml'))) return 'rust';
    return null;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if ('next' in deps)     return 'nextjs';
  if ('react' in deps)    return 'react';
  if ('vue' in deps)      return 'vue';
  if ('svelte' in deps)   return 'svelte';
  if ('express' in deps)  return 'express';
  if ('fastify' in deps)  return 'fastify';
  if ('electron' in deps) return 'electron';
  return 'node';
}

function detectLanguage(dir, pkg) {
  if (pkg) return existsSync(join(dir, 'tsconfig.json')) ? 'TypeScript' : 'JavaScript';
  if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'requirements.txt'))) return 'Python';
  if (existsSync(join(dir, 'go.mod'))) return 'Go';
  if (existsSync(join(dir, 'Cargo.toml'))) return 'Rust';
  return null;
}

/**
 * Find all git repos under `root` up to `maxDepth` levels deep.
 * Returns array of absolute directory paths.
 */
function findGitRepos(root, maxDepth = 3) {
  const repos = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.venv') continue;
        const full = join(dir, e.name);
        if (existsSync(join(full, '.git'))) {
          repos.push(full);
          // Don't recurse into a git repo (unless you want nested monorepos — skip for now)
          continue;
        }
        walk(full, depth + 1);
      }
    } catch { /* permission error — skip */ }
  }
  if (existsSync(root)) walk(root, 0);
  return repos;
}

// ── Scan one repo ─────────────────────────────────────────────────────────────

/**
 * Inspect a single git directory and return its metadata.
 * Does NOT touch the registry — pure read.
 */
export function inspectRepo(dir) {
  const pkg  = readJSON(join(dir, 'package.json'));
  const name = pkg?.name || basename(dir);
  return {
    path:      dir,
    name,
    framework: detectFramework(dir, pkg),
    language:  detectLanguage(dir, pkg),
    remote:    gitRemote(dir),
    head:      gitHead(dir),
    pkg,
    description: pkg?.description ?? null,
    keywords:    pkg?.keywords    ?? [],
    deps:        Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies }),
  };
}

// ── Main discovery ────────────────────────────────────────────────────────────

/**
 * Scan `roots`, register new repos, update metadata on existing ones.
 *
 * @param {object} options
 * @param {string[]} [options.roots]      — directories to scan (default: DEFAULT_ROOTS)
 * @param {number}  [options.maxDepth=3]  — how deep to recurse
 * @param {boolean} [options.dryRun]      — if true, return plan without writing
 * @param {function} [options.onProgress] — called with (msg) for each step
 *
 * @returns {{ added: object[], updated: object[], skipped: object[], errors: object[] }}
 */
export async function discoverProjects(options = {}) {
  const roots    = options.roots    ?? DEFAULT_ROOTS;
  const maxDepth = options.maxDepth ?? 3;
  const dryRun   = options.dryRun   ?? false;
  const log      = options.onProgress ?? (() => {});

  const result = { added: [], updated: [], skipped: [], errors: [] };

  for (const root of roots) {
    if (!existsSync(root)) {
      log(`skip root (not found): ${root}`);
      continue;
    }
    log(`scanning: ${root}`);
    const repos = findGitRepos(root, maxDepth);
    log(`  found ${repos.length} git repos`);

    for (const dir of repos) {
      try {
        const canonical = canonicalizePath(dir);
        const meta      = inspectRepo(canonical);
        const existing  = findProjectByRoot(canonical);

        if (existing) {
          // Update metadata if framework/language changed or was null
          const needsUpdate =
            (meta.framework && existing.framework !== meta.framework) ||
            (meta.language  && existing.language  !== meta.language);

          if (!dryRun && needsUpdate) {
            updateProject(existing.projectId, {
              framework: meta.framework ?? existing.framework,
              language:  meta.language  ?? existing.language,
            });
          }
          result.updated.push({ ...meta, projectId: existing.projectId, action: 'updated' });
          log(`  updated: ${meta.name}`);
        } else {
          if (!dryRun) {
            const profile = addProject(canonical, meta.name);
            updateProject(profile.projectId, {
              framework: meta.framework,
              language:  meta.language,
            });
            result.added.push({ ...meta, projectId: profile.projectId, action: 'added' });
          } else {
            result.added.push({ ...meta, action: 'would-add' });
          }
          log(`  ${dryRun ? 'would add' : 'added'}: ${meta.name}`);
        }
      } catch (err) {
        result.errors.push({ dir, error: err.message });
        log(`  error: ${dir} — ${err.message}`);
      }
    }
  }

  return result;
}

// ── Shared-dependency detection ───────────────────────────────────────────────

/**
 * For each pair of registered projects, find their shared npm/pip packages.
 * Returns array of { a, b, shared: string[] } sorted by shared count desc.
 *
 * Only checks projects where `deps` is non-empty.
 */
export function detectSharedDependencies() {
  const projects = loadRegistry();
  const depMap   = new Map(); // projectId → Set<dep>

  for (const p of projects) {
    if (!existsSync(p.root)) continue;
    const pkg = readJSON(join(p.root, 'package.json'));
    if (!pkg) continue;
    const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
    if (deps.size > 0) depMap.set(p.projectId, { project: p, deps });
  }

  const pairs = [];
  const ids   = [...depMap.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = depMap.get(ids[i]);
      const b = depMap.get(ids[j]);
      // Ignore trivial shared deps
      const IGNORE = new Set(['typescript', 'eslint', 'prettier', 'jest', 'vite', 'dotenv']);
      const shared = [...a.deps].filter(d => b.deps.has(d) && !IGNORE.has(d));
      if (shared.length >= 3) {
        pairs.push({ a: a.project, b: b.project, shared, count: shared.length });
      }
    }
  }

  return pairs.sort((x, y) => y.count - x.count);
}

/**
 * Detect projects in the same git org (same GitHub user/org prefix in remote URL).
 * Returns array of { org, projects: [] }
 */
export function detectSameOrg() {
  const projects = loadRegistry();
  const orgMap   = new Map();

  for (const p of projects) {
    const remote = gitRemote(p.root);
    if (!remote) continue;
    // Extract org: github.com/ORG/repo or git@github.com:ORG/repo
    const m = remote.match(/(?:github\.com[:/])([^/]+)\//);
    if (!m) continue;
    const org = m[1];
    if (!orgMap.has(org)) orgMap.set(org, []);
    orgMap.get(org).push(p);
  }

  return [...orgMap.entries()]
    .filter(([, ps]) => ps.length > 1)
    .map(([org, ps]) => ({ org, projects: ps }));
}
