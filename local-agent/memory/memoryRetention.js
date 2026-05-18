// memory/memoryRetention.js — retention policy engine
// Phase 7: decides what to keep, archive, or delete based on configurable policy

import { listMemories, deleteMemory } from './engineeringMemory.js';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Default retention policy. */
export const DEFAULT_POLICY = {
  keepIfSuccessRateAbove: 0.7,        // keep forever
  keepRecentDays: 90,                 // keep regardless of other signals
  deleteIfUseCountZero: true,
  deleteIfOlderThanDays: 60,
  deleteIfConfidenceBelow: 0.3,
};

/**
 * Apply a retention policy to the memory DB.
 * @param {import('better-sqlite3').Database} db
 * @param {object} policy — merged with DEFAULT_POLICY
 * @returns {{ kept: number, deleted: number, archived: number }}
 */
export function applyRetentionPolicy(db, policy = {}) {
  const cfg = { ...DEFAULT_POLICY, ...policy };
  const memories = listMemories(db, { limit: 5000 });
  let kept = 0, deleted = 0, archived = 0;

  for (const m of memories) {
    const score = scoreRetention(m);
    // Always keep high-value memories
    if (m.successRate >= cfg.keepIfSuccessRateAbove) { kept++; continue; }

    const ageDays = ageInDays(m.createdAt);
    // Keep recent entries regardless
    if (ageDays <= cfg.keepRecentDays) { kept++; continue; }

    // Delete low-value old entries
    if (
      cfg.deleteIfUseCountZero &&
      m.useCount === 0 &&
      ageDays > cfg.deleteIfOlderThanDays &&
      m.confidence < cfg.deleteIfConfidenceBelow
    ) {
      deleteMemory(db, m.id);
      deleted++;
    } else {
      kept++;
    }
  }

  return { kept, deleted, archived };
}

/**
 * Score how important a memory entry is (0 = delete, 1 = keep forever).
 * @param {object} entry
 * @returns {number} 0–1
 */
export function scoreRetention(entry) {
  const ageDays = ageInDays(entry.createdAt);
  const recency  = Math.max(0, 1 - ageDays / 365); // decays over a year
  const usage    = Math.min(1, (entry.useCount ?? 0) / 10);
  const conf     = entry.confidence ?? 0.5;
  const success  = entry.successRate ?? 0.5;

  return recency * 0.3 + usage * 0.2 + conf * 0.2 + success * 0.3;
}

/**
 * Archive memories older than `olderThanDays` to JSON files.
 * @param {import('better-sqlite3').Database} db
 * @param {string} archiveDir
 * @param {number} olderThanDays
 * @returns {{ archived: number }}
 */
export function archiveOldMemories(db, archiveDir, olderThanDays = 180) {
  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
  const memories = listMemories(db, { limit: 5000 });
  const old = memories.filter(m => ageInDays(m.createdAt) > olderThanDays);
  let archived = 0;

  for (const m of old) {
    try {
      const filename = join(archiveDir, `${m.id}.json`);
      writeFileSync(filename, JSON.stringify(m, null, 2), 'utf8');
      deleteMemory(db, m.id);
      archived++;
    } catch (err) {
      console.error('[memoryRetention] archiveOldMemories error:', err.message);
    }
  }

  return { archived };
}

/**
 * Generate a retention report (counts by score tier).
 * @param {import('better-sqlite3').Database} db
 * @returns {{ total: number, critical: number, healthy: number, marginal: number, expired: number }}
 */
export function getRetentionReport(db) {
  const memories = listMemories(db, { limit: 5000 });
  let critical = 0, healthy = 0, marginal = 0, expired = 0;

  for (const m of memories) {
    const score = scoreRetention(m);
    if (score >= 0.75) critical++;
    else if (score >= 0.5) healthy++;
    else if (score >= 0.25) marginal++;
    else expired++;
  }

  return { total: memories.length, critical, healthy, marginal, expired };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageInDays(dateStr) {
  const ms = Date.now() - new Date(dateStr ?? 0).getTime();
  return ms / 86_400_000;
}
