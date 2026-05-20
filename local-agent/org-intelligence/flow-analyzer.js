// org-intelligence/flow-analyzer.js
// Track delivery speed, blockers, QA failures, rollback patterns, patch quality.
// Build metrics over time from timeline events.

import { queryEvents } from '../timeline/TimelineStore.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORE_DIR = '.local-agent/org-intelligence';
const SNAPSHOT_FILE = 'flow-snapshots.json';

/**
 * Normalize a timestamp or return null.
 * @param {string|Date} ts
 * @returns {Date|null}
 */
function toDate(ts) {
  if (!ts) return null;
  try { return new Date(ts); } catch { return null; }
}

/**
 * Duration in milliseconds between two dates, or null.
 * @param {Date|null} start
 * @param {Date|null} end
 * @returns {number|null}
 */
function msBetween(start, end) {
  if (!start || !end) return null;
  return Math.abs(end.getTime() - start.getTime());
}

/**
 * Load persisted snapshots from disk.
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
function loadSnapshots(workspaceRoot) {
  const p = join(workspaceRoot, STORE_DIR, SNAPSHOT_FILE);
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return []; }
}

/**
 * Persist snapshots to disk, keeping last 200.
 * @param {string} workspaceRoot
 * @param {object[]} snapshots
 */
function saveSnapshots(workspaceRoot, snapshots) {
  mkdirSync(join(workspaceRoot, STORE_DIR), { recursive: true });
  writeFileSync(
    join(workspaceRoot, STORE_DIR, SNAPSHOT_FILE),
    JSON.stringify(snapshots.slice(-200), null, 2),
    'utf8'
  );
}

// ─── Core metric builders ────────────────────────────────────────────────────

/**
 * Delivery speed: average time from task start to resolved/closed.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ avgCycleTimeMs: number|null, avgCycleTimeMin: number|null, sampleCount: number, perDay: object[] }}
 */
export function deliverySpeed(workspaceRoot, { days = 30 } = {}) {
  const since   = new Date(Date.now() - days * 86400_000).toISOString();
  const starts   = queryEvents(workspaceRoot, { type: 'task_start',   since, limit: 2000 });
  const resolved = queryEvents(workspaceRoot, { type: 'task_resolved', since, limit: 2000 });

  const byDay = {};
  let totalMs = 0;
  let count = 0;

  for (const start of starts) {
    const startDate = toDate(start.ts);
    if (!startDate) continue;
    const match = resolved.find(
      (r) => r.taskId === start.taskId && toDate(r.ts)?.getTime() > startDate.getTime()
    );
    if (!match) continue;
    const ms = msBetween(startDate, toDate(match.ts));
    if (ms === null) continue;
    totalMs += ms;
    count++;
    const day = start.ts.slice(0, 10);
    byDay[day] = byDay[day] ?? { totalMs: 0, count: 0 };
    byDay[day].totalMs += ms;
    byDay[day].count++;
  }

  const perDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { totalMs: t, count: c }]) => ({
      date,
      avgCycleTimeMin: +((t / c / 60000).toFixed(1)),
    }));

  return {
    avgCycleTimeMs: count > 0 ? Math.round(totalMs / count) : null,
    avgCycleTimeMin: count > 0 ? +(totalMs / count / 60000).toFixed(2) : null,
    sampleCount: count,
    perDay,
  };
}

/**
 * Blockers: count of blocker events and their resolution time.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ total: number, unresolved: number, avgBlockerDurationMin: number|null, hotBlockers: object[], perDay: object[] }}
 */
export function blockerAnalytics(workspaceRoot, { days = 30 } = {}) {
  const since    = new Date(Date.now() - days * 86400_000).toISOString();
  const blockers = queryEvents(workspaceRoot, { type: 'blocker',          since, limit: 500 });
  const resolved = queryEvents(workspaceRoot, { type: 'blocker_resolved',  since, limit: 500 });

  const byDay = {};
  let totalMs = 0;
  let resolvedCount = 0;
  const hotBlockers = [];

  for (const b of blockers) {
    const bDate = toDate(b.ts);
    const day = b.ts.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;

    const res = resolved.find(
      (r) => r.blockerId === b.blockerId && toDate(r.ts)?.getTime() > bDate?.getTime()
    );
    if (res) {
      const ms = msBetween(bDate, toDate(res.ts));
      if (ms !== null) { totalMs += ms; resolvedCount++; }
    } else {
      hotBlockers.push({ id: b.blockerId, reason: b.reason ?? b.message ?? 'unknown', since: b.ts });
    }
  }

  return {
    total: blockers.length,
    unresolved: hotBlockers.length,
    avgBlockerDurationMin: resolvedCount > 0 ? +(totalMs / resolvedCount / 60000).toFixed(2) : null,
    hotBlockers: hotBlockers.sort((a, b) => a.since.localeCompare(b.since)),
    perDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
  };
}

