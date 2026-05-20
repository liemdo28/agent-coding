// local-agent/ecology/FoodChainAnalyzer.js
// Phase 104 — Execution Ecology
// Models tasks as "food" consumed by workers: P1 is high-value scarce prey,
// P3 is abundant low-value filler. Measures consumption rate per priority tier.

/**
 * @typedef {{ priority: string, count: number, running: number, done: number,
 *             failed: number, completion_rate: number, failure_rate: number,
 *             avg_duration_h: number, sla_breach_count: number }} FoodChainNode
 */

/**
 * Group tasks by priority and compute consumption metrics per tier.
 *
 * @param {object[]} tasks  — task records from execution_summary.json
 * @returns {FoodChainNode[]}  — P1 → P2 → P3 order
 */
export function analyzeFoodChain(tasks) {
  const tiers = { P1: [], P2: [], P3: [] };
  for (const t of tasks) {
    const p = t.priority ?? 'P3';
    if (tiers[p]) tiers[p].push(t);
  }

  return ['P1', 'P2', 'P3'].map((priority) => {
    const group = tiers[priority];
    if (!group.length) {
      return { priority, count: 0, running: 0, done: 0, failed: 0,
               completion_rate: 0, failure_rate: 0, avg_duration_h: 0,
               sla_breach_count: 0 };
    }

    const running  = group.filter((t) => t.dev_status === 'DEV_RUNNING').length;
    const done     = group.filter((t) => t.dev_status === 'DEV_DONE').length;
    const failed   = group.filter((t) => t.dev_status === 'DEV_FAILED').length;
    const breaches = group.filter((t) => t.sla_breach).length;

    const durations = group
      .filter((t) => typeof t.duration_h === 'number')
      .map((t) => t.duration_h);
    const avg_duration_h = durations.length
      ? +(durations.reduce((a, v) => a + v, 0) / durations.length).toFixed(3)
      : 0;

    return {
      priority,
      count:            group.length,
      running,
      done,
      failed,
      completion_rate:  +(done / group.length).toFixed(3),
      failure_rate:     +(failed / group.length).toFixed(3),
      avg_duration_h,
      sla_breach_count: breaches,
    };
  });
}

/**
 * Derive the queue pressure level from the food chain.
 * Uses P1 backlog (undone P1 tasks) as the primary signal.
 *
 * @param {FoodChainNode[]} foodChain
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function foodChainPressure(foodChain) {
  const p1 = foodChain.find((n) => n.priority === 'P1');
  if (!p1) return 'low';

  const p1Undone = p1.count - p1.done;
  const p1FailRate = p1.failure_rate;

  if (p1Undone > 20 || p1FailRate > 0.3) return 'critical';
  if (p1Undone > 10 || p1FailRate > 0.15) return 'high';
  if (p1Undone > 3  || p1FailRate > 0.05) return 'medium';
  return 'low';
}
