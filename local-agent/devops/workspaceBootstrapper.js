// devops/workspaceBootstrapper.js — automates workspace startup checks and repair
// Phase 11: checks node version, deps, env, services, health endpoints

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import http from 'http';

const MIN_NODE_MAJOR = 18;

/**
 * Run all bootstrap checks for a workspace.
 * @param {string} workspaceRoot
 * @param {{ services?: object[] }} options
 * @returns {{ checks: object[], passed: number, failed: number, warnings: number }}
 */
export async function runBootstrapChecks(workspaceRoot, options = {}) {
  const checks = [];

  // ── Node.js version ────────────────────────────────────────────────────────
  try {
    const ver   = process.versions.node;
    const major = parseInt(ver.split('.')[0], 10);
    checks.push({
      name:    'Node.js version',
      status:  major >= MIN_NODE_MAJOR ? 'pass' : 'fail',
      message: `Node ${ver} (min: ${MIN_NODE_MAJOR})`,
      fix:     major < MIN_NODE_MAJOR ? `Upgrade Node.js to v${MIN_NODE_MAJOR}+` : null,
    });
  } catch (err) {
    checks.push({ name: 'Node.js version', status: 'fail', message: err.message, fix: null });
  }

  // ── package.json present ──────────────────────────────────────────────────
  const pkgPath = join(workspaceRoot, 'package.json');
  checks.push({
    name:    'package.json',
    status:  existsSync(pkgPath) ? 'pass' : 'warn',
    message: existsSync(pkgPath) ? 'Found' : 'Missing',
    fix:     existsSync(pkgPath) ? null : 'Run npm init',
  });

  // ── node_modules present ──────────────────────────────────────────────────
  const nmPath = join(workspaceRoot, 'node_modules');
  checks.push({
    name:    'node_modules',
    status:  existsSync(nmPath) ? 'pass' : 'fail',
    message: existsSync(nmPath) ? 'Present' : 'Missing',
    fix:     existsSync(nmPath) ? null : 'Run npm install',
  });

  // ── .env present ──────────────────────────────────────────────────────────
  const envPath = join(workspaceRoot, '.env');
  checks.push({
    name:    '.env file',
    status:  existsSync(envPath) ? 'pass' : 'warn',
    message: existsSync(envPath) ? 'Present' : 'Not found',
    fix:     existsSync(envPath) ? null : 'Copy .env.example to .env',
  });

  // ── Git repository ────────────────────────────────────────────────────────
  try {
    execSync('git rev-parse --git-dir', { cwd: workspaceRoot, stdio: 'pipe' });
    checks.push({ name: 'Git repo', status: 'pass', message: 'Valid git repository', fix: null });
  } catch {
    checks.push({ name: 'Git repo', status: 'warn', message: 'Not a git repository', fix: 'Run git init' });
  }

  // ── Health endpoints ──────────────────────────────────────────────────────
  const services = options.services ?? [];
  for (const svc of services) {
    if (!svc.healthUrl) continue;
    try {
      const ok = await checkRouteHealth(svc.healthUrl);
      checks.push({
        name:    `Health: ${svc.name}`,
        status:  ok ? 'pass' : 'fail',
        message: `${svc.healthUrl} → ${ok ? 'UP' : 'DOWN'}`,
        fix:     ok ? null : `Start service: ${svc.name}`,
      });
    } catch {
      checks.push({ name: `Health: ${svc.name}`, status: 'warn', message: 'Could not check', fix: null });
    }
  }

  const passed   = checks.filter(c => c.status === 'pass').length;
  const failed   = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;

  return { checks, passed, failed, warnings };
}

/**
 * Full workspace bootstrap: run checks, return detailed result.
 */
export async function bootstrapWorkspace(workspaceRoot, options = {}) {
  const result = await runBootstrapChecks(workspaceRoot, options);
  return { ...result, workspaceRoot, bootstrappedAt: new Date().toISOString() };
}

/**
 * Generate a markdown bootstrap report.
 * @param {{ checks: object[], passed: number, failed: number, warnings: number }} result
 * @returns {string}
 */
export function generateBootstrapReport(result) {
  const lines = [
    '# Workspace Bootstrap Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    `| Status | Count |`,
    `|--------|-------|`,
    `| Pass   | ${result.passed} |`,
    `| Fail   | ${result.failed} |`,
    `| Warn   | ${result.warnings} |`,
    '',
    '## Checks',
    '',
  ];

  for (const c of result.checks) {
    const icon = c.status === 'pass' ? 'OK' : c.status === 'fail' ? 'FAIL' : 'WARN';
    lines.push(`- [${icon}] **${c.name}**: ${c.message}${c.fix ? ` — Fix: \`${c.fix}\`` : ''}`);
  }

  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkRouteHealth(url) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    } catch { resolve(false); }
  });
}
