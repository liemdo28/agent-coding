// local-agent/strategy/StrategyHistory.js
// Phase 102 — append-only JSONL log for StrategyScore history.

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Append one StrategyScore to the JSONL log file.
 * Creates the file (and parent dirs) if they don't exist.
 *
 * @param {string} logPath
 * @param {object} strategyScore
 */
export async function appendStrategyLog(logPath, strategyScore) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify(strategyScore) + '\n', 'utf8');
  } catch {
    // Log writes are non-critical; swallow errors silently.
  }
}

/**
 * Read recent entries from the strategy log.
 *
 * @param {string} logPath
 * @param {{ limitMs?: number, limit?: number }} opts
 *   limitMs — keep only entries within this many milliseconds of now (default: 24h)
 *   limit   — max entries to return (most recent first, default: 1000)
 * @returns {object[]} StrategyScore[]
 */
export function readStrategyLog(logPath, opts = {}) {
  const { limitMs = 86_400_000, limit = 1000 } = opts;

  if (!existsSync(logPath)) return [];

  const cutoff = Date.now() - limitMs;
  const lines  = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);

  const entries = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (new Date(entry.ts).getTime() >= cutoff) {
        entries.push(entry);
      }
    } catch {
      // skip malformed lines
    }
  }

  // Most-recent first, capped at limit.
  return entries.reverse().slice(0, limit);
}

/**
 * Return the single most-recent StrategyScore from the log, or null.
 *
 * @param {string} logPath
 * @returns {object|null}
 */
export function latestStrategyScore(logPath) {
  const entries = readStrategyLog(logPath, { limit: 1 });
  return entries[0] ?? null;
}
