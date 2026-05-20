// local-agent/ui/UIGenerator.js
// Phase 109 — Autonomous Design
// Generates a self-contained, adaptive HTML dashboard that reflects live
// execution state from all prior phases. Theme adapts to weather alert level.

import { existsSync, writeFileSync,
         readFileSync, mkdirSync }   from 'fs';
import { resolve, dirname }          from 'path';
import { fileURLToPath }             from 'url';
import { selectTheme, applyTheme }   from './ThemeEngine.js';
import { renderSensorPanel }         from './panels/SensorPanel.js';
import { renderEcologyPanel }        from './panels/EcologyPanel.js';
import { renderWeatherPanel }        from './panels/WeatherPanel.js';
import { renderSpeciesPanel }        from './panels/SpeciesPanel.js';

const ROOT       = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR    = resolve(ROOT, '.local-agent', 'dashboard');
const INDEX_HTML = resolve(OUT_DIR, 'index.html');
const DATA_JSON  = resolve(OUT_DIR, 'data.json');

// ── Inline CSS ─────────────────────────────────────────────────────────────

function _css(theme) {
  return `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:{{THEME_BG}};color:{{THEME_TEXT}};padding:24px;font-size:13px}
h1{font-size:16px;font-weight:800;color:{{THEME_ACCENT}};margin-bottom:4px}
.subtitle{font-size:11px;color:{{THEME_DIM}};margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.panel{background:color-mix(in srgb,{{THEME_BG}} 70%,#1e293b);border:1px solid {{THEME_BORDER}};border-radius:10px;padding:16px}
.panel-title{font-size:11px;font-weight:700;color:{{THEME_DIM}};text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;border-bottom:1px solid {{THEME_BORDER}};padding-bottom:6px}
.sensor-row-group,.srow{display:flex;align-items:baseline;gap:8px;margin-bottom:5px}
.sl{width:72px;color:{{THEME_DIM}};flex-shrink:0;font-size:11px}
.sb{font-family:monospace;font-size:12px;letter-spacing:1px}
.sv{font-size:12px;font-weight:600}
.dim{font-size:11px;color:{{THEME_DIM}};font-weight:400}
.subsection-title{font-size:10px;color:{{THEME_DIM}};text-transform:uppercase;letter-spacing:.06em;margin:10px 0 4px}
.rec{font-size:11px;color:{{THEME_DIM}};margin-bottom:3px}
.rec-high{color:#fb923c}
.alert-banner{background:#7f1d1d;border:1px solid #f87171;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:700;color:#fca5a5}
.alert-row .sv{font-size:14px}
${theme.pulsing ? '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.panel{animation:pulse 2s infinite}' : ''}
`.replace(/\n/g, ' ');
}

// ── HTML template ──────────────────────────────────────────────────────────

