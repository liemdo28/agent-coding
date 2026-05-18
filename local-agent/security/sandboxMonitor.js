// security/sandboxMonitor.js — monitors sandbox violations during command execution
// Phase 10: tracks NETWORK_ATTEMPT, PATH_ESCAPE, EXEC_BLOCKED, ENV_LEAK

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const VIOLATION_TYPES = ['NETWORK_ATTEMPT', 'PATH_ESCAPE', 'EXEC_BLOCKED', 'ENV_LEAK'];

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// In-memory monitor store (keyed by sessionId)
const _monitors = new Map();

/**
 * Start monitoring a new session.
 * @param {string} sessionId
 * @returns {{ sessionId, violations, startedAt, active }}  (monitor handle)
 */
export function startMonitoring(sessionId) {
  const handle = {
    sessionId,
    violations: [],
    startedAt:  new Date().toISOString(),
    active:     true,
  };
  _monitors.set(sessionId, handle);
  return handle;
}

/**
 * Record a sandbox violation on a monitor handle.
 * @param {object} handle  — returned by startMonitoring
 * @param {{ type: string, detail?: string, path?: string }} violation
 */
export function recordViolation(handle, violation) {
  if (!handle || !handle.active) return;
  if (!VIOLATION_TYPES.includes(violation.type)) {
    violation.type = 'EXEC_BLOCKED'; // default
  }
  handle.violations.push({
    id:         genId(),
    type:       violation.type,
    detail:     violation.detail ?? '',
    path:       violation.path ?? null,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Stop monitoring and return results.
 * @param {object} handle
 * @returns {{ violations: object[], duration: number, sessionId: string }}
 */
export function stopMonitoring(handle) {
  if (!handle) return { violations: [], duration: 0, sessionId: null };
  handle.active = false;
  const duration = Date.now() - new Date(handle.startedAt).getTime();
  _monitors.delete(handle.sessionId);
  return {
    violations: handle.violations,
    duration,
    sessionId:  handle.sessionId,
  };
}

/**
 * Persist and retrieve violation history from disk.
 * @param {string} workspaceRoot
 * @param {number} limit
 * @returns {object[]}
 */
export function getViolationHistory(workspaceRoot, limit = 100) {
  const filePath = join(workspaceRoot, '.local-agent', 'sandbox-violations.json');
  if (!existsSync(filePath)) return [];
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data.slice(-limit) : [];
  } catch {
    return [];
  }
}

/**
 * Persist a completed session's violations to disk.
 * @param {string} workspaceRoot
 * @param {object} result  — from stopMonitoring
 */
export function persistViolations(workspaceRoot, result) {
  const dir      = join(workspaceRoot, '.local-agent');
  const filePath = join(dir, 'sandbox-violations.json');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let history = [];
  try {
    const raw = readFileSync(filePath, 'utf8');
    history = JSON.parse(raw);
  } catch { /* start fresh */ }

  history.push({
    sessionId:  result.sessionId,
    violations: result.violations,
    duration:   result.duration,
    savedAt:    new Date().toISOString(),
  });

  // Keep last 500 sessions
  if (history.length > 500) history = history.slice(-500);
  writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
}

/** Return a currently active monitor handle by sessionId, or null. */
export function getMonitor(sessionId) {
  return _monitors.get(sessionId) ?? null;
}
