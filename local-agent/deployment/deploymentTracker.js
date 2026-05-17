// deployment/deploymentTracker.js — SQLite-backed deployment history
// Phase 9: tracks all deployments with status, timing, and metadata

import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const require   = createRequire(import.meta.url);
const Database  = require('better-sqlite3');
const DEFAULT_DB = join(homedir(), '.local-agent', 'deployments.db');

/** Open (or create) the deployment SQLite database. */
export function openDeployDB(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS deployments (
      id              TEXT PRIMARY KEY,
      project_id      TEXT,
      environment     TEXT,
      status          TEXT DEFAULT 'pending',
      started_at      TEXT,
      completed_at    TEXT,
      duration_ms     INTEGER,
      success         INTEGER DEFAULT 0,
      rollback_reason TEXT,
      commit_hash     TEXT,
      deployer        TEXT,
      metadata        TEXT DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_dep_project ON deployments(project_id, environment);
    CREATE INDEX IF NOT EXISTS idx_dep_status  ON deployments(status, started_at DESC);
  `);

  return db;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Record a new deployment event. Returns the deployment with its id. */
export function recordDeployment(db, deploy) {
  try {
    const id = deploy.id ?? genId();
    db.prepare(`
      INSERT INTO deployments
        (id, project_id, environment, status, started_at, completed_at,
         duration_ms, success, rollback_reason, commit_hash, deployer, metadata)
      VALUES
        (@id, @project_id, @environment, @status, @started_at, @completed_at,
         @duration_ms, @success, @rollback_reason, @commit_hash, @deployer, @metadata)
    `).run({
      id,
      project_id:      deploy.projectId ?? null,
      environment:     deploy.environment ?? 'development',
      status:          deploy.status ?? 'pending',
      started_at:      deploy.startedAt ?? new Date().toISOString(),
      completed_at:    deploy.completedAt ?? null,
      duration_ms:     deploy.durationMs ?? null,
      success:         deploy.success ? 1 : 0,
      rollback_reason: deploy.rollbackReason ?? null,
      commit_hash:     deploy.commitHash ?? null,
      deployer:        deploy.deployer ?? null,
      metadata:        typeof deploy.metadata === 'string' ? deploy.metadata : JSON.stringify(deploy.metadata ?? {}),
    });
    return { ...deploy, id };
  } catch (err) {
    console.error('[deploymentTracker] recordDeployment error:', err.message);
    return null;
  }
}

/** Update fields on an existing deployment. */
export function updateDeployment(db, id, updates) {
  try {
    const allowed = ['status', 'completed_at', 'duration_ms', 'success', 'rollback_reason', 'metadata'];
    const fields  = Object.keys(updates).filter(k => allowed.includes(k));
    if (fields.length === 0) return false;
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    const params    = { id };
    for (const f of fields) params[f] = updates[f];
    db.prepare(`UPDATE deployments SET ${setClause} WHERE id = @id`).run(params);
    return true;
  } catch (err) {
    console.error('[deploymentTracker] updateDeployment error:', err.message);
    return false;
  }
}

/** Retrieve a single deployment by id. */
export function getDeployment(db, id) {
  try {
    const row = db.prepare('SELECT * FROM deployments WHERE id = ?').get(id);
    return row ? deserialize(row) : null;
  } catch { return null; }
}

/** List deployments with optional filters. */
export function listDeployments(db, { projectId, env, limit = 50 } = {}) {
  try {
    let sql = 'SELECT * FROM deployments WHERE 1=1';
    const params = [];
    if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
    if (env)       { sql += ' AND environment = ?'; params.push(env); }
    sql += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params).map(deserialize);
  } catch { return []; }
}

/** Return aggregated stats for a project. */
export function getDeployStats(db, projectId) {
  try {
    const rows = db.prepare(
      'SELECT COUNT(*) as total, SUM(success) as successCount, AVG(duration_ms) as avgDuration FROM deployments WHERE project_id = ?'
    ).get(projectId);
    const last = db.prepare(
      'SELECT started_at FROM deployments WHERE project_id = ? ORDER BY started_at DESC LIMIT 1'
    ).get(projectId);
    return {
      total:       rows?.total ?? 0,
      success:     rows?.successCount ?? 0,
      failed:      (rows?.total ?? 0) - (rows?.successCount ?? 0),
      avgDuration: Math.round(rows?.avgDuration ?? 0),
      lastDeploy:  last?.started_at ?? null,
    };
  } catch { return { total: 0, success: 0, failed: 0, avgDuration: 0, lastDeploy: null }; }
}

function deserialize(row) {
  return {
    id:             row.id,
    projectId:      row.project_id,
    environment:    row.environment,
    status:         row.status,
    startedAt:      row.started_at,
    completedAt:    row.completed_at,
    durationMs:     row.duration_ms,
    success:        row.success === 1,
    rollbackReason: row.rollback_reason,
    commitHash:     row.commit_hash,
    deployer:       row.deployer,
    metadata:       tryParseJSON(row.metadata),
  };
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return s; }
}
