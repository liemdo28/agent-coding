// memory/memoryIndexer.js — in-memory inverted index over engineering_memory
// Phase 7: fast keyword lookup without scanning all rows

const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','was','are','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'this','that','these','those','it','its','we','our','you','your','they',
  'their','not','no','if','as','so','up','out','into','about','after',
]);

/** Tokenize text into lowercase, stemmed, filtered tokens. */
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/\W+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
    .map(t => t.slice(0, 5)); // stem by truncating to 5 chars
}

/**
 * Build an in-memory inverted index from all rows in engineering_memory.
 * @param {import('better-sqlite3').Database} db
 * @returns {{ index: Map<string, Set<string>>, totalDocs: number }}
 */
export function buildIndex(db) {
  const index = new Map();
  let totalDocs = 0;
  try {
    const rows = db.prepare('SELECT id, title, content, tags FROM engineering_memory').all();
    totalDocs = rows.length;
    for (const row of rows) {
      const text = [
        row.title,
        typeof row.content === 'string' ? row.content : '',
        typeof row.tags === 'string' ? row.tags : '',
      ].join(' ');
      addToIndex(index, row.id, text);
    }
  } catch (err) {
    console.error('[memoryIndexer] buildIndex error:', err.message);
  }
  return { index, totalDocs };
}

/**
 * Add/update a document in the index.
 * @param {Map<string, Set<string>>} index
 * @param {string} id  document id
 * @param {string} text  raw text to index
 */
export function addToIndex(index, id, text) {
  const tokens = tokenize(text);
  for (const token of tokens) {
    if (!index.has(token)) index.set(token, new Set());
    index.get(token).add(id);
  }
}

/**
 * Remove a document from every posting list.
 * @param {Map<string, Set<string>>} index
 * @param {string} id
 */
export function removeFromIndex(index, id) {
  for (const [token, ids] of index) {
    ids.delete(id);
    if (ids.size === 0) index.delete(token);
  }
}

/**
 * Return stats about the current index.
 * @param {Map<string, Set<string>>} index
 * @returns {{ termCount: number, avgPostingLength: number, topTerms: string[] }}
 */
export function getIndexStats(index) {
  const termCount = index.size;
  let totalPostings = 0;
  const termFreqs = [];
  for (const [token, ids] of index) {
    totalPostings += ids.size;
    termFreqs.push({ token, count: ids.size });
  }
  termFreqs.sort((a, b) => b.count - a.count);
  return {
    termCount,
    avgPostingLength: termCount > 0 ? (totalPostings / termCount).toFixed(2) : 0,
    topTerms: termFreqs.slice(0, 10).map(t => t.token),
  };
}

/**
 * Search the index for documents matching all query tokens.
 * Returns Set of matching document ids (intersection of posting lists).
 * @param {Map<string, Set<string>>} index
 * @param {string} queryText
 * @returns {Set<string>}
 */
export function queryIndex(index, queryText) {
  const tokens = tokenize(queryText);
  if (tokens.length === 0) return new Set();
  let result = null;
  for (const token of tokens) {
    const posting = index.get(token) ?? new Set();
    if (result === null) {
      result = new Set(posting);
    } else {
      for (const id of result) {
        if (!posting.has(id)) result.delete(id);
      }
    }
  }
  return result ?? new Set();
}
