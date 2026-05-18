// self-heal/RecoveryPlanner.js — build a prioritized recovery plan from health issues
import { detectRuntimeIssues } from './RuntimeRecovery.js';
import { verifyIndex }         from './IndexRepair.js';
import { scanCache }           from './CacheRepair.js';

const PRIORITY = {
  stale_lock:            1,
  corrupt_session_state: 1,
  missing_db:            2,
  missing_file:          2,
  empty_index:           3,
  missing_config:        3,
  empty_index_file:      4,
  stale_log:             5,
  old_backup:            5,
  high_memory:           4,
};

/**
 * Build a full recovery plan for a workspace.
 * @param {string} workspaceRoot
 * @param {object} healthReport — from HealthWatcher.getHealth()
 * @returns {{ steps: Array, urgency: 'critical'|'warning'|'ok' }}
 */
export function buildRecoveryPlan(workspaceRoot, healthReport) {
  const steps = [];

  // Runtime issues
  const { issues: runtimeIssues } = detectRuntimeIssues(workspaceRoot);
  for (const issue of runtimeIssues) {
    steps.push({
      priority:    PRIORITY[issue.type] ?? 3,
      type:        issue.type,
      action:      'recover-runtime',
      description: describeIssue(issue),
      auto:        true,
    });
  }

  // Health issues from watcher
  for (const issue of (healthReport?.issues ?? [])) {
    if (runtimeIssues.find((r) => r.type === issue.type)) continue; // no dup
    steps.push({
      priority:    PRIORITY[issue.type] ?? 3,
      type:        issue.type,
      action:      issueAction(issue.type),
      description: describeIssue(issue),
      auto:        issue.type !== 'missing_db',
    });
  }

  // Cache issues
  const { issues: cacheIssues } = scanCache(workspaceRoot);
  if (cacheIssues.length > 0) {
    steps.push({
      priority:    5,
      type:        'stale_cache',
      action:      'clear-cache',
      description: `${cacheIssues.length} stale/old cache files (${Math.round(cacheIssues.reduce((s,i)=>s+i.bytes,0)/1024)} KB)`,
      auto:        true,
    });
  }

  // Index issues
  const { valid, issues: idxIssues } = verifyIndex(workspaceRoot);
  if (!valid) {
    steps.push({
      priority:    3,
      type:        'invalid_index',
      action:      'repair-index',
      description: idxIssues.join('; '),
      auto:        true,
    });
  }

  steps.sort((a, b) => a.priority - b.priority);

  const maxPriority = steps.length > 0 ? steps[0].priority : Infinity;
  const urgency     = maxPriority <= 2 ? 'critical' : maxPriority <= 4 ? 'warning' : 'ok';

  return { steps, urgency, stepCount: steps.length };
}

function issueAction(type) {
  if (type === 'empty_index' || type === 'empty_index_file') return 'repair-index';
  if (type === 'stale_log'   || type === 'old_backup')       return 'clear-cache';
  if (type === 'high_memory')                                  return 'recover-runtime';
  return 'recover-runtime';
}

function describeIssue(issue) {
  switch (issue.type) {
    case 'stale_lock':            return `Stale agent lock file (${Math.round((issue.ageMs ?? 0) / 60000)}min old)`;
    case 'corrupt_session_state': return 'Corrupt session state file';
    case 'missing_db':            return 'Agent database missing — re-run init';
    case 'missing_file':          return `Missing critical file: ${issue.file}`;
    case 'empty_index':           return 'Index directory empty — run scan';
    case 'missing_config':        return 'Config file missing';
    case 'empty_index_file':      return `Zero-byte index file: ${issue.path}`;
    case 'stale_log':             return `Stale log file: ${issue.path}`;
    case 'old_backup':            return `Old backup: ${issue.path}`;
    case 'high_memory':           return `High memory usage: ${issue.memMB} MB`;
    default:                      return `Issue: ${issue.type}`;
  }
}
