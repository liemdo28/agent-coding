// self-heal/IndexRepair.js — validate and rebuild the project index
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Verify the project index is present and non-empty.
 * @param {string} workspaceRoot
 * @returns {{ valid: boolean, fileCount: number, issues: string[] }}
 */
export function verifyIndex(workspaceRoot) {
  const idxDir  = join(workspaceRoot, '.local-agent', 'index');
  const issues  = [];

  if (!existsSync(idxDir)) {
    return { valid: false, fileCount: 0, issues: ['Index directory missing'] };
  }

  let fileCount = 0;
  let emptyCount = 0;

  for (const f of readdirSync(idxDir)) {
    const abs  = join(idxDir, f);
    const stat = statSync(abs);
    if (stat.isFile()) {
      fileCount++;
      if (stat.size === 0) emptyCount++;
    }
  }

  if (fileCount === 0) issues.push('Index directory is empty — run scan');
  if (emptyCount > 0)  issues.push(`${emptyCount} zero-byte index file(s)`);

  // Check project-map exists
  const pmPath = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (!existsSync(pmPath)) issues.push('project-map.json missing — run scan');

  return { valid: issues.length === 0, fileCount, emptyCount, issues };
}

/**
 * Repair index by removing zero-byte fragments and writing a rebuild marker.
 * Full rebuild is triggered by re-running scan; this clears corrupt artifacts.
 * @param {string} workspaceRoot
 * @param {{ dryRun?: boolean }} opts
 * @returns {{ removed: number, markerWritten: boolean, issues: string[] }}
 */
export function repairIndex(workspaceRoot, { dryRun = false } = {}) {
  const { issues, emptyCount } = verifyIndex(workspaceRoot);
  let removed = 0;

  if (!dryRun && emptyCount > 0) {
    const idxDir = join(workspaceRoot, '.local-agent', 'index');
    for (const f of readdirSync(idxDir)) {
      const abs  = join(idxDir, f);
      const stat = statSync(abs);
      if (stat.isFile() && stat.size === 0) {
        try {
          require('fs').unlinkSync(abs);
          removed++;
        } catch { /* skip */ }
      }
    }
  }

  // Write a rebuild-needed marker so next scan knows to do full rebuild
  let markerWritten = false;
  if (!dryRun) {
    const markerPath = join(workspaceRoot, '.local-agent', 'index-rebuild-needed');
    try {
      mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
      writeFileSync(markerPath, JSON.stringify({ requestedAt: new Date().toISOString(), reason: 'index-repair' }));
      markerWritten = true;
    } catch { /* ignore */ }
  }

  return { removed, markerWritten, issues, dryRun };
}
