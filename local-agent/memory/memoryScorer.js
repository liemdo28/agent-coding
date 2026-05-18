// memory/memoryScorer.js — scores memories for relevance to a given context
// Phase 7: weights: recency 25%, confidence 25%, success_rate 30%, frequency 10%, type_match 10%

import { listMemories, recordUsage } from './engineeringMemory.js';

const WEIGHTS = {
  recency:     0.25,
  confidence:  0.25,
  successRate: 0.30,
  frequency:   0.10,
  typeMatch:   0.10,
};

/**
 * Score a single memory against a context object.
 * @param {object} memory
 * @param {{ type?: string, projectId?: string, maxAgeMs?: number }} context
 * @returns {{ total: number, breakdown: object }}
 */
export function scoreMemory(memory, context = {}) {
  const now = Date.now();

  // Recency: full score within 7 days, zero at 90 days
  const ageDays = (now - new Date(memory.updatedAt ?? memory.createdAt ?? 0).getTime()) / 86_400_000;
  const recency = Math.max(0, 1 - ageDays / 90);

  // Confidence: stored value, clamped
  const confidence = Math.min(1, Math.max(0, memory.confidence ?? 0.5));

  // Success rate: stored value, clamped
  const successRate = Math.min(1, Math.max(0, memory.successRate ?? 0.5));

  // Frequency: use_count, normalized (saturates at 20 uses)
  const frequency = Math.min(1, (memory.useCount ?? 0) / 20);

  // Type match: 1 if context.type matches, 0 otherwise
  const typeMatch = context.type && memory.type === context.type ? 1 : 0;

  const breakdown = { recency, confidence, successRate, frequency, typeMatch };
  const total =
    recency     * WEIGHTS.recency     +
    confidence  * WEIGHTS.confidence  +
    successRate * WEIGHTS.successRate +
    frequency   * WEIGHTS.frequency   +
    typeMatch   * WEIGHTS.typeMatch;

  return { total, breakdown };
}

/**
 * Rank an array of memories against a context, returning sorted array with scores.
 * @param {object[]} memories
 * @param {object} context
 * @returns {object[]} sorted descending by score
 */
export function rankMemories(memories, context = {}) {
  return memories
    .map(m => ({ ...m, _relevance: scoreMemory(m, context) }))
    .sort((a, b) => b._relevance.total - a._relevance.total);
}

/**
 * Retrieve and rank the top memories from the DB for a given context.
 * @param {import('better-sqlite3').Database} db
 * @param {{ type?: string, projectId?: string }} context
 * @param {number} limit
 * @returns {object[]}
 */
export function getTopMemories(db, context = {}, limit = 10) {
  try {
    const candidates = listMemories(db, {
      type:      context.type,
      projectId: context.projectId,
      limit:     200,
    });
    return rankMemories(candidates, context).slice(0, limit);
  } catch (err) {
    console.error('[memoryScorer] getTopMemories error:', err.message);
    return [];
  }
}
