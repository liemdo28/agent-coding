// orchestrator/ProjectHealthMonitor.js — Health status for one or many projects
import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { updateProject } from './ProjectRegistry.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJSON(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function latestQAReport(workspaceRoot) {
  const reportsDir = join(workspaceRoot, '.local-agent', 'reports');
  if (!existsSync(reportsDir)) return null;
  try {
    const files = readdirSync(reportsDir)
      .filter((f) => f.startsWith('qa-report-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return readJSON(join(reportsDir, files[0]));
  } catch {
    return null;
  }
}

// ── Per-project health check ──────────────────────────────────────────────────

/**
 * Evaluate the health of a single project workspace.
 *
 * Status rules (evaluated in priority order):
 *   'fail'    — qaGrade === 'FAIL'  OR  secretCount > 0
 *   'warning' — qaGrade === 'WARNING'  OR  riskCount > 0
 *   'healthy' — data is present and no issues found
 *   'unknown' — no scan/QA data at all
 *
 * Returns { status: 'healthy'|'warning'|'fail'|'unknown', details: {} }
 */
export function checkHealth(workspaceRoot) {
  const scanReport = readJSON(join(workspaceRoot, '.local-agent', 'scan-report.json'));
  const qaReport   = latestQAReport(workspaceRoot);

  const hasData = scanReport !== null || qaReport !== null;

  if (!hasData) {
    return { status: 'unknown', details: { reason: 'No scan or QA data found' } };
  }

  const secretCount = scanReport?.risks?.hardcodedSecrets?.length ?? 0;
  const riskCount   = (scanReport?.risks?.highRisk?.length ?? 0) +
                      (scanReport?.risks?.mediumRisk?.length ?? 0);
  const qaGrade     = qaReport?.grade ?? null;
  const qaScore     = qaReport?.qaScore?.total ?? null;

  const details = { secretCount, riskCount, qaGrade, qaScore };

  if (qaGrade === 'FAIL' || secretCount > 0) {
    return { status: 'fail', details };
  }

  if (qaGrade === 'WARNING' || riskCount > 0) {
    return { status: 'warning', details };
  }

  return { status: 'healthy', details };
}

// ── Batch health check ────────────────────────────────────────────────────────

/**
 * Check health for an array of project registry entries.
 * Returns the same array with `healthStatus` and `healthDetails` added to each item.
 */
export function checkHealthAll(projects) {
  return projects.map((project) => {
    let healthStatus = 'unknown';
    let healthDetails = {};
    try {
      const result = checkHealth(project.root);
      healthStatus   = result.status;
      healthDetails  = result.details;

      // Persist the new status back into the registry (best-effort)
      try {
        updateProject(project.projectId, { status: healthStatus });
      } catch { /* registry may not be writable — ignore */ }
    } catch (err) {
      healthStatus  = 'unknown';
      healthDetails = { error: err.message };
    }
    return { ...project, healthStatus, healthDetails };
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

/**
 * Generate a summary object from an array of projects (as returned by
 * checkHealthAll or the plain registry).
 *
 * Returns:
 *   { total, healthy, warning, fail, unknown, needsAttention: [] }
 *
 * `needsAttention` contains projects whose status is 'fail' or 'warning'.
 */
export function generateHealthSummary(projects) {
  const summary = { total: projects.length, healthy: 0, warning: 0, fail: 0, unknown: 0, needsAttention: [] };

  for (const project of projects) {
    const status = project.healthStatus ?? project.status ?? 'unknown';
    if (status === 'healthy') {
      summary.healthy += 1;
    } else if (status === 'warning') {
      summary.warning += 1;
      summary.needsAttention.push(project);
    } else if (status === 'fail') {
      summary.fail += 1;
      summary.needsAttention.push(project);
    } else {
      summary.unknown += 1;
    }
  }

  return summary;
}
