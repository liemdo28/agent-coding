// local-agent/dna/PatternLibrary.js
// Phase 106 — Engineering DNA
// Persistent pattern library stored in SQLite. Successful fixes, experiment outcomes,
// and cross-project learnings are stored as reusable "genes".

import { createRequire }          from 'module';
import { existsSync, mkdirSync }  from 'fs';
import { resolve, dirname }       from 'path';
import { fileURLToPath }          from 'url';
import { randomUUID }             from 'crypto';
import { createHash }             from 'crypto';

const require   = createRequire(import.meta.url);
const Database  = require('better-sqlite3');

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DB_PATH  = resolve(ROOT, '.local-agent', 'dna.db');
const MUT_DIR  = resolve(ROOT, '.local-agent', 'mutations');

function sha1(str) {
  return createHash('sha1').update(str).digest('hex');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS genes (
  id              TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL,
  source          TEXT NOT NULL,
  source_ref      TEXT,
  category        TEXT NOT NULL,
  pattern_hash    TEXT NOT NULL,
  description     TEXT,
  pattern_json    TEXT NOT NULL,
  applicability   TEXT,
  success_count   INTEGER DEFAULT 0,
  failure_count   INTEGER DEFAULT 0,
  last_applied_at TEXT,
  active          INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_genes_category ON genes(category);
CREATE INDEX IF NOT EXISTS idx_genes_hash     ON genes(pattern_hash);
`;

export class PatternLibrary {
  /**
   * @param {object} options
   * @param {string} [options.dbPath]      path to dna.db
   * @param {string} [options.mutationDir] path to mutations/ directory
   */
  constructor(options = {}) {
    this.dbPath     = options.dbPath     ?? DB_PATH;
    this.mutationDir = options.mutationDir ?? MUT_DIR;
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.exec(SCHEMA);
  }

  /**
   * Ingest a pattern. Deduplicates by pattern_hash.
   *
   * @param {'experiment'|'cross_project'|'manual'} source
   * @param {object} patternObj  — normalized pattern; must have `category` and `description`
   * @param {object} [opts]      — { sourceRef, applicability }
   * @returns {{ id: string, isNew: boolean }}
   */
  ingest(source, patternObj, opts = {}) {
    const hash    = sha1(JSON.stringify(patternObj));
    const existing = this.db.prepare('SELECT id FROM genes WHERE pattern_hash = ?').get(hash);

    if (existing) {
      this.db.prepare('UPDATE genes SET success_count = success_count + 1 WHERE id = ?')
             .run(existing.id);
      return { id: existing.id, isNew: false };
    }

    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO genes (id, created_at, source, source_ref, category, pattern_hash,
                         description, pattern_json, applicability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      new Date().toISOString(),
      source,
      opts.sourceRef ?? null,
      patternObj.category ?? 'fix_recipe',
      hash,
      patternObj.description ?? null,
      JSON.stringify(patternObj),
      opts.applicability ? JSON.stringify(opts.applicability) : null,
    );

    return { id, isNew: true };
  }

  /**
   * Query active genes.
   *
   * @param {object} opts
   * @param {string}  [opts.category]
   * @param {string}  [opts.speciesClass]   filter by applicability.species_classes
   * @param {number}  [opts.minSuccessRate] e.g. 0.6 → only genes with ≥60% win rate
   * @returns {object[]} Gene rows, sorted by success rate descending
   */
  query(opts = {}) {
    const rows = this.db.prepare('SELECT * FROM genes WHERE active = 1').all();

    return rows
      .filter((g) => {
        if (opts.category && g.category !== opts.category) return false;
        if (opts.speciesClass) {
          try {
            const appl = JSON.parse(g.applicability ?? '{}');
            if (appl.species_classes && !appl.species_classes.includes(opts.speciesClass)) return false;
          } catch { /* malformed — allow */ }
        }
        if (opts.minSuccessRate != null) {
          const total = g.success_count + g.failure_count;
          if (total > 0 && g.success_count / total < opts.minSuccessRate) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rateA = (a.success_count + a.failure_count) > 0
          ? a.success_count / (a.success_count + a.failure_count) : 0;
        const rateB = (b.success_count + b.failure_count) > 0
          ? b.success_count / (b.success_count + b.failure_count) : 0;
        return rateB - rateA;
      })
      .map((g) => ({ ...g, pattern: JSON.parse(g.pattern_json) }));
  }

  /**
   * Record the outcome of applying a gene.
   *
   * @param {string}  geneId
   * @param {boolean} success
   */
  recordOutcome(geneId, success) {
    const col = success ? 'success_count' : 'failure_count';
    this.db.prepare(`UPDATE genes SET ${col} = ${col} + 1, last_applied_at = ? WHERE id = ?`)
           .run(new Date().toISOString(), geneId);

    // Auto-deactivate genes with > 50% failure rate after 10+ trials.
    const g = this.db.prepare('SELECT success_count, failure_count FROM genes WHERE id = ?').get(geneId);
    if (g) {
      const total = g.success_count + g.failure_count;
      if (total >= 10 && g.failure_count / total > 0.5) {
        this.db.prepare('UPDATE genes SET active = 0 WHERE id = ?').run(geneId);
      }
    }
  }

  /**
   * Return applicable genes for a given project species.
   *
   * @param {string} speciesClass  — e.g. 'optimal', 'fragile'
   * @returns {object[]} Gene rows
   */
  inherit(targetProjectPath, speciesClass) {
    return this.query({ speciesClass });
  }

  /** Return total gene count. */
  count() {
    return this.db.prepare('SELECT COUNT(*) as n FROM genes WHERE active = 1').get().n;
  }

  close() { this.db.close(); }
}
