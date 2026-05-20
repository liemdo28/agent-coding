// local-agent/strategy/StrategyScorer.js
// Phase 102 — Strategic Consciousness
// Reads sensor snapshot + analytics, produces a StrategyScore with a concrete
// recommendation so other phases can decide whether to run expensive operations.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname }        from 'path';
import { fileURLToPath }           from 'url';
import { collectAll }              from '../sensors/index.js';
import { appendStrategyLog }       from './StrategyHistory.js';

const ROOT          = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE_PATH = resolve(ROOT, 'metrics', 'baseline-2026-05-18.json');
const KPI_DIR       = resolve(ROOT, '.super-agent-fullauto-kpi');
const DEFAULT_LOG   = resolve(ROOT, '.local-agent', 'strategy-log.jsonl');

// Baseline reference values used for ratio normalisation.
// Loaded once at construction time.
function loadBaseline(path) {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

function loadJSON(p) {
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

// Sigmoid-like clamp: maps any positive ratio to 0-100 with smooth saturation.
// ratio 1.0 → 50, 0.5 → ~27, 2.0 → ~73
function ratioToScore(ratio) {
  return Math.round(100 / (1 + Math.exp(-2 * (ratio - 1))));
}

// Linear clamp to [0, 100].
function clamp100(v) { return Math.max(0, Math.min(100, Math.round(v))); }

export class StrategyScorer {
  /**
   * @param {object} options
   * @param {{ performance: number, cost: number, maintainability: number }} [options.weights]
   * @param {string} [options.baselinePath]
   * @param {string} [options.logPath]
   */
  constructor(options = {}) {
    this.weights = {
      performance:     0.4,
      cost:            0.3,
      maintainability: 0.3,
      ...options.weights,
    };
    this.baselinePath = options.baselinePath ?? BASELINE_PATH;
    this.logPath      = options.logPath      ?? DEFAULT_LOG;
    this._baseline    = loadBaseline(this.baselinePath);
  }

  // ── Pure scoring (no I/O) ──────────────────────────────────────────────────

  /**
   * Compute a StrategyScore from a pre-collected sensor reading + analytics blob.
   *
   * @param {object} sensorReading  — output of collectAll()
   * @param {object} [analyticsData] — contents of analytics.json (optional)
   * @returns {import('./types.js').StrategyScore}
   */
  score(sensorReading, analyticsData = {}) {
    const sys  = sensorReading?.system  ?? {};
    const kb   = sensorReading?.kb      ?? {};
    const wrk  = sensorReading?.workers ?? {};
    const scn  = sensorReading?.scan    ?? {};
    const perf = this._baseline?.performance ?? {};

    // ── Performance axis ────────────────────────────────────────────────────
    const cpuCount     = sys.cpu_count ?? 4;
    const cpuLoad1m    = sys.cpu_load_1m ?? 0;
    const cpu_pressure = Math.min(cpuLoad1m / cpuCount, 1);

    const baselineKBp50      = perf.kb_query_p50_ms ?? 106;
    const currentKBp50       = kb.query_p50_ms ?? baselineKBp50;
    const kb_latency_ratio   = baselineKBp50 > 0 ? currentKBp50 / baselineKBp50 : 1;

    const totalWorkers   = wrk.total_workers ?? 1;
    const activeWorkers  = wrk.active_workers ?? 0;
    const queueDepth     = wrk.queue_depth ?? 0;
    const queue_pressure = Math.min(queueDepth / Math.max(totalWorkers * 0.5, 1), 1);

    // Higher pressure / worse latency → lower performance score.
    const perfScore = clamp100(
      (1 - cpu_pressure)       * 40 +   // 40 pts: CPU headroom
      (2 - kb_latency_ratio)   * 30 +   // 30 pts: KB speed vs baseline
      (1 - queue_pressure)     * 30      // 30 pts: queue headroom
    );

    // ── Cost axis ──────────────────────────────────────────────────────────
    const slaBreaches      = wrk.sla_breach_count ?? 0;
    const totalTasks       = analyticsData?.total_tasks ?? Math.max(slaBreaches * 10, 1);
    const sla_breach_rate  = Math.min(slaBreaches / totalTasks, 1);
    const workerEfficiency = totalWorkers > 0
      ? (totalWorkers - (wrk.idle_workers ?? 0)) / totalWorkers
      : 0;

    const costScore = clamp100(
      (1 - sla_breach_rate)  * 60 +   // 60 pts: low SLA breach rate
      workerEfficiency       * 40      // 40 pts: workers are busy, not idle
    );

    // ── Maintainability axis ───────────────────────────────────────────────
    const qaPassRate = analyticsData?.qa_pass_rate
      ?? (analyticsData?.qa_passed != null && analyticsData?.qa_total != null
          ? analyticsData.qa_passed / analyticsData.qa_total
          : 0.8);  // neutral default

    const baselineJsLoc  = this._baseline?.counts?.js_loc ?? 35728;
    const baselineChunks = this._baseline?.counts?.kb_chunks ?? 13461;
    const currentChunks  = kb.kb_chunks ?? baselineChunks;
    // How well is the KB keeping pace with codebase size?
    const kb_coverage = baselineJsLoc > 0
      ? Math.min((currentChunks / baselineJsLoc) / (baselineChunks / baselineJsLoc), 2)
      : 1;

    const maintScore = clamp100(
      qaPassRate * 60 +            // 60 pts: QA health
      (kb_coverage / 2) * 40       // 40 pts: KB coverage (ratio capped at 2×)
    );

    // ── Composite ─────────────────────────────────────────────────────────
    const { performance: wp, cost: wc, maintainability: wm } = this.weights;
    const composite = clamp100(
      perfScore  * wp +
      costScore  * wc +
      maintScore * wm
    );

    const strategyScore = {
      ts: new Date().toISOString(),
      performance: {
        score:            perfScore,
        cpu_pressure:     +cpu_pressure.toFixed(3),
        kb_latency_ratio: +kb_latency_ratio.toFixed(3),
        queue_pressure:   +queue_pressure.toFixed(3),
      },
      cost: {
        score:              costScore,
        worker_efficiency:  +workerEfficiency.toFixed(3),
        sla_breach_rate:    +sla_breach_rate.toFixed(4),
      },
      maintainability: {
        score:       maintScore,
        qa_pass_rate: +qaPassRate.toFixed(3),
        kb_coverage:  +kb_coverage.toFixed(3),
      },
      composite,
      recommendation: this.getRecommendation({ composite, performance: { score: perfScore }, cost: { score: costScore }, maintainability: { score: maintScore } }),
      weights: { ...this.weights },
    };

    return strategyScore;
  }

  /**
   * Live async variant: collects sensors + loads KPI files, then calls score().
   * Appends the result to the strategy log.
   *
   * @returns {Promise<StrategyScore>}
   */
  async scoreAsync() {
    const [sensorReading, analytics] = await Promise.all([
      collectAll(),
      Promise.resolve(loadJSON(resolve(KPI_DIR, 'analytics.json'))),
    ]);

    const strategyScore = this.score(sensorReading, analytics);
    await appendStrategyLog(this.logPath, strategyScore);
    return strategyScore;
  }

  /**
   * Derive recommendation from a StrategyScore.
   *
   * @param {{ composite: number, performance: { score: number }, cost: { score: number }, maintainability: { score: number } }} s
   * @returns {'run_full'|'run_lite'|'defer'|'alert'}
   */
  getRecommendation(s) {
    const { composite, performance, cost, maintainability } = s;
    // Any axis critically low → alert regardless of composite.
    if (performance.score < 15 || cost.score < 15 || maintainability.score < 15) {
      return 'alert';
    }
    if (composite < 30)  return 'defer';
    if (composite < 50)  return 'run_lite';
    return 'run_full';
  }
}
