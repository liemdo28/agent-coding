// local-agent/experiments/HypothesisBuilder.js
// Phase 105 — Autonomous Scientist
// Generates experiment hypotheses from an EcologyReport (Phase 104).

/**
 * @typedef {object} HypothesisSuggestion
 * @property {string} hypothesis      — plain-English description
 * @property {string} variable        — the independent variable being tested
 * @property {string} metric          — the dependent metric to measure
 * @property {object} controlFilter   — filter for control group tasks
 * @property {object} treatmentFilter — filter for treatment group tasks
 */

/**
 * Suggest up to 5 experiment hypotheses based on an EcologyReport.
 *
 * @param {object} ecologyReport — EcologyReport from EcologyBalancer.analyze()
 * @returns {HypothesisSuggestion[]}
 */
export function suggestHypotheses(ecologyReport) {
  const suggestions = [];

  const { workers, food_chain, queue } = ecologyReport;

  // ── 1. Highest-failure-rate skill vs others ──────────────────────────────
  if (workers.skill_gaps && workers.skill_gaps.length > 0) {
    // Sort by failure_rate descending; pick the worst skill
    const sorted = [...workers.skill_gaps].sort((a, b) => b.failure_rate - a.failure_rate);
    const worst  = sorted[0];

    suggestions.push({
      hypothesis:      `Tasks assigned to workers with skill '${worst.skill}' have a higher SLA breach rate than tasks with other skills`,
      variable:        'worker_skill',
      metric:          'sla_breach',
      controlFilter:   { worker_skill: worst.skill },
      treatmentFilter: {},   // empty → all tasks; splitByFilter handles partial match
    });
  }

  // ── 2. Overloaded vs normal worker duration ──────────────────────────────
  if (workers.overloaded && workers.overloaded.length > 0) {
    const overloadedIds = workers.overloaded.map((w) =>
      typeof w === 'string' ? w : w.worker_id ?? w.id ?? w
    );

    suggestions.push({
      hypothesis:      `Tasks handled by overloaded workers take longer than tasks handled by normal workers`,
      variable:        'worker_load_status',
      metric:          'duration_h',
      controlFilter:   { assigned_worker: overloadedIds[0] },
      treatmentFilter: {},
    });
  }

  // ── 3. P1 completion rate < 70% → compare P1 vs P2 completion ───────────
  const p1Node = food_chain?.find((n) => n.priority === 'P1');
  if (p1Node && p1Node.completion_rate < 0.70) {
    suggestions.push({
      hypothesis:      `P1 tasks have a lower SLA breach rate than P2 tasks, suggesting priority routing is under-performing`,
      variable:        'priority',
      metric:          'sla_breach',
      controlFilter:   { priority: 'P1' },
      treatmentFilter: { priority: 'P2' },
    });
  }

  // ── 4. High/critical queue pressure → DEV_RUNNING vs DEV_DONE SLA breach ─
  if (queue.pressure === 'high' || queue.pressure === 'critical') {
    suggestions.push({
      hypothesis:      `Tasks in DEV_RUNNING status have a higher SLA breach rate than tasks in DEV_DONE, indicating backlog-driven breaches`,
      variable:        'dev_status',
      metric:          'sla_breach',
      controlFilter:   { dev_status: 'DEV_RUNNING' },
      treatmentFilter: { dev_status: 'DEV_DONE' },
    });
  }

  // ── 5. General: P1 vs P3 duration comparison (always useful baseline) ────
  if (suggestions.length < 5) {
    suggestions.push({
      hypothesis:      `P1 tasks take longer to complete than P3 tasks, reflecting higher complexity at critical priority`,
      variable:        'priority_level',
      metric:          'duration_h',
      controlFilter:   { priority: 'P1' },
      treatmentFilter: { priority: 'P3' },
    });
  }

  return suggestions.slice(0, 5);
}
