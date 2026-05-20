// local-agent/strategy/SpeciesClassifier.js
// Phase 103 — Software Species
// Classifies the project into a software species archetype based on multi-axis scores.

import { createRequire }              from 'module';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname }           from 'path';
import { fileURLToPath }              from 'url';
import { scoreAdaptability }          from './AdaptabilityScorer.js';
import { scoreIntelligenceReadiness } from './IntelligenceReadinessScorer.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..', '..');

const BASELINE_PATH = resolve(ROOT, 'metrics', 'baseline-2026-05-18.json');
const DEFAULT_DB    = resolve(ROOT, '.local-agent', 'species-profiles.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS species_scores (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  project_path TEXT NOT NULL,
  adaptability REAL,
  stability REAL,
  scalability REAL,
  intelligence REAL,
  species_class TEXT,
  composite REAL
);
`;

function loadJSON(p) {
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

/**
 * Determine species class from axis scores.
 *
 * @param {{ adaptability: number, stability: number, intelligence: number }} scores
 * @returns {'optimal'|'pioneer'|'workhorse'|'fragile'|'stagnant'}
 */
function classifySpecies({ adaptability, stability, intelligence }) {
  if (adaptability >= 70 && stability >= 70 && intelligence >= 60) return 'optimal';
  if (adaptability >= 60 && stability < 50)                         return 'pioneer';
  if (stability >= 70 && adaptability < 40)                         return 'workhorse';
  if (stability < 40 && adaptability < 40)                          return 'fragile';
  return 'stagnant';
}

export class SpeciesClassifier {
  /**
   * @param {{ dbPath?: string, kpiPath?: string }} [options]
   */
  constructor(options = {}) {
    this._dbPath   = options.dbPath  ?? DEFAULT_DB;
    this._kpiPath  = options.kpiPath ?? resolve(ROOT, '.super-agent-fullauto-kpi');
    this._baseline = loadJSON(BASELINE_PATH);
    this._db       = null; // lazy-open on first write
  }

  /** Open (or create) the SQLite database. */
  _openDB() {
    if (this._db) return this._db;
    mkdirSync(dirname(this._dbPath), { recursive: true });
    this._db = new Database(this._dbPath);
    this._db.exec(SCHEMA);
    return this._db;
  }

  // ── Pure classification (no I/O) ────────────────────────────────────────────

  /**
   * Compute a SpeciesProfile from a strategy score and optional timeline events.
   *
   * @param {string} projectPath
   * @param {object} strategyScore   — output of StrategyScorer.score()
   * @param {Array}  [timelineEvents]
   * @returns {object} SpeciesProfile
   */
  classify(projectPath, strategyScore, timelineEvents = []) {
    const baseline        = this._baseline;
    const baseline_chunks = baseline?.counts?.kb_chunks ?? 13461;

    // Adaptability — derived from timeline events
    const adaptResult = scoreAdaptability(timelineEvents);
    const adaptability = adaptResult.score;

    // Stability — cost axis already measures SLA breach rate
    const stability = strategyScore?.cost?.score ?? 60;

    // Scalability — performance axis
    const scalability = strategyScore?.performance?.score ?? 60;

    // Intelligence readiness — KB coverage × test density
    const kb_coverage  = strategyScore?.maintainability?.kb_coverage ?? 1;
    const kb_chunks    = Math.round(kb_coverage * baseline_chunks);
    const intelligenceResult = scoreIntelligenceReadiness(baseline, { kb_chunks });
    const intelligence = intelligenceResult.score;

    // Composite — equal-weighted average
    const composite = +(
      (adaptability * 0.25 + stability * 0.25 + scalability * 0.25 + intelligence * 0.25)
    ).toFixed(2);

    const species_class = classifySpecies({ adaptability, stability, intelligence });

    return {
      ts:            new Date().toISOString(),
      project_path:  projectPath,
      adaptability:  +adaptability.toFixed(2),
      stability:     +stability.toFixed(2),
      scalability:   +scalability.toFixed(2),
      intelligence:  +intelligence.toFixed(2),
      species_class,
      composite,
    };
  }

  // ── Live async classification (with I/O) ────────────────────────────────────

  /**
   * Collect live strategy score, classify, persist, and return SpeciesProfile.
   *
   * @param {string} projectPath
   * @param {object} strategyScorer  — instance of StrategyScorer
   * @returns {Promise<object>} SpeciesProfile
   */
  async classifyAsync(projectPath, strategyScorer) {
    const strategyScore = await strategyScorer.scoreAsync();
    const profile       = this.classify(projectPath, strategyScore, []);

    const db = this._openDB();
    db.prepare(`
      INSERT INTO species_scores
        (ts, project_path, adaptability, stability, scalability, intelligence, species_class, composite)
      VALUES
        (@ts, @project_path, @adaptability, @stability, @scalability, @intelligence, @species_class, @composite)
    `).run(profile);

    return profile;
  }

  // ── History query ────────────────────────────────────────────────────────────

  /**
   * Return SpeciesProfile rows for the given project, most-recent first.
   *
   * @param {string} projectPath
   * @param {number} [days=30]
   * @returns {object[]} SpeciesProfile[]
   */
  getHistory(projectPath, days = 30) {
    const db     = this._openDB();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return db.prepare(`
      SELECT * FROM species_scores
      WHERE project_path = ? AND ts >= ?
      ORDER BY ts DESC
    `).all(projectPath, cutoff);
  }
}
