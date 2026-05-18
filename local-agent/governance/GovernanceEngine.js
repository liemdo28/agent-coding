// governance/GovernanceEngine.js — local AI governance: policies, risk thresholds, restricted zones
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const GOV_FILE  = '.local-agent/governance.json';
const GOV_AUDIT = '.local-agent/governance-audit.jsonl';

const DEFAULTS = {
  patchApprovalRequired:  true,
  riskThreshold:          'medium',        // low|medium|high — auto-reject patches above this
  restrictedFiles:        ['.env', '*.pem', '*.key', 'secrets.*'],
  restrictedDirs:         ['.ssh', '.gnupg'],
  modelPolicy:            { allowedModels: ['*'], maxTokens: 8192, requireOffline: true },
  workflowApprovals:      { releaseCheck: true, qaRun: false, patchApply: true },
  roles: {
    admin:      { canModifyGovernance: true, canApprovePatch: true },
    senior_dev: { canModifyGovernance: false, canApprovePatch: true },
    dev:        { canModifyGovernance: false, canApprovePatch: false },
  },
  version: 1,
};

export function loadGovernance(workspaceRoot) {
  const p = join(workspaceRoot, GOV_FILE);
  if (!existsSync(p)) return { ...DEFAULTS };
  try { return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}

export function saveGovernance(workspaceRoot, policy) {
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  policy.updatedAt = new Date().toISOString();
  writeFileSync(join(workspaceRoot, GOV_FILE), JSON.stringify(policy, null, 2));
  auditLog(workspaceRoot, 'policy_updated', { keys: Object.keys(policy) });
}

/**
 * Check if a patch is allowed under current governance policy.
 * @param {string} workspaceRoot
 * @param {{ riskLevel: string, files: string[] }} patch
 * @returns {{ allowed: boolean, reason?: string, requiresApproval: boolean }}
 */
export function checkPatchPolicy(workspaceRoot, { riskLevel, files = [] }) {
  const gov       = loadGovernance(workspaceRoot);
  const riskRank  = { low: 1, medium: 2, high: 3, critical: 4 };
  const threshold = riskRank[gov.riskThreshold] ?? 2;
  const patchRisk = riskRank[riskLevel] ?? 2;

  // Check restricted files
  const restricted = files.filter((f) =>
    gov.restrictedFiles.some((pat) => {
      const regex = new RegExp('^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(f.split('/').pop());
    }) ||
    gov.restrictedDirs.some((d) => f.startsWith(d))
  );

  if (restricted.length > 0) {
    return { allowed: false, requiresApproval: true, reason: `Restricted files: ${restricted.join(', ')}` };
  }

  if (patchRisk > threshold) {
    return { allowed: false, requiresApproval: true, reason: `Risk "${riskLevel}" exceeds threshold "${gov.riskThreshold}"` };
  }

  return { allowed: true, requiresApproval: gov.patchApprovalRequired };
}

export function auditLog(workspaceRoot, action, meta = {}) {
  const entry = { ts: new Date().toISOString(), action, ...meta };
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  appendFileSync(join(workspaceRoot, GOV_AUDIT), JSON.stringify(entry) + '\n', 'utf8');
}

export function readGovernanceAudit(workspaceRoot, { limit = 50 } = {}) {
  const p = join(workspaceRoot, GOV_AUDIT);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    .slice(-limit);
}