function buildHTML(panels, theme, meta) {
  const alertBanner = theme.alertBanner
    ? `<div class="alert-banner">⚠ ${theme.label.toUpperCase()} ALERT — recommendation: ${theme.recommendation?.toUpperCase() ?? 'N/A'}</div>`
    : '';

  const ts = meta.ts?.slice(0, 19).replace('T', ' ') ?? new Date().toISOString().slice(0, 19).replace('T', ' ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Local Agent — AOS Dashboard</title>
<style>${applyTheme(_css(theme), theme)}</style>
</head>
<body class="{{THEME_PULSING}}">
<h1>Local Agent — AOS Dashboard</h1>
<div class="subtitle">Phase 109 · Generated ${ts} · Theme: ${theme.label} · Auto-refresh 30s</div>
${alertBanner}
<div class="grid">
${panels.join('\n')}
</div>
<script>
// Lightweight auto-refresh of data.json without full page reload
async function poll() {
  try {
    const r = await fetch('data.json?' + Date.now());
    if (r.ok) console.log('[AOS] data refreshed');
  } catch {}
}
setInterval(poll, 30000);
</script>
</body>
</html>`.replace(/\{\{THEME_PULSING\}\}/g, theme.pulsing ? 'pulsing' : '');
}

// ── UIGenerator class ──────────────────────────────────────────────────────

export class UIGenerator {
  /**
   * @param {object} options
   * @param {string} [options.outputDir]   default ~/.local-agent/dashboard/
   */
  constructor(options = {}) {
    this.outputDir = options.outputDir ?? OUT_DIR;
    mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Render dashboard from a pre-collected uiState snapshot.
   *
   * @param {{ sensor, strategy, ecology, weather, species, physics }} uiState
   * @returns {{ path: string, theme: string, panelsRendered: number }}
   */
  render(uiState) {
    const alertLevel    = uiState.weather?.alert_level         ?? 'clear';
    const recommendation = uiState.strategy?.recommendation    ?? 'run_full';
    const theme         = selectTheme(alertLevel, recommendation);

    const panels = [
      renderSensorPanel(uiState.sensor   ?? {}),
      renderEcologyPanel(uiState.ecology ?? {}),
      renderWeatherPanel(uiState.weather ?? {}),
      renderSpeciesPanel(uiState.species ?? {}),
    ];

    // Add physics panel if available.
    if (uiState.physics) {
      panels.push(this._renderPhysicsPanel(uiState.physics));
    }

    const filtered = theme.collapsedPanels.length
      ? panels.filter((_, i) => {
          const ids = ['sensors', 'ecology', 'weather', 'species', 'physics'];
          return !theme.collapsedPanels.includes(ids[i]);
        })
      : panels;

    const html = applyTheme(
      buildHTML(filtered, theme, { ts: uiState.sensor?.collected_at }),
      theme,
    );

    writeFileSync(resolve(this.outputDir, 'index.html'), html, 'utf8');
    writeFileSync(resolve(this.outputDir, 'data.json'),
      JSON.stringify({ ...uiState, rendered_at: new Date().toISOString() }, null, 2), 'utf8');

    return { path: resolve(this.outputDir, 'index.html'), theme: theme.label, panelsRendered: filtered.length };
  }

  /**
   * Live async variant: collects all dependencies and renders.
   *
   * @param {object} deps  — { sensorBus, strategyScorer, ecologyBalancer, weatherEngine,
   *                           speciesClassifier, physicsEngine }
   * @returns {Promise<{ path, theme, panelsRendered }>}
   */
  async renderAsync(deps = {}) {
    const [sensor, strategy, weather] = await Promise.all([
      deps.sensorBus?.collectAll?.()        ?? Promise.resolve({}),
      deps.strategyScorer?.scoreAsync?.()   ?? Promise.resolve({}),
      deps.weatherEngine?.forecastAsync?.() ?? Promise.resolve({}),
    ]);

    const ecology = deps.ecologyBalancer?.analyze?.() ?? {};
    const species = deps.speciesClassifier
      ? await deps.speciesClassifier.classifyAsync?.('.', deps.strategyScorer).catch(() => {})
      : {};
    const physics = deps.physicsEngine
      ? deps.physicsEngine.compute({ sensor, strategy, ecology, weather, species, geneLibrary: {} })
      : null;

    return this.render({ sensor, strategy, ecology, weather, species: species ?? {}, physics });
  }

  /**
   * Start a watch loop that re-renders on each tick.
   *
   * @param {number} intervalMs
   * @param {object} deps
   * @returns {{ stop: Function }}
   */
  watch(intervalMs = 5000, deps = {}) {
    let running = true;
    const tick = async () => {
      if (!running) return;
      try { await this.renderAsync(deps); } catch { /* non-critical */ }
      if (running) setTimeout(tick, intervalMs);
    };
    tick();
    return { stop: () => { running = false; } };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _renderPhysicsPanel(eq) {
    const si    = eq.stability_index ?? 0;
    const sign  = si >= 0 ? '+' : '';
    const ps    = eq.phase_state ?? 'unknown';
    const PS_COLOR = { stable: '#34d399', meta_stable: '#fbbf24', oscillating: '#fb923c',
                       diverging: '#f87171', critical: '#f87171' };
    const color = PS_COLOR[ps] ?? '#94a3b8';
    const nf    = eq.net_force ?? 0;

    const recs  = (eq.restoration_actions ?? []).slice(0, 2).map((a) =>
      `<div class="rec rec-high">⟶ ${a.action}</div>`
    ).join('');

    return `
<div class="panel" id="panel-physics">
  <div class="panel-title">⚛ Phase 110 — Physics Engine</div>
  <div class="srow">
    <span class="sl">Phase state</span>
    <span class="sv" style="color:${color};font-weight:700">${ps.toUpperCase()}</span>
  </div>
  <div class="srow">
    <span class="sl">Stability</span>
    <span class="sv" style="color:${si >= 0 ? '#34d399' : '#f87171'}">${sign}${si} / 100</span>
  </div>
  <div class="srow">
    <span class="sl">Net force</span>
    <span class="sv" style="color:${nf <= 0 ? '#34d399' : '#f87171'}">${nf >= 0 ? '+' : ''}${nf}</span>
    <span class="sv dim">${nf > 0 ? '(diverging)' : '(converging)'}</span>
  </div>
  <div class="srow">
    <span class="sl">Entropy</span>
    <span class="sv">${eq.entropy?.current ?? 0}  <span class="dim">${eq.entropy?.trend ?? 'stable'}</span></span>
  </div>
  ${recs ? `<div class="subsection-title">Restoration</div>${recs}` : ''}
</div>`;
  }
}
