// memory/engineeringMemory.js — SQLite-backed persistent engineering memory
// Phase 7: stores ERROR_FIX, PATCH_RESULT, QA_HISTORY, etc.

import { createRequire } from 'module';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = join(homedir(), '.local-agent', 'engineering-memory.db');

// Valid memory types
export const MEMORY_TYPES = [
  'ERROR_FIX', 'PATCH_RESULT', 'QA_HISTORY', 'ROLLBACK_HISTORY',
  'PROJECT_BEHAVIOR', 'UNSTABLE_MODULE', 'RECOVERY_PATTERN',
];

/** Open (or create) the engineering memory SQLite database. */
export function openMemoryDB(dbPath = DEFAULT_DB_PATH) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS engineering_memory (
      id          TEXT PRIMARY KEY,
      project_id  TEXT,
      memory_type TEXT,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      tags        TEXT DEFAULT '[]',
      confidence  REAL DEFAULT 0.5,
      success_rate REAL DEFAULT 0.5,
      use_count   INTEGER DEFAULT 0,
      last_used_at TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_em_project
      ON engineering_memory(project_id, memory_type);
    CREATE INDEX IF NOT EXISTS idx_em_type
      ON engineering_memory(memory_type, success_rate DESC);
  `);

  return db;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

/** Save a new memory entry. Returns the saved entry with its id. */
export function saveMemory(db, entry) {
  try {
    const id = entry.id || genId();
    const ts = now();
    const stmt = db.prepare(`
      INSERT INTO engineering_memory
        (id, project_id, memory_type, title, content, tags,
         confidence, success_rate, use_count, last_used_at, created_at, updated_at)
      VALUES
        (@id, @project_id, @memory_type, @title, @content, @tags,
         @confidence, @success_rate, @use_count, @last_used_at, @created_at, @updated_at)
    `);
    stmt.run({
      id,
      project_id:   entry.projectId ?? null,
      memory_type:  entry.type ?? entry.memory_type ?? 'ERROR_FIX',
      title:        entry.title,
      content:      typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
      tags:         JSON.stringify(entry.tags ?? []),
      confidence:   entry.confidence ?? 0.5,
      success_rate: entry.successRate ?? entry.success_rate ?? 0.5,
      use_count:    entry.useCount ?? entry.use_count ?? 0,
      last_used_at: entry.lastUsedAt ?? null,
      created_at:   ts,
      updated_at:   ts,
    });
    return { ...entry, id, createdAt: ts, updatedAt: ts };
  } catch (err) {
    console.error('[engineeringMemory] saveMemory error:', err.message);
    return null;
  }
}

/** Retrieve a single memory by id. */
export function getMemory(db, id) {
  try {
    const row = db.prepare('SELECT * FROM engineering_memory WHERE id = ?').get(id);
    return row ? deserialize(row) : null;
  } catch (err) {
    console.error('[engineeringMemory] getMemory error:', err.message);
    return null;
  }
}

/** Update fields on an existing memory entry. */
export function updateMemory(db, id, updates) {
  try {
    const allowed = ['title', 'content', 'tags', 'confidence', 'success_rate', 'use_count', 'last_used_at'];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (fields.length === 0) return false;
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    const stmt = db.prepare(`UPDATE engineering_memory SET ${setClause}, updated_at = @updated_at WHERE id = @id`);
    const params = { id, updated_at: now() };
    for (const f of fields) params[f] = updates[f];
    stmt.run(params);
    return true;
  } catch (err) {
    console.error('[engineeringMemory] updateMemory error:', err.message);
    return false;
  }
}

/** List memories with optional filters. */
export function listMemories(db, { projectId, type, limit = 50, offset = 0 } = {}) {
  try {
    let sql = 'SELECT * FROM engineering_memory WHERE 1=1';
    const params = [];
    if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
    if (type)      { sql += ' AND memory_type = ?'; params.push(type); }
    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.prepare(sql).all(...params);
    return rows.map(deserialize);
  } catch (err) {
    console.error('[engineeringMemory] listMemories error:', err.message);
    return [];
  }
}

/** Increment use_count and update last_used_at for a memory. */
export function recordUsage(db, id) {
  try {
    db.prepare(`
      UPDATE engineering_memory
        SET use_count = use_count + 1, last_used_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now(), now(), id);
    return true;
  } catch (err) {
    console.error('[engineeringMemory] recordUsage error:', err.message);
    return false;
  }
}

/** Delete a memory entry. */
export function deleteMemory(db, id) {
  try {
    db.prepare('DELETE FROM engineering_memory WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('[engineeringMemory] deleteMemory error:', err.message);
    return false;
  }
}

/** Return aggregate stats about the memory store. */
export function getStats(db) {
  try {
    const total = db.prepare('SELECT COUNT(*) as n FROM engineering_memory').get().n;
    const byType = db.prepare(
      'SELECT memory_type, COUNT(*) as count, AVG(success_rate) as avgSuccess FROM engineering_memory GROUP BY memory_type'
    ).all();
    const avgConf = db.prepare('SELECT AVG(confidence) as v FROM engineering_memory').get().v ?? 0;
    return { total, byType, avgConfidence: avgConf };
  } catch (err) {
    console.error('[engineeringMemory] getStats error:', err.message);
    return { total: 0, byType: [], avgConfidence: 0 };
  }
}

function deserialize(row) {
  return {
    id:          row.id,
    projectId:   row.project_id,
    type:        row.memory_type,
    title:       row.title,
    content:     tryParseJSON(row.content),
    tags:        tryParseJSON(row.tags) ?? [],
    confidence:  row.confidence,
    successRate: row.success_rate,
    useCount:    row.use_count,
    lastUsedAt:  row.last_used_at,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return str; }
}
