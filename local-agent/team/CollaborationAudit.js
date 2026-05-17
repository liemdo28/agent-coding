// team/CollaborationAudit.js — audit log for all team collaboration actions
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const AUDIT_FILE = '.local-agent/team-audit.jsonl';

/**
 * Append an audit event to the team collaboration log.
 * @param {string} workspaceRoot
 * @param {string} action — e.g. 'export-memory', 'import-memory', 'export-recipes'
 * @param {object} meta — additional metadata (no secrets)
 */
export function auditLog(workspaceRoot, action, meta = {}) {
  const entry = {
    ts:     new Date().toISOString(),
    action,
    user:   process.env.USER ?? process.env.USERNAME ?? 'unknown',
    ...meta,
  };
  // Strip any accidental secret-looking fields
  for (const key of Object.keys(entry)) {
    if (/password|secret|token|api.?key/i.test(key)) entry[key] = '[REDACTED]';
  }

  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  appendFileSync(join(workspaceRoot, AUDIT_FILE), JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Read the team audit log.
 * @param {string} workspaceRoot
 * @param {{ limit?: number }} opts
 * @returns {object[]}
 */
export function readAuditLog(workspaceRoot, { limit = 100 } = {}) {
  const p = join(workspaceRoot, AUDIT_FILE);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
