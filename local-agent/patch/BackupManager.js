// patch/BackupManager.js - create and manage file backups before patching

import {
  existsSync, mkdirSync, copyFileSync,
  readdirSync, readFileSync, writeFileSync,
} from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';
import { logger } from '../core/logger.js';

/**
 * Create a backup of a file, preserving relative path structure.
 *
 * Backup location:
 *   .local-agent/backups/<patchId>/<relative-path>
 *
 * @param {string} absFilePath  - Absolute path to file to back up
 * @param {string} workspaceRoot
 * @param {string} patchId
 * @returns {{ backupPath: string, relPath: string } | null}
 */
export function backupFile(absFilePath, workspaceRoot, patchId) {
  if (!existsSync(absFilePath)) return null; // file doesn't exist yet (new file)

  const relPath   = relative(workspaceRoot, absFilePath);
  const backupDir = join(workspaceRoot, '.local-agent', 'backups', patchId);
  const backupPath = join(backupDir, relPath);

  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(absFilePath, backupPath);

  logger.info('backup created', { file: relPath, patchId, backupPath });
  return { backupPath, relPath };
}

/**
 * Back up all files that a patch touches.
 *
 * @param {string[]} filePaths  - Relative paths within workspace
 * @param {string} workspaceRoot
 * @param {string} patchId
 * @returns {BackupManifest}
 */
export function backupPatchFiles(filePaths, workspaceRoot, patchId) {
  const entries = [];

  for (const relPath of filePaths) {
    const absPath = resolve(workspaceRoot, relPath);
    const result  = backupFile(absPath, workspaceRoot, patchId);
    if (result) {
      entries.push({ relPath, backupPath: result.backupPath, existed: true });
    } else {
      entries.push({ relPath, backupPath: null, existed: false }); // new file
    }
  }

  // Write manifest for the patch
  const manifestPath = join(workspaceRoot, '.local-agent', 'backups', patchId, 'manifest.json');
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({
    patchId,
    createdAt: new Date().toISOString(),
    workspaceRoot,
    entries,
  }, null, 2));

  return { patchId, entries, manifestPath };
}

/**
 * Load the backup manifest for a patch.
 */
export function loadBackupManifest(workspaceRoot, patchId) {
  const manifestPath = join(workspaceRoot, '.local-agent', 'backups', patchId, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * List all existing backup patch IDs.
 */
export function listBackups(workspaceRoot) {
  const backupsRoot = join(workspaceRoot, '.local-agent', 'backups');
  if (!existsSync(backupsRoot)) return [];
  return readdirSync(backupsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
