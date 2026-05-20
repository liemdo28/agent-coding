// local-agent/ui/panels/WeatherPanel.js
// Phase 109 — Autonomous Design

const ALERT_COLOR = { clear: '#34d399', watch: '#fbbf24', warning: '#fb923c', storm: '#f87171' };
const ALERT_ICON  = { clear: '☀', watch: '⛅', warning: '🌩', storm: '⛈' };

function bar(pct, width = 14) {
  const filled = Math.round(Math.max(0, Math.min(1, pct / 100)) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Render WeatherForecast as HTML.
 *
 * @param {object} forecast  — from WeatherEngine.forecast()
 * @returns {string} HTML
 */
export function renderWeatherPanel(forecast) {
  const alert  = forecast?.alert_level ?? 'clear';
  const color  = ALERT_COLOR[alert] ?? '#94a3b8';
  const icon   = ALERT_ICON[alert]  ?? '?';
  const q      = forecast?.queue_forecast ?? {};
  const sla    = forecast?.sla_forecast   ?? {};
  const wex    = forecast?.worker_exhaustion ?? {};
  const pi     = forecast?.pressure_index ?? 0;

  const trendArrow = q.trend === 'rising' ? '↑' : q.trend === 'falling' ? '↓' : '→';

  return `
<div class="panel" id="panel-weather">
  <div class="panel-title">${icon} Phase 107 — Weather Engine</div>
  <div class="srow alert-row">
    <span class="sl">Alert</span>
    <span class="sv" style="color:${color};font-weight:700">${alert.toUpperCase()}</span>
    <span class="sv dim">pressure index: ${pi}/100</span>
  </div>
  <div class="srow">
    <span class="sl">Pressure</span>
    <span class="sb" style="color:${color}">${bar(pi)}</span>
    <span class="sv" style="color:${color}">${pi}%</span>
  </div>
  <div class="srow">
    <span class="sl">Queue ${trendArrow}</span>
    <span class="sv">depth ~${Math.round(q.predicted_depth ?? 0)}  storm prob: ${Math.round((q.storm_probability ?? 0) * 100)}%</span>
  </div>
  <div class="srow">
    <span class="sl">SLA risk</span>
    <span class="sv">${Math.round((sla.predicted_breach_rate ?? 0) * 100)}% breach  ${sla.at_risk_tasks ?? 0} tasks at risk</span>
  </div>
  <div class="srow">
    <span class="sl">Workers</span>
    <span class="sv">idle surplus: ${wex.predicted_idle_surplus ?? 0}  at-risk: ${(wex.at_risk_workers ?? []).length}</span>
  </div>
</div>`;
}
