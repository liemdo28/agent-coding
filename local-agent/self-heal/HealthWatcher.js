// self-heal/HealthWatcher.js — monitors workspace health, emits events on anomalies
import { EventEmitter } from 'events';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_INTERVAL_MS = 30_000;

const CRITICAL_FILES = [
  '.local-agent/project-map.json',
  '.local-agent/scan-report.json',
];

export class HealthWatcher extends EventEmitter {
  constructor(workspaceRoot, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
    super();
    this.root       = workspaceRoot;
    this.intervalMs = intervalMs;
    this._timer     = null;
    this._baseline  = null;
  }

  start() {
    if (this._timer) return;
    this._baseline = this._snapshot();
    this._timer = setInterval(() => this._check(), this.intervalMs);
    if (this._timer.unref) this._timer.unref();
    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** Synchronous health snapshot — returns structured health object */
  getHealth() {
    return this._buildReport(this._snapshot());
  }

  _snapshot() {
    const snap = { ts: Date.now(), files: {}, indexSize: 0, dbExists: false };

    for (const rel of CRITICAL_FILES) {
      const abs = join(this.root, rel);
      snap.files[rel] = existsSync(abs) ? statSync(abs).size : -1;
    }

    const indexDir = join(this.root, '.local-agent', 'index');
    if (existsSync(indexDir)) {
      try {
        snap.indexSize = readdirSync(indexDir).length;
      } catch { snap.indexSize = 0; }
    }

    snap.dbExists = existsSync(join(this.root, '.local-agent', 'local-agent.db'));
    snap.mem      = process.memoryUsage().rss;
    return snap;
  }

  _buildReport(snap) {
    const issues = [];
    const checks = {};

    for (const [rel, size] of Object.entries(snap.files)) {
      const ok = size > 0;
      checks[rel] = ok;
      if (!ok) issues.push({ type: 'missing_file', file: rel });
    }

    checks.index = snap.indexSize > 0;
    if (!checks.index) issues.push({ type: 'empty_index' });

    checks.db = snap.dbExists;
    if (!checks.db) issues.push({ type: 'missing_db' });

    const memMB = Math.round(snap.mem / 1048576);
    checks.memory = memMB < 512;
    if (memMB >= 512) issues.push({ type: 'high_memory', memMB });

    return {
      healthy:   issues.length === 0,
      issueCount: issues.length,
      issues,
      checks,
      memMB,
      indexFiles: snap.indexSize,
      timestamp:  new Date(snap.ts).toISOString(),
    };
  }

  _check() {
    const snap   = this._snapshot();
    const report = this._buildReport(snap);
    this.emit('check', report);
    if (!report.healthy) this.emit('unhealthy', report);
  }
}
