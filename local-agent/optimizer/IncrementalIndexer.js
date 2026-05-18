// optimizer/IncrementalIndexer.js — only re-index changed files since last scan
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MANIFEST_FILE = '.local-agent/index-manifest.json';

/**
 * Load the existing index manifest (file → mtime map).
 * @param {string} workspaceRoot
 * @returns {Object} manifest
 */
export function loadManifest(workspaceRoot) {
  const p = join(workspaceRoot, MANIFEST_FILE);
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

/**
 * Save the index manifest.
 * @param {string} workspaceRoot
 * @param {Object} manifest
 */
export function saveManifest(workspaceRoot, manifest) {
  const p = join(workspaceRoot, MANIFEST_FILE);
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  writeFileSync(p, JSON.stringify(manifest, null, 2));
}

/**
 * Given a list of files, return only those that changed since the last manifest.
 * @param {string} workspaceRoot
 * @param {string[]} allFiles — absolute paths
 * @returns {{ changed: string[], unchanged: number, newFiles: string[], deleted: string[] }}
 */
export function detectChanges(workspaceRoot, allFiles) {
  const manifest = loadManifest(workspaceRoot);
  const changed  = [];
  const newFiles = [];

  for (const f of allFiles) {
    try {
      const mtime = statSync(f).mtimeMs;
      if (!(f in manifest)) {
        newFiles.push(f);
        changed.push(f);
      } else if (manifest[f] !== mtime) {
        changed.push(f);
      }
    } catch { /* file unreadable — skip */ }
  }

  const allSet  = new Set(allFiles);
  const deleted = Object.keys(manifest).filter((k) => !allSet.has(k));

  return { changed, unchanged: allFiles.length - changed.length, newFiles, deleted };
}

/**
 * Update the manifest after indexing a batch of files.
 * @param {string} workspaceRoot
 * @param {string[]} indexedFiles
 * @param {string[]} deletedFiles
 */
export function updateManifest(workspaceRoot, indexedFiles, deletedFiles = []) {
  const manifest = loadManifest(workspaceRoot);
  for (const f of indexedFiles) {
    try { manifest[f] = statSync(f).mtimeMs; } catch { /* skip */ }
  }
  for (const f of deletedFiles) delete manifest[f];
  saveManifest(workspaceRoot, manifest);
}
