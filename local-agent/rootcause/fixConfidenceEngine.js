// rootcause/fixConfidenceEngine.js — scores confidence that a fix will resolve root cause
// Phase 13: combines historical success, causal match, code quality, test coverage, risk

import { listMemories, updateMemory, recordUsage } from '../memory/engineeringMemory.js';

/**
 * Score confidence that a proposed fix resolves the root cause (0–1).
 * @param {{ type?: string, description?: string }} rootCause
 * @param {{ code?: string, description?: string, affectedFiles?: string[] }} proposedFix
 * @param {import('better-sqlite3').Database} memoryDB
 * @returns {{ confidence: number, breakdown: object }}
 */
export function scoreFixConfidence(rootCause, proposedFix, memoryDB) {
  const breakdown = getConfidenceBreakdown(rootCause, proposedFix);

  // Enhance historical signal from memory DB
  if (memoryDB) {
    try {
      const history = listMemories(memoryDB, { type: 'ERROR_FIX', limit: 100 });
      const similar = history.filter(m => {
        const content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content ?? '';
        return rootCause.type && content.includes(rootCause.type);
      });
      if (similar.length > 0) {
        const avgSuccess = similar.reduce((s, m) => s + (m.successRate ?? 0.5), 0) / similar.length;
        breakdown.historicalSuccess = avgSuccess;
      }
    } catch { /* ignore */ }
  }

  const weights = {
    historicalSuccess: 0.35,
    causalMatch:       0.25,
    codeQuality:       0.15,
    testCoverage:      0.15,
    riskLevel:         0.10,
  };

  const total = Object.entries(weights)
    .reduce((sum, [k, w]) => sum + (breakdown[k] ?? 0.5) * w, 0);

  return { confidence: +total.toFixed(3), breakdown };
}

/**
 * Break down confidence factors for a fix.
 * @param {object} rootCause
 * @param {object} proposedFix
 * @returns {object}
 */
export function getConfidenceBreakdown(rootCause, proposedFix) {
  const code = proposedFix?.code ?? proposedFix?.description ?? '';

  // Causal match: does the fix address the root cause type?
  let causalMatch = 0.4;
  if (rootCause?.type && code.toLowerCase().includes(rootCause.type.toLowerCase())) {
    causalMatch = 0.9;
  } else if (rootCause?.description && code.includes(rootCause.description.slice(0, 20))) {
    causalMatch = 0.7;
  }

  // Code quality: check for obvious smells
  let codeQuality = 0.7;
  if (/console\.log|debugger|TODO|FIXME/i.test(code)) codeQuality -= 0.2;
  if (code.length < 10) codeQuality = 0.2;
  if (code.length > 50 && code.length < 500) codeQuality = Math.min(0.95, codeQuality);

  // Test coverage: does fix mention tests?
  const testCoverage = /test|spec|assert|expect|describe|it\(/.test(code) ? 0.8 : 0.4;

  // Risk level: fewer files changed = lower risk = higher confidence
  const filesChanged = proposedFix?.affectedFiles?.length ?? 1;
  const riskLevel    = Math.max(0, 1 - (filesChanged - 1) * 0.15);

  return {
    historicalSuccess: 0.5, // overridden in scoreFixConfidence if DB available
    causalMatch:       +causalMatch.toFixed(3),
    codeQuality:       +codeQuality.toFixed(3),
    testCoverage,
    riskLevel:         +riskLevel.toFixed(3),
  };
}

/**
 * Update memory with the actual outcome of a fix (learns from results).
 * @param {import('better-sqlite3').Database} memoryDB
 * @param {string} fixId  memory id
 * @param {{ success: boolean, testsPassed?: number, testsFailed?: number }} outcome
 */
export function updateConfidenceFromOutcome(memoryDB, fixId, outcome) {
  try {
    const entry = memoryDB
      ? memoryDB.prepare('SELECT * FROM engineering_memory WHERE id = ?').get(fixId)
      : null;

    if (!entry) return;

    const currentRate = entry.success_rate ?? 0.5;
    const useCount    = (entry.use_count ?? 0) + 1;
    // Exponential moving average
    const newRate     = currentRate * 0.7 + (outcome.success ? 1 : 0) * 0.3;

    updateMemory(memoryDB, fixId, {
      success_rate: +newRate.toFixed(3),
      use_count:    useCount,
    });
    recordUsage(memoryDB, fixId);
  } catch (err) {
    console.error('[fixConfidenceEngine] updateConfidenceFromOutcome error:', err.message);
  }
}
