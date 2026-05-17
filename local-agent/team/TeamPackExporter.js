// team/TeamPackExporter.js — export workspace knowledge packs for team sharing
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { validateSyncTarget } from './InternalPolicyManager.js';

// Secret patterns to strip before export
const SECRET_PATTERNS = [
  /["']?(?:api[_-]?key|access[_-]?token|secret[_-]?key|password|passwd|auth[_-]?token)["']?\s*[:=]\s*["']?\S+/gi,
  /Bearer\s+\S+/gi,
  /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g,
];

/**
 * Strip secrets from text content before export.
 * @param {string} content
 * @returns {string}
 */
export function sanitizeForExport(content) {
  let out = content;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

/**
 * Export a team knowledge pack (recipes, memory, policies) to a target directory.
 * @param {string} workspaceRoot
 * @param {string} targetDir — LAN path or NAS mount
 * @param {{ dryRun?: boolean, includeMemory?: boolean, includeRecipes?: boolean }} opts
 * @returns {ExportResult}
 */
export function exportPack(workspaceRoot, targetDir, opts = {}) {
  const { dryRun = false, includeMemory = true, includeRecipes = true } = opts;

  const check = validateSyncTarget(workspaceRoot, targetDir);
  if (!check.allowed) throw new Error(`Export denied: ${check.reason}`);

  if (!dryRun) mkdirSync(targetDir, { recursive: true });

  const exported = [];
  const errors   = [];

  const exportDir = (srcDir, label) => {
    if (!existsSync(srcDir)) return;
    const outDir = join(targetDir, label);
    if (!dryRun) mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(srcDir)) {
      const srcPath = join(srcDir, f);
      if (!statSync(srcPath).isFile()) continue;
      try {
        const raw       = readFileSync(srcPath, 'utf8');
        const sanitized = sanitizeForExport(raw);
        if (!dryRun) writeFileSync(join(outDir, f), sanitized, 'utf8');
        exported.push(`${label}/${f}`);
      } catch (err) {
        errors.push(`${label}/${f}: ${err.message}`);
      }
    }
  };

  if (includeMemory)  exportDir(join(workspaceRoot, '.local-agent', 'memory'),  'memory');
  if (includeRecipes) exportDir(join(workspaceRoot, '.local-agent', 'reports'), 'reports');

  // Export manifest
  const manifest = {
    exportedAt:    new Date().toISOString(),
    workspaceRoot, // stripped of secrets in consuming code
    fileCount:     exported.length,
    includeMemory,
    includeRecipes,
  };
  if (!dryRun) writeFileSync(join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { exported, errors, dryRun, manifestWritten: !dryRun };
}
