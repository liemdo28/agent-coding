// local-agent/strategy/TradeoffMatrix.js
// Phase 102 — ranked tradeoff comparison across StrategyScore snapshots.

/**
 * Build a tradeoff matrix from an array of StrategyScore objects.
 * Returns each axis ranked from best to worst, plus the binding constraint
 * (the axis with the lowest current score).
 *
 * @param {object[]} scores  — array of StrategyScore
 * @returns {{ axes: object[], binding_constraint: string, latest: object|null }}
 */
export function buildTradeoffMatrix(scores) {
  if (!scores.length) {
    return { axes: [], binding_constraint: 'unknown', latest: null };
  }

  const latest = scores[0]; // most-recent first

  const axes = [
    {
      name:    'performance',
      score:   latest.performance.score,
      details: {
        cpu_pressure:     latest.performance.cpu_pressure,
        kb_latency_ratio: latest.performance.kb_latency_ratio,
        queue_pressure:   latest.performance.queue_pressure,
      },
    },
    {
      name:    'cost',
      score:   latest.cost.score,
      details: {
        worker_efficiency: latest.cost.worker_efficiency,
        sla_breach_rate:   latest.cost.sla_breach_rate,
      },
    },
    {
      name:    'maintainability',
      score:   latest.maintainability.score,
      details: {
        qa_pass_rate: latest.maintainability.qa_pass_rate,
        kb_coverage:  latest.maintainability.kb_coverage,
      },
    },
  ].sort((a, b) => b.score - a.score);  // best first

  // Compute trend slope over the last N readings (if history available).
  if (scores.length > 1) {
    for (const axis of axes) {
      const vals = scores
        .slice(0, Math.min(scores.length, 10))
        .map((s) => s[axis.name]?.score ?? 0)
        .reverse();  // oldest first for slope calc
      axis.trend = _linearSlope(vals);
    }
  }

  const binding = axes[axes.length - 1];

  return {
    axes,
    binding_constraint: binding.name,
    binding_score:      binding.score,
    composite:          latest.composite,
    recommendation:     latest.recommendation,
    latest,
  };
}

/**
 * Format the tradeoff matrix as a human-readable string for CLI display.
 *
 * @param {{ axes: object[], binding_constraint: string, composite: number, recommendation: string }} matrix
 * @returns {string}
 */
export function formatTradeoffMatrix(matrix) {
  const BAR_WIDTH = 20;
  const lines = [
    '┌─────────────────────────────────────────┐',
    '│  Phase 102 — Strategy Tradeoff Matrix   │',
    '├──────────────────┬────────┬─────────────┤',
    '│ Axis             │ Score  │ Trend       │',
    '├──────────────────┼────────┼─────────────┤',
  ];

  for (const axis of matrix.axes) {
    const bar    = '█'.repeat(Math.round(axis.score / 100 * BAR_WIDTH)).padEnd(BAR_WIDTH, '░');
    const trend  = axis.trend != null ? (axis.trend > 0.5 ? '↑' : axis.trend < -0.5 ? '↓' : '→') : '—';
    const nameP  = axis.name.padEnd(16);
    const scoreP = String(axis.score).padStart(5);
    lines.push(`│ ${nameP} │ ${scoreP} │ ${bar} ${trend} │`);
  }

  lines.push('├──────────────────┴────────┴─────────────┤');
  lines.push(`│ Composite: ${String(matrix.composite).padStart(3)}   Binding: ${matrix.binding_constraint.padEnd(15)}│`);
  lines.push(`│ Recommendation: ${matrix.recommendation.padEnd(23)}│`);
  lines.push('└─────────────────────────────────────────┘');

  return lines.join('\n');
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _linearSlope(vals) {
  if (vals.length < 2) return null;
  const n  = vals.length;
  const sx = (n * (n - 1)) / 2;
  const sx2 = vals.reduce((a, _, i) => a + i * i, 0);
  const sy  = vals.reduce((a, v) => a + v, 0);
  const sxy = vals.reduce((a, v, i) => a + i * v, 0);
  const denom = n * sx2 - sx * sx;
  return denom === 0 ? 0 : +((n * sxy - sx * sy) / denom).toFixed(2);
}
