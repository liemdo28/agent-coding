// memory/ApprovalHistoryStore.js - tracks patch approval and rejection history

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sanitize } from './MemorySanitizer.js';

const MAX_ENTRIES = 200;

// ── Helpers ─────────────────────────────────────────────────────────────────

function memoryDir(workspaceRoot) {
  return join(workspaceRoot, '.local-agent', 'memory');
}

function loadArray(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveArray(filePath, arr) {
  const trimmed = arr.length > MAX_ENTRIES ? arr.slice(arr.length - MAX_ENTRIES) : arr;
  writeFileSync(filePath, JSON.stringify(trimmed, null, 2), 'utf8');
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendRecord(record, workspaceRoot) {
  const filePath = join(memoryDir(workspaceRoot), 'approval-history.json');
  const entries = loadArray(filePath);
  entries.push(sanitize(record));
  saveArray(filePath, entries);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Record that a patch was approved.
 *
 * @param {string} patchId
 * @param {string} task
 * @param {string} riskLevel  - 'low' | 'medium' | 'high'
 * @param {string} workspaceRoot
 */
export function recordApproval(patchId, task, riskLevel, workspaceRoot) {
  appendRecord(
    {
      id: generateId(),
      patchId: patchId ?? '',
      task: task ?? '',
      decision: 'approved',
      riskLevel: riskLevel ?? 'low',
      createdAt: new Date().toISOString(),
    },
    workspaceRoot
  );
}

/**
 * Record that a patch was rejected.
 *
 * @param {string} patchId
 * @param {string} task
 * @param {string} riskLevel  - 'low' | 'medium' | 'high'
 * @param {string} reason
 * @param {string} workspaceRoot
 */
export function recordRejection(patchId, task, riskLevel, reason, workspaceRoot) {
  appendRecord(
    {
      id: generateId(),
      patchId: patchId ?? '',
      task: task ?? '',
      decision: 'rejected',
      riskLevel: riskLevel ?? 'low',
      reason: reason ?? '',
      createdAt: new Date().toISOString(),
    },
    workspaceRoot
  );
}

/**
 * Load the full approval history.
 *
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function getHistory(workspaceRoot) {
  return loadArray(join(memoryDir(workspaceRoot), 'approval-history.json'));
}

/**
 * Aggregate rejection reasons and their occurrence counts.
 *
 * @param {string} workspaceRoot
 * @returns {{ reason: string, count: number }[]} sorted descending by count
 */
export function getRejectionReasons(workspaceRoot) {
  const history = getHistory(workspaceRoot);
  const counts = {};

  for (const entry of history) {
    if (entry.decision !== 'rejected') continue;
    const reason = (entry.reason ?? '').trim() || '(no reason given)';
    counts[reason] = (counts[reason] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Return approval/rejection totals and the approval rate.
 *
 * @param {string} workspaceRoot
 * @returns {{ approved: number, rejected: number, rate: number }}
 *   rate is in [0, 1]; NaN-safe (returns 0 when no history)
 */
export function getApprovalRate(workspaceRoot) {
  const history = getHistory(workspaceRoot);
  const approved = history.filter((e) => e.decision === 'approved').length;
  const rejected = history.filter((e) => e.decision === 'rejected').length;
  const total = approved + rejected;
  const rate = total === 0 ? 0 : approved / total;
  return { approved, rejected, rate };
}
