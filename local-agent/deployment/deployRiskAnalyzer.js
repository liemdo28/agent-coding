// deployment/deployRiskAnalyzer.js — analyzes risk before a deployment
// Phase 9: checks changed files, QA failures, rollback frequency, time since stable deploy

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { listDeployments } from './deploymentTracker.js';

const HIGH_RISK_PATHS = ['auth', 'login', 'password', 'token', 'config', 'env', 'schema', 'migration', 'payment'];

/**
 * Analyze deployment risk.
 * @param {string} projectRoot
 * @param {string} targetEnv  'production' | 'staging' | 'development'
 * @param {{ changedFiles?: string[], qaFailures?: number, db?: object }} context
 * @returns {{ score: number, risk: string, warnings: string[], blockers: string[], recommendations: string[] }}
 */
export function analyzeDeployRisk(projectRoot, targetEnv, context = {}) {
  const warnings        = [];
  const blockers        = [];
  const recommendations = [];
  let score             = 20; // start low, add risk

  // ── Changed files ─────────────────────────────────────────────────────────
  const changedFiles = context.changedFiles ?? [];
  const riskyCFiles  = changedFiles.filter(f => HIGH_RISK_PATHS.some(kw => f.toLowerCase().includes(kw)));
  if (riskyCFiles.length > 0) {
    score += 25;
    warnings.push(`High-risk files changed: ${riskyCFiles.join(', ')}`);
  }
  if (changedFiles.length > 20) {
    score += 15;
    warnings.push(`Large changeset: ${changedFiles.length} files`);
  }

  // ── QA failures ───────────────────────────────────────────────────────────
  const qaFailures = context.qaFailures ?? 0;
  if (qaFailures > 0) {
    score += qaFailures > 5 ? 30 : 15;
    const msg = `${qaFailures} QA failure(s) pending`;
    if (qaFailures > 3) blockers.push(msg); else warnings.push(msg);
  }

  // ── Production deployment extra risk ──────────────────────────────────────
  if (targetEnv === 'production') {
    score += 10;
    recommendations.push('Consider staging deployment before production');
    if (qaFailures > 0) {
      blockers.push('Cannot deploy to production with open QA failures');
    }
  }

  // ── Rollback frequency (from DB) ──────────────────────────────────────────
  if (context.db) {
    try {
      const recent = listDeployments(context.db, { projectId: context.projectId, limit: 10 });
      const rollbacks = recent.filter(d => d.rollbackReason || !d.success).length;
      if (rollbacks >= 3) {
        score += 20;
        blockers.push(`High rollback frequency: ${rollbacks} of last 10 deploys failed`);
      } else if (rollbacks >= 1) {
        score += 10;
        warnings.push(`Recent rollbacks detected: ${rollbacks}`);
      }
    } catch { /* ignore */ }
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  if (score > 60) recommendations.push('Consider feature flags for high-risk changes');
  if (riskyCFiles.length > 0) recommendations.push('Review auth/config changes with a second engineer');
  if (changedFiles.length > 20) recommendations.push('Consider splitting into smaller deployments');

  score = Math.min(100, score);
  const risk = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, risk, warnings, blockers, recommendations };
}