/**
 * QA failure patterns: which tests/files/features fail most.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ totalRuns: number, failedRuns: number, passRate: number|null, hotFiles: object[], hotFeatures: object[] }}
 */
export function qaFailurePatterns(workspaceRoot, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const runs  = queryEvents(workspaceRoot, { type: 'qa_run', since, limit: 1000 });

  const fileFailures     = {};
  const featureFailures  = {};
  let failed = 0;

  for (const run of runs) {
    if (!run.passed) {
      failed++;
      if (run.file)     fileFailures[run.file]         = (fileFailures[run.file]          ?? 0) + 1;
      if (run.feature)  featureFailures[run.feature]  = (featureFailures[run.feature]   ?? 0) + 1;
    }
  }

  const hotFiles = Object.entries(fileFailures)
    .sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([file, failures]) => ({ file, failures }));

  const hotFeatures = Object.entries(featureFailures)
    .sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([feature, failures]) => ({ feature, failures }));

  const passRate = runs.length > 0
    ? +(100 * (runs.length - failed) / runs.length).toFixed(1)
    : null;

  return { totalRuns: runs.length, failedRuns: failed, passRate, hotFiles, hotFeatures };
}

/**
 * Rollback patterns: how often patches are rolled back and why.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ totalApplied: number, totalRolledBack: number, rollbackRate: number|null, rollbackReasons: object[], rollbackTrend: object[] }}
 */
export function rollbackPatterns(workspaceRoot, { days = 90 } = {}) {
  const since   = new Date(Date.now() - days * 86400_000).toISOString();
  const patches = queryEvents(workspaceRoot, { type: 'patch', since, limit: 2000 });

  const applied    = patches.filter((p) => p.action === 'applied');
  const rolledBack = patches.filter((p) => p.action === 'rolled_back');

  const reasonCounts = {};
  for (const rb of rolledBack) {
    const reason = rb.reason ?? rb.cause ?? 'unknown';
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }

  const rollbackReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([reason, count]) => ({ reason, count }));

  const byDay = {};
  for (const rb of rolledBack) {
    const day = rb.ts.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const rollbackTrend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    totalApplied:    applied.length,
    totalRolledBack:  rolledBack.length,
    rollbackRate:    applied.length > 0 ? +(100 * rolledBack.length / applied.length).toFixed(2) : null,
    rollbackReasons,
    rollbackTrend,
  };
}

/**
 * Patch quality: size, file count, review coverage over time.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ avgPatchSize: number|null, avgFilesChanged: number|null, reviewedRate: number|null, qualityTrend: object[] }}
 */
export function patchQuality(workspaceRoot, { days = 30 } = {}) {
  const since   = new Date(Date.now() - days * 86400_000).toISOString();
  const patches = queryEvents(workspaceRoot, { type: 'patch', since, limit: 2000 });

  let totalSize     = 0;
  let totalFiles    = 0;
  let totalReviewed = 0;
  let count = 0;
  const qualityTrend = [];

  for (const p of patches) {
    if (p.action !== 'applied') continue;
    const size   = p.size ?? p.patchSize ?? 0;
    const files  = Array.isArray(p.files) ? p.files.length : (p.filesChanged ?? 0);
    const review = p.reviewed ?? p.reviewCoverage ?? 0;
    totalSize     += size;
    totalFiles    += files;
    totalReviewed += review;
    count++;
    qualityTrend.push({ date: p.ts.slice(0, 10), size, files, reviewed: review });
  }

  return {
    avgPatchSize:    count > 0 ? Math.round(totalSize / count)        : null,
    avgFilesChanged: count > 0 ? +(totalFiles / count).toFixed(2)      : null,
    reviewedRate:    count > 0 ? +(100 * totalReviewed / count).toFixed(1) : null,
    qualityTrend:    qualityTrend.slice(-30),
  };
}

