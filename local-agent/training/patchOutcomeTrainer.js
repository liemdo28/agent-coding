// training/patchOutcomeTrainer.js — prepares patch outcome training data for local fine-tuning
// Phase 17: extracts examples, builds prompt pairs, validates for instruction fine-tuning

import { listMemories } from '../memory/engineeringMemory.js';

const SECRET_RE = /(?:password|passwd|secret|api[_-]?key|token|private[_-]?key)\s*[:=]\s*\S{6,}/i;

/**
 * Extract patch examples from engineering memory.
 * @param {import('better-sqlite3').Database} memoryDB
 * @param {number} minConfidence
 * @returns {Array<{ input: string, output: string, meta: object }>}
 */
export function extractPatchExamples(memoryDB, minConfidence = 0.5) {
  const memories = listMemories(memoryDB, { type: 'PATCH_RESULT', limit: 1000 })
    .filter(m => m.confidence >= minConfidence);

  return memories.map(m => {
    const content = typeof m.content === 'object' ? m.content : {};
    const input   = [
      `Context: ${m.title}`,
      content.filePath ? `File: ${content.filePath}` : '',
      content.patch    ? `Patch:\n${content.patch}` : '',
    ].filter(Boolean).join('\n');

    const output = m.successRate >= 0.6
      ? `APPLIED_SUCCESSFULLY. Success rate: ${m.successRate.toFixed(2)}`
      : `FAILED_OR_REVERTED. Success rate: ${m.successRate.toFixed(2)}`;

    return {
      input:  input.slice(0, 2000),
      output: output.slice(0, 200),
      meta:   { id: m.id, confidence: m.confidence, successRate: m.successRate },
    };
  }).filter(e => !SECRET_RE.test(e.input));
}

/**
 * Format examples into instruction-tuning prompt pairs (Alpaca-style).
 * @param {Array<{ input: string, output: string }>} examples
 * @returns {Array<{ instruction: string, input: string, output: string }>}
 */
export function buildPromptPairs(examples) {
  const INSTRUCTION = 'Analyze the following code patch and predict whether it will be applied successfully.';
  return examples.map(e => ({
    instruction: INSTRUCTION,
    input:       e.input,
    output:      e.output,
  }));
}

/**
 * Validate training data — remove duplicates and low-quality entries.
 * @param {object[]} examples
 * @returns {object[]}
 */
export function validateTrainingData(examples) {
  const seen = new Set();
  return examples.filter(e => {
    if (!e.input || !e.output) return false;
    if (e.input.length < 20 || e.output.length < 5) return false;
    const key = e.input.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build a complete training-ready JSONL string.
 * @param {import('better-sqlite3').Database} memoryDB
 * @param {number} minConfidence
 * @returns {{ jsonl: string, count: number }}
 */
export function buildTrainingJSONL(memoryDB, minConfidence = 0.5) {
  const raw       = extractPatchExamples(memoryDB, minConfidence);
  const pairs     = buildPromptPairs(raw);
  const validated = validateTrainingData(pairs);
  const jsonl     = validated.map(e => JSON.stringify(e)).join('\n');
  return { jsonl, count: validated.length };
}
