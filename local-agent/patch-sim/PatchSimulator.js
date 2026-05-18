// patch-sim/PatchSimulator.js — simulate patch impact before apply (no writes)
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const RISK_WEIGHTS = {
  auth:     30, security: 30, crypto: 25, password: 25,
  database: 20, schema:   20, migrate: 20,
  config:   15, env:      15,
  api:      10, route:    10, server: 10,
  test:      5, spec:      5,
};

/**
 * Load a patch proposal by ID.
 * @param {string} workspaceRoot
 * @param {string} patchId
 * @returns {PatchProposal|null}
 */
export function loadPatch(workspaceRoot, patchId) {
  const candidates = [
    join(workspaceRoot, '.local-agent', 'patches', `${patchId}.json`),
    join(workspaceRoot, '.local-agent', 'patches', patchId, 'proposal.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
    }
  }
  return null;
}

/**
 * Estimate regression risk from the patch diff / affected files.
 * @param {string[]} affectedFiles
 * @param {string} diff — unified diff text
 * @returns {{ score: number, level: string, factors: string[] }}
 */
export function estimateRegressionRisk(affectedFiles, diff = '') {
  let score   = 0;
  const factors = [];

  for (const file of affectedFiles) {
    const lower = file.toLowerCase();
    for (const [keyword, weight] of Object.entries(RISK_WEIGHTS)) {
      if (lower.includes(keyword)) {
        score += weight;
        factors.push(`${file} touches ${keyword} (${weight}pts)`);
        break;
      }
    }
  }

  // Lines changed
  const added   = (diff.match(/^\+[^+]/gm) ?? []).length;
  const removed = (diff.match(/^-[^-]/gm) ?? []).length;
  const churn   = added + removed;
  if (churn > 200) { score += 20; factors.push(`Large diff: ${churn} lines changed`); }
  else if (churn > 50) { score += 8; factors.push(`Medium diff: ${churn} lines`); }

  const level = score >= 60 ? 'critical' : score >= 35 ? 'high' : score >= 15 ? 'medium' : 'low';
  return { score: Math.min(score, 100), level, factors };
}

/**
 * Estimate which tests may be affected.
 * @param {string} projectDir
 * @param {string[]} affectedFiles
 * @returns {string[]}
 */
export function estimateAffectedTests(projectDir, affectedFiles) {
  const testFiles = [];
  function walk(dir, depth) {
    if (depth > 5) return;
    try {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.git'].includes(name)) continue;
        const abs = join(dir, name);
        try {
          if (statSync(abs).isDirectory()) walk(abs, depth + 1);
          else if (/\.(test|spec)\.(js|ts|jsx|tsx)$/.test(name)) testFiles.push(abs);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(projectDir, 0);

  const affected = new Set();
  for (const testFile of testFiles) {
    try {
      const content = readFileSync(testFile, 'utf8');
      for (const src of affectedFiles) {
        const baseName = src.split('/').pop().replace(/\.(js|ts)$/, '');
        if (content.includes(baseName)) {
          affected.add(relative(projectDir, testFile));
          break;
        }
      }
    } catch { /* skip */ }
  }
  return [...affected];
}

/**
 * Estimate rollback complexity.
 * @param {string[]} affectedFiles
 * @param {string} diff
 * @returns {{ complexity: string, reason: string }}
 */
export function estimateRollbackComplexity(affectedFiles, diff = '') {
  const hasDbMigration = affectedFiles.some((f) => /migrat/i.test(f));
  const hasSchemaChange = diff.includes('CREATE TABLE') || diff.includes('ALTER TABLE');
  const fileCount = affectedFiles.length;

  if (hasDbMigration || hasSchemaChange) {
    return { complexity: 'high', reason: 'Database migration — rollback requires down-migration script' };
  }
  if (fileCount > 10) {
    return { complexity: 'medium', reason: `${fileCount} files — automated rollback via backup, manual verification required` };
  }
  return { complexity: 'low', reason: 'Single-file or small change — backup restore is straightforward' };
}

/**
 * Run full patch simulation.
 * @param {string} workspaceRoot
 * @param {string} patchId
 * @returns {SimulationResult}
 */
export function simulatePatch(workspaceRoot, patchId) {
  const patch = loadPatch(workspaceRoot, patchId);

  const affectedFiles = patch?.files ?? patch?.targetFiles ?? patch?.affectedFiles ?? [];
  const diff          = patch?.diff  ?? patch?.patch ?? '';

  const regression    = estimateRegressionRisk(affectedFiles, diff);
  const affectedTests = estimateAffectedTests(workspaceRoot, affectedFiles);
  const rollback      = estimateRollbackComplexity(affectedFiles, diff);

  // API/route impact
  const apiFiles = affectedFiles.filter((f) => /api|route|endpoint|controller/i.test(f));

  return {
    patchId,
    found:         !!patch,
    affectedFiles,
    fileCount:     affectedFiles.length,
    regressionRisk: regression,
    affectedTests,
    testCount:     affectedTests.length,
    apiImpact:     apiFiles,
    rollback,
    recommendation: regression.level === 'critical' || regression.level === 'high'
      ? 'Do NOT apply without full QA pass and manual review'
      : 'Safe to apply after QA verification',
  };
}
