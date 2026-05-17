// rootcause/dependencyTracer.js — traces which dependencies contributed to a failure
// Phase 13: maps error messages to likely dependency sources via import chain analysis

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';

/**
 * Map an error message to likely dependencies.
 * @param {string} errorMessage
 * @param {string} projectRoot
 * @returns {{ dependency: string|null, version: string|null, confidence: number, chain: string[] }}
 */
export function traceFailure(errorMessage, projectRoot) {
  try {
    // Extract module names from common error patterns
    const moduleMatch = errorMessage.match(/Cannot find module ['"]([^'"]+)['"]/);
    if (moduleMatch) {
      const dep = moduleMatch[1];
      return {
        dependency: dep,
        version:    getDepVersion(dep, projectRoot),
        confidence: 0.9,
        chain:      [dep],
      };
    }

    // Look for package names in stack traces
    const nmMatch = errorMessage.match(/node_modules\/([^/]+)/);
    if (nmMatch) {
      const dep = nmMatch[1];
      return {
        dependency: dep,
        version:    getDepVersion(dep, projectRoot),
        confidence: 0.75,
        chain:      [dep],
      };
    }

    return { dependency: null, version: null, confidence: 0, chain: [] };
  } catch (err) {
    console.error('[dependencyTracer] traceFailure error:', err.message);
    return { dependency: null, version: null, confidence: 0, chain: [] };
  }
}

/**
 * Build an import chain by following import/require statements recursively.
 * @param {string} filePath  absolute path to starting file
 * @param {string} projectRoot
 * @param {number} maxDepth
 * @returns {string[]} ordered chain of imported files
 */
export function buildImportChain(filePath, projectRoot, maxDepth = 5) {
  const chain   = [];
  const visited = new Set();

  function walk(fp, depth) {
    if (depth > maxDepth || visited.has(fp) || !existsSync(fp)) return;
    visited.add(fp);
    chain.push(fp.replace(projectRoot, '').replace(/^\//, ''));

    let code;
    try { code = readFileSync(fp, 'utf8'); } catch { return; }

    const importRe = /(?:import\s+.*?from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRe.exec(code)) !== null) {
      const dep = m[1];
      if (!dep.startsWith('.')) continue; // only local files
      const resolved = tryResolve(dep, dirname(fp));
      if (resolved) walk(resolved, depth + 1);
    }
  }

  walk(filePath, 0);
  return chain;
}

/**
 * Find the dependency most likely responsible for a stack trace error.
 * @param {string} errorStack
 * @param {string} projectRoot
 * @returns {{ dependency: string|null, version: string|null, confidence: number, chain: string[] }}
 */
export function findFailingDependency(errorStack, projectRoot) {
  const lines = (errorStack ?? '').split('\n');
  const chain = [];
  let bestDep = null;
  let confidence = 0;

  for (const line of lines) {
    const nm = line.match(/node_modules[/\\](@?[^/\\]+(?:[/\\][^/\\]+)?)/);
    if (nm) {
      const dep = nm[1].replace(/\\/g, '/');
      chain.push(dep);
      if (!bestDep) {
        bestDep    = dep;
        confidence = 0.7;
      }
    }
  }

  return {
    dependency: bestDep,
    version:    bestDep ? getDepVersion(bestDep, projectRoot) : null,
    confidence,
    chain: [...new Set(chain)],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDepVersion(dep, projectRoot) {
  try {
    const depPkg = join(projectRoot, 'node_modules', dep, 'package.json');
    if (existsSync(depPkg)) {
      return JSON.parse(readFileSync(depPkg, 'utf8')).version ?? null;
    }
    // Fallback: check package.json
    const pkgPath = join(projectRoot, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      return pkg.dependencies?.[dep] ?? pkg.devDependencies?.[dep] ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

function tryResolve(importPath, baseDir) {
  const candidates = [
    importPath,
    `${importPath}.js`,
    `${importPath}/index.js`,
    `${importPath}.mjs`,
  ];
  for (const c of candidates) {
    const full = resolve(baseDir, c);
    if (existsSync(full)) return full;
  }
  return null;
}
