// optimizer/ParallelScanner.js — scan large directory trees with concurrency control
import { readdirSync, statSync } from 'fs';
import { join, extname }         from 'path';

const DEFAULT_CONCURRENCY = 8;
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '__pycache__', '.cache', 'vendor',
]);

/**
 * Recursively collect all source files, respecting ignore patterns.
 * @param {string} rootDir
 * @param {{ extensions?: string[], maxDepth?: number, ignore?: string[] }} opts
 * @returns {string[]} absolute paths
 */
export function collectFiles(rootDir, opts = {}) {
  const exts     = new Set(opts.extensions ?? ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.cs', '.rb', '.php']);
  const maxDepth = opts.maxDepth ?? 20;
  const extraIgnore = new Set(opts.ignore ?? []);
  const results  = [];

  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }

    for (const name of entries) {
      if (IGNORED_DIRS.has(name) || extraIgnore.has(name) || name.startsWith('.')) continue;
      const abs = join(dir, name);
      let stat;
      try { stat = statSync(abs); } catch { continue; }

      if (stat.isDirectory()) {
        walk(abs, depth + 1);
      } else if (stat.isFile() && (exts.size === 0 || exts.has(extname(name)))) {
        results.push(abs);
      }
    }
  }

  walk(rootDir, 0);
  return results;
}

/**
 * Process files in batches with concurrency limit.
 * @param {string[]} files
 * @param {(file: string) => Promise<any>} processor
 * @param {{ concurrency?: number, onProgress?: (done: number, total: number) => void }} opts
 * @returns {Promise<Array<{ file: string, result?: any, error?: string }>>}
 */
export async function processInParallel(files, processor, opts = {}) {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const results     = [];
  let done          = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(processor));

    for (let j = 0; j < batch.length; j++) {
      const s = settled[j];
      results.push(s.status === 'fulfilled'
        ? { file: batch[j], result: s.value }
        : { file: batch[j], error: s.reason?.message ?? String(s.reason) });
      done++;
    }

    if (opts.onProgress) opts.onProgress(done, files.length);
  }

  return results;
}
