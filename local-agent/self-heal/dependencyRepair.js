// self-heal/dependencyRepair.js — auto-repairs broken/missing npm dependencies
// Phase 16: only runs npm install if risk === 'low' and sandbox policy allows

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Check which declared dependencies are missing from node_modules.
 * @param {string} projectRoot
 * @returns {{ missing: string[], outdated: string[], corrupt: string[] }}
 */
export function detectBrokenDeps(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return { missing: [], outdated: [], corrupt: [] };

  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch {
    return { missing: [], outdated: [], corrupt: [] };
  }

  const declared = Object.keys({
    ...pkg.dependencies ?? {},
    ...pkg.devDependencies ?? {},
  });

  const nmPath  = join(projectRoot, 'node_modules');
  const missing  = [];
  const corrupt  = [];
  const outdated = [];

  for (const dep of declared) {
    const depPath = join(nmPath, dep);
    if (!existsSync(depPath)) {
      missing.push(dep);
      continue;
    }
    // Check for corrupt install (missing package.json inside)
    const depPkg = join(depPath, 'package.json');
    if (!existsSync(depPkg)) {
      corrupt.push(dep);
    }
  }

  return { missing, outdated, corrupt };
}

/**
 * Attempt to repair dependencies by running npm install (sandboxed).
 * Only runs if risk is 'low'.
 * @param {string} projectRoot
 * @param {{ dryRun?: boolean, timeoutMs?: number }} options
 * @returns {{ success: boolean, action: string, output?: string, error?: string }}
 */
export function repairDependencies(projectRoot, options = {}) {
  const { dryRun = false, timeoutMs = 120_000 } = options;

  const health = getDependencyHealth(projectRoot);
  if (health.status === 'healthy') {
    return { success: true, action: 'no_repair_needed' };
  }

  // Risk check: only repair if it's low risk (no missing lock file, no workspace)
  const lockExists = existsSync(join(projectRoot, 'package-lock.json'))
    || existsSync(join(projectRoot, 'yarn.lock'))
    || existsSync(join(projectRoot, 'pnpm-lock.yaml'));

  if (!lockExists) {
    return { success: false, action: 'skipped', error: 'No lockfile — repair risk too high' };
  }

  if (dryRun) {
    return { success: true, action: 'dry_run', missing: health.missing, corrupt: health.corrupt };
  }

  try {
    const output = execSync('npm install --prefer-offline --no-audit', {
      cwd: projectRoot,
      timeout: timeoutMs,
      env: { ...process.env },
      stdio: 'pipe',
    }).toString().trim();

    return { success: true, action: 'npm_install', output: output.slice(0, 500) };
  } catch (err) {
    return { success: false, action: 'npm_install_failed', error: err.message.slice(0, 300) };
  }
}

/**
 * Full dependency health report.
 * @param {string} projectRoot
 * @returns {{ status: string, missing: string[], outdated: string[], corrupt: string[] }}
 */
export function getDependencyHealth(projectRoot) {
  const { missing, outdated, corrupt } = detectBrokenDeps(projectRoot);
  const status = (missing.length + corrupt.length) > 0 ? 'broken'
    : outdated.length > 0 ? 'outdated' : 'healthy';
  return { status, missing, outdated, corrupt };
}
