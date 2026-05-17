// self-heal/RuntimeRecovery.js — detect and recover runtime state issues
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Detect runtime state issues: lock files, stuck sessions, missing state.
 * @param {string} workspaceRoot
 * @returns {{ issues: Array, healthy: boolean }}
 */
export function detectRuntimeIssues(workspaceRoot) {
  const issues = [];

  // Check for stale lock file
  const lockPath = join(workspaceRoot, '.local-agent', 'agent.lock');
  if (existsSync(lockPath)) {
    let lockAge = Infinity;
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      lockAge = Date.now() - new Date(lock.startedAt || 0).getTime();
    } catch { /* corrupt lock */ }

    // Lock older than 30 min without heartbeat = stale
    if (lockAge > 30 * 60_000) {
      issues.push({ type: 'stale_lock', path: lockPath, ageMs: lockAge });
    }
  }

  // Check for corrupted session state
  const statePath = join(workspaceRoot, '.local-agent', 'session-state.json');
  if (existsSync(statePath)) {
    try {
      JSON.parse(readFileSync(statePath, 'utf8'));
    } catch {
      issues.push({ type: 'corrupt_session_state', path: statePath });
    }
  }

  // Check for missing config
  const configPath = join(workspaceRoot, '.local-agent', 'config.json');
  if (!existsSync(configPath)) {
    issues.push({ type: 'missing_config', path: configPath });
  }

  return { issues, healthy: issues.length === 0 };
}

/**
 * Recover runtime state by clearing stale locks and resetting corrupt state.
 * @param {string} workspaceRoot
 * @param {{ dryRun?: boolean }} opts
 * @returns {{ recovered: number, actions: string[], errors: string[] }}
 */
export function recoverRuntime(workspaceRoot, { dryRun = false } = {}) {
  const { issues } = detectRuntimeIssues(workspaceRoot);
  const actions = [];
  const errors  = [];

  for (const issue of issues) {
    try {
      if (issue.type === 'stale_lock') {
        if (!dryRun) unlinkSync(issue.path);
        actions.push(`Removed stale lock (age: ${Math.round(issue.ageMs / 60000)}min)`);
      } else if (issue.type === 'corrupt_session_state') {
        if (!dryRun) writeFileSync(issue.path, JSON.stringify({ resetAt: new Date().toISOString() }));
        actions.push('Reset corrupt session state');
      } else if (issue.type === 'missing_config') {
        if (!dryRun) {
          mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
          writeFileSync(issue.path, JSON.stringify({ createdAt: new Date().toISOString() }));
        }
        actions.push('Created missing config file');
      }
    } catch (err) {
      errors.push(`${issue.type}: ${err.message}`);
    }
  }

  return { recovered: actions.length, actions, errors, dryRun };
}
