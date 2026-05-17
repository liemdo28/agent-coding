// logs/LogScanner.js - Scan project for log files of all types

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';

const LOG_EXTENSIONS = new Set([
  '.log', '.out', '.err', '.txt', '.json', '.xml', '.csv'
]);

const LOG_DIR_PATTERNS = new Set([
  'logs', 'log', '.logs', '.log', 'tmp', 'temp',
  'node_modules/.cache', '.next', '.nuxt', '.cache',
  'dist', 'build', 'coverage', '.parcel-cache',
  '__pycache__', '.pytest_cache', 'target',
]);

const LOG_FILENAME_PATTERNS = [
  /^.*\.(log|out|err|txt)$/i,
  /^npm\.(debug|error|warn|info|verbose|deprecated)/i,
  /^yarn\.(error|warn|out)/i,
  /^(server|app|application|api|build|test|debug|error|warning|info)\.(log|txt)$/i,
  /^catalina\.(out|log)/i,
  /^access\.(log|json)/i,
  /^error\.(log|json)/i,
];

/**
 * Scan a directory for log files.
 * @param {string} rootDir
 * @returns {{ files: LogFileInfo[], totalSize: number, byType: Record<string, number> }}
 */
export function scanForLogFiles(rootDir) {
  const files = [];
  let totalSize = 0;
  const byType = {};

  function isLogFile(filePath, stat) {
    if (stat.isDirectory()) return false;
    const name = basename(filePath);
    const ext  = extname(filePath).toLowerCase();

    if (LOG_EXTENSIONS.has(ext)) return true;
    if (LOG_FILENAME_PATTERNS.some((p) => p.test(name))) return true;

    // Heuristic: files named "*.log" or containing timestamps
    if (/\d{4}-\d{2}-\d{2}/.test(name)) return true;
    if (name === 'package-log.json' || name === 'yarn.lock') return false;

    return false;
  }

  function walk(dir, depth = 0) {
    if (depth > 5) return; // limit recursion depth
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        // Scan important log dirs
        if (LOG_DIR_PATTERNS.has(entry.toLowerCase())) {
          walk(fullPath, depth + 1);
        } else if (depth < 2) {
          walk(fullPath, depth + 1);
        }
      } else if (isLogFile(fullPath, stat)) {
        files.push({
          path: fullPath,
          name: basename(fullPath),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          type: categorizeLogFile(entry),
        });
        totalSize += stat.size;
        byType[entry] = (byType[entry] || 0) + 1;
      }
    }
  }

  walk(rootDir);
  return { files, totalSize, byType };
}

function categorizeLogFile(filename) {
  const lower = filename.toLowerCase();
  if (/error|err|fail|fatal/.test(lower)) return 'error';
  if (/warn|warning/.test(lower)) return 'warning';
  if (/debug|trace/.test(lower)) return 'debug';
  if (/server|app|application|api/.test(lower)) return 'runtime';
  if (/build|compile|bundle/.test(lower)) return 'build';
  if (/test|qa/.test(lower)) return 'test';
  if (/patch|fix|change/.test(lower)) return 'patch';
  if (/access|request|http/.test(lower)) return 'access';
  return 'general';
}

/**
 * Get content preview of a log file.
 * @param {string} filePath
 * @param {number} maxLines
 * @returns {{ content: string, lineCount: number, encoding: string }}
 */
export function getLogPreview(filePath, maxLines = 200) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines   = content.split('\n');
    return {
      content:    lines.slice(0, maxLines).join('\n'),
      lineCount:  lines.length,
      encoding:   'utf8',
      truncated:  lines.length > maxLines,
    };
  } catch (err) {
    return { content: '', lineCount: 0, encoding: 'unknown', error: err.message };
  }
}