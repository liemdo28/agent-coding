// resources/ResourceMonitor.js — monitor local machine health for agent runtime
import { EventEmitter } from 'events';
import { execSync }     from 'child_process';
import { statSync, readdirSync, existsSync } from 'fs';
import { join }         from 'path';

/**
 * Sample current resource state (synchronous snapshot).
 * @returns {ResourceSnapshot}
 */
export function snapshot() {
  const mem  = process.memoryUsage();
  const cpuU = process.cpuUsage();

  // CPU percentage heuristic: compare two samples ~50ms apart
  const t0   = process.hrtime.bigint();
  const cpu0 = process.cpuUsage();
  // Busy spin to measure
  let x = 0; for (let i = 0; i < 50000; i++) x += i;
  const cpuDelta = process.cpuUsage(cpu0);
  const tDelta   = Number(process.hrtime.bigint() - t0) / 1e6; // ms
  const cpuPct   = tDelta > 0 ? +((cpuDelta.user + cpuDelta.system) / 1000 / tDelta * 100).toFixed(2) : 0;

  const rssMB     = +(mem.rss      / 1048576).toFixed(1);
  const heapMB    = +(mem.heapUsed / 1048576).toFixed(1);
  const heapTotMB = +(mem.heapTotal / 1048576).toFixed(1);

  let diskFreeGB = null;
  try {
    const out = execSync('df -k . 2>/dev/null | tail -1', { timeout: 2000 }).toString().trim();
    const cols = out.split(/\s+/);
    if (cols[3]) diskFreeGB = +(parseInt(cols[3]) / 1048576).toFixed(2);
  } catch { /* skip */ }

  let gpuMB = null;
  try {
    const out = execSync('nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null', { timeout: 2000 }).toString().trim();
    if (out) gpuMB = parseInt(out);
  } catch { /* graceful null */ }

  let tempC = null;
  try {
    const out = execSync('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null', { timeout: 1000 }).toString().trim();
    if (out) tempC = +(parseInt(out) / 1000).toFixed(1);
  } catch { /* graceful null */ }

  return {
    ts:        new Date().toISOString(),
    cpuPct,
    rssMB,
    heapMB,
    heapTotMB,
    diskFreeGB,
    gpuMB,
    tempC,
  };
}

const THRESHOLDS = {
  cpuPct:  80,   // %
  rssMB:   1024, // MB
  diskFreeGB: 1, // GB
  tempC:   85,   // °C
};

/**
 * Check if snapshot exceeds any thresholds.
 * @param {ResourceSnapshot} snap
 * @returns {{ healthy: boolean, warnings: string[] }}
 */
export function checkThresholds(snap) {
  const warnings = [];
  if (snap.cpuPct   > THRESHOLDS.cpuPct)     warnings.push(`High CPU: ${snap.cpuPct}%`);
  if (snap.rssMB    > THRESHOLDS.rssMB)      warnings.push(`High memory: ${snap.rssMB} MB`);
  if (snap.diskFreeGB !== null && snap.diskFreeGB < THRESHOLDS.diskFreeGB) {
    warnings.push(`Low disk: ${snap.diskFreeGB} GB free`);
  }
  if (snap.tempC !== null && snap.tempC > THRESHOLDS.tempC) {
    warnings.push(`High temperature: ${snap.tempC}°C`);
  }
  return { healthy: warnings.length === 0, warnings };
}

/**
 * Continuous resource monitor (EventEmitter).
 */
export class ResourceWatcher extends EventEmitter {
  constructor({ intervalMs = 5000 } = {}) {
    super();
    this.intervalMs = intervalMs;
    this._timer     = null;
  }

  start() {
    if (this._timer) return this;
    this._timer = setInterval(() => {
      const snap   = snapshot();
      const health = checkThresholds(snap);
      this.emit('sample', { ...snap, ...health });
      if (!health.healthy) this.emit('warning', { ...snap, warnings: health.warnings });
    }, this.intervalMs);
    if (this._timer.unref) this._timer.unref();
    return this;
  }

  stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
}
