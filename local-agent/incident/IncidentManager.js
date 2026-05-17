// incident/IncidentManager.js — create and manage local engineering incidents
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const INCIDENTS_DIR = '.local-agent/incidents';

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const CATEGORIES = new Set([
  'corrupted_workspace', 'broken_release', 'destructive_patch',
  'severe_regression', 'db_corruption', 'crash_loop', 'security', 'other',
]);

function genId() {
  return 'INC-' + Date.now().toString(36).toUpperCase();
}

/**
 * Create a new incident.
 * @param {string} workspaceRoot
 * @param {{ title: string, severity?: string, category?: string, description?: string }} opts
 * @returns {Incident}
 */
export function createIncident(workspaceRoot, { title, severity = 'high', category = 'other', description = '' }) {
  if (!SEVERITIES.has(severity)) severity = 'high';
  if (!CATEGORIES.has(category)) category = 'other';

  const id       = genId();
  const incident = {
    id,
    title,
    severity,
    category,
    description,
    status:      'open',
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    timeline:    [{ ts: new Date().toISOString(), action: 'created', note: description }],
    recoverySteps: [],
  };

  const dir = join(workspaceRoot, INCIDENTS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify(incident, null, 2));
  return incident;
}

/**
 * Load an incident by ID.
 * @param {string} workspaceRoot
 * @param {string} id
 * @returns {Incident|null}
 */
export function loadIncident(workspaceRoot, id) {
  const p = join(workspaceRoot, INCIDENTS_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Update incident (add timeline entry, change status).
 * @param {string} workspaceRoot
 * @param {string} id
 * @param {{ status?: string, note?: string, recoverySteps?: string[] }} update
 */
export function updateIncident(workspaceRoot, id, update) {
  const inc = loadIncident(workspaceRoot, id);
  if (!inc) throw new Error(`Incident not found: ${id}`);
  if (update.status)        inc.status = update.status;
  if (update.recoverySteps) inc.recoverySteps.push(...update.recoverySteps);
  if (update.note) {
    inc.timeline.push({ ts: new Date().toISOString(), action: update.status ?? 'update', note: update.note });
  }
  inc.updatedAt = new Date().toISOString();
  writeFileSync(join(workspaceRoot, INCIDENTS_DIR, `${id}.json`), JSON.stringify(inc, null, 2));
  return inc;
}

/**
 * List all incidents.
 * @param {string} workspaceRoot
 * @param {{ status?: string, severity?: string }} opts
 * @returns {Incident[]}
 */
export function listIncidents(workspaceRoot, opts = {}) {
  const dir = join(workspaceRoot, INCIDENTS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; } })
    .filter((i) => i &&
      (!opts.status   || i.status   === opts.status)   &&
      (!opts.severity || i.severity === opts.severity))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
