// local-agent/ui/panels/EcologyPanel.js
// Phase 109 — Autonomous Design

const PRESSURE_COLOR = { low: '#34d399', medium: '#fbbf24', high: '#fb923c', critical: '#f87171' };

function bar(pct, width = 14) {
  const filled = Math.round(Math.max(0, Math.min(1, pct / 100)) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Render EcologyReport as HTML.
 *
 * @param {object} ecologyReport  — from EcologyBalancer.analyze()
 * @returns {string} HTML
 */
export function renderEcologyPanel(ecologyReport) {
  const q   = ecologyReport?.queue   ?? {};
  const wrk = ecologyReport?.workers ?? {};
  const fc  = ecologyReport?.food_chain ?? [];
  const pressure   = q.pressure ?? 'low';
  const pressColor = PRESSURE_COLOR[pressure] ?? '#94a3b8';

  const foodRows = fc.map((n) => {
    if (!n.count) return '';
    const pct = Math.round(n.completion_rate * 100);
    return `<div class="srow">
      <span class="sl">${n.priority}</span>
      <span class="sb" style="color:#3b82f6">${bar(pct)}</span>
      <span class="sv">${pct}% done  <span class="dim">${n.count} tasks / ${n.sla_breach_count} breaches</span></span>
    </div>`;
  }).join('');

  const recs = (ecologyReport?.recommendation ?? []).slice(0, 3).map((r) =>
    `<div class="rec ${r.urgency === 'high' ? 'rec-high' : ''}">⟶ [${r.action}] ${r.detail}</div>`
  ).join('');

  return `
<div class="panel" id="panel-ecology">
  <div class="panel-title">🌿 Phase 104 — Execution Ecology</div>
  <div class="srow">
    <span class="sl">Pressure</span>
    <span class="sv" style="color:${pressColor};font-weight:700">${pressure.toUpperCase()}</span>
    <span class="sv dim">queue depth: ${q.depth ?? 0}  sustainable: ${q.sustainable ? 'yes' : 'NO'}</span>
  </div>
  <div class="srow">
    <span class="sl">Workers</span>
    <span class="sv">${wrk.busy ?? 0} busy / ${wrk.idle ?? 0} idle  overloaded: ${(wrk.overloaded ?? []).length}</span>
  </div>
  <div class="subsection-title">Food Chain</div>
  ${foodRows}
  ${recs ? `<div class="subsection-title">Recommendations</div>${recs}` : ''}
</div>`;
}
