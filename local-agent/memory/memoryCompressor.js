// memory/memoryCompressor.js — deduplicate and prune old low-value memories
// Phase 7: keeps the DB lean by merging similar entries and deleting dead weight

import { listMemories, deleteMemory, updateMemory } from './engineeringMemory.js';

/**
 * Jaccard similarity on word sets (0–1).
 * @param {string} a
 * @param {string} b
 */
export function similarityScore(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Main compression pass.
 * - Merges entries with title similarity > 0.8 (keeps higher success_rate, increments use_count)
 * - Deletes entries where success_rate < 0.2 AND use_count === 0 AND age > 30 days
 * - Upgrades confidence of entries used successfully > 3 times
 * @param {import('better-sqlite3').Database} db
 * @param {{ dryRun?: boolean }} options
 * @returns {{ merged: number, deleted: number, upgraded: number, durationMs: number }}
 */
export function compressMemories(db, options = {}) {
  const start  = Date.now();
  const dryRun = options.dryRun ?? false;
  let merged = 0, deleted = 0, upgraded = 0;

  try {
    const all = listMemories(db, { limit: 2000 });
    const now = Date.now();

    // ── 1. Delete low-value entries ────────────────────────────────────────
    for (const m of all) {
      const ageDays = (now - new Date(m.createdAt).getTime()) / 86_400_000;
      if (m.successRate < 0.2 && m.useCount === 0 && ageDays > 30) {
        if (!dryRun) deleteMemory(db, m.id);
        deleted++;
      }
    }

    // ── 2. Merge similar entries (group by type first) ─────────────────────
    const byType = groupBy(all, m => m.type);
    const toDelete = new Set();

    for (const group of Object.values(byType)) {
      for (let i = 0; i < group.length; i++) {
        if (toDelete.has(group[i].id)) continue;
        for (let j = i + 1; j < group.length; j++) {
          if (toDelete.has(group[j].id)) continue;
          const sim = similarityScore(group[i].title, group[j].title);
          if (sim > 0.8) {
            // Keep the one with higher success_rate; merge use_count
            const [keep, remove] =
              group[i].successRate >= group[j].successRate
                ? [group[i], group[j]]
                : [group[j], group[i]];

            if (!dryRun) {
              updateMemory(db, keep.id, {
                use_count:    keep.useCount + remove.useCount,
                success_rate: Math.max(keep.successRate, remove.successRate),
              });
              deleteMemory(db, remove.id);
            }
            toDelete.add(remove.id);
            merged++;
          }
        }
      }
    }

    // ── 3. Upgrade confidence for frequently successful entries ─────────────
    for (const m of all) {
      if (toDelete.has(m.id)) continue;
      if (m.useCount > 3 && m.successRate > 0.7 && m.confidence < 0.9) {
        const newConf = Math.min(0.95, m.confidence + 0.1);
        if (!dryRun) updateMemory(db, m.id, { confidence: newConf });
        upgraded++;
      }
    }
  } catch (err) {
    console.error('[memoryCompressor] compressMemories error:', err.message);
  }

  return { merged, deleted, upgraded, durationMs: Date.now() - start };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase().split(/\W+/).filter(t => t.length > 2);
}

function groupBy(arr, fn) {
  const result = {};
  for (const item of arr) {
    const key = fn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