// ─── Snapshot & history ──────────────────────────────────────────────────────

/**
 * Build a current snapshot of all flow metrics.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {object}
 */
export function buildFlowSnapshot(workspaceRoot, { days = 30 } = {}) {
  const delivery  = deliverySpeed(workspaceRoot, { days });
  const blockers  = blockerAnalytics(workspaceRoot, { days });
  const qa        = qaFailurePatterns(workspaceRoot, { days });
  const rollbacks = rollbackPatterns(workspaceRoot, { days: Math.max(days, 90) });
  const quality   = patchQuality(workspaceRoot, { days });

  const snapshot = { ts: new Date().toISOString(), delivery, blockers, qa, rollbacks, quality };

  const existing = loadSnapshots(workspaceRoot);
  saveSnapshots(workspaceRoot, [...existing, snapshot]);

  return snapshot;
}

/**
 * Retrieve historical snapshots.
 * @param {string} workspaceRoot
 * @param {{ limit?: number }} opts
 * @returns {object[]}
 */
export function getFlowHistory(workspaceRoot, { limit = 50 } = {}) {
  return loadSnapshots(workspaceRoot).slice(-limit);
}

/**
 * Compare latest snapshot vs previous snapshot.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function flowTrend(workspaceRoot) {
  const history = loadSnapshots(workspaceRoot);
  if (history.length < 2) return { trend: null, message: 'Not enough history for trend analysis.' };

  const latest = history[history.length - 1];
  const prev   = history[history.length - 2];
  const delta  = (cur, pr) => (cur === null || pr === null) ? null : +(cur - pr).toFixed(2);

  return {
    ts: latest.ts,
    vs: prev.ts,
    delivery: {
      cycleTimeDeltaMin: delta(latest.delivery?.avgCycleTimeMin, prev.delivery?.avgCycleTimeMin),
      current:   latest.delivery?.avgCycleTimeMin,
      previous:  prev.delivery?.avgCycleTimeMin,
    },
    blockers: {
      unresolvedDelta: delta(latest.blockers?.unresolved, prev.blockers?.unresolved),
      current:  latest.blockers?.unresolved,
    },
    qa: {
      passRateDelta: delta(latest.qa?.passRate, prev.qa?.passRate),
      current:  latest.qa?.passRate,
    },
    rollbacks: {
      rollbackRateDelta: delta(latest.rollbacks?.rollbackRate, prev.rollbacks?.rollbackRate),
      current:  latest.rollbacks?.rollbackRate,
    },
  };
}

/**
 * Overall flow health score (0-100) with letter grade.
 * @param {string} workspaceRoot
 * @returns {{ score: number|null, grade: string, factors: object, snapshotTs: string }}
 */
export function flowHealthScore(workspaceRoot) {
  const snap = buildFlowSnapshot(workspaceRoot, { days: 30 });

  let score = 100;
  // Deduct for unresolved blockers (5 pts each, max 30)
  score -= Math.min((snap.blockers?.unresolved ?? 0) * 5, 30);
  // Deduct for QA failures (0-25 pts)
  if (snap.qa?.passRate !== null) {
    score -= Math.max(0, 100 - (snap.qa.passRate ?? 100)) * 0.25;
  }
  // Deduct for rollback rate
  if (snap.rollbacks?.rollbackRate !== null) {
    score -= snap.rollbacks.rollbackRate * 0.3;
  }
  // Deduct for slow cycle time (> 4 hrs)
  if (snap.delivery?.avgCycleTimeMin !== null) {
    score -= Math.max(0, (snap.delivery.avgCycleTimeMin - 240) / 12);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  return {
    score,
    grade,
    factors: {
      delivery:     snap.delivery?.avgCycleTimeMin,
      blockers:     snap.blockers?.unresolved,
      qaPassRate:   snap.qa?.passRate,
      rollbackRate: snap.rollbacks?.rollbackRate,
    },
    snapshotTs: snap.ts,
  };
}
