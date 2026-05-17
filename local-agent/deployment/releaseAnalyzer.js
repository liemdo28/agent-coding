// deployment/releaseAnalyzer.js — analyzes release readiness
// Phase 9: checks build, tests, QA, security, staging stages

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Analyze release readiness for a project.
 * @param {string} projectRoot
 * @param {{ qaScore?: number, qaThreshold?: number, secretsFound?: boolean }} options
 * @returns {{ ready: boolean, score: number, stages: object, blockers: string[] }}
 */
export async function analyzeRelease(projectRoot, options = {}) {
  const { qaScore = 75, qaThreshold = 70, secretsFound = false } = options;
  const blockers = [];
  const stages   = {};

  // ── BUILD ─────────────────────────────────────────────────────────────────
  stages.build = checkBuild(projectRoot);
  if (!stages.build.pass) blockers.push('Build check failed — no dist/build artifacts or build script');

  // ── TEST ──────────────────────────────────────────────────────────────────
  stages.test = checkTests(projectRoot);
  if (!stages.test.pass) blockers.push('No test script defined in package.json');

  // ── QA ────────────────────────────────────────────────────────────────────
  stages.qa = {
    pass:    qaScore >= qaThreshold,
    score:   qaScore,
    message: `QA score ${qaScore}/100 (threshold: ${qaThreshold})`,
  };
  if (!stages.qa.pass) blockers.push(`QA score below threshold: ${qaScore} < ${qaThreshold}`);

  // ── SECURITY ──────────────────────────────────────────────────────────────
  stages.security = {
    pass:    !secretsFound,
    message: secretsFound ? 'Secrets detected in codebase' : 'No secrets found',
  };
  if (secretsFound) blockers.push('Secrets found in source — cannot release');

  // ── STAGING ───────────────────────────────────────────────────────────────
  stages.staging = {
    pass:    true,
    message: 'Staging check not configured (defaulting to pass)',
  };

  const passCount = Object.values(stages).filter(s => s.pass).length;
  const score     = Math.round((passCount / Object.keys(stages).length) * 100);
  const ready     = blockers.length === 0 && score >= 70;

  return { ready, score, stages, blockers };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readPkg(projectRoot) {
  try {
    return JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  } catch { return {}; }
}

function checkBuild(projectRoot) {
  const pkg         = readPkg(projectRoot);
  const hasBuildCmd = !!(pkg.scripts?.build);
  const distExists  = existsSync(join(projectRoot, 'dist')) || existsSync(join(projectRoot, 'build')) || existsSync(join(projectRoot, '.next'));
  return {
    pass:    hasBuildCmd || distExists,
    message: distExists ? 'Build artifacts found' : hasBuildCmd ? 'Build script defined' : 'No build artifacts or script',
  };
}

function checkTests(projectRoot) {
  const pkg           = readPkg(projectRoot);
  const testScript    = pkg.scripts?.test ?? '';
  const hasTests      = !!testScript && !testScript.includes('no test specified') && testScript.trim() !== '';
  return {
    pass:    hasTests,
    message: hasTests ? `Test script: ${testScript.slice(0, 60)}` : 'No test script',
  };
}
