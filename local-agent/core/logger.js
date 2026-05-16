// core/logger.js - file + console logger with timestamps
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let _logFilePath = null;
let _level = 'info';
let _consoleEnabled = true;

function timestamp() {
  return new Date().toISOString();
}

function levelTag(level) {
  return `[${level.toUpperCase().padEnd(5)}]`;
}

function writeToFile(line) {
  if (!_logFilePath) return;
  try {
    appendFileSync(_logFilePath, line + '\n', 'utf8');
  } catch {
    // silently ignore file write failures — don't crash the agent
  }
}

function shouldLog(level) {
  return (LOG_LEVELS[level] ?? 0) >= (LOG_LEVELS[_level] ?? 1);
}

function formatMessage(level, message, meta) {
  const ts = timestamp();
  const tag = levelTag(level);
  const metaPart = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${tag} ${message}${metaPart}`;
}

export function initLogger(workspaceDir, level = 'info', consoleEnabled = true) {
  _level = level;
  _consoleEnabled = consoleEnabled;

  const logsDir = join(workspaceDir, '.local-agent', 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  _logFilePath = join(logsDir, 'agent.log');
}

export const logger = {
  debug(message, meta) {
    if (!shouldLog('debug')) return;
    const line = formatMessage('debug', message, meta);
    writeToFile(line);
    if (_consoleEnabled) process.stderr.write(line + '\n');
  },

  info(message, meta) {
    if (!shouldLog('info')) return;
    const line = formatMessage('info', message, meta);
    writeToFile(line);
    if (_consoleEnabled) process.stderr.write(line + '\n');
  },

  warn(message, meta) {
    if (!shouldLog('warn')) return;
    const line = formatMessage('warn', message, meta);
    writeToFile(line);
    if (_consoleEnabled) process.stderr.write(line + '\n');
  },

  error(message, meta) {
    if (!shouldLog('error')) return;
    const line = formatMessage('error', message, meta);
    writeToFile(line);
    if (_consoleEnabled) process.stderr.write(line + '\n');
  },

  /** Log to file only, without console output */
  fileOnly(level, message, meta) {
    const line = formatMessage(level, message, meta);
    writeToFile(line);
  },
};

export default logger;
