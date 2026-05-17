// perf/PerformanceProfiler.js - Local performance profiler

import { readFileSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { execSync } from 'child_process';
import { readdirSync, statSync, readdir } from 'fs';
import { promisify } from 'util';
import { exec as execAsync } from 'child_process';
import { loadConfig } from '../core/config.js';

const exec = promisify(execAsync);

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.cs', '.php',
  '.vue', '.svelte', '.css', '.scss', '.less',
]);

const FRAMEWORK_ENTRY_PATTERNS = {
  vite: 'vite.config.{js,ts,mjs}',
  webpack: ['webpack.config.{js,mjs}', 'next.config.{js,ts,mjs}'],
  next: ['next.config.{js,ts,mjs}', '.next/'],
  nuxt: ['nuxt.config.{js,ts}', '.nuxt/'],
  createReactApp: ['package.json'],
  parcel: ['.parcelrc'],
};

/**
 * Run a timed build and return performance metrics.
 */
export async function measureBuildPerformance(projectRoot, config) {
  const buildCmd = config.buildCommand || 'npm run build';
  const start = Date.now();

  let stdout = '', stderr = '';
  let success = false;

  try {
    const parts = buildCmd.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    const { stdout: out, stderr: err } = await exec(cmd + ' ' + args.join(' '), {
      cwd: projectRoot,
      timeout: 300000, // 5 min max
      killSignal: 'SIGKILL',
    });
    stdout = out;
    stderr = err;
    success = true;
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || err.message || '';
    success = false;
  }

  const durationMs = Date.now() - start;

  return {
    command: buildCmd,
    durationMs,
    success,
    stdout: stdout.slice(0, 2000),
    stderr: stderr.slice(0, 2000),
  };
}

/**
 * Measure test suite execution time.
 */
export async function measureTestPerformance(projectRoot, config) {
  const testCmd = config.testCommand || 'npm test';
  const start = Date.now();

  let success = false;
  let stdout = '', stderr = '';

  try {
    const parts = testCmd.split(' ');
    const cmd = parts[0];
    const args = [...parts.slice(1), '--', '--coverage=false'].filter(Boolean);
    const { stdout: out, stderr: err } = await exec(cmd + ' ' + args.join(' '), {
      cwd: projectRoot,
      timeout: 300000,
      killSignal: 'SIGKILL',
    });
    stdout = out;
    stderr = err;
    success = true;
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || err.message || '';
    success = false;
  }

  const durationMs = Date.now() - start;

  return { command: testCmd, durationMs, success, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 1000) };
}

/**
 * Measure dev server startup time.
 */
export async function measureStartupTime(projectRoot, config) {
  const devCmd = config.devCommand || 'npm run dev';
  const start = Date.now();
  let ready = false;
  let startupMs = 0;

  // For local measurement, estimate based on entry file parsing
  // True dev server measurement requires running the server which blocks
  // So we estimate startup by measuring how long it takes to import/parse entry files
  try {
    const entryFiles = findEntryFiles(projectRoot);
    for (const entry of entryFiles.slice(0, 3)) {
      const t0 = Date.now();
      try {
        const content = readFileSync(entry, 'utf8');
        const size = content.length;
        startupMs += (t0 - Date.now()) + Math.min(size / 50000, 200);
      } catch {
        // ignore
      }
    }
  } catch { /* ignore */ }

  // Estimate based on project size
  const stats = estimateProjectStats(projectRoot);
  startupMs = Math.max(startupMs, Math.min(stats.fileCount * 2, 5000));

  return {
    estimatedMs: startupMs,
    entryFiles: findEntryFiles(projectRoot).length,
    projectFiles: stats.fileCount,
    method: 'static_estimation',
  };
}

/**
 * Estimate bundle size from dist/build output directories.
 */
