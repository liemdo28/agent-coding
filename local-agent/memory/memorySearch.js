// memory/memorySearch.js — search engineering memory by keyword, type, project
// Phase 7: TF-IDF-like ranking with recency, confidence, and success_rate signals

import { listMemories, recordUsage } from './engineeringMemory.js';

/**
 * Search engineering memory using keyword + optional filters.
 * @returns {{ results: object[], totalFound: number, query: string, executionMs: number }}
 */
export function searchMemory(db, query, { type, projectId, limit = 20, minConfidence = 0 } = {}) {
  const start = Date.now();
  try {
    const memories = listMemories(db, { type, projectId, limit: 500 });
    const filtered = memories.filter(m => m.confidence >= minConfidence);
    const ranked = rankResults(filtered, query).slice(0, limit);
    return {
      results: ranked,
      totalFound: ranked.length,
      query,
      executionMs: Date.now() - start,
    };
  } catch (err) {
    console.error('[memorySearch] searchMemory error:', err.message);
    return { results: [], totalFound: 0, query, executionMs: Date.now() - start };
  }
}

/**
 * Score and rank memories against a query string.
 * Combines TF-IDF-like term frequency, success_rate, confidence, and recency.
 * @param {object[]} memories
 * @param {string} query
 * @returns {object[]} sorted descending by score
 */
export function rankResults(memories, query) {
  if (!query || !query.trim()) return memories;
  const terms = tokenize(query);
  const now = Date.now();

  return memories
    .map(m => {
      const titleTerms   = tokenize(m.title ?? '');
      const contentText  = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
      const contentTerms = tokenize(contentText);

      // TF: how many query terms appear in title / content
      let tfTitle   = 0;
      let tfContent = 0;
      for (const t of terms) {
        tfTitle   += titleTerms.filter(w => w === t).length;
        tfContent += contentTerms.filter(w => w === t).length;
      }
      const tfScore = (tfTitle * 2 + tfContent) / Math.max(terms.length, 1);

      // Recency: 1.0 for today, decays over 90 days
      const ageMs   = now - new Date(m.updatedAt ?? m.createdAt ?? 0).getTime();
      const ageDays = ageMs / 86_400_000;
      const recency = Math.max(0, 1 - ageDays / 90);

      const score = tfScore * 0.5
        + (m.successRate ?? 0.5) * 0.2
        + (m.confidence  ?? 0.5) * 0.2
        + recency * 0.1;

      return { ...m, _score: score };
    })
    .filter(m => m._score > 0)
    .sort((a, b) => b._score - a._score);
}

/**
 * Find memories similar to a reference memory (by shared tags and type).
 * @param {import('better-sqlite3').Database} db
 * @param {string} referenceId
 * @param {number} limit
 * @returns {object[]}
 */
export function findSimilarMemories(db, referenceId, limit = 10) {
  try {
    const ref = db.prepare('SELECT * FROM engineering_memory WHERE id = ?').get(referenceId);
    if (!ref) return [];

    let tags = [];
    try { tags = JSON.parse(ref.tags); } catch { /* ignore */ }

    const candidates = listMemories(db, { type: ref.memory_type, limit: 200 })
      .filter(m => m.id !== referenceId);

    // Score by shared tags + title similarity
    return candidates
      .map(m => {
        const sharedTags = (m.tags ?? []).filter(t => tags.includes(t)).length;
        const titleSim   = jaccardSim(tokenize(ref.title), tokenize(m.title ?? ''));
        return { ...m, _simScore: sharedTags * 0.3 + titleSim * 0.7 };
      })
      .sort((a, b) => b._simScore - a._simScore)
      .slice(0, limit);
  } catch (err) {
    console.error('[memorySearch] findSimilarMemories error:', err.message);
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase().split(/\W+/).filter(t => t.length > 2);
}

function jaccardSim(setA, setB) {
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
