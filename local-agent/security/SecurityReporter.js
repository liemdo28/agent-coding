// security/SecurityReporter.js - generate structured security reports
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const REPORTS_SUBPATH = '.local-agent/reports';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the reports directory exists under the workspace root.
 *
 * @param {string} workspaceRoot
 * @returns {string} Absolute path to the reports directory
 */
function ensureReportsDir(workspaceRoot) {
  const dir = join(resolve(workspaceRoot), REPORTS_SUBPATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Derive an overall result label from the findings.
 *
 * @param {object} findings
 * @returns {'PASS'|'WARNING'|'FAIL'}
 */
function deriveResult(findings) {
  const { secretFindings = [], auditEvents = [], policyChecks = [], sandboxViolations = [], offlineStatus } = findings;

  const hasHighSecrets = secretFindings.some((f) => f.severity === 'HIGH');
  const hasViolations = auditEvents.some((e) => e.level === 'VIOLATION');
  const hasSandboxViolations = sandboxViolations.length > 0;
  const offlineFailed = offlineStatus && !offlineStatus.allPassed;

  if (hasHighSecrets || hasViolations || hasSandboxViolations || offlineFailed) {
    return 'FAIL';
  }

  const hasMediumSecrets = secretFindings.some((f) => f.severity === 'MEDIUM');
  const hasBlocked = auditEvents.some((e) => e.level === 'BLOCKED');
  const hasWarnings = auditEvents.some((e) => e.level === 'WARNING');
  const hasFailedPolicyChecks = policyChecks.some((c) => c.allowed === false);

  if (hasMediumSecrets || hasBlocked || hasWarnings || hasFailedPolicyChecks) {
    return 'WARNING';
  }

  return 'PASS';
}

/**
 * Build the Markdown report string.
 *
 * @param {string} timestamp - ISO timestamp string
 * @param {string} result - 'PASS'|'WARNING'|'FAIL'
 * @param {object} findings
 * @returns {string}
 */
function buildMarkdown(timestamp, result, findings) {
  const {
    secretFindings = [],
    auditEvents = [],
    policyChecks = [],
    sandboxViolations = [],
    offlineStatus,
  } = findings;

  // Aggregate secret stats
  const secretFileSet = new Set(secretFindings.map((f) => f.label).filter(Boolean));
  const highSecrets = secretFindings.filter((f) => f.severity === 'HIGH').length;
  const mediumSecrets = secretFindings.filter((f) => f.severity === 'MEDIUM').length;

  // Aggregate audit event stats
  const violationCount = auditEvents.filter((e) => e.level === 'VIOLATION').length;
  const blockedCount = auditEvents.filter((e) => e.level === 'BLOCKED').length;
  const warningCount = auditEvents.filter((e) => e.level === 'WARNING').length;

  // Policy checks
  const failedChecks = policyChecks.filter((c) => c.allowed === false);

  const lines = [];

  lines.push(`# Security Report — ${timestamp}`);
  lines.push('');
  lines.push(`**Result**: ${result}`);
  lines.push('');

  // ---- Offline Status ----
  lines.push('## Offline Status');
  if (offlineStatus) {
    lines.push(`- offline: ${offlineStatus.offline}`);
    lines.push(`- telemetryDisabled: ${offlineStatus.telemetryDisabled}`);
    lines.push(`- cloudSyncDisabled: ${offlineStatus.cloudSyncDisabled}`);
    lines.push(`- llmLocal: ${offlineStatus.llmLocal}`);
    lines.push(`- llmEndpoint: ${offlineStatus.llmEndpoint || '(not set)'}`);
    lines.push(`- allPassed: ${offlineStatus.allPassed}`);
    if (offlineStatus.violations && offlineStatus.violations.length > 0) {
      lines.push('- violations:');
      for (const v of offlineStatus.violations) {
        lines.push(`  - ${v}`);
      }
    }
  } else {
    lines.push('- (no offline status provided)');
  }
  lines.push('');

  // ---- Secrets Detected ----
  lines.push('## Secrets Detected');
  if (secretFindings.length === 0) {
    lines.push('- No secrets detected.');
  } else {
    lines.push(`- ${secretFindings.length} secret(s) found in ${secretFileSet.size} file(s)`);
    lines.push(`- HIGH severity: ${highSecrets}`);
    lines.push(`- MEDIUM severity: ${mediumSecrets}`);
    if (secretFindings.length > 0) {
      lines.push('- Findings (values redacted):');
      for (const f of secretFindings) {
        lines.push(`  - [${f.severity}] ${f.name} at ${f.label || 'unknown'}:${f.line}:${f.column} — ${f.snippet}`);
      }
    }
  }
  lines.push('');

  // ---- Audit Events ----
  lines.push('## Audit Events');
  lines.push(`- ${auditEvents.length} total event(s)`);
  lines.push(`- VIOLATION: ${violationCount}`);
  lines.push(`- BLOCKED: ${blockedCount}`);
  lines.push(`- WARNING: ${warningCount}`);
  if (auditEvents.length > 0) {
    lines.push('- Recent events:');
    const sample = auditEvents.slice(-20);
    for (const e of sample) {
      const detail = typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail);
      lines.push(`  - [${e.level}] ${e.ts} ${e.event}: ${detail}`);
    }
  }
  lines.push('');

  // ---- Policy Checks ----
  lines.push('## Policy Checks');
  if (policyChecks.length === 0) {
    lines.push('- No policy checks recorded.');
  } else {
    const passedCount = policyChecks.length - failedChecks.length;
    lines.push(`- ${policyChecks.length} check(s): ${passedCount} passed, ${failedChecks.length} failed`);
    if (failedChecks.length > 0) {
      lines.push('- Failed checks:');
      for (const c of failedChecks) {
        lines.push(`  - ${c.reason || JSON.stringify(c)}`);
      }
    }
  }
  lines.push('');

  // ---- Sandbox Violations ----
  lines.push('## Sandbox Violations');
  if (sandboxViolations.length === 0) {
    lines.push('- No sandbox violations recorded.');
  } else {
    lines.push(`- ${sandboxViolations.length} violation(s):`);
    for (const v of sandboxViolations) {
      lines.push(`  - ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }
  lines.push('');

  // ---- Summary ----
  lines.push('## Summary');
  lines.push(`- Overall result: **${result}**`);
  lines.push(`- Secrets found: ${secretFindings.length}`);
  lines.push(`- Audit violations: ${violationCount}`);
  lines.push(`- Audit blocked events: ${blockedCount}`);
  lines.push(`- Sandbox violations: ${sandboxViolations.length}`);
  lines.push(`- Offline policy passed: ${offlineStatus?.allPassed ?? 'unknown'}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a security report from provided findings and write it to disk.
 *
 * @param {string} workspaceRoot
 * @param {{
 *   secretFindings?: Array,
 *   auditEvents?: Array,
 *   policyChecks?: Array,
 *   sandboxViolations?: Array,
 *   offlineStatus?: object,
 * }} findings
 * @returns {{
 *   mdPath: string,
 *   jsonPath: string,
 *   summary: { result: string, secretCount: number, violationCount: number, timestamp: string }
 * }}
 */
function generateReport(workspaceRoot, findings) {
  const reportsDir = ensureReportsDir(workspaceRoot);
  const timestamp = new Date().toISOString();
  const safeName = timestamp.replace(/[:.]/g, '-');

  const result = deriveResult(findings);

  // Build Markdown
  const mdContent = buildMarkdown(timestamp, result, findings);
  const mdPath = join(reportsDir, `security-report-${safeName}.md`);
  writeFileSync(mdPath, mdContent, 'utf8');

  // Build JSON
  const jsonPayload = {
    timestamp,
    result,
    offlineStatus: findings.offlineStatus ?? null,
    secretCount: (findings.secretFindings ?? []).length,
    violationCount: (findings.auditEvents ?? []).filter((e) => e.level === 'VIOLATION').length,
    blockedCount: (findings.auditEvents ?? []).filter((e) => e.level === 'BLOCKED').length,
    sandboxViolationCount: (findings.sandboxViolations ?? []).length,
    findings,
  };
  const jsonPath = join(reportsDir, `security-report-${safeName}.json`);
  writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf8');

  return {
    mdPath,
    jsonPath,
    summary: {
      result,
      secretCount: jsonPayload.secretCount,
      violationCount: jsonPayload.violationCount,
      timestamp,
    },
  };
}

/**
 * Read the most recent security report JSON from the workspace and return
 * a concise status object.
 *
 * @param {string} workspaceRoot
 * @returns {{
 *   lastReport: string|null,
 *   secretCount: number,
 *   violationCount: number,
 *   result: 'PASS'|'WARNING'|'FAIL'|null,
 * }}
 */
function getSecurityStatus(workspaceRoot) {
  const reportsDir = join(resolve(workspaceRoot), REPORTS_SUBPATH);

  if (!existsSync(reportsDir)) {
    return { lastReport: null, secretCount: 0, violationCount: 0, result: null };
  }

  let entries;
  try {
    entries = readdirSync(reportsDir);
  } catch {
    return { lastReport: null, secretCount: 0, violationCount: 0, result: null };
  }

  // Filter to JSON report files and sort lexicographically (ISO timestamps sort correctly)
  const reportFiles = entries
    .filter((f) => f.startsWith('security-report-') && f.endsWith('.json'))
    .sort();

  if (reportFiles.length === 0) {
    return { lastReport: null, secretCount: 0, violationCount: 0, result: null };
  }

  const latestFile = join(reportsDir, reportFiles[reportFiles.length - 1]);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(latestFile, 'utf8'));
  } catch {
    return { lastReport: latestFile, secretCount: 0, violationCount: 0, result: null };
  }

  return {
    lastReport: latestFile,
    secretCount: parsed.secretCount ?? 0,
    violationCount: parsed.violationCount ?? 0,
    result: parsed.result ?? null,
  };
}

// Default export for convenience — also export named for destructuring
export { generateReport, getSecurityStatus };

export default {
  generateReport,
  getSecurityStatus,
};
