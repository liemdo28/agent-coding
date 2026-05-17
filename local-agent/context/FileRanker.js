// context/FileRanker.js - Ranks files by relevance to a task description
import { statSync, existsSync } from 'fs';
import { extname, basename } from 'path';

export const SCORE_WEIGHTS = {
  keywordMatch:   30,  // per keyword match in filename/path
  importDepth1:   20,  // imported from entrypoint at depth 1
  importDepth2:   10,  // imported from entrypoint at depth 2
  recentChange:   15,  // modified within last 24h
  entrypoint:     25,  // IS an entrypoint
  errorMentioned: 40,  // file path appears in task description
  extBonus:       10,  // .js/.ts/.jsx/.tsx
  extBonusMinor:   5,  // .json/.md
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'had', 'has', 'his', 'how', 'did', 'its', 'him',
  'let', 'too', 'any', 'she', 'may', 'use', 'get', 'set', 'add', 'new',
  'run', 'fix', 'see', 'make', 'that', 'this', 'with', 'from', 'into',
  'they', 'them', 'their', 'what', 'when', 'which', 'will', 'have', 'been',
  'file', 'code', 'test', 'into', 'also', 'just', 'then', 'than', 'some',
]);

const SOURCE_EXTS  = new Set(['.js', '.ts', '.jsx', '.tsx']);
const MINOR_EXTS   = new Set(['.json', '.md']);
const NOW_MS       = 24 * 60 * 60 * 1000; // 24h in ms

/**
 * Extracts meaningful keywords from a task description.
 * Splits on whitespace and camelCase, filters short/common words.
 *
 * @param {string} task - Task description
 * @returns {string[]} Meaningful keyword tokens
 */
export function extractKeywords(task) {
  // Split on whitespace and punctuation first
  const spaceSplit = task.split(/[\s\-_/\\.,;:!?()\[\]{}"'`]+/);

  const tokens = [];
  for (const word of spaceSplit) {
    if (!word) continue;
    // Split camelCase: fooBar → ['foo', 'Bar']
    const camelParts = word.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    for (const part of camelParts) {
      tokens.push(part.toLowerCase());
    }
  }

  return tokens
    .filter((t) => t.length >= 3)
    .filter((t) => !STOP_WORDS.has(t))
    .filter((t) => /^[a-z0-9]+$/.test(t)); // only alphanumeric tokens
}

/**
 * Extracts file paths mentioned in an error/task string.
 * Looks for patterns like `src/foo.js:42`
 *
 * @param {string} task          - Task or error message string
 * @param {string} workspaceRoot - Workspace root (unused, kept for API consistency)
 * @returns {string[]} File path strings found in task
 */
export function detectErrorFiles(task, workspaceRoot) {
  const pattern = /\b([\w./\\-]+\.(js|ts|jsx|tsx|py|json))(?::[0-9]+)?/g;
  const found = new Set();
  let m;
  while ((m = pattern.exec(task)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

/**
 * Computes a relevance score for a single file.
 *
 * @param {string} filePath  - Absolute or relative file path
 * @param {string} task      - Task description
 * @param {object} options   - Scoring options
 * @param {string[]} [options.keywords]     - Pre-extracted keywords (from extractKeywords)
 * @param {string[]} [options.errorFiles]   - Files mentioned in task/errors
 * @param {string[]} [options.entrypoints]  - Known entrypoint paths
 * @param {string[]} [options.recentFiles]  - Recently modified file paths
 * @param {Map}      [options.importGraph]  - Dependency graph Map<file, string[]>
 * @returns {number} Relevance score (higher = more relevant)
 */
export function scoreFile(filePath, task, options = {}) {
  const {
    keywords = extractKeywords(task),
    errorFiles = [],
    entrypoints = [],
    recentFiles = [],
    importGraph = new Map(),
  } = options;

  let score = 0;
  const lowerPath = filePath.toLowerCase();
  const base      = basename(lowerPath);

  // ── Keyword match ───────────────────────────────────────────────────────
  for (const kw of keywords) {
    if (lowerPath.includes(kw)) {
      score += SCORE_WEIGHTS.keywordMatch;
    }
  }

  // ── Error file mentioned ────────────────────────────────────────────────
  for (const errFile of errorFiles) {
    if (filePath.includes(errFile) || lowerPath.includes(errFile.toLowerCase())) {
      score += SCORE_WEIGHTS.errorMentioned;
      break;
    }
  }

  // ── Entrypoint bonus ────────────────────────────────────────────────────
  if (entrypoints.some((ep) => ep === filePath || ep.includes(filePath) || filePath.includes(ep))) {
    score += SCORE_WEIGHTS.entrypoint;
  }

  // ── Import depth from entrypoints ───────────────────────────────────────
  // depth 1: this file is directly imported by an entrypoint
  for (const ep of entrypoints) {
    const deps = importGraph.get(ep) ?? [];
    if (deps.some((d) => d === filePath)) {
      score += SCORE_WEIGHTS.importDepth1;
      break;
    }
  }
  // depth 2: this file is imported by something imported by an entrypoint
  outer: for (const ep of entrypoints) {
    const depth1Deps = importGraph.get(ep) ?? [];
    for (const d1 of depth1Deps) {
      const depth2Deps = importGraph.get(d1) ?? [];
      if (depth2Deps.some((d2) => d2 === filePath)) {
        score += SCORE_WEIGHTS.importDepth2;
        break outer;
      }
    }
  }

  // ── Recent change ───────────────────────────────────────────────────────
  if (recentFiles.includes(filePath)) {
    score += SCORE_WEIGHTS.recentChange;
  } else {
    // Check mtime directly as a fallback
    try {
      if (existsSync(filePath)) {
        const st = statSync(filePath);
        if (Date.now() - st.mtimeMs < NOW_MS) {
          score += SCORE_WEIGHTS.recentChange;
        }
      }
    } catch { /* ignore */ }
  }

  // ── Extension bonus ─────────────────────────────────────────────────────
  const ext = extname(filePath).toLowerCase();
  if (SOURCE_EXTS.has(ext))      score += SCORE_WEIGHTS.extBonus;
  else if (MINOR_EXTS.has(ext))  score += SCORE_WEIGHTS.extBonusMinor;

  return score;
}

/**
 * Ranks a list of files by relevance to a task.
 *
 * @param {string[]} files  - Array of file paths (absolute or relative)
 * @param {string} task     - Task description
 * @param {object} options  - Same options as scoreFile
 * @returns {string[]} File paths sorted by descending score
 */
export function rankFiles(files, task, options = {}) {
  const keywords   = options.keywords   ?? extractKeywords(task);
  const errorFiles = options.errorFiles ?? detectErrorFiles(task, '');

  const withScores = files.map((f) => ({
    path: f,
    score: scoreFile(f, task, { ...options, keywords, errorFiles }),
  }));

  withScores.sort((a, b) => b.score - a.score);
  return withScores.map((f) => f.path);
}
