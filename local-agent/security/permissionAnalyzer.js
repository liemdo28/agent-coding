// security/permissionAnalyzer.js — file/command permission risk analysis
// Phase 10: offline-only, scans workspace for dangerous permission patterns

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const HIGH_RISK_COMMANDS = ['sudo', 'su', 'chmod 777', 'chmod a+x', 'chown root'];
const SUDO_RE     = /\bsudo\b/g;
const CHMOD777_RE = /chmod\s+777/g;
const SETUID_MASK = 0o4000;
const SETGID_MASK = 0o2000;
const WORLD_WRITE = 0o002;

/**
 * Scan workspace for setuid/setgid files, world-writable paths, chmod 777, sudo usage.
 * @param {string} workspaceRoot
 * @returns {{ findings: object[], riskLevel: string }}
 */
export function analyzePermissions(workspaceRoot) {
  const findings = [];

  try {
    walkDir(workspaceRoot, (filePath) => {
      try {
        const st = statSync(filePath);
        const rel = relative(workspaceRoot, filePath);

        if (st.mode & SETUID_MASK) {
          findings.push({ type: 'SETUID_FILE', path: rel, risk: 'high' });
        }
        if (st.mode & SETGID_MASK) {
          findings.push({ type: 'SETGID_FILE', path: rel, risk: 'medium' });
        }
        if (st.mode & WORLD_WRITE) {
          findings.push({ type: 'WORLD_WRITABLE', path: rel, risk: 'medium' });
        }

        // Scan script files for dangerous patterns
        if (/\.(sh|bash|zsh|fish|ps1|bat|cmd|js|ts|py)$/.test(filePath)) {
          let text;
          try { text = readFileSync(filePath, 'utf8'); } catch { return; }
          if (CHMOD777_RE.test(text)) {
            findings.push({ type: 'CHMOD_777_IN_SCRIPT', path: rel, risk: 'high' });
          }
          if (SUDO_RE.test(text)) {
            findings.push({ type: 'SUDO_USAGE', path: rel, risk: 'medium' });
          }
        }
      } catch { /* skip unreadable */ }
    }, { maxDepth: 6, skipDirs: ['node_modules', '.git', 'dist', 'build', '.next'] });
  } catch (err) {
    console.error('[permissionAnalyzer] analyzePermissions error:', err.message);
  }

  const riskLevel = findings.some(f => f.risk === 'high') ? 'high'
    : findings.some(f => f.risk === 'medium') ? 'medium' : 'low';

  return { findings, riskLevel };
}

/**
 * Check a single command string for permission risks.
 * @param {string} command
 * @returns {{ risk: string, reasons: string[] }}
 */
export function checkCommandPermissions(command) {
  const reasons = [];
  let risk = 'low';

  for (const pattern of HIGH_RISK_COMMANDS) {
    if (command.includes(pattern)) {
      reasons.push(`Contains dangerous pattern: ${pattern}`);
      risk = pattern.includes('777') || pattern.startsWith('sudo') ? 'high' : 'medium';
    }
  }

  if (/chmod\s+\+s/.test(command)) {
    reasons.push('Sets setuid bit');
    risk = 'high';
  }
  if (/>\s*\/etc\//.test(command) || /\bdd\b/.test(command)) {
    reasons.push('Writes to system path');
    risk = 'high';
  }

  return { risk, reasons };
}

/**
 * Full permission report for a workspace.
 * @param {string} workspaceRoot
 * @returns {{ summary: object, findings: object[] }}
 */
export function getPermissionReport(workspaceRoot) {
  const { findings, riskLevel } = analyzePermissions(workspaceRoot);
  const summary = {
    riskLevel,
    totalFindings: findings.length,
    high:   findings.filter(f => f.risk === 'high').length,
    medium: findings.filter(f => f.risk === 'medium').length,
    low:    findings.filter(f => f.risk === 'low').length,
    generatedAt: new Date().toISOString(),
  };
  return { summary, findings };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, fn, opts = {}, depth = 0) {
  const { maxDepth = 8, skipDirs = [] } = opts;
  if (depth > maxDepth) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (skipDirs.includes(name)) continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (st.isDirectory()) walkDir(full, fn, opts, depth + 1);
      else fn(full);
    } catch { /* skip */ }
  }
}