export function estimateBundleSize(projectRoot) {
  const distDir = join(projectRoot, 'dist');
  const buildDir = join(projectRoot, 'build');
  const outDir = existsSync(distDir) ? distDir : existsSync(buildDir) ? buildDir : null;

  if (!outDir) {
    return { exists: false, totalBytes: 0, jsFiles: 0, cssFiles: 0, assets: [] };
  }

  const assets = [];
  let totalBytes = 0;
  let jsFiles = 0;
  let cssFiles = 0;

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name));
      } else {
        const fullPath = join(dir, entry.name);
        try {
          const stat = statSync(fullPath);
          assets.push({ path: fullPath.replace(projectRoot, ''), size: stat.size });
          totalBytes += stat.size;
          if (entry.name.endsWith('.js')) jsFiles++;
          if (entry.name.endsWith('.css')) cssFiles++;
        } catch { /* ignore */ }
      }
    }
  }

  walk(outDir);

  return { exists: true, totalBytes, jsFiles, cssFiles, assetCount: assets.length };
}

/**
 * Find slow or large files in the project.
 */
export function findSlowFiles(projectRoot, options = {}) {
  const { maxSizeKB = 100, limit = 20 } = options;
  const files = [];

  function walk(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          try {
            const stat = statSync(fullPath);
            const sizeKB = stat.size / 1024;
            if (sizeKB > maxSizeKB) {
              files.push({ path: fullPath.replace(projectRoot, ''), sizeKB: Math.round(sizeKB * 10) / 10 });
            }
          } catch { /* ignore */ }
        }
      }
    }
  }

  walk(projectRoot);
  files.sort((a, b) => b.sizeKB - a.sizeKB);
  return files.slice(0, limit);
}

/**
 * Analyze dependency size and impact.
 */
export function analyzeDependencies(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return { error: 'No package.json found' };

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const depCount = Object.keys(deps).length;

    // Heuristic: count lines of code in node_modules (approximate heaviness)
    const nodeModules = join(projectRoot, 'node_modules');
    let totalDepSize = 0;
    let depFileCount = 0;

    if (existsSync(nodeModules)) {
      try {
        const entries = readdirSync(nodeModules);
        for (const dep of entries.slice(0, 50)) {
          if (dep.startsWith('.')) continue;
          const depPath = join(nodeModules, dep);
          try {
            const stat = statSync(depPath);
            if (stat.isDirectory()) {
              const size = estimateDirSize(depPath);
              totalDepSize += size;
              depFileCount++;
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    return {
      depCount,
      deps: Object.keys(deps),
      installedCount: depFileCount,
      estimatedSizeMB: Math.round(totalDepSize / 1024 / 1024 * 100) / 100,
    };
  } catch (err) {
    return { error: err.message };
  }
}

function estimateDirSize(dir, depth = 0) {
  if (depth > 2) return 0;
  let size = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        size += estimateDirSize(fullPath, depth + 1);
      } else if (entry.isFile()) {
        try { size += statSync(fullPath).size; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return size;
}

function findEntryFiles(projectRoot) {
  const patterns = ['index.js', 'index.ts', 'main.js', 'main.ts', 'App.js', 'App.tsx', 'src/index.js', 'src/main.js'];
  return patterns.filter((p) => existsSync(join(projectRoot, p))).map((p) => join(projectRoot, p));
}

function estimateProjectStats(projectRoot) {
  let fileCount = 0;
  let totalSize = 0;

  function walk(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else {
        fileCount++;
        try { totalSize += statSync(fullPath).size; } catch { /* ignore */ }
      }
    }
  }

  walk(projectRoot);
  return { fileCount, totalSize };
}

/**
 * Run full performance profile.
 */
export async function runPerformanceProfile(projectRoot, options = {}) {
  const { deep = false } = options;
  const config = loadConfig(projectRoot);

  const results = {
    timestamp: new Date().toISOString(),
    project: projectRoot,
    build: null,
    test: null,
    startup: null,
    bundle: null,
    slowFiles: null,
    dependencies: null,
  };

  // Build performance
  if (config.buildCommand) {
    results.build = await measureBuildPerformance(projectRoot, config);
  }

  // Test performance
  if (config.testCommand) {
    results.test = await measureTestPerformance(projectRoot, config);
  }

  // Startup estimate
  results.startup = await measureStartupTime(projectRoot, config);

  // Bundle size
  results.bundle = estimateBundleSize(projectRoot);

  if (deep) {
    // Deep mode: analyze slow files and dependencies
    results.slowFiles = findSlowFiles(projectRoot);
    results.dependencies = analyzeDependencies(projectRoot);
  }

  return results;
}