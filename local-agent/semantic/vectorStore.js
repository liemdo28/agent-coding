// semantic/vectorStore.js — in-memory + SQLite-backed vector store
// Phase 8: stores embeddings as BLOB, supports cosine similarity

import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const require  = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'vectors.db');

/** Open (or create) the vector store SQLite DB. */
export function openVectorStore(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS vectors (
      id         TEXT PRIMARY KEY,
      namespace  TEXT DEFAULT 'default',
      content    TEXT,
      embedding  BLOB,
      metadata   TEXT DEFAULT '{}',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vec_ns ON vectors(namespace);
  `);

  return db;
}

/**
 * Insert or replace a vector entry.
 * @param {object} store  SQLite db
 * @param {string} id
 * @param {number[]} embedding  float array
 * @param {string} content
 * @param {object} metadata
 * @param {string} namespace
 */
export function upsertVector(store, id, embedding, content, metadata = {}, namespace = 'default') {
  try {
    const embBuf = embeddingToBuffer(embedding);
    store.prepare(`
      INSERT OR REPLACE INTO vectors (id, namespace, content, embedding, metadata, created_at)
      VALUES (@id, @namespace, @content, @embedding, @metadata, @created_at)
    `).run({
      id,
      namespace,
      content,
      embedding:  embBuf,
      metadata:   JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('[vectorStore] upsertVector error:', err.message);
    return false;
  }
}

/** Delete a vector by id. */
export function deleteVector(store, id) {
  try { store.prepare('DELETE FROM vectors WHERE id = ?').run(id); return true; } catch { return false; }
}

/** List vectors in a namespace. */
export function listVectors(store, namespace = 'default', limit = 100) {
  try {
    return store.prepare('SELECT id, namespace, content, metadata, created_at FROM vectors WHERE namespace = ? LIMIT ?')
      .all(namespace, limit)
      .map(r => ({ ...r, metadata: tryParseJSON(r.metadata) }));
  } catch { return []; }
}

/**
 * Cosine similarity between two float arrays (pure JS).
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} -1 to 1
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Get vector store stats. */
export function getVectorStats(store) {
  try {
    const total = store.prepare('SELECT COUNT(*) as n FROM vectors').get().n;
    const byNs  = store.prepare('SELECT namespace, COUNT(*) as count FROM vectors GROUP BY namespace').all();
    return { total, byNamespace: byNs };
  } catch { return { total: 0, byNamespace: [] }; }
}

/**
 * Retrieve a single vector including its embedding as float array.
 * @param {object} store
 * @param {string} id
 * @returns {{ id, embedding: number[], content, metadata, namespace }|null}
 */
export function getVector(store, id) {
  try {
    const row = store.prepare('SELECT * FROM vectors WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id:        row.id,
      namespace: row.namespace,
      content:   row.content,
      embedding: bufferToEmbedding(row.embedding),
      metadata:  tryParseJSON(row.metadata),
      createdAt: row.created_at,
    };
  } catch { return null; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function embeddingToBuffer(arr) {
  if (!arr || !Array.isArray(arr)) return Buffer.alloc(0);
  const buf = Buffer.allocUnsafe(arr.length * 4);
  for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
  return buf;
}

function bufferToEmbedding(buf) {
  if (!buf || buf.length === 0) return [];
  const arr = [];
  for (let i = 0; i < buf.length; i += 4) arr.push(buf.readFloatLE(i));
  return arr;
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return s; }
}
