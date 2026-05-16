// scanner/scanner.js - project scanner with streaming glob
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, relative, extname, resolve } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fg from 'fast-glob';

// Project type detection markers
const PROJECT_TYPE_MARKERS = {
  nodejs: ['package.json'],
  python: ['requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg'],
  php: ['composer.json'],
  rust: ['Cargo.toml'],
  go: ['go.mod'],
  ruby: ['Gemfile'],
  java: ['pom.xml', 'build.gradle'],
  dotnet: ['*.csproj', '*.sln'],
};

// Config files to read and parse
const CONFIG_FILE_PATTERNS = [
  'package.json',
  'vite.config.js',
  'vite.config.ts',
  'vite.config.mjs',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.ts',
  '.env.example',
  '.env.sample',
  'tsconfig.json',
  'babel.config.js',
  'babel.config.json',
  'webpack.config.js',
  'jest.config.js',
  'jest.config.ts',
];

// Route/page directories to detect
const ROUTE_DIRS = [
  'src/pages',
  'src/routes',
  'app',
  'pages',
  'routes',
  'src/app',
];

// File extensions that may contain TODO/FIXME comments
const COMMENT_SOURCE_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.php', '.cs', '.cpp', '.c', '.h', '.swift',
  '.vue', '.svelte', '.astro',
  '.sh', '.bash', '.zsh',
]);

const TODO_PATTERN = /\/\/\s*(TODO|FIXME|HACK|XXX|NOTE|BUG)[:|\s](.+)/i;
const TODO_PATTERN_HASH = /#\s*(TODO|FIXME|HACK|XXX|NOTE|BUG)[:|\s](.+)/i;

/**
 * Build a fast-glob ignore pattern list from config
 */
function buildIgnorePatterns(config) {
  const ignoreList = config?.scanner?.ignore ?? [];
  return ignoreList.map((p) => {
    // Ensure directory patterns cover nested paths
    if (!p.includes('*') && !p.includes('/')) {
      return `**/${p}/**`;
    }
    return p;
  });
}

/**
 * Detect project types from the files present in the root directory
 */
function detectProjectTypes(rootDir) {
  const detected = [];
  for (const [type, markers] of Object.entries(PROJECT_TYPE_MARKERS)) {
    for (const marker of markers) {
      if (marker.includes('*')) {
        // Glob marker — use sync check
        try {
          const matches = fg.sync(marker, { cwd: rootDir, deep: 1, onlyFiles: true });
          if (matches.length > 0) {
            detected.push(type);
            break;
          }
        } catch {
          // ignore
        }
      } else if (existsSync(join(rootDir, marker))) {
        detected.push(type);
        break;
      }
    }
  }
  return [...new Set(detected)];
}

/**
 * Read a config file safely — returns parsed JSON for JSON files, path string otherwise
 */
function readConfigFile(rootDir, filename) {
  const filePath = join(rootDir, filename);
  if (!existsSync(filePath)) return null;
  if (filename.endsWith('.json')) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      return `<parse error: ${filename}>`;
    }
  }
  // For non-JSON configs, return the file path so callers know it exists
  return filePath;
}

/**
 * Extract npm scripts and common build commands from package.json
 */
function extractBuildCommands(configFiles) {
  const commands = [];
  const pkg = configFiles['package.json'];
  if (pkg && typeof pkg === 'object' && pkg.scripts) {
    for (const [name] of Object.entries(pkg.scripts)) {
      commands.push(`npm run ${name}`);
    }
  }
  return commands;
}

/**
 * Scan a file line-by-line for TODO/FIXME comments (streaming, memory-efficient)
 */
async function extractTodosFromFile(filePath, relPath) {
  const todos = [];
  try {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      const match = line.match(TODO_PATTERN) || line.match(TODO_PATTERN_HASH);
      if (match) {
        todos.push({
          file: relPath,
          line: lineNum,
          type: match[1].toUpperCase(),
          text: match[2].trim(),
        });
      }
    }
  } catch {
    // skip unreadable files
  }
  return todos;
}

/**
 * Detect route/page files within known route directories
 */
