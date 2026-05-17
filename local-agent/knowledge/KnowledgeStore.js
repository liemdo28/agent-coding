// knowledge/KnowledgeStore.js — persistent knowledge base for agent learning
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const KNOWLEDGE_FILE = '.local-agent/knowledge-base.json';

/**
 * Load the knowledge base.
 * @param {string} workspaceRoot
 * @returns {KnowledgeBase}
 */
export function loadKnowledge(workspaceRoot) {
  const p = join(workspaceRoot, KNOWLEDGE_FILE);
  if (!existsSync(p)) return { recipes: {}, rules: {}, clusters: [], updatedAt: null };
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { recipes: {}, rules: {}, clusters: [], updatedAt: null }; }
}

/**
 * Save the knowledge base.
 * @param {string} workspaceRoot
 * @param {KnowledgeBase} kb
 */
export function saveKnowledge(workspaceRoot, kb) {
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  kb.updatedAt = new Date().toISOString();
  writeFileSync(join(workspaceRoot, KNOWLEDGE_FILE), JSON.stringify(kb, null, 2));
}

/**
 * Record outcome for a recipe (fix attempt).
 * @param {string} workspaceRoot
 * @param {string} recipeId
 * @param {{ success: boolean, context?: string }} outcome
 */
export function recordOutcome(workspaceRoot, recipeId, { success, context }) {
  const kb = loadKnowledge(workspaceRoot);
  if (!kb.recipes[recipeId]) {
    kb.recipes[recipeId] = { id: recipeId, successes: 0, failures: 0, confidence: 0.5, lastUsed: null, staleSince: null };
  }
  const r = kb.recipes[recipeId];
  if (success) r.successes++; else r.failures++;
  r.lastUsed = new Date().toISOString();

  // Update confidence: Bayesian-style with recency weight
  const total = r.successes + r.failures;
  r.confidence = +((r.successes + 1) / (total + 2)).toFixed(3); // Laplace smoothing
  saveKnowledge(workspaceRoot, kb);
  return r;
}
