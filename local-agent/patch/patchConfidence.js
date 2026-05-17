// patch/patchConfidence.js — scores patch safety and confidence before application
// Phase 15: factors: file importance, change size, test coverage, history, complexity

import { listMemories } from '../memory/engineeringMemory.js';

// Files that are considered high-risk
const HIGH_RISK_FILES = [
  'auth', 'login', 'password', 'token', 'secret', 'config', 'env',
  'database', 'db', 'migration', 'schema', 'payment', 'billing',
];

/**
 * Score patch safety and confidence.
 * @param {{ filePath?: string, filesChanged?: string[], diff?: string, locDelta?: number }} patch
 * @param {{ projectRoot?: string }} projectContext
 * @param {import('better-sqlite3').Database|null} memoryDB
 * @returns {{ confidence: number, risk: string, rollbackSafe: boolean, factors: object }}
 */
export function scorePatch(patch, projectContext = {}, memoryDB = null) {
  const factors = {};

  // ── File importance ────────────────────────────────────────────────────────
  const paths = patch.filesChanged ?? (patch.filePath ? [patch.filePath] : []);
  const isHighRisk = paths.some(p =>
    HIGH_RISK_FILES.some(kw => p.toLowerCase().includes(kw))
  );
  factors.fileImportance = isHighRisk ? 0.2 : 0.8;

  // ── Change size ───────────────────────────────────────────────────────────
  const locDelta = patch.locDelta ?? countLocDelta(patch.diff ?? '');
  factors.changeSize = locDelta <= 10 ? 0.9
    : locDelta <= 50 ? 0.7
    : locDelta <= 200 ? 0.5
    : 0.2;

  // ── Test coverage ─────────────────────────────────────────────────────────
  const hasTestFile = paths.some(p => /test|spec/.test(p));
  const diffMentionsTest = /test|spec|expect|assert|describe/.test(patch.diff ?? '');
  factors.testCoverage = hasTestFile || diffMentionsTest ? 0.8 : 0.4;

  // ── Historical patch success for this module ──────────────────────────────
  factors.historicalSuccess = 0.6; // default
  if (memoryDB) {
    try {
      const history = listMemories(memoryDB, { type: 'PATCH_RESULT', limit: 50 });
      const relevant = history.filter(m => {
        const content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content ?? '';
        return paths.some(p => content.includes(p));
      });
      if (relevant.length > 0) {
        factors.historicalSuccess = relevant.reduce((s, m) => s + (m.successRate ?? 0.5), 0) / relevant.length;
      }
    } catch { /* ignore */ }
  }

  // ── Complexity score ──────────────────────────────────────────────────────
  const diff        = patch.diff ?? '';
  const complexity  = computeComplexity(diff);
  factors.complexity = Math.max(0, 1 - complexity / 20);

  // ── Composite confidence ───────────────────────────────────────────────────
  const weights = {
    fileImportance:   0.25,
    changeSize:       0.20,
    testCoverage:     0.20,
    historicalSuccess:0.25,
    complexity:       0.10,
  };

  const confidence = +Object.entries(weights)
    .reduce((sum, [k, w]) => sum + (factors[k] ?? 0.5) * w, 0)
    .toFixed(3);

  const risk = isHighRisk || locDelta > 100 ? 'high'
    : confidence < 0.6 ? 'medium' : 'low';

  const rollbackSafe = paths.length > 0 && !isHighRisk && locDelta <= 200;

  return { confidence, risk, rollbackSafe, factors };
}

/**
 * Translate a numeric confidence to a human-readable label.
 * @param {number} score  0–1
 * @returns {'HIGH'|'MEDIUM'|'LOW'|'BLOCKED'}
 */
export function getConfidenceLabel(score) {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.65) return 'MEDIUM';
  if (score >= 0.40) return 'LOW';
  return 'BLOCKED';
}

/**
 * Decide if a patch should be auto-applied.
 * Only true if confidence > 0.85 AND risk === 'low' AND rollbackSafe.
 * @param {object} patchScore  — from scorePatch
 * @returns {boolean}
 */
export function shouldAutoApply(patchScore) {
  return (
    patchScore.confidence > 0.85 &&
    patchScore.risk === 'low' &&
    patchScore.rollbackSafe === true
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function countLocDelta(diff) {
  return (diff.match(/^[+-]/gm) ?? []).length;
}

function computeComplexity(diff) {
  // Count control-flow keywords in diff additions
  const additions = diff.split('\n').filter(l => l.startsWith('+')).join('\n');
  const kwRe = /\b(if|else|for|while|switch|catch|try|&&|\|\||\?)\b/g;
  return (additions.match(kwRe) ?? []).length;
}
