// patch/RollbackManager.js - restore files from backups and update patch status

import { existsSync, copyFileSync, unlinkSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { loadBackupManifest } from './BackupManager.js';
import { logger } from '../core/logger.js';

/**
 * Roll back a patch by restoring all backed-up files.
 *
 * @param {string} patchId
 * @param {string} workspaceRoot
 * @returns {{ success: boolean, restored: string[], errors: string[] }}
 */
export function rollbackPatch(patchId, workspaceRoot) {
  const manifest = loadBackupManifest(workspaceRoot, patchId);

  if (!manifest) {
    return {
      success: false,
      restored: [],
      errors: [`No backup manifest found for patch ${patchId} — cannot rollback`],
    };
  }

  const restored = [];
  const errors   = [];

  for (const entry of manifest.entries) {
    const targetAbs = resolve(workspaceRoot, entry.relPath);

    if (!entry.existed) {
      // File was created by the patch — delete it on rollback
      if (existsSync(targetAbs)) {
        try {
          unlinkSync(targetAbs);
          restored.push(`deleted (new file): ${entry.relPath}`);
          logger.info('rollback: deleted new file', { file: entry.relPath, patchId });
        } catch (err) {
          errors.push(`Could not delete ${entry.relPath}: ${err.message}`);
        }
      }
      continue;
    }

    // Restore from backup
    if (!existsSync(entry.backupPath)) {
      errors.push(`Backup not found: ${entry.backupPath}`);
      continue;
    }

    try {
      mkdirSync(dirname(targetAbs), { recursive: true });
      copyFileSync(entry.backupPath, targetAbs);
      restored.push(entry.relPath);
      logger.info('rollback: restored file', { file: entry.relPath, from: entry.backupPath, patchId });
    } catch (err) {
      errors.push(`Could not restore ${entry.relPath}: ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    restored,
    errors,
    patchId,
    rolledBackAt: new Date().toISOString(),
  };
}

/**
 * Generate rollback commands for manual execution (if automated rollback isn't desired).
 */
export function generateRollbackCommands(patchId, workspaceRoot) {
  const manifest = loadBackupManifest(workspaceRoot, patchId);
  if (!manifest) return [];

  return manifest.entries
    .filter((e) => e.existed && e.backupPath)
    .map((e) => {
      const target = join(workspaceRoot, e.relPath);
      return `cp "${e.backupPath}" "${target}"`;
    });
}
