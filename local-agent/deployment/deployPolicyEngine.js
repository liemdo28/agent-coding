// deployment/deployPolicyEngine.js — enforces deployment policies
// Phase 9: blocks on QA failure, secrets, high rollback risk; warns on risky modules

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_POLICY = {
  blockOnQAFailure:         true,
  blockOnSecretsFound:      true,
  blockIfRollbackRiskAbove: 0.6,
  warnOnHighRiskModules:    true,
  requireManualApprovalFor: ['production'],
  qaFailureThreshold:       0,  // any failure blocks
};

/**
 * Load project-level policy from .local-agent/deploy-policy.json, merging with defaults.
 * @param {string} projectRoot
 * @returns {object}
 */
export function loadPolicy(projectRoot) {
  const filePath = join(projectRoot, '.local-agent', 'deploy-policy.json');
  if (!existsSync(filePath)) return { ...DEFAULT_POLICY };
  try {
    const custom = JSON.parse(readFileSync(filePath, 'utf8'));
    return { ...DEFAULT_POLICY, ...custom };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

/** Return the built-in default policy. */
export function getDefaultPolicy() {
  return { ...DEFAULT_POLICY };
}

/**
 * Check whether a deployment plan is allowed under the given policy.
 * @param {{ environment?: string, qaFailures?: number, secretsFound?: boolean, rollbackRisk?: number, changedFiles?: string[] }} deployPlan
 * @param {object} policy
 * @returns {{ allowed: boolean, violations: string[], warnings: string[] }}
 */
export function checkDeployPolicy(deployPlan, policy = DEFAULT_POLICY) {
  const violations = [];
  const warnings   = [];
  const env        = deployPlan.environment ?? 'development';

  // QA failure gate
  if (policy.blockOnQAFailure) {
    const failures = deployPlan.qaFailures ?? 0;
    if (failures > (policy.qaFailureThreshold ?? 0)) {
      violations.push(`QA failures (${failures}) exceed threshold (${policy.qaFailureThreshold ?? 0})`);
    }
  }

  // Secrets gate
  if (policy.blockOnSecretsFound && deployPlan.secretsFound) {
    violations.push('Secrets detected in deployment artifacts');
  }

  // Rollback risk gate
  const rollbackRisk = deployPlan.rollbackRisk ?? 0;
  if (rollbackRisk > (policy.blockIfRollbackRiskAbove ?? 0.6)) {
    violations.push(`Rollback risk too high: ${(rollbackRisk * 100).toFixed(0)}% (max: ${((policy.blockIfRollbackRiskAbove ?? 0.6) * 100).toFixed(0)}%)`);
  }

  // Manual approval required
  const requiresApproval = (policy.requireManualApprovalFor ?? []).includes(env);
  if (requiresApproval && !deployPlan.approved) {
    violations.push(`Manual approval required for environment: ${env}`);
  }

  // High-risk module warning
  if (policy.warnOnHighRiskModules) {
    const highRisk = ['auth', 'payment', 'config', 'schema', 'migration'];
    const risky    = (deployPlan.changedFiles ?? []).filter(f =>
      highRisk.some(kw => f.toLowerCase().includes(kw))
    );
    if (risky.length > 0) {
      warnings.push(`High-risk modules changed: ${risky.slice(0, 3).join(', ')}`);
    }
  }

  return {
    allowed:    violations.length === 0,
    violations,
    warnings,
  };
}
