// local-agent/ecology/EcologyBalancer.js
// Phase 104 — Execution Ecology
// Main orchestrator: reads KPI files + live sensors, builds EcologyReport,
// emits 'rebalance' events when pressure crosses thresholds, logs snapshots.

import { EventEmitter }            from 'events';
import { existsSync, readFileSync,
         appendFileSync, mkdirSync } from 'fs';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';
import { analyzeFoodChain,
         foodChainPressure }        from './FoodChainAnalyzer.js';
import { detectSkillGaps,
         skillGapActions }          from './SkillGapDetector.js';
import { buildWorkerUtilMap,
         classifyWorkers,
         workerRebalanceActions }   from './WorkerEcosystem.js';

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KPI_DIR  = resolve(ROOT, '.super-agent-fullauto-kpi');
const LOG_PATH = resolve(ROOT, '.local-agent', 'ecology-log.jsonl');

function loadJSON(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

export class EcologyBalancer extends EventEmitter {
  /**
   * @param {object} options
   * @param {string}  [options.kpiPath]           — path to .super-agent-fullauto-kpi/
   * @param {object}  [options.sensorBus]         — Phase 101 sensor bus (optional)
   * @param {string}  [options.logPath]           — ecology-log.jsonl path
   * @param {number}  [options.overloadThreshold] — tasks per worker (default 18)
   * @param {number}  [options.starveThreshold]   — tasks per worker (default 5)
   */
  constructor(options = {}) {
    super();
    this.kpiPath          = options.kpiPath           ?? KPI_DIR;
    this.sensorBus        = options.sensorBus         ?? null;
    this.logPath          = options.logPath            ?? LOG_PATH;
    this.overloadThresh   = options.overloadThreshold  ?? 18;
    this.starveThresh     = options.starveThreshold     ?? 5;
    this._timer           = null;
  }

  // ── Core analysis ──────────────────────────────────────────────────────────

  /**
   * Analyze current KPI data and return an EcologyReport.
   * Synchronous: reads files, no async I/O.
   *
   * @returns {EcologyReport}
   */
  analyze() {
    const tasks     = loadJSON(resolve(this.kpiPath, 'execution_summary.json')) ?? [];
    const analytics = loadJSON(resolve(this.kpiPath, 'analytics.json'))         ?? {};

    // Live sensor data (best-effort)
    const sensorSnap = this.sensorBus?.latest?.() ?? null;
    const liveQueue  = sensorSnap?.workers?.queue_depth ?? null;

    // ── Food chain ────────────────────────────────────────────────────────
    const food_chain = analyzeFoodChain(tasks);
    const basePressure = foodChainPressure(food_chain);

    // ── Worker ecosystem ──────────────────────────────────────────────────
    const utilMap    = buildWorkerUtilMap(tasks);
    const workerClass = classifyWorkers(utilMap, this.overloadThresh, this.starveThresh);

    // ── Skill gaps ────────────────────────────────────────────────────────
    const skill_gaps = detectSkillGaps(tasks, 0.3);

    // ── Queue stats ───────────────────────────────────────────────────────
    const runningCount  = tasks.filter((t) => t.dev_status === 'DEV_RUNNING').length;
    const doneCount     = tasks.filter((t) => t.dev_status === 'DEV_DONE').length;
    const totalCount    = tasks.length;

    // Compute inflow/outflow rates from analytics if available, else derive
    // from raw task proportions as a rough proxy.
    const elapsedH = analytics?.elapsed_h ?? 1;
    const inflow_rate_per_h  = analytics?.inflow_per_h
      ?? +(runningCount / elapsedH).toFixed(2);
    const outflow_rate_per_h = analytics?.outflow_per_h
      ?? +(doneCount    / elapsedH).toFixed(2);

    // Escalate pressure if live queue depth is large relative to worker count.
    const workerCount = utilMap.size || 1;
    let pressure = basePressure;
    if (liveQueue != null) {
      const queueRatio = liveQueue / workerCount;
      if      (queueRatio > 2)   pressure = 'critical';
      else if (queueRatio > 1)   pressure = 'high';
      else if (queueRatio > 0.5) pressure = pressure === 'low' ? 'medium' : pressure;
    }

    // ── Recommendations ───────────────────────────────────────────────────
    const recommendation = [
      ...workerRebalanceActions(workerClass),
      ...skillGapActions(skill_gaps),
    ];

    if (outflow_rate_per_h < inflow_rate_per_h && inflow_rate_per_h > 0) {
      recommendation.push({
        action:  'throttle',
        detail:  `Inflow (${inflow_rate_per_h}/h) > outflow (${outflow_rate_per_h}/h) — queue growing`,
        urgency: 'high',
      });
    }

    const report = {
      ts: new Date().toISOString(),
      queue: {
        depth:               liveQueue ?? runningCount,
        inflow_rate_per_h,
        outflow_rate_per_h,
        sustainable:         outflow_rate_per_h >= inflow_rate_per_h,
        pressure,
      },
      workers: {
        total:          utilMap.size,
        busy:           workerClass.busy,
        idle:           workerClass.idle,
        overloaded:     workerClass.overloaded,
        underutilized:  workerClass.underutilized,
        skill_gaps,
      },
      food_chain,
      recommendation,
    };

    this._appendLog(report);
    return report;
  }

  // ── Watch loop ─────────────────────────────────────────────────────────────

  /**
   * Start periodic analysis. Emits 'rebalance' when pressure >= 'high'.
   *
   * @param {number} intervalMs
   * @returns {this}
   */
  watch(intervalMs = 60_000) {
    this.stop();
    const tick = () => {
      const report = this.analyze();
      if (report.queue.pressure === 'high' || report.queue.pressure === 'critical') {
        this.emit('rebalance', report);
      }
    };
    tick();
    this._timer = setInterval(tick, intervalMs);
    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    return this;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _appendLog(report) {
    try {
      mkdirSync(dirname(this.logPath), { recursive: true });
      appendFileSync(this.logPath, JSON.stringify(report) + '\n', 'utf8');
    } catch {
      // Non-critical — swallow silently.
    }
  }
}
