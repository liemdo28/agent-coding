// knowledge-graph/GraphNodeStore.js — SQLite-backed node store
// Phase 18: stores projects, patches, errors, fixes, models, qa_results, deployments, dependencies

import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const require  = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'knowledge-graph.db');

export const NODE_TYPES = ['project','patch','error','fix','model','qa_result','deployment','dependency'];

/** Open (or create) the node store. */
export function openNodeStore(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      label      TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gn_type  ON graph_nodes(type);
    CREATE INDEX IF NOT EXISTS idx_gn_label ON graph_nodes(label);
  `);

  return db;
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function now()   { return new Date().toISOString(); }
function tryParseJSON(s) { try { return JSON.parse(s); } catch { return s ?? {}; } }

/** Add a node. Returns the node with its id. */
export function addNode(store, node) {
  try {
    const id = node.id ?? genId();
    const ts = now();
    store.prepare(`
      INSERT OR REPLACE INTO graph_nodes (id, type, label, properties, created_at, updated_at)
      VALUES (@id, @type, @label, @properties, @created_at, @updated_at)
    `).run({
      id,
      type:       node.type ?? 'project',
      label:      node.label ?? id,
      properties: JSON.stringify(node.properties ?? {}),
      created_at: node.createdAt ?? ts,
      updated_at: ts,
    });
    return { ...node, id };
  } catch (err) {
    console.error('[GraphNodeStore] addNode error:', err.message);
    return null;
  }
}

/** Update a node's properties. */
export function updateNode(store, id, updates) {
  try {
    const existing = store.prepare('SELECT properties FROM graph_nodes WHERE id = ?').get(id);
    if (!existing) return false;
    const props = { ...tryParseJSON(existing.properties), ...updates };
    store.prepare('UPDATE graph_nodes SET properties = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(props), now(), id);
    return true;
  } catch { return false; }
}

/** Get a node by id. */
export function getNode(store, id) {
  try {
    const row = store.prepare('SELECT * FROM graph_nodes WHERE id = ?').get(id);
    return row ? deserializeNode(row) : null;
  } catch { return null; }
}

/** Find nodes by type/label. */
export function findNodes(store, { type, label, limit = 50 } = {}) {
  try {
    let sql    = 'SELECT * FROM graph_nodes WHERE 1=1';
    const params = [];
    if (type)  { sql += ' AND type = ?';  params.push(type); }
    if (label) { sql += ' AND label LIKE ?'; params.push(`%${label}%`); }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);
    return store.prepare(sql).all(...params).map(deserializeNode);
  } catch { return []; }
}

/** Delete a node. */
export function deleteNode(store, id) {
  try { store.prepare('DELETE FROM graph_nodes WHERE id = ?').run(id); return true; } catch { return false; }
}

/** Stats about the node store. */
export function getNodeStats(store) {
  try {
    const total  = store.prepare('SELECT COUNT(*) as n FROM graph_nodes').get().n;
    const byType = store.prepare('SELECT type, COUNT(*) as count FROM graph_nodes GROUP BY type').all();
    return { total, byType };
  } catch { return { total: 0, byType: [] }; }
}

function deserializeNode(row) {
  return {
    id:         row.id,
    type:       row.type,
    label:      row.label,
    properties: tryParseJSON(row.properties),
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}
