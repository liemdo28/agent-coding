// config-drift/ConfigDriftDetector.js — detect config mismatch and drift
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const CONFIG_FILES = [
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
  'config.json', 'config.js', 'config.ts',
  'tsconfig.json', '.eslintrc', '.eslintrc.json', '.eslintrc.js',
  'jest.config.js', 'jest.config.ts', 'vite.config.js', 'vite.config.ts',
  'webpack.config.js', 'babel.config.js',
];

/**
 * Parse a .env file into a key → value map.
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseEnv(content) {
  const out = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Detect keys present in one env file but missing from another.
 * @param {Record<string,string>} base — e.g. .env
 * @param {Record<string,string>} target — e.g. .env.production
 * @returns {{ missing: string[], extra: string[], mismatched: string[] }}
 */
export function compareEnvFiles(base, target) {
  const baseKeys   = new Set(Object.keys(base));
  const targetKeys = new Set(Object.keys(target));
  const missing    = [...baseKeys].filter((k) => !targetKeys.has(k));
  const extra      = [...targetKeys].filter((k) => !baseKeys.has(k));
  const mismatched = [...baseKeys].filter((k) => targetKeys.has(k) && base[k] !== target[k]);
  return { missing, extra, mismatched };
}

/**
 * Scan a project directory for config issues.
 * @param {string} projectDir
 * @returns {ConfigScanResult}
 */
export function scanConfig(projectDir) {
  const found   = [];
  const issues  = [];

  // Detect config files present
  for (const name of CONFIG_FILES) {
    const abs = join(projectDir, name);
    if (existsSync(abs)) found.push(name);
  }

  // .env drift check
  const envBase  = join(projectDir, '.env');
  const envProd  = join(projectDir, '.env.production');
  const envLocal = join(projectDir, '.env.local');

  if (existsSync(envBase) && existsSync(envProd)) {
    const base   = parseEnv(readFileSync(envBase, 'utf8'));
    const prod   = parseEnv(readFileSync(envProd, 'utf8'));
    const diff   = compareEnvFiles(base, prod);
    if (diff.missing.length) {
      issues.push({ type: 'env_drift', severity: 'high',
        msg: `.env.production missing keys from .env: ${diff.missing.join(', ')}` });
    }
    if (diff.extra.length) {
      issues.push({ type: 'env_extra', severity: 'medium',
        msg: `.env.production has keys not in .env: ${diff.extra.join(', ')}` });
    }
  }

  // Missing .env.example
  if (existsSync(envBase) && !existsSync(join(projectDir, '.env.example'))) {
    issues.push({ type: 'missing_example', severity: 'low',
      msg: '.env exists but .env.example is missing — other devs lack the template' });
  }

  // Duplicate config detection: multiple versions of same config
  const configPairs = [
    ['.eslintrc', '.eslintrc.json', '.eslintrc.js'],
    ['jest.config.js', 'jest.config.ts'],
    ['vite.config.js', 'vite.config.ts'],
  ];
  for (const group of configPairs) {
    const present = group.filter((f) => existsSync(join(projectDir, f)));
    if (present.length > 1) {
      issues.push({ type: 'duplicate_config', severity: 'medium',
        msg: `Multiple config files for same tool: ${present.join(', ')}` });
    }
  }

  // Stale config: tsconfig for JS-only project
  if (existsSync(join(projectDir, 'tsconfig.json'))) {
    const hasTsFiles = walkHasExt(projectDir, '.ts', 3);
    if (!hasTsFiles) {
      issues.push({ type: 'stale_config', severity: 'low',
        msg: 'tsconfig.json present but no .ts files found — may be stale' });
    }
  }

  return {
    foundConfigs: found,
    issues,
    issueCount:  issues.length,
    healthy:     issues.length === 0,
  };
}

function walkHasExt(dir, ext, maxDepth) {
  if (maxDepth <= 0) return false;
  try {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.git'].includes(name)) continue;
      const abs = join(dir, name);
      try {
        if (statSync(abs).isDirectory()) { if (walkHasExt(abs, ext, maxDepth - 1)) return true; }
        else if (extname(name) === ext) return true;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return false;
}

/**
 * Compare two config directories for drift (e.g. dev vs prod configs).
 * @param {string} pathA
 * @param {string} pathB
 * @param {{ files?: string[] }} opts
 * @returns {DriftResult}
 */
export function compareConfigDirs(pathA, pathB, opts = {}) {
  const files  = opts.files ?? CONFIG_FILES;
  const drifts = [];

  for (const name of files) {
    const absA = join(pathA, name);
    const absB = join(pathB, name);
    const inA  = existsSync(absA);
    const inB  = existsSync(absB);

    if (inA && !inB) { drifts.push({ file: name, type: 'missing_in_b' }); continue; }
    if (!inA && inB) { drifts.push({ file: name, type: 'missing_in_a' }); continue; }
    if (!inA)         continue;

    const contA = readFileSync(absA, 'utf8');
    const contB = readFileSync(absB, 'utf8');
    if (contA !== contB) drifts.push({ file: name, type: 'content_differs' });
  }

  return { pathA, pathB, drifts, driftCount: drifts.length };
}
