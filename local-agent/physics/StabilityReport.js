// local-agent/physics/StabilityReport.js
// Phase 110 — Physics Engine
// Human-readable CLI and dashboard text rendering of a StabilityEquation.

/**
 * Format a StabilityEquation as a multi-line plain-text report.
 *
 * @param {object} eq  — StabilityEquation
 * @returns {string}
 */
export function formatStabilityReport(eq) {
  const PHASE_ICON = {
    stable:      '🟢',
    meta_stable: '🟡',
    oscillating: '🟠',
    diverging:   '🔴',
    critical:    '💀',
  };
  const icon = PHASE_ICON[eq.phase_state] ?? '?';
  const sign = eq.stability_index >= 0 ? '+' : '';
  const nfSign = eq.net_force >= 0 ? '+' : '';

  const lines = [
    '┌─────────────────────────────────────────────────┐',
    `│  Phase 110 — Physics Engine Stability Report    │`,
    '├─────────────────────────────────────────────────┤',
    `│  ${icon} Phase state   : ${eq.phase_state.padEnd(12)}                    │`,
    `│  Stability index : ${(sign + eq.stability_index).padEnd(8)}  (range: -100 to +100)  │`,
    `│  Net force       : ${(nfSign + eq.net_force).padEnd(8)}  (+ve = diverging)         │`,
    `│  Entropy         : ${String(eq.entropy.current).padEnd(8)}  delta: ${eq.entropy.delta >= 0 ? '+' : ''}${eq.entropy.delta}  ${eq.entropy.trend.padEnd(12)} │`,
    '├─────────────────────────────────────────────────┤',
    '│  Force breakdown                                │',
  ];

  const forces = eq.forces ?? {};
  const forceNames = [
    ['queue_pressure',      'Queue pressure   '],
    ['sla_breach_force',    'SLA breach force '],
    ['skill_gap_force',     'Skill gap force  '],
    ['kb_latency_drag',     'KB latency drag  '],
    ['ecology_restoration', 'Ecology restore  '],
    ['pattern_inheritance', 'Pattern inherit  '],
  ];

  for (const [key, label] of forceNames) {
    const v    = forces[key] ?? 0;
    const sign = v >= 0 ? '+' : '';
    const bar  = _miniBar(v, -20, 40, 12);
    lines.push(`│    ${label}: ${(sign + v).padStart(7)}  ${bar}  │`);
  }

  lines.push('├─────────────────────────────────────────────────┤');

  if (eq.restoration_actions?.length) {
    lines.push('│  Restoration actions                            │');
    for (const a of eq.restoration_actions.slice(0, 3)) {
      const line = `    · ${a.action}: ${a.estimated_delta >= 0 ? '+' : ''}${a.estimated_delta} idx`;
      lines.push(`│  ${line.padEnd(47)}│`);
    }
  } else {
    lines.push('│  No restoration actions needed.                 │');
  }

  lines.push('└─────────────────────────────────────────────────┘');
  return lines.join('\n');
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _miniBar(value, min, max, width) {
  const range = max - min;
  const norm  = Math.max(0, Math.min(1, (value - min) / range));
  const filled = Math.round(norm * width);
  const bar    = ('█'.repeat(filled) + '░'.repeat(width - filled));
  return `[${bar}]`;
}
