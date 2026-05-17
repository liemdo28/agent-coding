// self-heal/CacheRepair.js — detect and clear stale/corrupt cache artifacts
import { existsSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';

const CACHE_DIRS = [
  '.local-agent/index',
  '.local-agent/backups',
  '.local-agent/logs',
];

const MAX_LOG_AGE_MS  = 7 * 24 * 3600_000;  // 7 days
const MAX_BACKUP_AGE_MS = 30 * 24 * 3600_000; // 30 days

/**
 * Scan for cache issues without making changes.
 * @param {string} workspaceRoot
 * @returns {{ issues: Array, totalStaleBytes: number }}
 */
export function scanCache(workspaceRoot) {
  const issues = [];
  let totalStaleBytes = 0;

  // Check for oversized / stale log files
  const logsDir = join(workspaceRoot, '.local-agent', 'logs');
  if (existsSync(logsDir)) {
    for (const f of readdirSync(logsDir)) {
      const abs  = join(logsDir, f);
      const stat = statSync(abs);
      if (stat.isFile() && (Date.now() - stat.mtimeMs) > MAX_LOG_AGE_MS) {
        issues.push({ type: 'stale_log', path: abs, bytes: stat.size });
        totalStaleBytes += stat.size;
      }
    }
  }

  // Check for old backups
  const backDir = join(workspaceRoot, '.local-agent', 'backups');
  if (existsSync(backDir)) {
    for (const f of readdirSync(backDir)) {
      const abs  = join(backDir, f);
      const stat = statSync(abs);
      if (stat.isFile() && (Date.now() - stat.mtimeMs) > MAX_BACKUP_AGE_MS) {
        issues.push({ type: 'old_backup', path: abs, bytes: stat.size });
        totalStaleBytes += stat.size;
      }
    }
  }

  // Check for zero-byte index fragments
  const idxDir = join(workspaceRoot, '.local-agent', 'index');
  if (existsSync(idxDir)) {
    for (const f of readdirSync(idxDir)) {
      const abs  = join(idxDir, f);
      const stat = statSync(abs);
      if (stat.isFile() && stat.size === 0) {
        issues.push({ type: 'empty_index_file', path: abs, bytes: 0 });
      }
    }
  }

  return { issues, totalStaleBytes };
}

/**
 * Clear identified cache issues.
 * @param {string} workspaceRoot
 * @param {{ dryRun?: boolean }} opts
 * @returns {{ cleared: number, freedBytes: number, errors: string[] }}
 */
export function clearCache(workspaceRoot, { dryRun = false } = {}) {
  const { issues } = scanCache(workspaceRoot);
  let cleared    = 0;
  let freedBytes = 0;
  const errors   = [];

  for (const issue of issues) {
    try {
      if (!dryRun) unlinkSync(issue.path);
      cleared++;
      freedBytes += issue.bytes;
    } catch (err) {
      errors.push(`${issue.path}: ${err.message}`);
    }
  }

  return { cleared, freedBytes, errors, dryRun };
}
