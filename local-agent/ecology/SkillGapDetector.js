// local-agent/ecology/SkillGapDetector.js
// Phase 104 — Execution Ecology
// Detects which worker skills have disproportionately high failure rates,
// signalling a skill gap that rebalancing should address.

/**
 * @typedef {{ skill: string, failure_rate: number, worker_count: number,
 *             total_tasks: number, failed_tasks: number,
 *             sla_breach_rate: number }} SkillGap
 */

/**
 * Group tasks by worker_skill and compute failure + SLA breach rates per skill.
 * Returns only skills whose failure rate exceeds the threshold.
 *
 * @param {object[]} tasks      — task records
 * @param {number}   threshold  — failure_rate cutoff (default 0.3 = 30%)
 * @returns {SkillGap[]}  sorted by failure_rate descending
 */
export function detectSkillGaps(tasks, threshold = 0.3) {
  const bySkill = new Map();

  for (const t of tasks) {
    const skill = t.worker_skill ?? 'unknown';
    if (!bySkill.has(skill)) {
      bySkill.set(skill, { workers: new Set(), tasks: [], failed: 0, breaches: 0 });
    }
    const entry = bySkill.get(skill);
    if (t.assigned_worker) entry.workers.add(t.assigned_worker);
    entry.tasks.push(t);
    if (t.dev_status === 'DEV_FAILED') entry.failed++;
    if (t.sla_breach) entry.breaches++;
  }

  const gaps = [];
  for (const [skill, { workers, tasks: skillTasks, failed, breaches }] of bySkill) {
    const total        = skillTasks.length;
    const failure_rate = total > 0 ? +(failed / total).toFixed(3) : 0;
    if (failure_rate < threshold) continue;

    gaps.push({
      skill,
      failure_rate,
      worker_count:    workers.size,
      total_tasks:     total,
      failed_tasks:    failed,
      sla_breach_rate: total > 0 ? +(breaches / total).toFixed(3) : 0,
    });
  }

  return gaps.sort((a, b) => b.failure_rate - a.failure_rate);
}

/**
 * Return a list of recommended skill-specific actions based on detected gaps.
 *
 * @param {SkillGap[]} gaps
 * @returns {{ action: string, detail: string, urgency: 'low'|'high' }[]}
 */
export function skillGapActions(gaps) {
  return gaps.map((g) => ({
    action:  'scale_skill',
    detail:  `Skill '${g.skill}': ${Math.round(g.failure_rate * 100)}% failure rate across ${g.worker_count} worker(s) / ${g.total_tasks} tasks`,
    urgency: g.failure_rate > 0.5 ? 'high' : 'low',
  }));
}
