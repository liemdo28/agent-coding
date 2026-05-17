// security/AuditLogger.js - append-only security audit logger
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const AUDIT_LOG_SUBPATH = '.local-agent/logs/security-audit.log';

/**
 * Resolve the path to the security audit log for a given workspace root.
 * @param {string} workspaceRoot
 * @returns {string}
 */
function auditLogPath(workspaceRoot) {
  return join(workspaceRoot, AUDIT_LOG_SUBPATH);
}

/**
 * Ensure the directory containing the audit log exists.
 * @param {string} logPath
 */
function ensureLogDir(logPath) {
  const dir = join(logPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append a structured JSON line to the security audit log.
 *
 * @param {'BLOCKED'|'VIOLATION'|'WARNING'|'INFO'} level
 * @param {string} eventType  - short machine-readable event name
 * @param {object|string} detail - additional context for the event
 * @param {string} workspaceRoot - absolute path to the workspace root
 */
export function log(level, eventType, detail, workspaceRoot) {
  const logPath = auditLogPath(workspaceRoot);
  ensureLogDir(logPath);

  const entry = {
    ts: new Date().toISOString(),
    level,
    event: eventType,
    detail,
  };

  try {
    appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // Never let audit logging crash the agent — emit to stderr as fallback
    process.stderr.write(`[AuditLogger] Failed to write audit log: ${err.message}\n`);
  }
}

/**
 * Log a BLOCKED event (operation was prevented by policy).
 *
 * @param {string} eventType
 * @param {object|string} detail
 * @param {string} workspaceRoot
 */
export function logBlocked(eventType, detail, workspaceRoot) {
  log('BLOCKED', eventType, detail, workspaceRoot);
}

/**
 * Log a VIOLATION event (policy was broken — operation may have proceeded).
 *
 * @param {string} eventType
 * @param {object|string} detail
 * @param {string} workspaceRoot
 */
export function logViolation(eventType, detail, workspaceRoot) {
  log('VIOLATION', eventType, detail, workspaceRoot);
}

/**
 * Log a WARNING event (suspicious but not necessarily blocked).
 *
 * @param {string} eventType
 * @param {object|string} detail
 * @param {string} workspaceRoot
 */
export function logWarning(eventType, detail, workspaceRoot) {
  log('WARNING', eventType, detail, workspaceRoot);
}

/**
 * Read the last n lines from the security audit log and parse them as JSON.
 *
 * @param {string} workspaceRoot
 * @param {number} [n=50]
 * @returns {Array<{ ts: string, level: string, event: string, detail: any }>}
 */
export function getRecentEvents(workspaceRoot, n = 50) {
  const logPath = auditLogPath(workspaceRoot);

  if (!existsSync(logPath)) {
    return [];
  }

  let raw;
  try {
    raw = readFileSync(logPath, 'utf8');
  } catch {
    return [];
  }

  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const tail = lines.slice(-n);

  const events = [];
  for (const line of tail) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}
