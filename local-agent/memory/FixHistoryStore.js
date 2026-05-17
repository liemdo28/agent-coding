// memory/FixHistoryStore.js - persists successful and failed fix records

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
  // keep newest MAX_ENTRIES — slice from the tail
  const trimmed = arr.length > MAX_ENTRIES ? arr.slice(arr.length - MAX_ENTRIES) : arr;
  writeFileSync(filePath, JSON.stringify(trimmed, null, 2), 'utf8');
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a successful fix record.
 *
 * @param {object} fixData - { task, patchId, filePath, errorType, diffSummary, ...extra }
 * @param {string} workspaceRoot
 */
export function recordSuccess(fixData, workspaceRoot) {
  const filePath = join(memoryDir(workspaceRoot), 'successful-fixes.json');
  const entries = loadArray(filePath);

  const record = sanitize({
    id: generateId(),
    task: fixData.task ?? '',
    patchId: fixData.patchId ?? '',
    filePath: fixData.filePath ?? '',
    errorType: fixData.errorType ?? '',
    diffSummary: fixData.diffSummary ?? '',
    createdAt: new Date().toISOString(),
    ...fixData,
  });

  entries.push(record);
  saveArray(filePath, entries);
}

/**
 * Append a failed fix record.
 *
 * @param {object} fixData - { task, patchId, errorType, reason, retriesUsed, ...extra }
 * @param {string} workspaceRoot
 */
export function recordFailure(fixData, workspaceRoot) {
  const filePath = join(memoryDir(workspaceRoot), 'failed-fixes.json');
  const entries = loadArray(filePath);

  const record = sanitize({
    id: generateId(),
    task: fixData.task ?? '',
    patchId: fixData.patchId ?? '',
    errorType: fixData.errorType ?? '',
    reason: fixData.reason ?? '',
    retriesUsed: fixData.retriesUsed ?? 0,
    createdAt: new Date().toISOString(),
    ...fixData,
  });

  entries.push(record);
  saveArray(filePath, entries);
}

/**
 * Load all successful fix records.
 *
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function getSuccessfulFixes(workspaceRoot) {
  return loadArray(join(memoryDir(workspaceRoot), 'successful-fixes.json'));
}

/**
 * Load all failed fix records.
 *
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function getFailedFixes(workspaceRoot) {
  return loadArray(join(memoryDir(workspaceRoot), 'failed-fixes.json'));
}

/**
 * Return all fix records (successful and failed) touching a specific file path.
 *
 * @param {string} relPath - relative file path to filter by
 * @param {string} workspaceRoot
 * @returns {{ successful: object[], failed: object[] }}
 */
export function getFixesForFile(relPath, workspaceRoot) {
  const normalize = (p) => (p ?? '').replace(/\\/g, '/');
  const target = normalize(relPath);

  const successful = getSuccessfulFixes(workspaceRoot).filter(
    (r) => normalize(r.filePath) === target
  );

  // failed records don't always have filePath; match what's present
  const failed = getFailedFixes(workspaceRoot).filter(
    (r) => normalize(r.filePath) === target
  );

  return { successful, failed };
}
