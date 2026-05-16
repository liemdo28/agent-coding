// patch/PatchManager.js - manage the full patch lifecycle with JSON storage

import {
  existsSync, mkdirSync, writeFileSync,
  readFileSync, readdirSync,
} from 'fs';
import { join, resolve } from 'path';
import { applyPatch }           from 'diff';
import { validatePatch }        from './PatchValidator.js';
import { backupPatchFiles }     from './BackupManager.js';
import { rollbackPatch as doRollback, generateRollbackCommands } from './RollbackManager.js';
import { logger }               from '../core/logger.js';

// Patch statuses
export const PATCH_STATUS = {
  PROPOSED:  'proposed',
  APPLIED:   'applied',
  REJECTED:  'rejected',
  ROLLED_BACK: 'rolled_back',
  FAILED:    'failed',
};

function patchesDir(workspaceRoot) {
  return join(workspaceRoot, '.local-agent', 'patches');
}

function patchFilePath(workspaceRoot, patchId) {
  return join(patchesDir(workspaceRoot), `${patchId}.json`);
}

function reportsDir(workspaceRoot) {
  return join(workspaceRoot, '.local-agent', 'reports');
}

function nextPatchId(workspaceRoot) {
  const dir = patchesDir(workspaceRoot);
  if (!existsSync(dir)) return 'PATCH-001';

  const existing = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const m = f.match(/PATCH-(\d+)\.json$/);
      return m ? parseInt(m[1], 10) : 0;
    });

  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `PATCH-${String(max + 1).padStart(3, '0')}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create and persist a new patch proposal (does NOT apply it).
 *
 * @param {object} opts
 * @param {string}   opts.task
 * @param {string}   opts.workspaceRoot
 * @param {{ filePath: string, patchText: string }[]} opts.diffs
 * @param {string}   [opts.riskLevel]
 * @param {string}   [opts.model]
 * @returns {PatchRecord}
 */
export function createPatch({ task, workspaceRoot, diffs, riskLevel, model }) {
  const patchId    = nextPatchId(workspaceRoot);
  const createdAt  = new Date().toISOString();
  const filesChanged = diffs.map((d) => d.filePath);

  // Validate each diff
  const validations = diffs.map((d) => ({
    ...validatePatch({ ...d, workspaceRoot }),
    filePath: d.filePath,
  }));
  const allValid = validations.every((v) => v.valid);

  // Compute overall risk
  const risks = validations.map((v) => v.riskLevel ?? 'low');
  const overallRisk = risks.includes('high') ? 'high' :
                      risks.includes('medium') ? 'medium' : (riskLevel ?? 'low');

  const patch = {
    patchId,
    task,
    createdAt,
    filesChanged,
    diffs,
    validations,
    status: PATCH_STATUS.PROPOSED,
    riskLevel: overallRisk,
    model: model ?? null,
    backupPath: null,
    appliedAt: null,
    rejectedAt: null,
    rolledBackAt: null,
    rollbackCommands: [],
    error: null,
  };

  // Save to disk
  const dir = patchesDir(workspaceRoot);
  mkdirSync(dir, { recursive: true });
  writeFileSync(patchFilePath(workspaceRoot, patchId), JSON.stringify(patch, null, 2));
  logger.info('patch created', { patchId, task, files: filesChanged.length, risk: overallRisk });

  return patch;
}

/**
 * Load a patch by ID.
 */
export function getPatch(patchId, workspaceRoot) {
  const filePath = patchFilePath(workspaceRoot, patchId);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * List all patches, sorted by createdAt descending.
 */
export function listPatches(workspaceRoot) {
  const dir = patchesDir(workspaceRoot);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function savePatch(patch, workspaceRoot) {
  writeFileSync(patchFilePath(workspaceRoot, patch.patchId), JSON.stringify(patch, null, 2));
}

/**
 * Apply a proposed patch (creates backup first, then applies each diff).
 */
export function applyPatchById(patchId, workspaceRoot) {
  const patch = getPatch(patchId, workspaceRoot);
  if (!patch) return { success: false, error: `Patch ${patchId} not found` };
  if (patch.status !== PATCH_STATUS.PROPOSED) {
    return { success: false, error: `Patch ${patchId} is ${patch.status} — can only apply proposed patches` };
  }

  // Re-validate
  const invalidDiffs = patch.diffs.filter((d) => {
    const v = validatePatch({ ...d, workspaceRoot });
    return !v.valid;
  });
  if (invalidDiffs.length > 0) {
    return { success: false, error: `Validation failed for: ${invalidDiffs.map((d) => d.filePath).join(', ')}` };
  }

  // Backup all files
  const backup = backupPatchFiles(patch.filesChanged, workspaceRoot, patchId);

  // Apply each diff
  const applied = [];
  const errors  = [];

  for (const diff of patch.diffs) {
    const absPath = resolve(workspaceRoot, diff.filePath);
    const original = existsSync(absPath) ? readFileSync(absPath, 'utf8') : '';
    const patched  = applyPatch(original, diff.patchText);

    if (patched === false) {
      errors.push(`Patch did not apply cleanly to ${diff.filePath}`);
    } else {
      try {
        writeFileSync(absPath, patched, 'utf8');
        applied.push(diff.filePath);
      } catch (err) {
        errors.push(`Write failed for ${diff.filePath}: ${err.message}`);
      }
    }
  }

  const rollbackCmds = generateRollbackCommands(patchId, workspaceRoot);

  // Update patch record
  patch.status      = errors.length > 0 ? PATCH_STATUS.FAILED : PATCH_STATUS.APPLIED;
  patch.appliedAt   = new Date().toISOString();
  patch.backupPath  = join(workspaceRoot, '.local-agent', 'backups', patchId);
  patch.rollbackCommands = rollbackCmds;
  patch.error       = errors.length > 0 ? errors.join('; ') : null;
  savePatch(patch, workspaceRoot);

  // Write patch report
  writePatchReport(patch, workspaceRoot, applied, errors);

  logger.info('patch applied', { patchId, applied: applied.length, errors: errors.length });

  return {
    success: errors.length === 0,
    patchId,
    applied,
    errors,
    backupPath: patch.backupPath,
    rollbackCommands: rollbackCmds,
  };
}

/**
 * Reject a proposed patch (marks it without applying).
 */
export function rejectPatch(patchId, workspaceRoot, reason = '') {
  const patch = getPatch(patchId, workspaceRoot);
  if (!patch) return { success: false, error: `Patch ${patchId} not found` };
  if (patch.status !== PATCH_STATUS.PROPOSED) {
    return { success: false, error: `Only proposed patches can be rejected` };
  }

  patch.status     = PATCH_STATUS.REJECTED;
  patch.rejectedAt = new Date().toISOString();
  patch.error      = reason || 'Rejected by user';
  savePatch(patch, workspaceRoot);
  logger.info('patch rejected', { patchId, reason });
  return { success: true, patchId };
}

/**
 * Roll back an applied patch.
 */
export function rollbackPatchById(patchId, workspaceRoot) {
  const patch = getPatch(patchId, workspaceRoot);
  if (!patch) return { success: false, error: `Patch ${patchId} not found` };
  if (patch.status !== PATCH_STATUS.APPLIED) {
    return { success: false, error: `Only applied patches can be rolled back` };
  }

  const result = doRollback(patchId, workspaceRoot);

  patch.status       = result.success ? PATCH_STATUS.ROLLED_BACK : PATCH_STATUS.FAILED;
  patch.rolledBackAt = new Date().toISOString();
  patch.error        = result.errors.length > 0 ? result.errors.join('; ') : null;
  savePatch(patch, workspaceRoot);
  logger.info('patch rolled back', { patchId, success: result.success });

  return { ...result, patchId };
}

// ── Patch report writer ─────────────────────────────────────────────────────

function writePatchReport(patch, workspaceRoot, applied, errors) {
  const dir = reportsDir(workspaceRoot);
  mkdirSync(dir, { recursive: true });

  const rollback = patch.rollbackCommands.map((c) => `\`\`\`bash\n${c}\n\`\`\``).join('\n');

  const md = `# Patch Report — ${patch.patchId}

_Generated: ${new Date().toISOString()}_

## Task
${patch.task}

## Files Changed
${patch.filesChanged.map((f) => `- \`${f}\``).join('\n')}

## Status
**${patch.status.toUpperCase()}**

## Risk Level
**${patch.riskLevel.toUpperCase()}**

## Backup Location
\`${patch.backupPath ?? 'n/a'}\`

## Apply Result
- Applied: ${applied.join(', ') || 'none'}
- Errors: ${errors.join(', ') || 'none'}

## Rollback Commands
${rollback || '_No rollback available_'}

## Diff Summary
${patch.diffs.map((d) => `### ${d.filePath}\n\`\`\`diff\n${d.patchText?.slice(0, 1000)}\n\`\`\``).join('\n\n')}
`;

  writeFileSync(join(dir, `patch-report-${patch.patchId}.md`), md);
}
