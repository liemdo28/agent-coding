// local-agent/weather/WeatherEngine.js
// Phase 107 — Predictive weather engine for execution conditions.

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readStrategyLog } from '../strategy/StrategyHistory.js';
import { linearRegression, predictAt } from './TrendAnalyzer.js';
import { computeArrivalRate } from './ArrivalRateModel.js';
import { detectSLAStorm } from './SLAStormDetector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const KPI_PATH_DEFAULT      = resolve(ROOT, '.super-agent-fullauto-kpi');
const FORECAST_LOG_DEFAULT  = resolve(ROOT, '.local-agent', 'weather-forecasts.jsonl');
const STRATEGY_LOG_DEFAULT  = resolve(ROOT, '.local-agent', 'strategy-log.jsonl');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clamp(min, max, v) {
  return Math.max(min, Math.min(max, v));
}

function loadTasks(kpiPath) {
  const summaryPath = resolve(kpiPath, 'execution_summary.json');
  if (!existsSync(summaryPath)) return [];
  try {
    return JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WeatherEngine
// ---------------------------------------------------------------------------

export class WeatherEngine {
  constructor(options = {}) {
    this.kpiPath         = options.kpiPath         ?? KPI_PATH_DEFAULT;
    this.forecastLogPath = options.forecastLogPath  ?? FORECAST_LOG_DEFAULT;
    this.strategyLogPath = options.strategyLogPath  ?? STRATEGY_LOG_DEFAULT;
  }

  // ── public API ─────────────────────────────────────────────────────────────

  /**
   * Synchronous forecast computation.
   *
   * @param {number} horizonH  Forecast horizon in hours (default: 2).
   * @returns {WeatherForecast}
   */
  forecast(horizonH = 2) {
    // 1. Load tasks
    const tasks = loadTasks(this.kpiPath);

    // 2. Load last 20 strategy scores
    const strategyEntries = readStrategyLog(this.strategyLogPath, { limit: 20 });

    // 3. Build timeSeries for queue depth from strategy log
    const timeSeries = strategyEntries
      .filter((e) => e.ts && e.performance?.queue_pressure != null)
      .map((e) => ({
        ts:    e.ts,
        value: e.performance.queue_pressure * 100,
      }));

    // 4. Run regression (or flat line)
    const regression = timeSeries.length >= 2
      ? linearRegression(timeSeries)
      : { slope: 0, intercept: timeSeries[0]?.value ?? 0, r_squared: 0 };

    // 5. Predicted depth at horizon
    const predicted_depth = Math.max(0, predictAt(regression, horizonH * 3600));

    // 6. Trend
    let trend;
    if (regression.slope > 1)       trend = 'rising';
    else if (regression.slope < -1) trend = 'falling';
    else                            trend = 'stable';

    // 7. Storm probability
    let storm_probability;
    if (regression.slope > 5 && predicted_depth > 70) storm_probability = 0.8;
    else if (regression.slope > 2)                    storm_probability = 0.4;
    else if (regression.slope > 0)                    storm_probability = 0.2;
    else                                              storm_probability = 0.05;

    // 8. Arrival rate
    const arrivalRate = computeArrivalRate(tasks);

    // 9. SLA storm
    const slaStorm = detectSLAStorm(tasks, { predicted_depth });

    // 10. SLA predicted breach rate
    const totalTasks      = tasks.length;
    const breachedCount   = tasks.filter((t) => t.sla_breach).length;
    const predicted_breach_rate = totalTasks > 0 ? breachedCount / totalTasks : 0;

    // 11. At-risk tasks
    const at_risk_tasks = slaStorm.at_risk;

    // 12. Worker exhaustion proxy
    const latestStrategy    = strategyEntries[0] ?? null;
    const queue_pressure_raw = latestStrategy?.performance?.queue_pressure ?? 0;
    const runningCount      = tasks.filter((t) => t.dev_status === 'DEV_RUNNING').length;
    const totalWorkers      = 512;
    const predicted_idle_surplus = Math.max(0, totalWorkers - runningCount);

    // 13. Pressure index
    const pressure_index = clamp(
      0,
      100,
      queue_pressure_raw * 40 + slaStorm.breach_probability * 30 + storm_probability * 30
    );

    // 14. Alert level
    const alert_level = this.getAlertLevel({ pressure_index });

    /** @type {WeatherForecast} */
    const forecast = {
      ts:         new Date().toISOString(),
      horizon_h:  horizonH,
      alert_level,

      queue: {
        predicted_depth:  Math.round(predicted_depth * 100) / 100,
        trend,
        storm_probability,
        regression,
      },

      sla: {
        predicted_breach_rate: Math.round(predicted_breach_rate * 10_000) / 10_000,
        at_risk_tasks,
        median_duration_h:     slaStorm.median_duration_h,
        running_count:         slaStorm.running_count,
        breach_probability:    slaStorm.breach_probability,
      },

      workers: {
        predicted_idle_surplus,
        at_risk_workers:   [],
        total_workers:     totalWorkers,
        active_tasks:      runningCount,
      },

      arrival: arrivalRate,

      pressure_index: Math.round(pressure_index * 100) / 100,
    };

    return forecast;
  }

  /**
   * Async wrapper: computes forecast, appends to JSONL log, returns forecast.
   *
   * @param {number} horizonH
   * @returns {Promise<WeatherForecast>}
   */
  async forecastAsync(horizonH = 2) {
    const result = this.forecast(horizonH);

    try {
      mkdirSync(dirname(this.forecastLogPath), { recursive: true });
      appendFileSync(this.forecastLogPath, JSON.stringify(result) + '\n', 'utf8');
    } catch {
      // Log writes are non-critical.
    }

    return result;
  }

  /**
   * Map a pressure_index to a human-readable alert level.
   *
   * @param {{ pressure_index: number }} forecast
   * @returns {'storm'|'warning'|'watch'|'clear'}
   */
  getAlertLevel({ pressure_index }) {
    if (pressure_index > 80) return 'storm';
    if (pressure_index > 60) return 'warning';
    if (pressure_index > 40) return 'watch';
    return 'clear';
  }
}
