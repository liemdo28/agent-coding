// local-agent/weather/SLAStormDetector.js
// Phase 107 — Detect impending SLA storms from the running task set.

const SLA_HOURS = { P1: 4, P2: 24, P3: 72 };

/**
 * Detect SLA storm risk from the current task set.
 *
 * @param {Array<object>} tasks         All tasks (any status).
 * @param {object}        _queueForecast  Reserved for future use.
 * @returns {{ at_risk: number, breach_probability: number, running_count: number, median_duration_h: number }}
 */
export function detectSLAStorm(tasks, _queueForecast) {
  const all     = tasks ?? [];
  const running = all.filter((t) => t.dev_status === 'DEV_RUNNING');

  const running_count = running.length;

  // Compute median and 90th-percentile duration from ALL tasks
  const durations = all
    .map((t) => t.duration_h)
    .filter((d) => typeof d === 'number' && isFinite(d))
    .sort((a, b) => a - b);

  const median_duration_h = durations.length
    ? percentile(durations, 50)
    : 0;

  // Count at-risk running tasks
  let at_risk = 0;
  for (const task of running) {
    const slaH = SLA_HOURS[task.priority] ?? 24;
    const alreadyBreached = task.sla_breach === true;
    const willBreach      = typeof task.duration_h === 'number' && task.duration_h > slaH;

    if (alreadyBreached || willBreach) {
      at_risk++;
    }
  }

  const breach_probability = clamp(0, 1, at_risk / Math.max(running_count, 1));

  return {
    at_risk,
    breach_probability: round4(breach_probability),
    running_count,
    median_duration_h:  round4(median_duration_h),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v));
}

function round4(v) {
  return Math.round(v * 10_000) / 10_000;
}
