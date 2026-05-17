// devops/localScheduler.js — cron-like local task scheduler (no external deps)
// Phase 11: supports */n, *, specific values for minute/hour/day fields

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const _tasks   = new Map();
const _timers  = new Map();
const SCHEDULE_FILE = '.local-agent/scheduler.json';

/**
 * Parse a simple cron expression.
 * Supports: minute hour day-of-month month day-of-week (5 fields)
 * Values: star, star/n, or specific number.
 * @param {string} expr
 * @returns {{ minute, hour, dom, month, dow }}
 */
function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) throw new Error(`Invalid cron expression: ${expr}`);
  const [minute, hour, dom, month, dow] = parts;
  return { minute, hour, dom, month, dow };
}

function matchField(field, value) {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const n = parseInt(field.slice(2), 10);
    return value % n === 0;
  }
  return parseInt(field, 10) === value;
}

function shouldRun(cron) {
  const now = new Date();
  return (
    matchField(cron.minute, now.getMinutes()) &&
    matchField(cron.hour,   now.getHours())   &&
    matchField(cron.dom,    now.getDate())     &&
    matchField(cron.month,  now.getMonth() + 1) &&
    matchField(cron.dow,    now.getDay())
  );
}

/**
 * Schedule a task with a cron expression.
 * @param {string} name
 * @param {string} cronExpr  e.g. "star/5 star star star star" (minute/5 every hour)
 * @param {Function} fn  async or sync task function
 * @param {{ workspaceRoot?: string }} options
 */
export function scheduleTask(name, cronExpr, fn, options = {}) {
  if (_tasks.has(name)) unscheduleTask(name);

  const cron = parseCron(cronExpr);
  const task = {
    name,
    cronExpr,
    createdAt:    new Date().toISOString(),
    lastRunAt:    null,
    runCount:     0,
    status:       'active',
    lastError:    null,
  };

  _tasks.set(name, { ...task, fn, cron });

  // Check every 60 seconds
  const interval = setInterval(async () => {
    const t = _tasks.get(name);
    if (!t || t.status !== 'active') return;
    if (!shouldRun(t.cron)) return;
    try {
      await t.fn();
      t.lastRunAt = new Date().toISOString();
      t.runCount++;
    } catch (err) {
      t.lastError = err.message;
    }
  }, 60_000);

  _timers.set(name, interval);
  persistSchedule(options.workspaceRoot ?? process.cwd());
  return task;
}

/** Remove a scheduled task. */
export function unscheduleTask(name, workspaceRoot = process.cwd()) {
  const timer = _timers.get(name);
  if (timer) clearInterval(timer);
  _timers.delete(name);
  _tasks.delete(name);
  persistSchedule(workspaceRoot);
  return true;
}

/** List all scheduled tasks (without fn). */
export function listTasks() {
  return [..._tasks.values()].map(({ fn: _, cron: __, ...t }) => t);
}

/** Run a task immediately, regardless of cron. */
export async function runNow(name) {
  const task = _tasks.get(name);
  if (!task) return { success: false, error: `Task not found: ${name}` };
  try {
    await task.fn();
    task.lastRunAt = new Date().toISOString();
    task.runCount++;
    return { success: true };
  } catch (err) {
    task.lastError = err.message;
    return { success: false, error: err.message };
  }
}

function persistSchedule(workspaceRoot) {
  try {
    const dir      = join(workspaceRoot, '.local-agent');
    const filePath = join(workspaceRoot, SCHEDULE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(listTasks(), null, 2), 'utf8');
  } catch { /* non-critical */ }
}
