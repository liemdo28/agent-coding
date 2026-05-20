// local-agent/sensors/worker-sensor.js — Worker pool metrics from execution_summary.json

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

const SUMMARY_PATH = join(PROJECT_ROOT, '.super-agent-fullauto-kpi', 'execution_summary.json');

// How far back (in ms) to look for "recent" tasks when computing throughput
const THROUGHPUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window, then scale to per-min

const ZEROS = {
  total_workers:       0,
  active_workers:      0,
  idle_workers:        0,
  queue_depth:         0,
  throughput_per_min:  0,
  sla_breach_count:    0,
  top_bottleneck:      null,
};

/**
 * Collect worker pool metrics by analysing execution_summary.json.
 * Returns zeros when the file doesn't exist.
 */
export async function collect() {
  if (!existsSync(SUMMARY_PATH)) {
    return { ...ZEROS };
  }

  try {
    const raw   = readFileSync(SUMMARY_PATH, 'utf8');
    const tasks = JSON.parse(raw);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { ...ZEROS };
    }

    // Unique workers
    const workerIds   = new Set(tasks.map((t) => t.assigned_worker).filter(Boolean));
    const totalWorkers = workerIds.size;

    // Active = currently running (DEV_RUNNING or QA_RUNNING)
    const running = tasks.filter(
      (t) => t.dev_status === 'DEV_RUNNING' || t.qa_status === 'QA_RUNNING'
    );
    const activeWorkerIds = new Set(running.map((t) => t.assigned_worker).filter(Boolean));
    const activeWorkers   = activeWorkerIds.size;
    const idleWorkers     = Math.max(0, totalWorkers - activeWorkers);

    // Queue depth = tasks not yet started / still pending
    // Treat as tasks where dev_status is missing or 'DEV_QUEUED'
    const queueDepth = tasks.filter(
      (t) => !t.dev_status || t.dev_status === 'DEV_QUEUED'
    ).length;

    // Throughput: tasks completed in the last hour (DEV_DONE), scaled to per-minute
    const now      = Date.now();
    const recentDone = tasks.filter((t) => {
      if (t.dev_status !== 'DEV_DONE') return false;
      if (!t.started_at) return false;
      // Use started_at + duration_h as approximate completion time
      const startMs  = new Date(t.started_at).getTime();
      const endMs    = startMs + (t.duration_h ?? 0) * 3600 * 1000;
      return (now - endMs) <= THROUGHPUT_WINDOW_MS;
    });
    const throughputPerMin = Math.round((recentDone.length / 60) * 100) / 100; // per-min over 1-hr window

    // SLA breach count (all time)
    const slaBreachCount = tasks.filter((t) => t.sla_breach === true).length;

    // Top bottleneck company: company with most SLA breaches
    const breachByCompany = {};
    for (const t of tasks) {
      if (t.sla_breach === true && t.company) {
        breachByCompany[t.company] = (breachByCompany[t.company] ?? 0) + 1;
      }
    }
    let topBottleneck = null;
    let topCount      = 0;
    for (const [company, count] of Object.entries(breachByCompany)) {
      if (count > topCount) {
        topCount      = count;
        topBottleneck = company;
      }
    }

    return {
      total_workers:      totalWorkers,
      active_workers:     activeWorkers,
      idle_workers:       idleWorkers,
      queue_depth:        queueDepth,
      throughput_per_min: throughputPerMin,
      sla_breach_count:   slaBreachCount,
      top_bottleneck:     topBottleneck,
    };
  } catch (err) {
    return { ...ZEROS, error: err.message };
  }
}
