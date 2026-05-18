// knowledge/KnowledgeEvolver.js — evolve the knowledge base over time
import { loadKnowledge, saveKnowledge } from './KnowledgeStore.js';

const STALE_DAYS      = 30;
const PROMOTE_THRESHOLD = 0.8;   // confidence >= 0.8 → promoted
const DEMOTE_THRESHOLD  = 0.25;  // confidence <= 0.25 → demoted/flagged

/**
 * Run a full knowledge evolution pass.
 * - Promote high-confidence recipes
 * - Flag low-confidence recipes
 * - Mark stale knowledge
 * - Update QA rule weights
 *
 * @param {string} workspaceRoot
 * @returns {EvolveResult}
 */
export function evolveKnowledge(workspaceRoot) {
  const kb       = loadKnowledge(workspaceRoot);
  const now      = Date.now();
  const promoted = [];
  const demoted  = [];
  const stale    = [];

  for (const [id, recipe] of Object.entries(kb.recipes)) {
    // Check staleness
    const lastUsed = recipe.lastUsed ? new Date(recipe.lastUsed).getTime() : 0;
    const daysSince = (now - lastUsed) / 86400_000;
    if (daysSince > STALE_DAYS && !recipe.staleSince) {
      recipe.staleSince = new Date().toISOString();
      stale.push(id);
    } else if (daysSince <= STALE_DAYS && recipe.staleSince) {
      recipe.staleSince = null; // recovered
    }

    // Promote / demote
    if (recipe.confidence >= PROMOTE_THRESHOLD && !recipe.promoted) {
      recipe.promoted = true;
      promoted.push({ id, confidence: recipe.confidence });
    } else if (recipe.confidence <= DEMOTE_THRESHOLD && !recipe.demoted) {
      recipe.demoted  = true;
      recipe.promoted = false;
      demoted.push({ id, confidence: recipe.confidence });
    }
  }

  saveKnowledge(workspaceRoot, kb);

  return {
    totalRecipes: Object.keys(kb.recipes).length,
    promoted:     promoted.length,
    demoted:      demoted.length,
    stale:        stale.length,
    promotedItems: promoted,
    demotedItems:  demoted,
    staleItems:    stale,
    evolvedAt:     new Date().toISOString(),
  };
}

/**
 * Audit the knowledge base — summarize confidence distribution and staleness.
 * @param {string} workspaceRoot
 * @returns {AuditResult}
 */
export function auditKnowledge(workspaceRoot) {
  const kb      = loadKnowledge(workspaceRoot);
  const recipes = Object.values(kb.recipes);

  const highConf  = recipes.filter((r) => r.confidence >= PROMOTE_THRESHOLD);
  const lowConf   = recipes.filter((r) => r.confidence <= DEMOTE_THRESHOLD);
  const staleRec  = recipes.filter((r) => r.staleSince);
  const avgConf   = recipes.length
    ? +(recipes.reduce((s, r) => s + r.confidence, 0) / recipes.length).toFixed(3) : null;

  return {
    total:         recipes.length,
    highConfidence: highConf.length,
    lowConfidence:  lowConf.length,
    stale:         staleRec.length,
    averageConfidence: avgConf,
    promoted:      recipes.filter((r) => r.promoted).length,
    demoted:       recipes.filter((r) => r.demoted).length,
    topRecipes:    recipes.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
                          .map((r) => ({ id: r.id, confidence: r.confidence, uses: r.successes + r.failures })),
    bottomRecipes: recipes.sort((a, b) => a.confidence - b.confidence).slice(0, 5)
                          .map((r) => ({ id: r.id, confidence: r.confidence, uses: r.successes + r.failures })),
  };
}

/**
 * Refresh: clear stale demoted recipes and re-baseline rules.
 * @param {string} workspaceRoot
 * @returns {{ cleared: number, reset: number }}
 */
export function refreshKnowledge(workspaceRoot) {
  const kb = loadKnowledge(workspaceRoot);
  let cleared = 0, reset = 0;

  for (const [id, recipe] of Object.entries(kb.recipes)) {
    // Remove demoted recipes that are also stale
    if (recipe.demoted && recipe.staleSince) {
      delete kb.recipes[id];
      cleared++;
    }
    // Reset confidence for recently-active recipes that were mis-demoted
    else if (recipe.demoted && !recipe.staleSince) {
      recipe.demoted = false;
      reset++;
    }
  }

  saveKnowledge(workspaceRoot, kb);
  return { cleared, reset };
}
