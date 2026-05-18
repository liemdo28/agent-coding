// training/datasetBuilder.js — builds local training datasets from engineering memory
// Phase 17: exports patch+outcome, QA, and error→fix pairs; filters secrets

import { listMemories } from '../memory/engineeringMemory.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Patterns that look like secrets — filter these out
const SECRET_RE = /(?:password|passwd|secret|api[_-]?key|token|auth|private[_-]?key)\s*[:=]\s*\S{6,}/i;

function sanitizeEntry(entry) {
  const str = JSON.stringify(entry);
  return !SECRET_RE.test(str);
}

/**
 * Build a patch training dataset from memory.
 * @param {import('better-sqlite3').Database} memoryDB
 * @param {{ minConfidence?: number, limit?: number }} options
 * @returns {object[]}
 */
export function buildPatchDataset(memoryDB, options = {}) {
  const { minConfidence = 0.4, limit = 500 } = options;
  return listMemories(memoryDB, { type: 'PATCH_RESULT', limit })
    .filter(m => m.confidence >= minConfidence && sanitizeEntry(m))
    .map(m => ({
      input:   { context: m.title, patch: typeof m.content === 'object' ? m.content?.patch ?? '' : m.content },
      output:  { success: m.successRate >= 0.6, score: m.successRate },
      meta:    { id: m.id, confidence: m.confidence },
    }));
}

/**
 * Build a QA training dataset.
 * @param {import('better-sqlite3').Database} memoryDB
 * @param {{ limit?: number }} options
 * @returns {object[]}
 */
export function buildQADataset(memoryDB, options = {}) {
  const { limit = 500 } = options;
  return listMemories(memoryDB, { type: 'QA_HISTORY', limit })
    .filter(sanitizeEntry)
    .map(m => ({
      input:  { code: m.title, context: typeof m.content === 'object' ? m.content?.context ?? '' : '' },
      output: { qaResult: m.successRate >= 0.6 ? 'pass' : 'fail', score: m.successRate },
      meta:   { id: m.id },
    }));
}

/**
 * Build error→fix pair dataset.
 * @param {import('better-sqlite3').Database} memoryDB
 * @returns {object[]}
 */
export function buildErrorFixDataset(memoryDB) {
  return listMemories(memoryDB, { type: 'ERROR_FIX', limit: 500 })
    .filter(sanitizeEntry)
    .map(m => ({
      input:  { error: m.title },
      output: { fix: typeof m.content === 'object' ? m.content?.fix ?? '' : m.content },
      meta:   { id: m.id, successRate: m.successRate, confidence: m.confidence },
    }));
}

/**
 * Export a dataset to a file.
 * @param {object[]} dataset
 * @param {string} outputPath
 * @param {'JSONL'|'CSV'} format
 */
export function exportDataset(dataset, outputPath, format = 'JSONL') {
  const dir = join(outputPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (format === 'JSONL') {
    const lines = dataset.map(row => JSON.stringify(row)).join('\n');
    writeFileSync(outputPath, lines, 'utf8');
  } else if (format === 'CSV') {
    const headers = ['input_json', 'output_json', 'meta_json'];
    const rows    = dataset.map(r =>
      [JSON.stringify(r.input), JSON.stringify(r.output), JSON.stringify(r.meta ?? {})]
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(',')
    );
    writeFileSync(outputPath, [headers.join(','), ...rows].join('\n'), 'utf8');
  }

  return { path: outputPath, format, count: dataset.length };
}

/** Return stats about a dataset. */
export function getDatasetStats(dataset) {
  if (!dataset || dataset.length === 0) return { count: 0 };
  const successCount = dataset.filter(d => d.output?.success || d.output?.qaResult === 'pass').length;
  return {
    count:       dataset.length,
    successRate: +(successCount / dataset.length).toFixed(3),
    filtered:    dataset.length,
  };
}
