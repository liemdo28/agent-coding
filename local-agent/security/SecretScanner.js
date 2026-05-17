// security/SecretScanner.js - scan content and files for leaked secrets
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

/**
 * Patterns used to detect common secrets in source files and text content.
 * `snippet` in results is always '[REDACTED]' — actual secret values are never stored.
 */
export const SECRET_PATTERNS = [
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{32,}/g,
    severity: 'HIGH',
  },
  {
    name: 'AWS Access Key ID',
    pattern: /AKIA[A-Z0-9]{16}/g,
    severity: 'HIGH',
  },
  {
    name: 'GitHub Personal Access Token (classic)',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'HIGH',
  },
  {
    name: 'GitHub Personal Access Token (fine-grained)',
    pattern: /github_pat_[a-zA-Z0-9_]{82}/g,
    severity: 'HIGH',
  },
  {
    name: 'Generic API Key',
    pattern: /api[_-]?key\s*[:=]\s*['"]?[\w-]{16,}/gi,
    severity: 'MEDIUM',
  },
  {
    name: 'Password in Code',
    pattern: /password\s*[:=]\s*['"][\w!@#$%^&*]{8,}/gi,
    severity: 'HIGH',
  },
  {
    name: 'Basic Auth URL',
    pattern: /https?:\/\/[^:]+:[^@]{6,}@/g,
    severity: 'HIGH',
  },
  {
    name: 'Private Key Header',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    severity: 'HIGH',
  },
  {
    name: 'JSON Web Token (JWT)',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: 'MEDIUM',
  },
  {
    name: 'Database Connection String with Password',
    pattern: /(?:mongodb|postgresql|mysql):\/\/[^:]+:[^@]+@/gi,
    severity: 'HIGH',
  },
];

/**
 * Directories to skip when scanning recursively.
 */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

/**
 * Detect if a Buffer/string looks like a binary file (contains null bytes).
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
function isBinary(buf) {
  // Scan the first 8 KB for null bytes — reliable binary detector
  const sample = buf.slice(0, 8192);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

/**
 * Scan a string of content for secret patterns.
 *
 * @param {string} content - Raw text content to scan
 * @param {string} [label=''] - A label for the source (e.g. file path) used in results
 * @returns {Array<{
 *   name: string,
 *   severity: 'HIGH'|'MEDIUM',
 *   line: number,
 *   column: number,
 *   snippet: '[REDACTED]',
 *   label: string,
 * }>}
 */
export function scanContent(content, label = '') {
  const findings = [];
  const lines = content.split('\n');

  for (const { name, pattern, severity } of SECRET_PATTERNS) {
    // Reset lastIndex because patterns use the /g flag
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Determine line and column from match index
      const before = content.slice(0, match.index);
      const lineNum = (before.match(/\n/g) || []).length + 1;
      const lastNewline = before.lastIndexOf('\n');
      const column = match.index - lastNewline; // 1-based column

      findings.push({
        name,
        severity,
        line: lineNum,
        column,
        snippet: '[REDACTED]',
        label,
      });

      // Prevent infinite loops on zero-width matches
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }

    // Always reset after use
    pattern.lastIndex = 0;
  }

  return findings;
}

/**
 * Scan a single file for secrets.
 * Binary files are skipped automatically.
 *
 * @param {string} filePath - Absolute or relative path to the file
 * @returns {Array<{ name: string, severity: string, line: number, column: number, snippet: string, label: string }>}
 */
export function scanFile(filePath) {
  const abs = resolve(filePath);

  if (!existsSync(abs)) {
    return [];
  }

  let buf;
  try {
    buf = readFileSync(abs);
  } catch {
    return [];
  }

  if (isBinary(buf)) {
    return [];
  }

  let content;
  try {
    content = buf.toString('utf8');
  } catch {
    return [];
  }

  return scanContent(content, abs);
}

/**
 * Recursively scan a directory for secrets in all text files.
 *
 * @param {string} dirPath - Directory to scan
 * @param {string[]} [ignorePatterns=[]] - Additional path substrings to ignore
 * @returns {{
 *   findings: Array<{ name: string, severity: string, line: number, column: number, snippet: string, label: string }>,
 *   filesScanned: number,
 *   fileCount: number,
 * }}
 */
export function scanDirectory(dirPath, ignorePatterns = []) {
  const abs = resolve(dirPath);
  const allFindings = [];
  let filesScanned = 0;
  let fileCount = 0;

  function walk(currentPath) {
    let entries;
    try {
      entries = readdirSync(currentPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);

      // Check ignore patterns first
      const relPath = relative(abs, fullPath);
      if (ignorePatterns.some((p) => relPath.includes(p))) {
        continue;
      }

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (SKIP_DIRS.has(entry)) continue;
        walk(fullPath);
      } else if (stat.isFile()) {
        fileCount++;

        let buf;
        try {
          buf = readFileSync(fullPath);
        } catch {
          continue;
        }

        if (isBinary(buf)) continue;

        let content;
        try {
          content = buf.toString('utf8');
        } catch {
          continue;
        }

        filesScanned++;
        const fileFindings = scanContent(content, fullPath);
        allFindings.push(...fileFindings);
      }
    }
  }

  walk(abs);

  return {
    findings: allFindings,
    filesScanned,
    fileCount,
  };
}
