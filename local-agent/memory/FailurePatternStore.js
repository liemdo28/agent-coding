// memory/FailurePatternStore.js - persists and retrieves known error patterns

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sanitize } from './MemorySanitizer.js';

const MAX_ENTRIES = 200;
const PATTERN_PREFIX_LENGTH = 100;

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

/**
 * Normalize an error text to a fingerprint used for deduplication.
 * Takes the first PATTERN_PREFIX_LENGTH chars, lowercased, whitespace-collapsed.
 *
 * @param {string} errorText
 * @returns {string}
 */
function normalizePattern(errorText) {
  if (!errorText || typeof errorText !== 'string') return '';
  return errorText
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PATTERN_PREFIX_LENGTH);
}

/**
 * Simple word-overlap score between two strings (Jaccard-like).
 * Returns a value in [0, 1].
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function overlapScore(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Learn from an error outcome — upsert into known-issues.json.
 *
 * If an existing pattern shares the same normalised prefix, increment its
 * counters and update suggestedFix on success; otherwise insert a new entry.
 *
 * @param {string} errorText
 * @param {string} errorType
 * @param {string} suggestedFix
 * @param {'success'|'failure'} outcome
 * @param {string} workspaceRoot
 */
export function learnPattern(errorText, errorType, suggestedFix, outcome, workspaceRoot) {
  const filePath = join(memoryDir(workspaceRoot), 'known-issues.json');
  const entries = loadArray(filePath);

  const fingerprint = normalizePattern(errorText);
  const existing = entries.find((e) => normalizePattern(e.errorText ?? e.pattern) === fingerprint);

  if (existing) {
    if (outcome === 'success') {
      existing.successCount = (existing.successCount ?? 0) + 1;
      if (suggestedFix) existing.suggestedFix = suggestedFix;
    } else {
      existing.failureCount = (existing.failureCount ?? 0) + 1;
    }
    existing.updatedAt = new Date().toISOString();
  } else {
    const record = sanitize({
      id: generateId(),
      pattern: fingerprint,
      errorType: errorType ?? '',
      errorText: errorText ?? '',
      suggestedFix: suggestedFix ?? '',
      successCount: outcome === 'success' ? 1 : 0,
      failureCount: outcome === 'failure' ? 1 : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    entries.push(record);
  }

  saveArray(filePath, entries);
}

/**
 * Load all known-issues entries.
 *
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function getKnownPatterns(workspaceRoot) {
  return loadArray(join(memoryDir(workspaceRoot), 'known-issues.json'));
}

/**
 * Return the top 3 patterns that best match the given error text.
 * Sorted descending by word-overlap score.
 *
 * @param {string} errorText
 * @param {string} workspaceRoot
 * @returns {object[]} up to 3 pattern records, each with an extra `.score` field
 */
export function findMatchingPatterns(errorText, workspaceRoot) {
  if (!errorText) return [];
  const patterns = getKnownPatterns(workspaceRoot);

  const scored = patterns
    .map((p) => ({
      ...p,
      score: overlapScore(errorText, p.errorText ?? p.pattern ?? ''),
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3);
}

/**
 * Return all patterns for a given errorType.
 *
 * @param {string} errorType
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function getPatternsByType(errorType, workspaceRoot) {
  if (!errorType) return getKnownPatterns(workspaceRoot);
  const lower = errorType.toLowerCase();
  return getKnownPatterns(workspaceRoot).filter(
    (p) => (p.errorType ?? '').toLowerCase() === lower
  );
}
