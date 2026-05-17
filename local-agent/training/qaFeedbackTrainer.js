// training/qaFeedbackTrainer.js — builds QA feedback training data
// Phase 17: extracts QA examples from memory for fine-tuning

import { listMemories } from '../memory/engineeringMemory.js';

const SECRET_RE = /(?:password|passwd|secret|api[_-]?key|token|private[_-]?key)\s*[:=]\s*\S{6,}/i;

/**
 * Extract QA examples from engineering memory.
 * @param {import('better-sqlite3').Database} memoryDB
 * @returns {Array<{ code: string, qaResult: string, score: number, fixes: string[] }>}
 */
export function extractQAExamples(memoryDB) {
  const memories = listMemories(memoryDB, { type: 'QA_HISTORY', limit: 1000 });

  return memories
    .filter(m => !SECRET_RE.test(JSON.stringify(m)))
    .map(m => {
      const content = typeof m.content === 'object' ? m.content : {};
      return {
        code:     m.title ?? '',
        qaResult: m.successRate >= 0.6 ? 'PASS' : 'FAIL',
        score:    m.successRate,
        fixes:    Array.isArray(content.fixes) ? content.fixes : [],
        context:  content.context ?? '',
        meta:     { id: m.id, confidence: m.confidence },
      };
    })
    .filter(e => e.code.length > 5);
}

/**
 * Build prompt-response pairs for QA feedback fine-tuning.
 * @param {Array<{ code: string, qaResult: string, score: number, fixes: string[] }>} examples
 * @returns {Array<{ instruction: string, input: string, output: string }>}
 */
export function buildFeedbackPairs(examples) {
  const INSTRUCTION = 'Review the following code or change. Assess QA quality and suggest improvements.';

  return examples.map(e => {
    const input  = e.context ? `Context: ${e.context}\nCode: ${e.code}` : `Code: ${e.code}`;
    const output = [
      `QA Result: ${e.qaResult}`,
      `Score: ${(e.score * 100).toFixed(0)}/100`,
      e.fixes.length > 0 ? `Suggested fixes:\n${e.fixes.map(f => `- ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');

    return { instruction: INSTRUCTION, input: input.slice(0, 1500), output: output.slice(0, 500) };
  });
}

/**
 * Get statistics about QA training examples.
 * @param {object[]} examples
 * @returns {{ count: number, passRate: number, avgScore: number }}
 */
export function getQATrainingStats(examples) {
  if (!examples || examples.length === 0) return { count: 0, passRate: 0, avgScore: 0 };
  const passing  = examples.filter(e => e.qaResult === 'PASS' || (e.score ?? 0) >= 0.6).length;
  const avgScore = examples.reduce((s, e) => s + (e.score ?? 0.5), 0) / examples.length;
  return {
    count:    examples.length,
    passRate: +(passing / examples.length).toFixed(3),
    avgScore: +avgScore.toFixed(3),
  };
}
