// semantic/semanticSearch.js — semantic search over the vector store
// Phase 8: cosine similarity + keyword hybrid search

import { listVectors, getVector, cosineSimilarity } from './vectorStore.js';
import { embed } from './embeddingEngine.js';

/**
 * Semantic search using a pre-computed query embedding.
 * @param {object} store  SQLite db (vector store)
 * @param {number[]} queryEmbedding
 * @param {{ namespace?: string, limit?: number, minScore?: number }} options
 * @returns {{ results: object[], query: number[], totalSearched: number, executionMs: number }}
 */
export function semanticSearch(store, queryEmbedding, options = {}) {
  const start     = Date.now();
  const { namespace = 'default', limit = 10, minScore = 0.0 } = options;

  try {
    // Load all vectors in namespace (SQLite stores embeddings as BLOB; retrieve all for cosine)
    const rows = store.prepare(
      'SELECT id, namespace, content, embedding, metadata, created_at FROM vectors WHERE namespace = ?'
    ).all(namespace);

    const results = [];
    for (const row of rows) {
      const rowEmb  = bufferToEmbedding(row.embedding);
      const score   = cosineSimilarity(queryEmbedding, rowEmb);
      if (score >= minScore) {
        results.push({
          id:       row.id,
          score:    +score.toFixed(4),
          content:  row.content,
          metadata: tryParseJSON(row.metadata),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return {
      results:      results.slice(0, limit),
      query:        queryEmbedding,
      totalSearched: rows.length,
      executionMs:  Date.now() - start,
    };
  } catch (err) {
    console.error('[semanticSearch] error:', err.message);
    return { results: [], query: queryEmbedding, totalSearched: 0, executionMs: Date.now() - start };
  }
}

/**
 * Hybrid search: combine semantic (embedding) + keyword (text match) scores.
 * @param {object} store
 * @param {object} embeddingEngine  — { embed } reference (pass module)
 * @param {string} queryText
 * @param {{ namespace?: string, limit?: number, embeddingWeight?: number }} options
 */
export async function hybridSearch(store, embeddingEngine, queryText, options = {}) {
  const { namespace = 'default', limit = 10, embeddingWeight = 0.7 } = options;
  const kwWeight = 1 - embeddingWeight;

  // Keyword pass (simple text match)
  const all = store.prepare('SELECT id, content, metadata FROM vectors WHERE namespace = ?').all(namespace);
  const lower = queryText.toLowerCase();

  const kwScores = {};
  for (const row of all) {
    const text  = (row.content ?? '').toLowerCase();
    const terms = lower.split(/\W+/).filter(t => t.length > 2);
    const hits  = terms.filter(t => text.includes(t)).length;
    kwScores[row.id] = hits / Math.max(terms.length, 1);
  }

  // Semantic pass
  const queryEmbedding = await embed(queryText);
  const semResults     = queryEmbedding
    ? semanticSearch(store, queryEmbedding, { namespace, limit: all.length }).results
    : [];

  const semScores = {};
  for (const r of semResults) semScores[r.id] = r.score;

  // Merge
  const merged = all.map(row => ({
    id:       row.id,
    content:  row.content,
    metadata: tryParseJSON(row.metadata),
    score:    +(embeddingWeight * (semScores[row.id] ?? 0) + kwWeight * (kwScores[row.id] ?? 0)).toFixed(4),
  })).sort((a, b) => b.score - a.score).slice(0, limit);

  return { results: merged, query: queryText, totalSearched: all.length, hybrid: true };
}

/** Specialized: search for similar errors. */
export async function searchErrors(store, errorText, embeddingEngine) {
  return hybridSearch(store, embeddingEngine, errorText, { namespace: 'errors', limit: 5 });
}

/** Specialized: search for patches by description. */
export async function searchPatches(store, description, embeddingEngine) {
  return hybridSearch(store, embeddingEngine, description, { namespace: 'patches', limit: 5 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function bufferToEmbedding(buf) {
  if (!buf || buf.length === 0) return [];
  const arr = [];
  for (let i = 0; i < buf.length; i += 4) arr.push(buf.readFloatLE(i));
  return arr;
}

function tryParseJSON(s) {
  try { return JSON.parse(s); } catch { return s; }
}
