// local-agent/sensors/kb-sensor.js — Knowledge base health metrics

import { existsSync, statSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { performance } from 'perf_hooks';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

const DB_PATH       = join(PROJECT_ROOT, '.local-agent', 'kb', 'knowledge.db');
const STATS_PATH    = join(PROJECT_ROOT, 'kb', 'stats.json');

// Simple FTS5 probe queries — short common terms
const PROBE_QUERIES = ['javascript', 'machine learning', 'accounting'];

/**
 * Run N timing samples of a single FTS5 query and return the durations in ms.
 */
function timeFTSQuery(db, term, runs = 5) {
  // Sanitise for FTS5
  const ftsQuery = term
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .join(' OR ');

  const stmt = db.prepare(`
    SELECT c.id, c.content
    FROM chunks_fts
    JOIN chunks c ON c.id = chunks_fts.rowid
    WHERE chunks_fts MATCH ?
    LIMIT 20
  `);

  const durations = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    stmt.all(ftsQuery);
    durations.push(performance.now() - t0);
  }
  return durations;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)] * 10) / 10;
}

/**
 * Collect KB health metrics.
 * Falls back to kb/stats.json when DB is unavailable.
 * @returns {{ kb_documents, kb_chunks, kb_words, query_p50_ms, query_p99_ms,
 *             db_size_mb, available }}
 */
export async function collect() {
  // ── Try SQLite path first ────────────────────────────────────────────────
  if (existsSync(DB_PATH)) {
    try {
      const require  = createRequire(import.meta.url);
      const Database = require('better-sqlite3');
      const db       = new Database(DB_PATH, { readonly: true });

      const docCount   = db.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
      const chunkCount = db.prepare('SELECT COUNT(*) AS n FROM chunks').get().n;
      const wordCount  = db.prepare('SELECT SUM(word_count) AS n FROM documents').get().n ?? 0;

      // DB file size
      const dbStat   = statSync(DB_PATH);
      const dbSizeMb = Math.round((dbStat.size / 1024 / 1024) * 100) / 100;

      // FTS5 latency — run all probe queries, collect all durations
      const allDurations = [];
      for (const term of PROBE_QUERIES) {
        try {
          allDurations.push(...timeFTSQuery(db, term, 3));
        } catch {
          // FTS5 may not be available or query failed — skip
        }
      }
      allDurations.sort((a, b) => a - b);

      db.close();

      return {
        kb_documents: docCount,
        kb_chunks:    chunkCount,
        kb_words:     wordCount,
        query_p50_ms: percentile(allDurations, 50),
        query_p99_ms: percentile(allDurations, 99),
        db_size_mb:   dbSizeMb,
        available:    true,
      };
    } catch (err) {
      // DB open failed — fall through to stats.json
    }
  }

  // ── Fallback: kb/stats.json ──────────────────────────────────────────────
  if (existsSync(STATS_PATH)) {
    try {
      const stats = JSON.parse(readFileSync(STATS_PATH, 'utf8'));
      const total = stats.total ?? {};
      return {
        kb_documents: total.documents ?? null,
        kb_chunks:    total.chunks    ?? null,
        kb_words:     total.words     ?? null,
        query_p50_ms: null,
        query_p99_ms: null,
        db_size_mb:   null,
        available:    false,
      };
    } catch {
      // fall through to zeros
    }
  }

  // ── Nothing available ────────────────────────────────────────────────────
  return {
    kb_documents: null,
    kb_chunks:    null,
    kb_words:     null,
    query_p50_ms: null,
    query_p99_ms: null,
    db_size_mb:   null,
    available:    false,
  };
}
