// orchestrator/sessionManager.js — manages agent sessions across projects
// Phase 12: persists to .local-agent/sessions.json

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SESSIONS_FILE = '.local-agent/sessions.json';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadSessions(workspaceRoot) {
  const filePath = join(workspaceRoot, SESSIONS_FILE);
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch { return {}; }
}

function saveSessions(workspaceRoot, sessions) {
  const dir      = join(workspaceRoot, '.local-agent');
  const filePath = join(workspaceRoot, SESSIONS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf8');
}

/**
 * Create a new session for a project.
 * @param {string} projectId
 * @param {object} options  — { workspaceRoot, priority, metadata }
 * @returns {{ sessionId, projectId, startedAt, status, priority }}
 */
export function createSession(projectId, options = {}) {
  const { workspaceRoot = process.cwd(), priority = 'normal', metadata = {} } = options;
  const sessionId = genId();
  const now       = new Date().toISOString();
  const session   = {
    sessionId,
    projectId,
    startedAt:    now,
    lastActivity: now,
    status:       'active',
    priority,
    metadata,
  };

  const sessions    = loadSessions(workspaceRoot);
  sessions[sessionId] = session;
  saveSessions(workspaceRoot, sessions);
  return session;
}

/** Get a session by id. */
export function getSession(sessionId, workspaceRoot = process.cwd()) {
  const sessions = loadSessions(workspaceRoot);
  return sessions[sessionId] ?? null;
}

/** List sessions, optionally filtered. */
export function listSessions(filter = {}, workspaceRoot = process.cwd()) {
  const sessions = Object.values(loadSessions(workspaceRoot));
  return sessions.filter(s => {
    if (filter.status    && s.status    !== filter.status)    return false;
    if (filter.projectId && s.projectId !== filter.projectId) return false;
    return true;
  });
}

/** Update session fields. */
export function updateSession(sessionId, updates, workspaceRoot = process.cwd()) {
  const sessions = loadSessions(workspaceRoot);
  if (!sessions[sessionId]) return null;
  sessions[sessionId] = {
    ...sessions[sessionId],
    ...updates,
    lastActivity: new Date().toISOString(),
  };
  saveSessions(workspaceRoot, sessions);
  return sessions[sessionId];
}

/** Mark a session as closed. */
export function closeSession(sessionId, workspaceRoot = process.cwd()) {
  return updateSession(sessionId, { status: 'closed', closedAt: new Date().toISOString() }, workspaceRoot);
}

/** Return all active sessions. */
export function getActiveSessions(workspaceRoot = process.cwd()) {
  return listSessions({ status: 'active' }, workspaceRoot);
}

/**
 * Remove stale sessions older than a given threshold.
 * @param {number} olderThanMs
 * @param {string} workspaceRoot
 * @returns {{ removed: number }}
 */
export function cleanupStaleSessions(olderThanMs = 86_400_000, workspaceRoot = process.cwd()) {
  const sessions = loadSessions(workspaceRoot);
  const cutoff   = Date.now() - olderThanMs;
  let removed    = 0;

  for (const [id, s] of Object.entries(sessions)) {
    const last = new Date(s.lastActivity ?? s.startedAt ?? 0).getTime();
    if (last < cutoff) {
      delete sessions[id];
      removed++;
    }
  }

  saveSessions(workspaceRoot, sessions);
  return { removed };
}
