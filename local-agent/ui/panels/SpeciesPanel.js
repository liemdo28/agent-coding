// local-agent/ui/panels/SpeciesPanel.js
// Phase 109 — Autonomous Design

const SPECIES_COLOR = {
  optimal:    '#34d399',
  pioneer:    '#60a5fa',
  workhorse:  '#a78bfa',
  fragile:    '#fb923c',
  stagnant:   '#94a3b8',
};

const SPECIES_ICON = {
  optimal: '🦅', pioneer: '🚀', workhorse: '🐂', fragile: '🌿', stagnant: '🪨',
};

function dimBar(score, width = 14) {
  const filled = Math.round(Math.max(0, Math.min(100, score)) / 100 * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Render a SpeciesProfile as HTML.
 *
 * @param {object} speciesProfile  — from SpeciesClassifier.classify()
 * @returns {string} HTML
 */
export function renderSpeciesPanel(speciesProfile) {
  if (!speciesProfile || !speciesProfile.species_class) {
    return `<div class="panel" id="panel-species"><div class="panel-title">🧬 Phase 103 — Software Species</div><div class="dim">No profile available.</div></div>`;
  }

  const sc     = speciesProfile.species_class;
  const color  = SPECIES_COLOR[sc] ?? '#94a3b8';
  const icon   = SPECIES_ICON[sc]  ?? '?';

  const dims = [
    ['Adaptability',    speciesProfile.adaptability    ?? 0],
    ['Stability',       speciesProfile.stability       ?? 0],
    ['Scalability',     speciesProfile.scalability     ?? 0],
    ['Intelligence',    speciesProfile.intelligence    ?? 0],
  ];

  const dimRows = dims.map(([label, score]) => {
    const col = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
    return `<div class="srow">
      <span class="sl">${label}</span>
      <span class="sb" style="color:${col}">${dimBar(score)}</span>
      <span class="sv" style="color:${col}">${Math.round(score)}</span>
    </div>`;
  }).join('');

  return `
<div class="panel" id="panel-species">
  <div class="panel-title">🧬 Phase 103 — Software Species</div>
  <div class="srow">
    <span class="sl">Species</span>
    <span class="sv" style="color:${color};font-weight:700">${icon} ${sc.toUpperCase()}</span>
    <span class="sv dim">composite: ${Math.round(speciesProfile.composite ?? 0)}/100</span>
  </div>
  ${dimRows}
</div>`;
}
