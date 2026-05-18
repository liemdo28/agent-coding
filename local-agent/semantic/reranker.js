// semantic/reranker.js — re-ranks semantic search results using multiple signals
// Phase 8: BM25-like text score, recency, success_rate, type preference

const K1 = 1.5;  // BM25 term saturation
const B  = 0.75; // BM25 length normalization

/**
 * BM25-like text relevance score.
 * @param {string} doc
 * @param {string} query
 * @returns {number}
 */
export function getBM25Score(doc, query) {
  if (!doc || !query) return 0;
  const docTerms   = tokenize(doc);
  const queryTerms = tokenize(query);
  const docLen     = docTerms.length;
  const avgDocLen  = 200; // assumed average

  let score = 0;
  const tf = buildTF(docTerms);

  for (const term of queryTerms) {
    const termFreq = tf[term] ?? 0;
    if (termFreq === 0) continue;
    const idf = Math.log((1 + 1) / (0.5 + 1)); // simplified IDF (single doc)
    const tfNorm = (termFreq * (K1 + 1)) / (termFreq + K1 * (1 - B + B * docLen / avgDocLen));
    score += idf * tfNorm;
  }

  return score;
}

/**
 * Re-rank search results using multiple signals.
 * @param {Array<{ id: string, content: string, score: number, metadata?: object }>} results
 * @param {string} query
 * @param {{ typePreference?: string, recencyBoostDays?: number }} options
 * @returns {Array<object>}  sorted descending with rerank metadata
 */
export function rerank(results, query, options = {}) {
  const { typePreference, recencyBoostDays = 30 } = options;
  const now = Date.now();

  const scored = results.map((r, originalRank) => {
    const bm25     = getBM25Score(r.content ?? '', query);
    const recency  = computeRecency(r.metadata?.createdAt ?? r.metadata?.created_at, now, recencyBoostDays);
    const success  = r.metadata?.success_rate ?? r.metadata?.successRate ?? 0.5;
    const typeBonus = typePreference && r.metadata?.type === typePreference ? 0.1 : 0;

    const rerankScore = r.score * 0.4 + normalizeBM25(bm25) * 0.3 + recency * 0.15 + success * 0.15 + typeBonus;

    return {
      ...r,
      original_rank: originalRank,
      rerank_score:  +rerankScore.toFixed(4),
    };
  });

  scored.sort((a, b) => b.rerank_score - a.rerank_score);
  return scored.map((r, newRank) => ({ ...r, new_rank: newRank }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(text) {
  return String(text).toLowerCase().split(/\W+/).filter(t => t.length > 2);
}

function buildTF(terms) {
  const tf = {};
  for (const t of terms) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}

function computeRecency(dateStr, now, decayDays) {
  if (!dateStr) return 0.5;
  const age = (now - new Date(dateStr).getTime()) / 86_400_000;
  return Math.max(0, 1 - age / decayDays);
}

function normalizeBM25(score) {
  // Normalize to 0–1 range assuming max meaningful score ~5
  return Math.min(1, score / 5);
}
