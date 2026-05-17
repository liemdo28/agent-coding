// eng-log/IncidentRecorder.js — record failed attempts, regressions, and runtime incidents
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const INCIDENTS_DIR = '.local-agent/engineering-log/incidents';

/**
 * Record an engineering incident.
 * @param {string} workspaceRoot
 * @param {{ title: string, rootCause: string, failedFiles?: string[], qaResult?: string,
 *           whyFailed: string, rollbackResult?: string, prevention?: string, severity?: string }} opts
 * @returns {Incident}
 */
export function recordIncident(workspaceRoot, opts) {
  const dir = join(workspaceRoot, INCIDENTS_DIR);
  mkdirSync(dir, { recursive: true });

  const existing = listIncidents(workspaceRoot);
  const id       = String(existing.length + 1).padStart(3, '0');

  const incident = {
    incidentId:       `INC-LOG-${id}`,
    title:            opts.title,
    severity:         opts.severity ?? 'medium',
    rootCause:        opts.rootCause,
    failedFiles:      opts.failedFiles ?? [],
    qaResult:         opts.qaResult ?? 'unknown',
    whyFailed:        opts.whyFailed,
    rollbackResult:   opts.rollbackResult ?? 'n/a',
    prevention:       opts.prevention ?? 'See rootCause for mitigation.',
    status:           'open',
    recordedAt:       new Date().toISOString(),
  };

  const mdContent = `# Incident ${incident.incidentId}: ${incident.title}

**Recorded:** ${incident.recordedAt}
**Severity:** ${incident.severity}
**Status:** ${incident.status}

## Root Cause
${incident.rootCause}

## Failed Files
${incident.failedFiles.length ? incident.failedFiles.map((f) => `- ${f}`).join('\n') : '- none'}

## QA Result
${incident.qaResult}

## Why It Failed
${incident.whyFailed}

## Rollback Result
${incident.rollbackResult}

## Prevention Recommendation
${incident.prevention}
`;

  writeFileSync(join(dir, `INC-LOG-${id}.md`), mdContent);
  writeFileSync(join(dir, `INC-LOG-${id}.json`), JSON.stringify(incident, null, 2));
  return incident;
}

/**
 * List all recorded incidents (from JSON files).
 * @param {string} workspaceRoot
 * @returns {Incident[]}
 */
export function listIncidents(workspaceRoot) {
  const dir = join(workspaceRoot, INCIDENTS_DIR);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => a.incidentId.localeCompare(b.incidentId));
  } catch { return []; }
}
