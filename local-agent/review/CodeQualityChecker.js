// review/CodeQualityChecker.js - Code quality and architecture review

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, extname, relative } from 'path';

// ── Complexity metrics ───────────────────────────────────────────────────────

const COMPLEXITY_PATTERNS = [
  /\bswitch\s*\(/g,
  /\bif\s*\(.*&&.*\)/g,
  /\bif\s*\(.*\|\|.*\)/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\btry\s*\{/g,
  /\bcatch\s*\(/g,
  /\.then\s*\(/g,
  /\.catch\s*\(/g,
  /\basync\s+\w+\s*\(/g,
];

/**
 * Calculate cyclomatic complexity score for a file.
 */
function calculateComplexity(content) {
  let score = 1;
  for (const pattern of COMPLEXITY_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) score += matches.length;
  }
  return score;
}

/**
 * Detect duplicate code blocks (simple hash-based approach).
 */
function detectDuplicateCode(files) {
  const lineHashes = {};
  const duplicates = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    // Use 3-line window hashes
    for (let i = 0; i < lines.length - 2; i++) {
      const window = lines.slice(i, i + 3).join('\n').trim();
      if (window.length < 20) continue;
      const hash = simpleHash(window);
      const key = `${hash}:${file.path}`;
      if (lineHashes[hash] && lineHashes[hash] !== file.path) {
        duplicates.push({
          type: 'duplicate_block',
          hash,
          files: [lineHashes[hash], file.path],
          lineStart: i + 1,
          lineEnd: i + 3,
        });
      } else {
        lineHashes[hash] = file.path;
      }
    }
  }

  return duplicates;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ── Code quality checks ──────────────────────────────────────────────────────

/**
 * Scan source files for quality issues.
 */
export function scanCodeQuality(projectRoot, options = {}) {
  const files = collectSourceFiles(projectRoot, options);
  const issues = [];
  const metrics = { files: 0, totalLines: 0, complexity: [] };

  for (const file of files) {
    metrics.files++;
    metrics.totalLines += file.lineCount;

    // Complexity check
    const complexity = calculateComplexity(file.content);
    metrics.complexity.push({ path: file.path, complexity });
    if (complexity > 20) {
      issues.push({
        type: 'high_complexity',
        severity: complexity > 40 ? 'error' : 'warn',
        file: file.path,
        message: `Cyclomatic complexity ${complexity} exceeds threshold (20)`,
        value: complexity,
      });
    }

    // File size check
    if (file.lineCount > 500) {
      issues.push({
        type: 'large_file',
        severity: file.lineCount > 1000 ? 'error' : 'warn',
        file: file.path,
        message: `File has ${file.lineCount} lines (threshold: 500)`,
        value: file.lineCount,
      });
    }

    // Error handling checks
    if (file.ext !== '.json' && file.ext !== '.md') {
      if (!file.content.includes('try') && file.lineCount > 100) {
        issues.push({
          type: 'missing_error_handling',
          severity: 'info',
          file: file.path,
          message: 'Large file (>100 lines) may benefit from error handling',
        });
      }

      // Console.log in production files
      if (file.path.includes('/src/') && file.content.includes('console.log')) {
        issues.push({
          type: 'debug_statement',
          severity: 'info',
          file: file.path,
          message: 'console.log found in source code',
        });
      }

      // TODO/FIXME detection
      const todos = file.content.match(/\b(TODO|FIXME|HACK|XXX|NOTE):?\s*(.*)/gi);
      if (todos) {
        for (const todo of todos) {
          issues.push({
            type: 'todo_comment',
            severity: 'info',
            file: file.path,
            message: todo.trim(),
          });
        }
      }

      // Magic numbers
      const magicNumbers = file.content.match(/[^a-zA-Z_][0-9]{3,}[^a-zA-Z_]/g);
      if (magicNumbers && magicNumbers.length > 5) {
        issues.push({
          type: 'magic_numbers',
          severity: 'info',
          file: file.path,
          message: `${magicNumbers.length} potential magic numbers detected`,
        });
      }
    }
  }

  // Sort by severity
  const sorted = {
    errors:   issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warn'),
    info:     issues.filter((i) => i.severity === 'info'),
  };

  return { files: metrics, issues: sorted, total: issues.length };
}

/**
 * Scan for dead/unused code.
 */
export function scanDeadCode(projectRoot) {
  const files = collectSourceFiles(projectRoot, { extensions: ['.js', '.jsx', '.ts', '.tsx'] });
  const deadCode = [];

  // Detect unused exports
  for (const file of files) {
    const content = file.content;
    const exports = content.match(/export\s+(?:function|const|class|default)\s+(\w+)/g) || [];
    for (const exp of exports) {
      const match = exp.match(/export\s+(?:function|const|class|default)\s+(\w+)/);
      if (match) {
        const name = match[1];
        // Check if it's used within the file or imported elsewhere
        const localUses = (content.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
        if (localUses <= 1) { // 1 because export itself counts
          deadCode.push({
            type: 'unused_export',
            file: file.path,
            name,
            message: `Export '${name}' appears unused in ${file.path}`,
          });
        }
      }
    }

    // Empty catch blocks
    const emptyCatch = content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
    if (emptyCatch) {
      for (const block of emptyCatch) {
        deadCode.push({
          type: 'empty_catch',
          file: file.path,
          message: 'Empty catch block (errors silently swallowed)',
        });
      }
    }

    // Unreachable code after return
    const returnBlocks = content.match(/return[^;]*;[\s\n]*[^\s]/g);
    if (returnBlocks) {
      for (const block of returnBlocks) {
        deadCode.push({
          type: 'unreachable_code',
          file: file.path,
          message: 'Potential unreachable code after return',
        });
      }
    }
  }

  return { deadCode, count: deadCode.length };
}

/**
 * Analyze folder structure and architecture.
 */
export function analyzeArchitecture(projectRoot) {
  const structure = buildFolderStructure(projectRoot);
  const issues = [];

  // Check for flat structure (no src/ directory)
  const hasSrcDir = existsSync(join(projectRoot, 'src'));
  if (!hasSrcDir) {
    issues.push({
      type: 'missing_src_directory',
      severity: 'info',
      message: 'No src/ directory found — consider organizing code under src/',
    });
  }

  // Check for deep nesting
  const deepDirs = structure.filter((d) => d.depth > 4);
  if (deepDirs.length > 0) {
    issues.push({
      type: 'deep_nesting',
      severity: 'warn',
      message: `${deepDirs.length} directories nested more than 4 levels deep`,
      details: deepDirs.map((d) => d.path),
    });
  }

  // Check for mixed concerns
  const rootFiles = structure.filter((d) => d.depth === 0 && d.type === 'file');
  if (rootFiles.length > 10) {
    issues.push({
      type: 'cluttered_root',
      severity: 'warn',
      message: `${rootFiles.length} files in project root — consider organizing`,
    });
  }

  // Check for naming inconsistencies
  const namingIssues = checkNamingConsistency(structure);
  issues.push(...namingIssues);

  return {
    structure,
    issues,
    summary: {
      totalDirs: structure.filter((d) => d.type === 'dir').length,
      totalFiles: structure.filter((d) => d.type === 'file').length,
      maxDepth: Math.max(...structure.map((d) => d.depth), 0),
    },
  };
}

function checkNamingConsistency(structure) {
  const issues = [];
  const exts = {};

  for (const item of structure) {
    if (item.type === 'file' && item.ext) {
      const base = item.name.replace(item.ext, '');
      const ext = item.ext;
      if (!exts[ext]) exts[ext] = [];
      exts[ext].push({ base, path: item.path });
    }
  }

  // Check PascalCase vs camelCase inconsistency
  for (const [ext, files] of Object.entries(exts)) {
    const pascalCase = files.filter((f) => /^[A-Z]/.test(f.base));
    const camelCase  = files.filter((f) => /^[a-z]/.test(f.base));
    if (pascalCase.length > 0 && camelCase.length > 0) {
      issues.push({
        type: 'naming_inconsistency',
        severity: 'info',
        message: `Mixed PascalCase/camelCase for ${ext} files`,
      });
    }
  }

  return issues;
}

function buildFolderStructure(rootDir, depth = 0) {
  const items = [];
  if (depth > 6) return items;

  let entries;
  try { entries = readdirSync(rootDir, { withFileTypes: true }); }
  catch { return items; }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
    const fullPath = join(rootDir, entry.name);
    const ext = extname(entry.name);

    items.push({
      path: relative(rootDir, fullPath),
      name: entry.name,
      ext,
      type: entry.isDirectory() ? 'dir' : 'file',
      depth,
    });

    if (entry.isDirectory()) {
      items.push(...buildFolderStructure(fullPath, depth + 1));
    }
  }

  return items;
}

function collectSourceFiles(projectRoot, options = {}) {
  const extensions = options.extensions || [
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.rb', '.go', '.java', '.cs', '.php',
    '.vue', '.svelte', '.css', '.scss', '.less',
  ];

  const files = [];

  function walk(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = join(dir, entry.name);
      const ext = extname(entry.name).toLowerCase();

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (extensions.includes(ext)) {
        try {
          const stat  = statSync(fullPath);
          const content = readFileSync(fullPath, 'utf8');
          files.push({
            path: relative(projectRoot, fullPath),
            fullPath,
            ext,
            size: stat.size,
            lineCount: content.split('\n').length,
            content,
          });
        } catch { /* ignore unreadable files */ }
      }
    }
  }

  walk(projectRoot);
  return files;
}

/**
 * Run complete review.
 */
export async function runCodeReview(projectRoot, options = {}) {
  const { quality = true, architecture = true } = options;

  const result = {
    timestamp: new Date().toISOString(),
    project: projectRoot,
    quality: null,
    architecture: null,
  };

  if (quality) {
    result.quality = {
      metrics: scanCodeQuality(projectRoot, options),
      deadCode: scanDeadCode(projectRoot),
    };
  }

  if (architecture) {
    result.architecture = analyzeArchitecture(projectRoot);
  }

  return result;
}