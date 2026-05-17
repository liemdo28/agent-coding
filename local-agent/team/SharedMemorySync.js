// team/SharedMemorySync.js — export/import agent memory for LAN/NAS team sharing
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { validateSyncTarget } from './InternalPolicyManager.js';
import { sanitizeForExport }  from './TeamPackExporter.js';

const MEMORY_DIR = '.local-agent/memory';

/**
 * Export memory files to a shared LAN/NAS folder.
 * @param {string} workspaceRoot
 * @param {string} targetDir — absolute path to shared folder (LAN or NAS mount)
 * @param {{ dryRun?: boolean }} opts
 * @returns {{ exported: number, skipped: number, errors: string[], totalBytes: number }}
 */
export function exportMemory(workspaceRoot, targetDir, { dryRun = false } = {}) {
  const check = validateSyncTarget(workspaceRoot, targetDir);
  if (!check.allowed) throw new Error(`Export denied: ${check.reason}`);

  const srcDir = join(workspaceRoot, MEMORY_DIR);
  if (!existsSync(srcDir)) return { exported: 0, skipped: 0, errors: [], totalBytes: 0 };

  let exported = 0, skipped = 0, totalBytes = 0;
  const errors = [];

  if (!dryRun) mkdirSync(targetDir, { recursive: true });

  for (const f of readdirSync(srcDir)) {
    const srcPath = join(srcDir, f);
    const stat    = statSync(srcPath);
    if (!stat.isFile()) continue;

    try {
      const raw       = readFileSync(srcPath, 'utf8');
      const sanitized = sanitizeForExport(raw);
      const dstPath   = join(targetDir, f);
      totalBytes += Buffer.byteLength(sanitized, 'utf8');
      if (!dryRun) writeFileSync(dstPath, sanitized, 'utf8');
      exported++;
    } catch (err) {
      errors.push(`${f}: ${err.message}`);
      skipped++;
    }
  }

  return { exported, skipped, errors, totalBytes, dryRun };
}

/**
 * Import memory files from a shared LAN/NAS folder into workspace.
 * @param {string} workspaceRoot
 * @param {string} sourceDir — absolute path to shared folder
 * @param {{ dryRun?: boolean, overwrite?: boolean }} opts
 * @returns {{ imported: number, skipped: number, errors: string[] }}
 */
export function importMemory(workspaceRoot, sourceDir, { dryRun = false, overwrite = false } = {}) {
  if (!existsSync(sourceDir)) throw new Error(`Source directory not found: ${sourceDir}`);

  const check = validateSyncTarget(workspaceRoot, sourceDir);
  if (!check.allowed) throw new Error(`Import denied: ${check.reason}`);

  const dstDir = join(workspaceRoot, MEMORY_DIR);
  if (!dryRun) mkdirSync(dstDir, { recursive: true });

  let imported = 0, skipped = 0;
  const errors = [];

  for (const f of readdirSync(sourceDir)) {
    const srcPath = join(sourceDir, f);
    const stat    = statSync(srcPath);
    if (!stat.isFile()) continue;

    const dstPath = join(dstDir, f);
    if (!overwrite && existsSync(dstPath)) { skipped++; continue; }

    try {
      if (!dryRun) copyFileSync(srcPath, dstPath);
      imported++;
    } catch (err) {
      errors.push(`${f}: ${err.message}`);
    }
  }

  return { imported, skipped, errors, dryRun };
}
