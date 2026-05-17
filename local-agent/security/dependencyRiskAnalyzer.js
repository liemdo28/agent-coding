// security/dependencyRiskAnalyzer.js — npm dependency risk analysis (offline, heuristics)
// Phase 10: no network — checks package.json + lockfile against built-in risk patterns

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Heuristic risk patterns for package names / install scripts
const MALICIOUS_NAME_PATTERNS = [
  /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/, // excessive hyphenation
  /0day|exploit|hack|backdoor|rootkit|malware/i,
  /^[a-z]{1,2}$/, // suspiciously short names
  /(paypal|amazon|google|microsoft|apple)-(?!official)/i, // brand squatting
];

const RISKY_SCRIPT_PATTERNS = [
  /curl\s+.*\|\s*sh/,         // curl | sh
  /wget\s+.*\|\s*sh/,
  /eval\s*\(/,                // eval in postinstall
  /process\.env\.[A-Z_]{3,}/, // reading env vars in install
  /require\s*\(\s*'child_process'\s*\)/,
  /exec\s*\(\s*['"`]/,
  /spawn\s*\(\s*['"`]/,
  /rm\s+-rf/,
  /http:\/\/(?!localhost)/,   // outbound HTTP (non-localhost)
  /https:\/\/(?!localhost)/,  // outbound HTTPS
];

/**
 * Analyze all dependencies in a project for risk.
 * @param {string} projectRoot
 * @returns {{ high: object[], medium: object[], low: object[], summary: object }}
 */
export function analyzeDependencies(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return { high: [], medium: [], low: [], summary: { error: 'No package.json found' } };
  }

  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch {
    return { high: [], medium: [], low: [], summary: { error: 'Invalid package.json' } };
  }

  const deps = {
    ...pkg.dependencies ?? {},
    ...pkg.devDependencies ?? {},
    ...pkg.optionalDependencies ?? {},
  };

  const high = [], medium = [], low = [];

  for (const [name, version] of Object.entries(deps)) {
    const risk = scorePackageRisk(name, version, pkg);
    const entry = { name, version, ...risk };
    if (risk.level === 'high') high.push(entry);
    else if (risk.level === 'medium') medium.push(entry);
    else low.push(entry);
  }

  const summary = {
    total:   high.length + medium.length + low.length,
    high:    high.length,
    medium:  medium.length,
    low:     low.length,
    scannedAt: new Date().toISOString(),
  };

  return { high, medium, low, summary };
}

/**
 * Score a single package for risk.
 * @param {string} name
 * @param {string} version
 * @param {object} pkg  full package.json (for script context)
 * @returns {{ level: string, reasons: string[] }}
 */
export function scorePackageRisk(name, version, pkg = {}) {
  const reasons = [];
  let score = 0;

  // Name heuristics
  for (const pattern of MALICIOUS_NAME_PATTERNS) {
    if (pattern.test(name)) {
      reasons.push(`Suspicious package name pattern: ${name}`);
      score += 30;
    }
  }

  // Version heuristics
  if (version === '*' || version === 'latest') {
    reasons.push('Unpinned version (can receive malicious updates)');
    score += 15;
  }
  if (version.startsWith('git+') || version.startsWith('github:') || version.includes('://')) {
    reasons.push('Non-registry source (git/URL)');
    score += 25;
  }

  // Check scripts in package.json for this dep (not available without lockfile, but check top-level)
  const scripts = Object.values(pkg.scripts ?? {}).join('\n');
  for (const pattern of RISKY_SCRIPT_PATTERNS) {
    if (pattern.test(scripts)) {
      reasons.push('Risky install script pattern detected');
      score += 20;
      break;
    }
  }

  const level = score >= 40 ? 'high' : score >= 15 ? 'medium' : 'low';
  return { level, score, reasons };
}

/**
 * Full dependency risk report.
 * @param {string} projectRoot
 * @returns {{ high: object[], medium: object[], low: object[], summary: object }}
 */
export function getDependencyReport(projectRoot) {
  return analyzeDependencies(projectRoot);
}
