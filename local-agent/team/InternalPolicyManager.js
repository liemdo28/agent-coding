// team/InternalPolicyManager.js — manage team-internal policy rules (offline, LAN only)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const POLICY_FILE = '.local-agent/team-policy.json';

const DEFAULT_POLICY = {
  allowExportMemory:   true,
  allowImportMemory:   true,
  allowExportRecipes:  true,
  requireAuditLog:     true,
  sanitizeSecretsOnExport: true,
  allowedSyncTargets:  [],  // LAN paths or NAS mount points only
  maxExportSizeKB:     10240,
  version:             1,
};

/**
 * Load the team policy.
 * @param {string} workspaceRoot
 * @returns {TeamPolicy}
 */
export function loadPolicy(workspaceRoot) {
  const p = join(workspaceRoot, POLICY_FILE);
  if (!existsSync(p)) return { ...DEFAULT_POLICY };
  try {
    const saved = JSON.parse(readFileSync(p, 'utf8'));
    return { ...DEFAULT_POLICY, ...saved };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

/**
 * Save team policy overrides.
 * @param {string} workspaceRoot
 * @param {Partial<TeamPolicy>} overrides
 */
export function savePolicy(workspaceRoot, overrides) {
  const current = loadPolicy(workspaceRoot);
  const updated = { ...current, ...overrides, updatedAt: new Date().toISOString() };
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  writeFileSync(join(workspaceRoot, POLICY_FILE), JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * Validate a sync target path against policy.
 * Only LAN / local filesystem paths are allowed — no http(s) or cloud URLs.
 * @param {string} workspaceRoot
 * @param {string} targetPath
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function validateSyncTarget(workspaceRoot, targetPath) {
  // Block any URL with scheme (http, ftp, s3, etc.)
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(targetPath)) {
    return { allowed: false, reason: 'Network URLs are not allowed — use LAN path or mounted NAS only' };
  }

  const policy = loadPolicy(workspaceRoot);
  if (policy.allowedSyncTargets.length > 0) {
    const matched = policy.allowedSyncTargets.some((t) => targetPath.startsWith(t));
    if (!matched) return { allowed: false, reason: 'Target not in allowedSyncTargets policy list' };
  }

  return { allowed: true };
}
