// context/EntrypointDetector.js - Identifies key entry files in a project
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

export const ENTRYPOINT_NAMES = [
  'index.js', 'index.ts', 'index.jsx', 'index.tsx',
  'main.js',  'main.ts',  'main.jsx',  'main.tsx',
  'app.js',   'app.ts',   'app.jsx',   'app.tsx',
  'server.js', 'server.ts',
  'vite.config.js', 'vite.config.ts',
  'next.config.js',
  'webpack.config.js',
  'tailwind.config.js',
  'package.json',
];

const ENTRYPOINT_SET = new Set(ENTRYPOINT_NAMES);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.local-agent', 'coverage', '.next', '.nuxt']);

const CONFIG_PATTERNS = [
  '.env.example',
  'tsconfig.json',
  'jsconfig.json',
];

const CONFIG_GLOB_PATTERNS = [
  /^eslint/i,
  /^prettier/i,
  /^babel\.config\./i,
  /^jest\.config\./i,
  /^vitest\.config\./i,
];

/**
 * Detect entry point files in the workspace (top 2 directory levels).
 *
 * @param {string} workspaceRoot - Absolute path to project root
 * @returns {string[]} Absolute paths of detected entrypoints
 */
export function detectEntrypoints(workspaceRoot) {
  const root = resolve(workspaceRoot);
  const found = [];

  function scan(dir, depth) {
    if (depth > 2) return;

    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      const fullPath = join(dir, name);

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(name)) {
          scan(fullPath, depth + 1);
        }
      } else if (stat.isFile()) {
        if (ENTRYPOINT_SET.has(name)) {
          found.push(fullPath);
        }
      }
    }
  }

  scan(root, 0);
  return found;
}

/**
 * Detect configuration files in the workspace root.
 *
 * @param {string} workspaceRoot - Absolute path to project root
 * @returns {string[]} Absolute paths of config files found
 */
export function detectConfigFiles(workspaceRoot) {
  const root = resolve(workspaceRoot);
  const found = [];

  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return found;
  }

  for (const name of entries) {
    const fullPath = join(root, name);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (!stat.isFile()) continue;

    // Exact name matches
    if (CONFIG_PATTERNS.includes(name)) {
      found.push(fullPath);
      continue;
    }

    // Pattern matches
    if (CONFIG_GLOB_PATTERNS.some((re) => re.test(name))) {
      found.push(fullPath);
    }
  }

  return found;
}

/**
 * Detect route files from a project map.
 *
 * @param {object} projectMap - Parsed project-map.json
 * @returns {string[]} Route file paths from project map, or empty array
 */
export function detectRouteFiles(projectMap) {
  if (!projectMap || !Array.isArray(projectMap.routes)) return [];
  return projectMap.routes;
}
