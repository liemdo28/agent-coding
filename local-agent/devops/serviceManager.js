// devops/serviceManager.js — manages local development services (start/stop/status)
// Phase 11: persists service registry to .local-agent/services.json

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const SERVICES_FILE = '.local-agent/services.json';

// In-memory process handles (not persisted across restarts)
const _processes = new Map();

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadRegistry(workspaceRoot) {
  const filePath = join(workspaceRoot, SERVICES_FILE);
  if (!existsSync(filePath)) return {};
  try { return JSON.parse(readFileSync(filePath, 'utf8')); } catch { return {}; }
}

function saveRegistry(workspaceRoot, registry) {
  const dir      = join(workspaceRoot, '.local-agent');
  const filePath = join(workspaceRoot, SERVICES_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Register a service definition.
 * @param {string} name
 * @param {{ command: string, cwd?: string, healthUrl?: string, port?: number }} config
 * @param {string} workspaceRoot
 */
export function registerService(name, config, workspaceRoot = process.cwd()) {
  const registry = loadRegistry(workspaceRoot);
  registry[name] = {
    id:        genId(),
    name,
    command:   config.command,
    cwd:       config.cwd ?? workspaceRoot,
    healthUrl: config.healthUrl ?? null,
    port:      config.port ?? null,
    status:    'stopped',
    pid:       null,
    startedAt: null,
    lastError: null,
    registeredAt: new Date().toISOString(),
  };
  saveRegistry(workspaceRoot, registry);
  return registry[name];
}

/** Start a registered service. */
export function startService(name, workspaceRoot = process.cwd()) {
  const registry = loadRegistry(workspaceRoot);
  const svc      = registry[name];
  if (!svc) return { success: false, error: `Service not found: ${name}` };
  if (_processes.has(name)) return { success: false, error: 'Service already running' };

  try {
    const [cmd, ...args] = svc.command.split(/\s+/);
    const child = spawn(cmd, args, {
      cwd:   svc.cwd,
      stdio: 'pipe',
      env:   { ...process.env, PORT: svc.port?.toString() ?? process.env.PORT },
    });

    _processes.set(name, { child, startedAt: Date.now() });
    registry[name].status    = 'running';
    registry[name].pid       = child.pid;
    registry[name].startedAt = new Date().toISOString();
    registry[name].lastError = null;

    child.on('exit', (code) => {
      _processes.delete(name);
      const reg2 = loadRegistry(workspaceRoot);
      if (reg2[name]) {
        reg2[name].status = code === 0 ? 'stopped' : 'crashed';
        reg2[name].pid    = null;
        reg2[name].lastError = code !== 0 ? `Exited with code ${code}` : null;
        saveRegistry(workspaceRoot, reg2);
      }
    });

    saveRegistry(workspaceRoot, registry);
    return { success: true, pid: child.pid };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Stop a running service. */
export function stopService(name, workspaceRoot = process.cwd()) {
  const handle = _processes.get(name);
  if (!handle) return { success: false, error: 'Service not running' };
  try {
    handle.child.kill('SIGTERM');
    _processes.delete(name);
    const registry = loadRegistry(workspaceRoot);
    if (registry[name]) {
      registry[name].status = 'stopped';
      registry[name].pid    = null;
      saveRegistry(workspaceRoot, registry);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Restart a service. */
export function restartService(name, workspaceRoot = process.cwd()) {
  stopService(name, workspaceRoot);
  return startService(name, workspaceRoot);
}

/** Get current status of a service. */
export function getServiceStatus(name, workspaceRoot = process.cwd()) {
  const registry = loadRegistry(workspaceRoot);
  const svc      = registry[name];
  if (!svc) return null;
  const handle = _processes.get(name);
  const uptime = handle ? Date.now() - handle.startedAt : null;
  return {
    running:   !!handle,
    pid:       svc.pid,
    uptime,
    lastError: svc.lastError,
    status:    svc.status,
  };
}

/** List all registered services. */
export function listServices(workspaceRoot = process.cwd()) {
  return Object.values(loadRegistry(workspaceRoot));
}
