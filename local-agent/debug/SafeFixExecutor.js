// debug/SafeFixExecutor.js - safely apply and rollback file patches with backup

import {
  existsSync, readFileSync, writeFileSync,
  mkdirSync, copyFileSync,
} from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { createPatch, applyPatch }          from 'diff';
import { assertPathInWorkspace }             from '../core/policy.js';
import { logger }                            from '../core/logger.js';

// Patterns that must never be touched by auto-fix
const FORBIDDEN_TOUCH_PATTERNS = [
  /[/\\]\.env$/,
  /[/\\]\.env\.(local|prod|production|staging)/,
  /private[_-]?key/i,
  /credentials/i,
  /\.pem$/,
  /\.key$/,
  /secret/i,
  /id_rsa|id_ed25519|id_ecdsa/,
];

function isForbiddenPath(absPath) {
  return FORBIDDEN_TOUCH_PATTERNS.some((re) => re.test(absPath));
}

/**
 * Estimate patch risk (0=low, 1=high) based on what files it touches.
 */
export function estimatePatchRisk(patches) {
  if (!patches?.length) return 0;

  let maxRisk = 0;
  for (const patch of patches) {
    let risk = 0.2; // base
    const p = patch.filePath.toLowerCase();
    if (/auth|security|permission|crypto|token/i.test(p)) risk = Math.max(risk, 0.8);
    if (/database|migration|schema|model/i.test(p))       risk = Math.max(risk, 0.7);
    if (/config|env|settings/i.test(p))                   risk = Math.max(risk, 0.6);
    if (/test|spec/i.test(p))                              risk = Math.max(risk, 0.2);
    maxRisk = Math.max(maxRisk, risk);
  }
  return +maxRisk.toFixed(3);
}

/**
 * Create a backup of a file and return the backup path.
 */
function backupFile(absPath, backupsDir) {
  const ts   = Date.now();
  const name = basename(absPath).replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = join(backupsDir, `${name}.${ts}.bak`);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(absPath, dest);
  return dest;
}

/**
 * Apply a unified diff patch string to a file.
 *
 * @param {string} filePath  - Relative path within workspace
 * @param {string} patchText - Unified diff text
 * @param {string} workspaceRoot
 * @param {string} backupsDir
 * @returns {{ success, backupPath, rollbackCmd, error? }}
 */
export function applyFilePatch(filePath, patchText, workspaceRoot, backupsDir) {
  const absPath = resolve(workspaceRoot, filePath);

  // Security checks
  try { assertPathInWorkspace(absPath, workspaceRoot); }
  catch (err) { return { success: false, error: err.message }; }

  if (isForbiddenPath(absPath)) {
    return { success: false, error: `Patch rejected: "${filePath}" is a protected file` };
  }

  if (!existsSync(absPath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const original = readFileSync(absPath, 'utf8');
  const patched  = applyPatch(original, patchText);

  if (patched === false) {
    return { success: false, error: `Patch did not apply cleanly to ${filePath}` };
  }

  // Backup first
  const backupPath = backupFile(absPath, backupsDir);

  // Write patched content
  writeFileSync(absPath, patched, 'utf8');

  logger.info('patch applied', { file: filePath, backup: backupPath });

  return {
    success:     true,
    filePath,
    backupPath,
    rollbackCmd: `cp "${backupPath}" "${absPath}"`,
    originalSize: original.length,
    patchedSize:  patched.length,
  };
}

/**
 * Generate a unified diff between original and proposed content.
 */
export function generateDiff(filePath, originalContent, proposedContent) {
  return createPatch(filePath, originalContent, proposedContent, 'original', 'proposed');
}

/**
 * Rollback a file from its backup.
 */
export function rollbackFile(backupPath, targetAbsPath, workspaceRoot) {
  try { assertPathInWorkspace(targetAbsPath, workspaceRoot); }
  catch (err) { return { success: false, error: err.message }; }

  if (!existsSync(backupPath)) {
    return { success: false, error: `Backup not found: ${backupPath}` };
  }

  copyFileSync(backupPath, targetAbsPath);
  logger.info('rollback applied', { file: targetAbsPath, from: backupPath });
  return { success: true, restoredFrom: backupPath };
}

/**
 * Apply a batch of patch proposals returned by the LLM.
 * Each proposal: { filePath, patchText, risk }
 */
export async function applyPatchBatch(proposals, workspaceRoot, config) {
  const backupsDir = join(workspaceRoot, '.local-agent', 'backups');
  const patchesDir = join(workspaceRoot, '.local-agent', 'patches');
  mkdirSync(backupsDir, { recursive: true });
  mkdirSync(patchesDir, { recursive: true });

  const maxRisk    = config?.retryConfig?.maxPatchRisk ?? 0.75;
  const maxFiles   = config?.retryConfig?.maxFilesChangedPerLoop ?? 10;
  const results    = [];
  let   applied    = 0;

  for (const proposal of proposals.slice(0, maxFiles)) {
    if (proposal.risk > maxRisk) {
      results.push({
        filePath: proposal.filePath,
        success:  false,
        skipped:  true,
        reason:   `Patch risk ${proposal.risk} exceeds limit ${maxRisk}`,
      });
      continue;
    }

    const result = applyFilePatch(proposal.filePath, proposal.patchText, workspaceRoot, backupsDir);
    results.push({ ...result, filePath: proposal.filePath, risk: proposal.risk });

    if (result.success) {
      // Save patch file for audit
      const ts = Date.now();
      const patchName = `${basename(proposal.filePath)}.${ts}.patch`;
      writeFileSync(join(patchesDir, patchName), proposal.patchText, 'utf8');
      applied++;
    }
  }

  return { applied, results, backupsDir, patchesDir };
}
