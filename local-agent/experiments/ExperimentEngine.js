// local-agent/experiments/ExperimentEngine.js
// Phase 105 — Autonomous Scientist
// Lightweight A/B experiment engine backed by SQLite.

import { createRequire }                     from 'module';
import { resolve, dirname }                  from 'path';
import { fileURLToPath }                     from 'url';
import { existsSync, readFileSync,
         appendFileSync, mkdirSync }         from 'fs';
import { randomUUID }                        from 'crypto';
import { tTest, splitByFilter }              from './StatsTester.js';

const require  = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const ROOT         = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_DB   = resolve(ROOT, '.local-agent', 'experiments.db');
const DEFAULT_KPI  = resolve(ROOT, '.super-agent-fullauto-kpi');
const PATTERNS_LOG = resolve(ROOT, '.local-agent', 'experiment-patterns.jsonl');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS experiments (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  hypothesis       TEXT NOT NULL,
  variable         TEXT NOT NULL,
  control_filter   TEXT,
  treatment_filter TEXT,
  metric           TEXT NOT NULL,
  status           TEXT DEFAULT 'pending',
  control_n        INTEGER,
  treatment_n      INTEGER,
  control_mean     REAL,
  treatment_mean   REAL,
  p_value          REAL,
  significant      INTEGER,
  effect_size      REAL,
  conclusion       TEXT,
  completed_at     TEXT
);
`.trim();

/**
 * Lightweight A/B experiment engine.
 */
export class ExperimentEngine {
  /**
   * @param {object} [options]
   * @param {string}  [options.dbPath]  — path to SQLite DB file
   * @param {string}  [options.kpiPath] — path to .super-agent-fullauto-kpi/
   * @param {number}  [options.alpha]   — significance level (default 0.05)
   */
  constructor(options = {}) {
    this.dbPath  = options.dbPath  ?? DEFAULT_DB;
    this.kpiPath = options.kpiPath ?? DEFAULT_KPI;
    this.alpha   = options.alpha   ?? 0.05;

    // Ensure the directory exists before opening the DB
    mkdirSync(dirname(this.dbPath), { recursive: true });

    this._db = new Database(this.dbPath);
    this._db.exec(SCHEMA);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Define (register) a new experiment.
   *
   * @param {object} hypothesis
   * @param {string} hypothesis.hypothesis      — description string
   * @param {string} hypothesis.variable        — independent variable name
   * @param {string} hypothesis.metric          — dependent metric field name
   * @param {object} [hypothesis.controlFilter]
   * @param {object} [hypothesis.treatmentFilter]
   * @returns {{ id: string, [key: string]: any }}
   */
  defineExperiment(hypothesis) {
    const { hypothesis: text, variable, metric, controlFilter, treatmentFilter } = hypothesis;

    if (!text)     throw new Error('defineExperiment: hypothesis.hypothesis is required');
    if (!variable) throw new Error('defineExperiment: hypothesis.variable is required');
    if (!metric)   throw new Error('defineExperiment: hypothesis.metric is required');

    const id         = randomUUID();
    const created_at = new Date().toISOString();

    const stmt = this._db.prepare(`
      INSERT INTO experiments
        (id, created_at, hypothesis, variable, control_filter, treatment_filter, metric)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      created_at,
      text,
      variable,
      controlFilter   != null ? JSON.stringify(controlFilter)   : null,
      treatmentFilter != null ? JSON.stringify(treatmentFilter) : null,
      metric,
    );

    return { id, created_at, hypothesis: text, variable, metric, controlFilter, treatmentFilter, status: 'pending' };
  }

  /**
   * Run a previously defined experiment.
   *
   * @param {string} experimentId
   * @returns {object} — the updated experiment row
   */
  runExperiment(experimentId) {
    const row = this._db.prepare('SELECT * FROM experiments WHERE id = ?').get(experimentId);
    if (!row) throw new Error(`Experiment not found: ${experimentId}`);

    // Load tasks from KPI data
    const summaryPath = resolve(this.kpiPath, 'execution_summary.json');
    if (!existsSync(summaryPath)) {
      throw new Error(`execution_summary.json not found at ${summaryPath}`);
    }
    const tasks = JSON.parse(readFileSync(summaryPath, 'utf8'));

    // Parse filters (stored as JSON strings or already objects)
    const controlFilter   = this._parseFilter(row.control_filter);
    const treatmentFilter = this._parseFilter(row.treatment_filter);

    // Split into value arrays
    const controlValues   = splitByFilter(tasks, controlFilter,   row.metric);
    const treatmentValues = splitByFilter(tasks, treatmentFilter, row.metric);

    // Run Welch's t-test
    const result = tTest(controlValues, treatmentValues, this.alpha);

    // Build human-readable conclusion
    const direction = result.effect_size > 0 ? 'improved' : 'worsened';
    const conclusion =
      `Treatment ${direction} ${row.metric} by ${Math.abs(result.effect_size * 100).toFixed(1)}%` +
      ` (p=${result.p_value.toFixed(3)}, ${result.significant ? 'SIGNIFICANT' : 'not significant'})`;

    const completed_at = new Date().toISOString();

    // Update DB row
    this._db.prepare(`
      UPDATE experiments SET
        status        = 'complete',
        control_n     = ?,
        treatment_n   = ?,
        control_mean  = ?,
        treatment_mean= ?,
        p_value       = ?,
        significant   = ?,
        effect_size   = ?,
        conclusion    = ?,
        completed_at  = ?
      WHERE id = ?
    `).run(
      result.control_n,
      result.treatment_n,
      result.control_mean,
      result.treatment_mean,
      result.p_value,
      result.significant ? 1 : 0,
      result.effect_size,
      conclusion,
      completed_at,
      experimentId,
    );

    // Append significant patterns to JSONL
    if (result.significant && result.effect_size > 0.1) {
      this._appendPattern({
        id:           experimentId,
        completed_at,
        hypothesis:   row.hypothesis,
        variable:     row.variable,
        metric:       row.metric,
        effect_size:  result.effect_size,
        p_value:      result.p_value,
        conclusion,
      });
    }

    return this.getResult(experimentId);
  }

  /**
   * List experiments, optionally filtered by status.
   *
   * @param {string|null} [status]
   * @returns {object[]}
   */
  listExperiments(status = null) {
    if (status) {
      return this._db.prepare('SELECT * FROM experiments WHERE status = ? ORDER BY created_at DESC').all(status);
    }
    return this._db.prepare('SELECT * FROM experiments ORDER BY created_at DESC').all();
  }

  /**
   * Get a single experiment by ID.
   *
   * @param {string} experimentId
   * @returns {object|null}
   */
  getResult(experimentId) {
    return this._db.prepare('SELECT * FROM experiments WHERE id = ?').get(experimentId) ?? null;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Parse a filter value — may be a JSON string, a plain object, or null/undefined.
   * @param {string|object|null|undefined} raw
   * @returns {object}
   */
  _parseFilter(raw) {
    if (raw == null) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
  }

  /**
   * Append a significant-pattern record to experiment-patterns.jsonl.
   * @param {object} record
   */
  _appendPattern(record) {
    try {
      mkdirSync(dirname(PATTERNS_LOG), { recursive: true });
      appendFileSync(PATTERNS_LOG, JSON.stringify(record) + '\n', 'utf8');
    } catch {
      // Non-critical — swallow silently.
    }
  }
}
