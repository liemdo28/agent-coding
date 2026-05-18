// eng-log/SmartFileSelector.js — minimum necessary file selection for tasks
import { loadFilePurposeIndex } from './FilePurposeIndexer.js';

/**
 * Given a task description, return the minimum set of relevant source files.
 * Uses file purpose index — no source scanning required.
 * @param {string} workspaceRoot
 * @param {string} task
 * @param {{ limit?: number, minScore?: number }} opts
 * @returns {Array<{ file: string, purpose: string, category: string, score: number, matchedTerms: string[] }>}
 */
export function selectFilesForTask(workspaceRoot, task, { limit = 8, minScore = 1 } = {}) {
  const index   = loadFilePurposeIndex(workspaceRoot);
  const terms   = task.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const results = [];

  for (const [file, info] of Object.entries(index)) {
    const haystack    = `${file} ${info.purpose} ${info.category} ${info.phase}`.toLowerCase();
    const matchedTerms = terms.filter((t) => haystack.includes(t));
    const score        = matchedTerms.length;
    if (score >= minScore) {
      results.push({ file, purpose: info.purpose, category: info.category, score, matchedTerms });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Rank a given list of file paths by relevance to a query.
 * @param {string} workspaceRoot
 * @param {string} query
 * @param {string[]} files — relative paths
 * @returns {Array<{ file: string, score: number }>}
 */
export function rankFilesByRelevance(workspaceRoot, query, files) {
  const index = loadFilePurposeIndex(workspaceRoot);
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);

  return files
    .map((file) => {
      const info     = index[file] ?? {};
      const haystack = `${file} ${info.purpose ?? ''} ${info.category ?? ''}`.toLowerCase();
      const score    = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { file, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Return minimum context recommendation for a task:
 * always-read log files + task-specific source files.
 * @param {string} workspaceRoot
 * @param {string} task
 * @returns {{ logFiles: string[], sourceFiles: string[], totalFiles: number }}
 */
export function getMinimumContext(workspaceRoot, task) {
  const selected = selectFilesForTask(workspaceRoot, task, { limit: 5 });
  return {
    logFiles: [
      '.local-agent/engineering-log/latest.md',
      '.local-agent/engineering-log/architecture/implementation-map.md',
      '.local-agent/engineering-log/file-purpose-index.json',
    ],
    sourceFiles:  selected.map((r) => r.file),
    totalFiles:   3 + selected.length,
  };
}
