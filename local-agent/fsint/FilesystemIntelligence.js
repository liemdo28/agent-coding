// fsint/FilesystemIntelligence.js — filesystem health analysis
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, extname, basename, relative } from 'path';
import { createHash } from 'crypto';

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build', '.cache']);

const JUNK_PATTERNS = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^desktop\.ini$/,
  /~$/,
  /\.swp$/,
  /\.swo$/,
  /\.orig$/,
  /\.bak$/,
];

const ARTIFACT_DIRS = new Set(['dist', 'build', 'out', '.next', '.nuxt', '__pycache__', 'coverage']);
const OVERSIZED_DIR_MB = 500;

/**
 * Walk directory tree, collecting file info.
 * @param {string} rootDir
 * @param {{ maxDepth?: number }} opts
 * @returns {FileEntry[]}
 */
function walkFiles(rootDir, { maxDepth = 8 } = {}) {
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(dir, name);
      let stat;
      try { stat = statSync(abs); } catch { continue; }
      if (stat.isDirectory()) { walk(abs, depth + 1); }
      else if (stat.isFile())  results.push({ abs, name, size: stat.size, mtime: stat.mtimeMs });
    }
  }
  walk(rootDir, 0);
  return results;
}

/**
 * Compute a fast content hash (first 64KB only for speed).
 * @param {string} abs
 * @returns {string|null}
 */
function quickHash(abs) {
  try {
    const buf = Buffer.alloc(65536);
    const fd  = require('fs').openSync(abs, 'r');
    const n   = require('fs').readSync(fd, buf, 0, 65536, 0);
    require('fs').closeSync(fd);
    return createHash('md5').update(buf.slice(0, n)).digest('hex');
  } catch { return null; }
}

/**
 * Full filesystem scan.
 * @param {string} projectDir
 * @returns {FsScanResult}
 */
export function scanFilesystem(projectDir) {
  const files   = walkFiles(projectDir);
  const junk    = files.filter((f) => JUNK_PATTERNS.some((p) => p.test(f.name)));
  const totalMB = +(files.reduce((s, f) => s + f.size, 0) / 1048576).toFixed(1);

  // Orphan files: files with no obvious owner (no import, in root, suspicious extension)
  const ORPHAN_EXTS = new Set(['.log', '.tmp', '.bak', '.orig', '.swp']);
  const orphans = files.filter((f) => ORPHAN_EXTS.has(extname(f.name)));

  // Oversized folders (non-node_modules)
  const dirSizes = {};
  for (const f of files) {
    const rel  = relative(projectDir, f.abs);
    const topDir = rel.split('/')[0];
    if (!SKIP_DIRS.has(topDir)) dirSizes[topDir] = (dirSizes[topDir] ?? 0) + f.size;
  }
  const oversized = Object.entries(dirSizes)
    .filter(([, bytes]) => bytes > OVERSIZED_DIR_MB * 1048576)
    .map(([dir, bytes]) => ({ dir, sizeMB: +(bytes / 1048576).toFixed(1) }));

  // Stale artifacts
  const staleArtifacts = [];
  for (const art of ARTIFACT_DIRS) {
    const abs = join(projectDir, art);
    if (existsSync(abs)) {
      let sz = 0;
      try { walkFiles(abs).forEach((f) => sz += f.size); } catch { /* skip */ }
      staleArtifacts.push({ dir: art, sizeMB: +(sz / 1048576).toFixed(1) });
    }
  }

  return {
    totalFiles:      files.length,
    totalMB,
    junkFiles:       junk.map((f) => ({ path: relative(projectDir, f.abs), size: f.size })),
    orphanFiles:     orphans.map((f) => ({ path: relative(projectDir, f.abs), size: f.size })),
    oversizedDirs:   oversized,
    staleArtifacts,
    issues: [
      ...(junk.length    ? [{ type: 'junk',      count: junk.length }]    : []),
      ...(orphans.length  ? [{ type: 'orphans',   count: orphans.length }]  : []),
      ...(oversized.length ? [{ type: 'oversized', count: oversized.length }] : []),
    ],
  };
}

/**
 * Find duplicate files by content hash.
 * @param {string} projectDir
 * @param {{ minSizeBytes?: number }} opts
 * @returns {DuplicateGroup[]}
 */
export function findDuplicates(projectDir, { minSizeBytes = 1024 } = {}) {
  const files   = walkFiles(projectDir).filter((f) => f.size >= minSizeBytes);
  const bySize  = {};
  for (const f of files) {
    bySize[f.size] = bySize[f.size] ?? [];
    bySize[f.size].push(f);
  }

  const groups = [];
  for (const candidates of Object.values(bySize)) {
    if (candidates.length < 2) continue;
    const byHash = {};
    for (const f of candidates) {
      const h = quickHash(f.abs);
      if (!h) continue;
      byHash[h] = byHash[h] ?? [];
      byHash[h].push(f.abs);
    }
    for (const [hash, paths] of Object.entries(byHash)) {
      if (paths.length > 1) groups.push({ hash, paths, count: paths.length, sizeBytes: candidates[0].size });
    }
  }
  return groups;
}

/**
 * Build a cleanup plan (what to remove and estimated savings).
 * @param {FsScanResult} scan
 * @returns {CleanupPlan}
 */
export function buildCleanupPlan(scan) {
  const steps = [];
  let savedBytes = 0;

  for (const f of scan.junkFiles) {
    steps.push({ action: 'delete', reason: 'junk file', path: f.path, bytes: f.size });
    savedBytes += f.size;
  }
  for (const art of scan.staleArtifacts) {
    steps.push({ action: 'delete_dir', reason: 'stale build artifact', path: art.dir, bytes: art.sizeMB * 1048576 });
    savedBytes += art.sizeMB * 1048576;
  }

  return {
    steps,
    totalSteps:  steps.length,
    savedMB:     +(savedBytes / 1048576).toFixed(1),
    note: 'Cleanup plan only — run with --apply to execute (creates backups first)',
  };
}
