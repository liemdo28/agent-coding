// self-heal/envRepair.js — detects and repairs broken environment configuration
// Phase 16: compares .env vs .env.example, never fills real secrets

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Parse a .env-style file into a key→value map.
 * @param {string} filePath
 * @returns {Map<string, string>}
 */
function parseEnvFile(filePath) {
  const map = new Map();
  if (!existsSync(filePath)) return map;
  try {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) map.set(key, val);
    }
  } catch { /* ignore */ }
  return map;
}

/**
 * Detect issues between .env and .env.example.
 * @param {string} projectRoot
 * @returns {{ missing: string[], extra: string[], mismatched: string[], suggestions: string[] }}
 */
export function detectEnvIssues(projectRoot) {
  const envPath     = join(projectRoot, '.env');
  const examplePath = join(projectRoot, '.env.example');

  if (!existsSync(examplePath)) {
    return { missing: [], extra: [], mismatched: [], suggestions: ['No .env.example found — create one to track required variables'] };
  }

  const env     = parseEnvFile(envPath);
  const example = parseEnvFile(examplePath);

  const missing     = [];
  const mismatched  = [];
  const suggestions = [];

  // Keys in example but not in .env
  for (const [key, exampleVal] of example) {
    if (!env.has(key)) {
      missing.push(key);
    } else if (env.get(key) === '' && exampleVal !== '') {
      mismatched.push(key);
      suggestions.push(`${key} is empty — expected a non-empty value`);
    }
  }

  // Keys in .env but not in example
  const extra = [...env.keys()].filter(k => !example.has(k));
  if (extra.length > 0) {
    suggestions.push(`Consider adding undocumented keys to .env.example: ${extra.slice(0, 5).join(', ')}`);
  }

  if (missing.length > 0) {
    suggestions.push(`Run repairEnv() to add placeholder values for missing keys`);
  }

  return { missing, extra, mismatched, suggestions };
}

/**
 * Repair .env by copying missing keys from .env.example with placeholder values.
 * NEVER fills real secrets — uses placeholder strings.
 * @param {string} projectRoot
 * @param {{ dryRun?: boolean }} options
 * @returns {{ added: string[], skipped: string[], dryRun: boolean }}
 */
export function repairEnv(projectRoot, options = {}) {
  const { dryRun = false } = options;
  const { missing } = detectEnvIssues(projectRoot);

  const envPath     = join(projectRoot, '.env');
  const examplePath = join(projectRoot, '.env.example');

  if (missing.length === 0) return { added: [], skipped: [], dryRun };

  const example = parseEnvFile(examplePath);
  const added   = [];

  if (dryRun) return { added: missing, skipped: [], dryRun: true };

  try {
    let currentContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    if (currentContent && !currentContent.endsWith('\n')) currentContent += '\n';
    currentContent += '\n# Added by envRepair — replace placeholders with real values\n';

    for (const key of missing) {
      const placeholder = `PLACEHOLDER_${key}`;
      currentContent += `${key}=${placeholder}\n`;
      added.push(key);
    }

    writeFileSync(envPath, currentContent, 'utf8');
  } catch (err) {
    console.error('[envRepair] repairEnv error:', err.message);
  }

  return { added, skipped: [], dryRun: false };
}

/**
 * Full env report.
 * @param {string} projectRoot
 * @returns {{ missing: string[], extra: string[], mismatched: string[], suggestions: string[] }}
 */
export function getEnvReport(projectRoot) {
  return detectEnvIssues(projectRoot);
}
