// deployment/rollbackPredictor.js — predicts rollback probability for a deployment
// Phase 9: factors: past rollback rate, risk score, module overlap

import { listDeployments } from './deploymentTracker.js';

/**
 * Predict rollback probability for a deployment plan.
 * @param {{ changedFiles?: string[], riskScore?: number, projectId?: string }} deploymentPlan
 * @param {object[]} history  — array of past deployment objects
 * @returns {{ probability: number, confidence: number, reasons: string[] }}
 */
export function predictRollback(deploymentPlan, history = []) {
  const reasons = [];
  let prob = 0.1; // base rate

  // ── Historical rollback rate for this project ─────────────────────────────
  if (history.length > 0) {
    const failures = history.filter(d => !d.success || d.rollbackReason).length;
    const rate     = failures / history.length;
    prob = prob * 0.4 + rate * 0.4;
    if (rate > 0.3) {
      reasons.push(`High historical rollback rate: ${(rate * 100).toFixed(0)}%`);
    }
  }

  // ── Risk score contribution ───────────────────────────────────────────────
  const riskScore = deploymentPlan.riskScore ?? 30;
  prob += (riskScore / 100) * 0.3;
  if (riskScore > 60) reasons.push(`High risk score: ${riskScore}/100`);

  // ── Module overlap with previously rolled-back deploys ────────────────────
  const changedFiles  = deploymentPlan.changedFiles ?? [];
  const rolledBack    = history.filter(d => !d.success || d.rollbackReason);
  let overlapCount    = 0;

  for (const past of rolledBack) {
    const pastFiles = past.metadata?.changedFiles ?? [];
    const overlap   = changedFiles.filter(f => pastFiles.includes(f)).length;
    overlapCount   += overlap;
  }

  if (overlapCount > 0) {
    prob += Math.min(0.2, overlapCount * 0.05);
    reasons.push(`${overlapCount} file(s) overlap with previously failed deploys`);
  }

  prob = Math.min(1, Math.max(0, prob));
  const confidence = history.length >= 5 ? 0.8 : history.length >= 2 ? 0.6 : 0.3;

  return { probability: +prob.toFixed(3), confidence, reasons };
}

/**
 * Retrieve rollback history for a project from the deploy DB.
 * @param {import('better-sqlite3').Database} db
 * @param {string} projectId
 * @param {number} limit
 * @returns {object[]}
 */
export function getRollbackHistory(db, projectId, limit = 20) {
  try {
    return listDeployments(db, { projectId, limit })
      .filter(d => !d.success || d.rollbackReason);
  } catch { return []; }
}
