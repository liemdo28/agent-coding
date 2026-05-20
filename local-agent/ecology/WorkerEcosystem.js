// local-agent/ecology/WorkerEcosystem.js
// Phase 104 — Execution Ecology
// Classifies workers into busy / idle / overloaded / underutilized buckets
// and generates rebalancing actions for each.

/**
 * Build a per-worker utilization map from the task array.
 * Returns { workerId → { total, running, done, failed, skills: Set } }
 *
 * @param {object[]} tasks
 * @returns {Map<string, object>}
 */
export function buildWorkerUtilMap(tasks) {
  const map = new Map();
  for (const t of tasks) {
    const w = t.assigned_worker;
    if (!w) continue;
    if (!map.has(w)) map.set(w, { total: 0, running: 0, done: 0, failed: 0, skills: new Set() });
    const e = map.get(w);
    e.total++;
    if (t.dev_status === 'DEV_RUNNING') e.running++;
    if (t.dev_status === 'DEV_DONE')    e.done++;
    if (t.dev_status === 'DEV_FAILED')  e.failed++;
    if (t.worker_skill) e.skills.add(t.worker_skill);
  }
  return map;
}

/**
 * Classify workers based on their task load relative to thresholds.
 *
 * @param {Map<string, object>} utilMap         — from buildWorkerUtilMap()
 * @param {number}              overloadThresh  — total tasks > this → overloaded (default 18)
 * @param {number}              starveThresh    — total tasks < this → underutilized (default 5)
 * @returns {{ busy: number, idle: number, overloaded: string[], underutilized: string[] }}
 */
export function classifyWorkers(utilMap, overloadThresh = 18, starveThresh = 5) {
  const overloaded     = [];
  const underutilized  = [];
  let busy = 0, idle = 0;

  for (const [workerId, stats] of utilMap) {
    if (stats.running > 0) {
      busy++;
    } else {
      idle++;
    }
    if (stats.total > overloadThresh) overloaded.push(workerId);
    if (stats.total < starveThresh)   underutilized.push(workerId);
  }

  return { busy, idle, overloaded, underutilized };
}

/**
 * Generate reassign / throttle rebalance actions from worker classification.
 *
 * @param {{ overloaded: string[], underutilized: string[] }} classification
 * @returns {{ action: string, detail: string, urgency: 'low'|'high' }[]}
 */
export function workerRebalanceActions(classification) {
  const actions = [];

  if (classification.overloaded.length > 0) {
    const sample = classification.overloaded.slice(0, 3).join(', ');
    actions.push({
      action:  'reassign',
      detail:  `${classification.overloaded.length} overloaded worker(s) (e.g. ${sample}) — redistribute tasks to idle pool`,
      urgency: 'high',
    });
  }

  if (classification.underutilized.length > classification.overloaded.length) {
    actions.push({
      action:  'throttle',
      detail:  `${classification.underutilized.length} underutilized worker(s) — consider reassigning or pausing inflow`,
      urgency: 'low',
    });
  }

  return actions;
}
