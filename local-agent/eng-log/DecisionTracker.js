// eng-log/DecisionTracker.js — record engineering decisions with structured metadata
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const DECISIONS_DIR = '.local-agent/engineering-log/decisions';

/**
 * Record an engineering decision.
 * @param {string} workspaceRoot
 * @param {{ title: string, reason: string, impact: string, risk?: string, alternatives?: string[] }} opts
 * @returns {Decision}
 */
export function recordDecision(workspaceRoot, { title, reason, impact, risk = 'low', alternatives = [] }) {
  const dir = join(workspaceRoot, DECISIONS_DIR);
  mkdirSync(dir, { recursive: true });

  const existing = listDecisions(workspaceRoot);
  const id       = String(existing.length + 1).padStart(3, '0');
  const decision = {
    decisionId:  `DEC-${id}`,
    title,
    reason,
    impact,
    risk,
    alternatives,
    timestamp:   new Date().toISOString(),
  };

  writeFileSync(join(dir, `DEC-${id}.json`), JSON.stringify(decision, null, 2));

  // Append to flat index for fast listing
  const indexPath = join(workspaceRoot, '.local-agent', 'engineering-log', 'decisions-index.jsonl');
  mkdirSync(join(workspaceRoot, '.local-agent', 'engineering-log'), { recursive: true });
  appendFileSync(indexPath, JSON.stringify({ id: decision.decisionId, title, timestamp: decision.timestamp }) + '\n');

  return decision;
}

/**
 * List all recorded decisions.
 * @param {string} workspaceRoot
 * @returns {Decision[]}
 */
export function listDecisions(workspaceRoot) {
  const dir = join(workspaceRoot, DECISIONS_DIR);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => a.decisionId.localeCompare(b.decisionId));
  } catch { return []; }
}
