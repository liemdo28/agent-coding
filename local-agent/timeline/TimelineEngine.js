// timeline/TimelineEngine.js — high-level timeline API
import { appendEvent, queryEvents } from './TimelineStore.js';
import { existsSync, statSync, readdirSync } from 'fs';
import { join, relative } from 'path';

/**
 * Record a file change event (call from scanner/patch hooks).
 * @param {string} workspaceRoot
 * @param {string} absFile
 * @param {{ action: 'modified'|'created'|'deleted', patchId?: string }} meta
 */
export function recordFileChange(workspaceRoot, absFile, meta = {}) {
  const file = relative(workspaceRoot, absFile);
  return appendEvent(workspaceRoot, 'file_change', { file, ...meta });
}

/**
 * Record a QA result event.
 * @param {string} workspaceRoot
 * @param {{ passed: boolean, score?: number, failedTests?: string[] }} result
 */
export function recordQAEvent(workspaceRoot, result) {
  return appendEvent(workspaceRoot, 'qa_run', result);
}

/**
 * Record a patch applied/rejected event.
 * @param {string} workspaceRoot
 * @param {{ patchId: string, action: 'applied'|'rejected'|'rolled_back', file: string, risk?: string }} info
 */
export function recordPatchEvent(workspaceRoot, info) {
  return appendEvent(workspaceRoot, 'patch', info);
}

/**
 * Record a regression event.
 * @param {string} workspaceRoot
 * @param {{ file: string, test?: string, severity?: string }} info
 */
export function recordRegression(workspaceRoot, info) {
  return appendEvent(workspaceRoot, 'regression', info);
}

/**
 * Get full timeline for a specific file.
 * @param {string} workspaceRoot
 * @param {string} relFile
 * @returns {object[]}
 */
export function getFileTimeline(workspaceRoot, relFile) {
  return queryEvents(workspaceRoot, { file: relFile });
}

/**
 * Get all regression events.
 * @param {string} workspaceRoot
 * @param {{ limit?: number }} opts
 * @returns {object[]}
 */
export function getRegressions(workspaceRoot, opts = {}) {
  return queryEvents(workspaceRoot, { type: 'regression', limit: opts.limit ?? 100 });
}

/**
 * Get unstable files — files with most changes in timeline.
 * @param {string} workspaceRoot
 * @param {{ topN?: number }} opts
 * @returns {Array<{ file: string, changeCount: number }>}
 */
export function getUnstableFiles(workspaceRoot, { topN = 10 } = {}) {
  const events = queryEvents(workspaceRoot, { type: 'file_change', limit: 2000 });
  const counts = {};
  for (const e of events) {
    counts[e.file] = (counts[e.file] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([file, changeCount]) => ({ file, changeCount }))
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, topN);
}

/**
 * Get summary across all timeline types.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function getSummary(workspaceRoot) {
  const all         = queryEvents(workspaceRoot, { limit: 5000 });
  const byType      = {};
  for (const e of all) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const unstable    = getUnstableFiles(workspaceRoot, { topN: 5 });
  const regressions = all.filter((e) => e.type === 'regression').length;
  const qaRuns      = all.filter((e) => e.type === 'qa_run');
  const qaPassRate  = qaRuns.length
    ? +(qaRuns.filter((e) => e.passed).length / qaRuns.length * 100).toFixed(1) : null;
  return { totalEvents: all.length, byType, unstable, regressions, qaRuns: qaRuns.length, qaPassRate };
}
