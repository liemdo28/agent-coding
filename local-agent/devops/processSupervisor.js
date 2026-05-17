// devops/processSupervisor.js — supervises child processes, auto-restarts on crash
// Phase 11: max 3 auto-restarts before marking FAILED

import { spawn } from 'child_process';

const MAX_RESTARTS = 3;
const _supervised  = new Map();

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Start a supervised process that auto-restarts on crash.
 * @param {string} name
 * @param {string} command  full command string
 * @param {{ cwd?: string, env?: object, restartDelayMs?: number }} options
 * @returns {{ name, pid, status }}
 */
export function supervise(name, command, options = {}) {
  if (_supervised.has(name)) return getSupervisedProcess(name);

  const { cwd = process.cwd(), env = process.env, restartDelayMs = 1000 } = options;

  const entry = {
    id:           genId(),
    name,
    command,
    cwd,
    pid:          null,
    restartCount: 0,
    status:       'starting',
    lastCrash:    null,
    child:        null,
    startedAt:    new Date().toISOString(),
  };

  _supervised.set(name, entry);
  _start(name, command, cwd, env, restartDelayMs);

  return getSupervisedProcess(name);
}

function _start(name, command, cwd, env, restartDelayMs) {
  const entry = _supervised.get(name);
  if (!entry) return;

  try {
    const [cmd, ...args] = command.split(/\s+/);
    const child = spawn(cmd, args, { cwd, env, stdio: 'pipe' });
    entry.child  = child;
    entry.pid    = child.pid;
    entry.status = 'running';

    child.on('exit', (code) => {
      if (!_supervised.has(name)) return; // unsupervised

      entry.lastCrash  = new Date().toISOString();
      entry.pid        = null;
      entry.child      = null;

      if (code === 0 || code === null) {
        entry.status = 'stopped';
        return;
      }

      entry.restartCount++;
      if (entry.restartCount > MAX_RESTARTS) {
        entry.status = 'FAILED';
        console.error(`[processSupervisor] ${name} exceeded max restarts (${MAX_RESTARTS}) — marked FAILED`);
        return;
      }

      entry.status = 'restarting';
      setTimeout(() => {
        if (_supervised.has(name)) _start(name, command, cwd, env, restartDelayMs);
      }, restartDelayMs * entry.restartCount);
    });
  } catch (err) {
    entry.status   = 'FAILED';
    entry.lastCrash = err.message;
  }
}

/** Stop supervising a process. */
export function unsupervise(name) {
  const entry = _supervised.get(name);
  if (!entry) return false;
  try { entry.child?.kill('SIGTERM'); } catch { /* ignore */ }
  _supervised.delete(name);
  return true;
}

/** Get info about a supervised process. */
export function getSupervisedProcess(name) {
  const entry = _supervised.get(name);
  if (!entry) return null;
  const { child: _, ...info } = entry; // omit the child handle
  return info;
}

/** List all supervised processes. */
export function listSupervised() {
  return [..._supervised.values()].map(({ child: _, ...info }) => info);
}
