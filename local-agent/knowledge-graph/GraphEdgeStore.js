// knowledge-graph/GraphEdgeStore.js — SQLite-backed edge store
// Phase 18: stores directed edges with relation type and weight

import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const require  = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'knowledge-graph.db');

export const EDGE_RELATIONS = [
  'CAUSED_BY', 'FIXED_BY', 'RELATED_TO', 'DEPENDS_ON',
  'PART_OF', 'SUCCEEDED', 'FAILED', 'DEPLOYED_TO',
];

/** Open (or create) the edge store in the same DB file as nodes. */
export function openEdgeStore(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id         TEXT PRIMARY KEY,
      source_id  TEXT NOT NULL,
      target_id  TEXT NOT NULL,
      relation   TEXT NOT NULL,
      weight     REAL DEFAULT 1.0,
      properties TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ge_source   ON graph_edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_ge_target   ON graph_edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_ge_relation ON graph_edges(relation);
  `);

  return db;
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function tryParseJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

/** Add an edge. Returns the edge with its id. */
export function addEdge(store, edge) {
  try {
    const id = edge.id ?? genId();
    store.prepare(`
      INSERT OR REPLACE INTO graph_edges (id, source_id, target_id, relation, weight, properties, created_at)
      VALUES (@id, @source_id, @target_id, @relation, @weight, @properties, @created_at)
    `).run({
      id,
      source_id:  edge.sourceId ?? edge.source_id,
      target_id:  edge.targetId ?? edge.target_id,
      relation:   edge.relation ?? 'RELATED_TO',
      weight:     edge.weight ?? 1.0,
      properties: JSON.stringify(edge.properties ?? {}),
      created_at: new Date().toISOString(),
    });
    return { ...edge, id };
  } catch (err) {
    console.error('[GraphEdgeStore] addEdge error:', err.message);
    return null;
  }
}

/** Get an edge by id. */
export function getEdge(store, id) {
  try {
    const row = store.prepare('SELECT * FROM graph_edges WHERE id = ?').get(id);
    return row ? deserializeEdge(row) : null;
  } catch { return null; }
}

/**
 * Find edges by source, target, or relation.
 * @param {{ sourceId?: string, targetId?: string, relation?: string, limit?: number }}
 */
export function findEdges(store, { sourceId, targetId, relation, limit = 100 } = {}) {
  try {
    let sql      = 'SELECT * FROM graph_edges WHERE 1=1';
    const params = [];
    if (sourceId) { sql += ' AND source_id = ?'; params.push(sourceId); }
    if (targetId) { sql += ' AND target_id = ?'; params.push(targetId); }
    if (relation) { sql += ' AND relation = ?';  params.push(relation); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return store.prepare(sql).all(...params).map(deserializeEdge);
  } catch { return []; }
}

/** Delete an edge. */
export function deleteEdge(store, id) {
  try { store.prepare('DELETE FROM graph_edges WHERE id = ?').run(id); return true; } catch { return false; }
}

function deserializeEdge(row) {
  return {
    id:         row.id,
    sourceId:   row.source_id,
    targetId:   row.target_id,
    relation:   row.relation,
    weight:     row.weight,
    properties: tryParseJSON(row.properties),
    createdAt:  row.created_at,
  };
}
