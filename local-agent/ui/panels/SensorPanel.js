// local-agent/ui/panels/SensorPanel.js
// Phase 109 — Autonomous Design

function bar(pct, width = 16) {
  const filled = Math.round(Math.max(0, Math.min(1, pct / 100)) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function color(pct) {
  return pct > 80 ? '#f87171' : pct > 50 ? '#fb923c' : '#34d399';
}

/**
 * Render the Phase 101 sensor reading as an HTML card section.
 *
 * @param {object} sensorReading  — from collectAll()
 * @returns {string} HTML
 */
export function renderSensorPanel(sensorReading) {
  const sys = sensorReading?.system ?? {};
  const kb  = sensorReading?.kb     ?? {};
  const wrk = sensorReading?.workers ?? {};
  const scn = sensorReading?.scan   ?? {};

  const cpuPct  = Math.min(Math.round((sys.cpu_load_1m ?? 0) / Math.max(sys.cpu_count ?? 4, 1) * 100), 100);
  const memPct  = Math.round(sys.mem_pct ?? 0);
  const wrkPct  = wrk.total_workers > 0
    ? Math.round((wrk.active_workers ?? 0) / wrk.total_workers * 100) : 0;

  return `
<div class="panel" id="panel-sensors">
  <div class="panel-title">⚡ Phase 101 — System Sensors</div>
  <div class="sensor-row-group">
    <div class="srow">
      <span class="sl">CPU</span>
      <span class="sb" style="color:${color(cpuPct)}">${bar(cpuPct)}</span>
      <span class="sv" style="color:${color(cpuPct)}">${cpuPct}%</span>
    </div>
    <div class="srow">
      <span class="sl">RAM</span>
      <span class="sb" style="color:${color(memPct)}">${bar(memPct)}</span>
      <span class="sv" style="color:${color(memPct)}">${memPct}%  (${sys.mem_used_mb ?? 0} MB)</span>
    </div>
    <div class="srow">
      <span class="sl">Workers</span>
      <span class="sb" style="color:#3b82f6">${bar(wrkPct)}</span>
      <span class="sv" style="color:#3b82f6">${wrk.active_workers ?? 0}/${wrk.total_workers ?? 0}</span>
    </div>
    <div class="srow">
      <span class="sl">KB p50</span>
      <span class="sv" style="color:${(kb.query_p50_ms ?? 0) < 100 ? '#34d399' : '#fb923c'}">${kb.query_p50_ms ?? 0} ms</span>
      <span class="sv dim">(${kb.kb_documents ?? 0} docs)</span>
    </div>
    <div class="srow">
      <span class="sl">Scan</span>
      <span class="sv" style="color:${scn.status === 'ok' ? '#34d399' : '#f87171'}">${scn.last_scan_ms ?? 0} ms  ${scn.status === 'ok' ? '✓' : '✗'}</span>
    </div>
  </div>
</div>`;
}
