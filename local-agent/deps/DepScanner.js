// deps/DepScanner.js — scan package.json deps for health issues (fully local, no npm registry)
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const KNOWN_RISKY = new Set([
  'event-stream', 'flatmap-stream', 'colors', 'faker', 'node-ipc',
  'peacenotwar', 'ua-parser-js', 'rc', 'coa',
]);

const KNOWN_ABANDONED = new Set([
  'request', 'node-uuid', 'hoek', 'boom', 'joi@<17',
  'CoffeeScript', 'bower', 'grunt', 'gulp@<4',
]);

const SIZE_WARN_KB = 500; // warn if single dep declared > this (rough heuristic via node_modules size)

/**
 * Load and parse package.json
 * @param {string} projectDir
 * @returns {object|null}
 */
export function loadPackageJson(projectDir) {
  const p = join(projectDir, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Get installed package version from node_modules.
 * @param {string} projectDir
 * @param {string} pkgName
 * @returns {string|null}
 */
function installedVersion(projectDir, pkgName) {
  const p = join(projectDir, 'node_modules', pkgName, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')).version ?? null; } catch { return null; }
}

/**
 * Estimate installed size of a package in KB.
 * @param {string} projectDir
 * @param {string} pkgName
 * @returns {number}
 */
function installedSizeKB(projectDir, pkgName) {
  const dir = join(projectDir, 'node_modules', pkgName);
  if (!existsSync(dir)) return 0;
  let bytes = 0;
  try {
    function walk(d) {
      for (const f of readdirSync(d)) {
        const abs = join(d, f);
        try {
          const s = statSync(abs);
          if (s.isDirectory()) walk(abs);
          else bytes += s.size;
        } catch { /* skip */ }
      }
    }
    walk(dir);
  } catch { /* skip */ }
  return Math.round(bytes / 1024);
}

/**
 * Scan all declared dependencies for health issues.
 * @param {string} projectDir
 * @returns {DepScanResult}
 */
export function scanDeps(projectDir) {
  const pkg = loadPackageJson(projectDir);
  if (!pkg) return { error: 'No package.json found', packages: [] };

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  const packages = [];
  const duplicates = detectDuplicates(projectDir, Object.keys(allDeps));

  for (const [name, declared] of Object.entries(allDeps)) {
    const installed = installedVersion(projectDir, name);
    const sizeKB    = installedSizeKB(projectDir, name);
    const issues    = [];

    if (KNOWN_RISKY.has(name))     issues.push({ type: 'risky',     msg: 'Known malicious/compromised package' });
    if (KNOWN_ABANDONED.has(name)) issues.push({ type: 'abandoned', msg: 'Abandoned / unmaintained package' });
    if (sizeKB > SIZE_WARN_KB)     issues.push({ type: 'oversized', msg: `Large package: ${sizeKB} KB` });
    if (duplicates.has(name))      issues.push({ type: 'duplicate', msg: 'Multiple versions installed' });

    // Range checks
    if (declared.startsWith('*') || declared === 'latest') {
      issues.push({ type: 'unpinned', msg: `Unpinned version: "${declared}"` });
    }

    packages.push({ name, declared, installed, sizeKB, issues, healthy: issues.length === 0 });
  }

  return {
    totalDeps:    packages.length,
    unhealthy:    packages.filter((p) => !p.healthy).length,
    packages,
    summary: {
      risky:     packages.filter((p) => p.issues.some((i) => i.type === 'risky')).length,
      abandoned: packages.filter((p) => p.issues.some((i) => i.type === 'abandoned')).length,
      oversized: packages.filter((p) => p.issues.some((i) => i.type === 'oversized')).length,
      duplicate: packages.filter((p) => p.issues.some((i) => i.type === 'duplicate')).length,
      unpinned:  packages.filter((p) => p.issues.some((i) => i.type === 'unpinned')).length,
    },
  };
}

/**
 * Detect packages with multiple versions in node_modules.
 * @param {string} projectDir
 * @param {string[]} names
 * @returns {Set<string>}
 */
function detectDuplicates(projectDir, names) {
  const dups = new Set();
  const nmDir = join(projectDir, 'node_modules');
  if (!existsSync(nmDir)) return dups;

  for (const name of names) {
    // Check nested .../node_modules/<name> within other packages
    try {
      const nestedCount = countNestedInstalls(nmDir, name, 0);
      if (nestedCount > 1) dups.add(name);
    } catch { /* skip */ }
  }
  return dups;
}

function countNestedInstalls(dir, target, depth) {
  if (depth > 3) return 0;
  let count = 0;
  try {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (entry === target && existsSync(join(abs, 'package.json'))) count++;
      else if (entry === 'node_modules' || (!entry.startsWith('.') && statSync(abs).isDirectory())) {
        count += countNestedInstalls(abs, target, depth + 1);
      }
    }
  } catch { /* skip */ }
  return count;
}
