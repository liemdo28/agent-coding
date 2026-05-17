// context/ImportTracer.js - Traces import/require dependency chains in source files
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve, extname } from 'path';

const EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];
const SKIP_DIRS = ['node_modules', '.local-agent', '.git', 'dist', 'build'];

/**
 * Extracts all import/require paths from file content.
 *
 * @param {string} filePath - Absolute path to the source file
 * @param {string} content  - File content string
 * @returns {string[]} Array of imported module paths/names
 */
export function extractImports(filePath, content) {
  const results = new Set();
  const fileDir = dirname(filePath);

  // Patterns to match various import forms
  const patterns = [
    // import X from './foo'  |  import { X } from '../bar'  |  import * as X from "..."
    /\bimport\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
    // require('./baz')
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // import('./dynamic')
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // export ... from '...'
    /\bexport\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
  ];

  for (const pattern of patterns) {
    let match;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;

      if (importPath.startsWith('.')) {
        // Relative import — resolve to absolute path
        const resolved = resolve(fileDir, importPath);
        results.add(resolved);
      } else {
        // Package name — keep as-is (but don't follow into node_modules)
        // Skip built-in Node.js modules and scoped packages for tracing
        results.add(importPath);
      }
    }
  }

  return [...results];
}

/**
 * Resolves a path to an existing file, trying various extensions if needed.
 *
 * @param {string} basePath - Path potentially without extension
 * @returns {string|null} Resolved absolute file path or null
 */
function resolveFile(basePath) {
  // Try as-is first
  if (existsSync(basePath) && !basePath.endsWith('/')) {
    // Check it's actually a file (not directory)
    try {
      const { statSync } = await import('fs').catch(() => ({ statSync: null }));
    } catch { /* ignore */ }
    if (existsSync(basePath)) return basePath;
  }

  // Try with extensions
  for (const ext of EXTENSIONS) {
    const withExt = basePath + ext;
    if (existsSync(withExt)) return withExt;
  }

  // Try as directory index
  for (const ext of EXTENSIONS) {
    const index = join(basePath, `index${ext}`);
    if (existsSync(index)) return index;
  }

  return null;
}

function resolveFileSync(basePath) {
  if (existsSync(basePath)) return basePath;

  for (const ext of EXTENSIONS) {
    const withExt = basePath + ext;
    if (existsSync(withExt)) return withExt;
  }

  for (const ext of EXTENSIONS) {
    const index = join(basePath, `index${ext}`);
    if (existsSync(index)) return index;
  }

  return null;
}

function isSkipped(filePath) {
  return SKIP_DIRS.some((dir) => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`));
}

/**
 * Recursively traces imports from an entry file up to a given depth.
 *
 * @param {string} entryFile     - Absolute path to entry file
 * @param {string} workspaceRoot - Absolute workspace root
 * @param {number} maxDepth      - Max recursion depth (default 3)
 * @returns {Set<string>} Set of absolute file paths of traced dependencies
 */
export function traceImports(entryFile, workspaceRoot, maxDepth = 3) {
  const visited = new Set();
  const result = new Set();
  const root = resolve(workspaceRoot);

  function trace(filePath, depth) {
    if (depth > maxDepth) return;
    if (visited.has(filePath)) return;
    if (!filePath.startsWith(root)) return;
    if (isSkipped(filePath)) return;

    visited.add(filePath);

    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      return;
    }

    result.add(filePath);

    const imports = extractImports(filePath, content);
    for (const imp of imports) {
      // Skip non-relative (package) imports
      if (!imp.startsWith('/') && !imp.startsWith('.')) continue;

      const resolved = resolveFileSync(imp);
      if (!resolved) continue;
      if (!resolved.startsWith(root)) continue;
      if (isSkipped(resolved)) continue;

      trace(resolved, depth + 1);
    }
  }

  const resolvedEntry = resolveFileSync(entryFile);
  if (resolvedEntry) {
    trace(resolvedEntry, 0);
  }

  return result;
}

/**
 * Extracts exported symbol names from a file.
 *
 * @param {string} filePath      - Absolute path to source file
 * @param {string} workspaceRoot - Workspace root (unused but kept for API consistency)
 * @returns {string[]} Array of exported symbol names
 */
export function traceExports(filePath, workspaceRoot) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const exports = new Set();

  // export function foo / export async function foo
  const fnPattern = /\bexport\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = fnPattern.exec(content)) !== null) exports.add(m[1]);

  // export const foo / export let foo / export var foo
  const varPattern = /\bexport\s+(?:const|let|var)\s+(\w+)/g;
  while ((m = varPattern.exec(content)) !== null) exports.add(m[1]);

  // export class Foo
  const classPattern = /\bexport\s+class\s+(\w+)/g;
  while ((m = classPattern.exec(content)) !== null) exports.add(m[1]);

  // export default (anonymous or named)
  const defaultPattern = /\bexport\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|(\w+))/g;
  while ((m = defaultPattern.exec(content)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (name) exports.add(name);
    else exports.add('default');
  }

  // export { foo, bar }
  const namedPattern = /\bexport\s+\{([^}]+)\}/g;
  while ((m = namedPattern.exec(content)) !== null) {
    const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop().trim());
    for (const name of names) {
      if (name) exports.add(name);
    }
  }

  // module.exports = { foo, bar } or module.exports.foo =
  const cjsPattern = /module\.exports\s*=\s*\{([^}]+)\}/g;
  while ((m = cjsPattern.exec(content)) !== null) {
    const names = m[1].split(',').map((n) => {
      const parts = n.trim().split(':');
      return parts[0].trim();
    });
    for (const name of names) {
      if (name && /^\w+$/.test(name)) exports.add(name);
    }
  }

  const cjsDotPattern = /module\.exports\.(\w+)\s*=/g;
  while ((m = cjsDotPattern.exec(content)) !== null) exports.add(m[1]);

  return [...exports];
}

/**
 * Builds a dependency graph mapping each file to its imported files.
 *
 * @param {string[]} files       - Array of absolute file paths
 * @param {string} workspaceRoot - Workspace root
 * @returns {Map<string, string[]>} Map of filePath → [importedFilePaths]
 */
export function buildDependencyGraph(files, workspaceRoot) {
  const graph = new Map();
  const root = resolve(workspaceRoot);

  for (const filePath of files) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      graph.set(filePath, []);
      continue;
    }

    const rawImports = extractImports(filePath, content);
    const resolvedDeps = [];

    for (const imp of rawImports) {
      if (!imp.startsWith('/') && !imp.startsWith('.')) continue;
      const resolved = resolveFileSync(imp);
      if (resolved && resolved.startsWith(root) && !isSkipped(resolved)) {
        resolvedDeps.push(resolved);
      }
    }

    graph.set(filePath, resolvedDeps);
  }

  return graph;
}