function detectRoutes(rootDir, allFiles) {
  const routes = [];
  for (const f of allFiles) {
    for (const routeDir of ROUTE_DIRS) {
      if (f.startsWith(routeDir + '/') || f.startsWith(routeDir.replace(/\//g, '\\') + '\\')) {
        routes.push(f);
        break;
      }
    }
  }
  return routes;
}

/**
 * Main scanner function.
 *
 * @param {string} targetDir - Absolute path to project root
 * @param {object} config - Loaded agent config
 * @returns {Promise<object>} - Project map object
 */
export async function scanProject(targetDir, config) {
  const rootDir = resolve(targetDir);
  const maxFileSizeBytes = config?.scanner?.maxFileSizeBytes ?? 1048576;
  const ignorePatterns = buildIgnorePatterns(config);

  // --- Detect project types ---
  const projectTypes = detectProjectTypes(rootDir);

  // --- Read config files ---
  const configFiles = {};
  for (const cfgFile of CONFIG_FILE_PATTERNS) {
    const value = readConfigFile(rootDir, cfgFile);
    if (value !== null) {
      configFiles[cfgFile] = value;
    }
  }

  const buildCommands = extractBuildCommands(configFiles);

  // --- Glob all source files ---
  const globPattern = '**/*';
  const globOptions = {
    cwd: rootDir,
    ignore: [
      ...ignorePatterns,
      '**/.local-agent/**',
      '**/.git/**',
    ],
    onlyFiles: true,
    followSymbolicLinks: config?.scanner?.followSymlinks ?? false,
    dot: true,
    absolute: false,
    suppressErrors: true,
  };

  const allRelPaths = await fg(globPattern, globOptions);

  // --- Build file list with metadata ---
  const files = [];
  const byType = {};
  let totalSize = 0;

  const todoPromises = [];

  for (const relPath of allRelPaths) {
    const absPath = join(rootDir, relPath);
    let size = 0;
    let lastModified = null;

    try {
      const st = statSync(absPath);
      if (!st.isFile()) continue;
      size = st.size;
      lastModified = st.mtime.toISOString();
    } catch {
      continue;
    }

    // Skip files that are too large
    if (size > maxFileSizeBytes) continue;

    const ext = extname(relPath).toLowerCase() || '(no ext)';
    byType[ext] = (byType[ext] ?? 0) + 1;
    totalSize += size;

    files.push({
      path: relPath,
      size,
      type: ext.replace(/^\./, '') || 'unknown',
      lastModified,
    });

    // Queue TODO extraction for source files
    if (COMMENT_SOURCE_EXTS.has(ext)) {
      todoPromises.push(extractTodosFromFile(absPath, relPath));
    }
  }

  // --- Extract TODOs in parallel (but bounded) ---
  const BATCH_SIZE = 50;
  const todos = [];
  for (let i = 0; i < todoPromises.length; i += BATCH_SIZE) {
    const batch = todoPromises.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch);
    for (const r of results) {
      todos.push(...r);
    }
  }

  // --- Detect routes ---
  const allRelPathsSet = allRelPaths;
  const routes = detectRoutes(rootDir, allRelPathsSet);

  // --- Build project map ---
  const projectMap = {
    scannedAt: new Date().toISOString(),
    rootDir,
    projectTypes,
    configFiles,
    buildCommands,
    files,
    routes,
    todos,
    stats: {
      totalFiles: files.length,
      totalSize,
      byType,
    },
  };

  // --- Write outputs to .local-agent ---
  const workspaceDir = join(rootDir, '.local-agent');
  if (existsSync(workspaceDir)) {
    const mapPath = join(workspaceDir, 'project-map.json');
    writeFileSync(mapPath, JSON.stringify(projectMap, null, 2), 'utf8');

    const summaryPath = join(workspaceDir, 'project-summary.md');
    writeFileSync(summaryPath, buildSummaryMarkdown(projectMap), 'utf8');
  }

  return projectMap;
}

/**
 * Build a human-readable markdown summary from the project map
 */
function buildSummaryMarkdown(map) {
  const sizeKb = (map.stats.totalSize / 1024).toFixed(1);
  const typesStr = map.projectTypes.length > 0 ? map.projectTypes.join(', ') : 'unknown';

  const byTypeLines = Object.entries(map.stats.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([ext, count]) => `  - \`${ext}\`: ${count} files`)
    .join('\n');

  const buildCommandLines = map.buildCommands.slice(0, 10)
    .map((c) => `  - \`${c}\``)
    .join('\n') || '  _None detected_';

  const routeLines = map.routes.slice(0, 20)
    .map((r) => `  - ${r}`)
    .join('\n') || '  _None detected_';

  const todoLines = map.todos.slice(0, 30)
    .map((t) => `  - \`${t.file}:${t.line}\` **${t.type}**: ${t.text}`)
    .join('\n') || '  _None found_';

  return `# Project Summary

> Auto-generated by local-agent on ${map.scannedAt}
> Do not edit — regenerated on each scan.

## Overview

- **Root**: \`${map.rootDir}\`
- **Project Types**: ${typesStr}
- **Total Files**: ${map.stats.totalFiles}
- **Total Size**: ${sizeKb} KB

## File Types

${byTypeLines || '  _None_'}

## Build & Test Commands

${buildCommandLines}

## Routes / Pages

${routeLines}

## Open TODOs / FIXMEs (first 30)

${todoLines}
`;
}
