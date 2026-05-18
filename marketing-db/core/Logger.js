// Logger.js — structured logging for marketing-db
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export function createLogger(workspaceRoot, module = 'marketing-db') {
  const logDir = join(workspaceRoot, '.marketing-db/logs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `${module}-${new Date().toISOString().slice(0,10)}.log`);

  return {
    info:  (msg, data) => writeLog(logFile, 'INFO',  module, msg, data),
    warn:  (msg, data) => writeLog(logFile, 'WARN',  module, msg, data),
    error: (msg, data) => writeLog(logFile, 'ERROR', module, msg, data),
    audit: (msg, data) => writeLog(logFile, 'AUDIT', module, msg, data),
  };
}

function writeLog(logFile, level, module, msg, data) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(), level, module, msg,
    ...(data ? { data } : {}),
  });
  try { appendFileSync(logFile, entry + '\n'); } catch { /* non-fatal */ }
}
