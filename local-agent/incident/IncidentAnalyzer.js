// incident/IncidentAnalyzer.js — analyze an incident and suggest recovery steps
import { loadIncident } from './IncidentManager.js';

const RECOVERY_PLAYBOOKS = {
  corrupted_workspace: [
    'Run: local-agent heal status',
    'Run: local-agent heal recover-runtime --dry-run',
    'Run: local-agent heal recover-runtime',
    'Run: local-agent heal repair-index',
    'Run: local-agent scan to rebuild project map',
    'Verify: local-agent status',
  ],
  broken_release: [
    'Identify the breaking commit: git log --oneline -10',
    'Run: local-agent timeline regressions to find regression point',
    'Revert last deployment: git revert HEAD or git reset --hard <safe-sha>',
    'Run: local-agent qa to verify reverted state',
    'Tag safe release: git tag <version>-reverted',
  ],
  destructive_patch: [
    'Do NOT apply any further patches',
    'Run: local-agent rollback <patch-id>',
    'Verify rollback: local-agent qa',
    'Analyze patch risk: local-agent timeline file <affected-file>',
    'Review patch proposal before re-applying',
  ],
  severe_regression: [
    'Run: local-agent timeline regressions',
    'Identify first failing commit: git bisect start',
    'Run regression test suite: local-agent test',
    'Create incident patch: local-agent fix "<regression description>"',
    'Apply only after QA passes: local-agent apply <patch-id>',
  ],
  db_corruption: [
    'Do NOT write to database',
    'Create backup: cp .local-agent/local-agent.db .local-agent/local-agent.db.bak',
    'Run: local-agent heal recover-runtime',
    'Verify WAL: sqlite3 .local-agent/local-agent.db "PRAGMA integrity_check"',
    'If corrupt, restore from backup or reinitialize: local-agent init',
  ],
  crash_loop: [
    'Kill all agent processes: pkill -f local-agent',
    'Clear stale locks: local-agent heal recover-runtime',
    'Check logs: local-agent logs (or .local-agent/logs/)',
    'Restart with verbose: node bin/local-agent.js status --verbose',
    'File incident report: local-agent incident report <id>',
  ],
  security: [
    'Immediately rotate exposed credentials (offline)',
    'Run: local-agent vault scan',
    'Run: local-agent vault audit',
    'Identify exposure: local-agent timeline file <affected-file>',
    'Remediate: local-agent vault isolate',
    'Document in incident timeline',
  ],
  other: [
    'Document symptoms clearly in incident timeline',
    'Run: local-agent health status',
    'Run: local-agent qa for baseline',
    'Escalate to appropriate playbook if category becomes clear',
  ],
};

/**
 * Analyze an incident and return suggested recovery steps.
 * @param {string} workspaceRoot
 * @param {string} incidentId
 * @returns {{ incident: Incident, analysis: object, recoverySteps: string[] }}
 */
export function analyzeIncident(workspaceRoot, incidentId) {
  const incident = loadIncident(workspaceRoot, incidentId);
  if (!incident) throw new Error(`Incident not found: ${incidentId}`);

  const playbook = RECOVERY_PLAYBOOKS[incident.category] ?? RECOVERY_PLAYBOOKS.other;

  const urgency =
    incident.severity === 'critical' ? 'IMMEDIATE — stop all other work' :
    incident.severity === 'high'     ? 'HIGH — address within the hour'  :
    incident.severity === 'medium'   ? 'MEDIUM — address today'          : 'LOW — schedule fix';

  const analysis = {
    id:          incident.id,
    severity:    incident.severity,
    category:    incident.category,
    urgency,
    status:      incident.status,
    age:         Math.round((Date.now() - new Date(incident.createdAt)) / 60000) + ' min',
    timelineLen: incident.timeline.length,
  };

  return { incident, analysis, recoverySteps: playbook };
}
