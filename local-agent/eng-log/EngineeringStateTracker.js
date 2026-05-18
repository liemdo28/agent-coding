// eng-log/EngineeringStateTracker.js — blocked systems, known issues, active risks
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STATE_FILE = '.local-agent/engineering-log/state.json';

const DEFAULT_STATE = {
  blockedSystems: [],
  knownIssues:    [],
  risks: [
    { id: 'R-001', title: 'Context overload on long sessions', mitigation: 'Engineering Log System (this)', severity: 'low',    status: 'mitigated' },
    { id: 'R-002', title: 'Large monorepo scan performance',   mitigation: 'IncrementalIndexer + LRU cache', severity: 'low',    status: 'mitigated' },
    { id: 'R-003', title: 'SQLite lock under parallel writes', mitigation: 'WAL mode enabled',              severity: 'low',    status: 'mitigated' },
    { id: 'R-004', title: 'Plugin sandbox bypass',             mitigation: 'Path guard + permission check', severity: 'medium', status: 'mitigated' },
  ],
  lastUpdated: new Date().toISOString(),
};

function ensureDir(workspaceRoot) {
  mkdirSync(join(workspaceRoot, '.local-agent/engineering-log'), { recursive: true });
}

export function getState(workspaceRoot) {
  const p = join(workspaceRoot, STATE_FILE);
  if (!existsSync(p)) return {
    blockedSystems: [],
    knownIssues:    [],
    risks:          DEFAULT_STATE.risks.map((r) => ({ ...r })),
    lastUpdated:    new Date().toISOString(),
  };
  try {
    const loaded = JSON.parse(readFileSync(p, 'utf8'));
    return {
      blockedSystems: Array.isArray(loaded.blockedSystems) ? loaded.blockedSystems : [],
      knownIssues:    Array.isArray(loaded.knownIssues)    ? loaded.knownIssues    : [],
      risks:          Array.isArray(loaded.risks)          ? loaded.risks          : DEFAULT_STATE.risks.map((r) => ({ ...r })),
      lastUpdated:    loaded.lastUpdated ?? new Date().toISOString(),
    };
  } catch {
    return {
      blockedSystems: [],
      knownIssues:    [],
      risks:          DEFAULT_STATE.risks.map((r) => ({ ...r })),
      lastUpdated:    new Date().toISOString(),
    };
  }
}

export function saveState(workspaceRoot, state) {
  ensureDir(workspaceRoot);
  writeFileSync(
    join(workspaceRoot, STATE_FILE),
    JSON.stringify({ ...state, lastUpdated: new Date().toISOString() }, null, 2),
  );
}

export function updateState(workspaceRoot, delta) {
  saveState(workspaceRoot, { ...getState(workspaceRoot), ...delta });
}

// ── Known Issues ──────────────────────────────────────────────────────────────

export function addKnownIssue(workspaceRoot, {
  title, rootCause, affectedFiles = [], workaround = 'n/a', longTermFix = 'n/a', risk = 'low',
}) {
  const state = getState(workspaceRoot);
  const id    = `ISS-${String(state.knownIssues.length + 1).padStart(3, '0')}`;
  state.knownIssues.push({
    id, title, rootCause, affectedFiles, workaround, longTermFix, risk,
    status: 'open', createdAt: new Date().toISOString(),
  });
  saveState(workspaceRoot, state);
  return id;
}

export function resolveIssue(workspaceRoot, id) {
  const state = getState(workspaceRoot);
  const issue = state.knownIssues.find((i) => i.id === id);
  if (issue) { issue.status = 'resolved'; issue.resolvedAt = new Date().toISOString(); }
  saveState(workspaceRoot, state);
}

export function listKnownIssues(workspaceRoot, { includeResolved = false } = {}) {
  const { knownIssues } = getState(workspaceRoot);
  return includeResolved ? knownIssues : knownIssues.filter((i) => i.status !== 'resolved');
}

// ── Blockers ──────────────────────────────────────────────────────────────────

export function addBlocker(workspaceRoot, { system, reason, severity = 'medium' }) {
  const state = getState(workspaceRoot);
  const id    = `BLK-${String(state.blockedSystems.length + 1).padStart(3, '0')}`;
  state.blockedSystems.push({ id, system, reason, severity, status: 'active', createdAt: new Date().toISOString() });
  saveState(workspaceRoot, state);
  return id;
}

export function resolveBlocker(workspaceRoot, id) {
  const state   = getState(workspaceRoot);
  const blocker = state.blockedSystems.find((b) => b.id === id);
  if (blocker) { blocker.status = 'resolved'; blocker.resolvedAt = new Date().toISOString(); }
  saveState(workspaceRoot, state);
}

export function listBlockers(workspaceRoot, { includeResolved = false } = {}) {
  const { blockedSystems } = getState(workspaceRoot);
  return includeResolved ? blockedSystems : blockedSystems.filter((b) => b.status === 'active');
}

// ── Risks ─────────────────────────────────────────────────────────────────────

export function listRisks(workspaceRoot) {
  return getState(workspaceRoot).risks;
}

export function addRisk(workspaceRoot, { title, mitigation = 'n/a', severity = 'medium' }) {
  const state = getState(workspaceRoot);
  const id    = `R-${String(state.risks.length + 1).padStart(3, '0')}`;
  state.risks.push({ id, title, mitigation, severity, status: 'open' });
  saveState(workspaceRoot, state);
  return id;
}
