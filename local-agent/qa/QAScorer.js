// qa/QAScorer.js - multi-dimensional QA scoring

// Weight distribution (must sum to 1.0)
const WEIGHTS = {
  stability:         0.25,
  coreFunctionality: 0.20,
  buildTest:         0.20,
  security:          0.10,
  performance:       0.10,
  codeQuality:       0.10,
  documentation:     0.05,
};

const THRESHOLDS = { PASS: 90, WARNING: 70 };

/**
 * Score the project based on QA run results and scan data.
 *
 * @param {object} params
 * @param {object}   params.buildResult   - Result from BuildRunner.runBuild
 * @param {object[]} params.staticResults  - Results from BuildRunner.runStaticChecks
 * @param {object}   params.testResult    - Result from TestRunner.runTests
 * @param {object}   params.projectMap    - Loaded project-map.json (or null)
 * @param {object}   params.scanReport    - Loaded scan-report.json (or null)
 * @param {object[]} params.patchHistory  - Patches applied this session
 * @returns {QAScore}
 */
export function scoreQA({ buildResult, staticResults = [], testResult, projectMap, scanReport, patchHistory = [] }) {
  const dimensions = {};

  // ── Build / Test (20%) ────────────────────────────────────────────────────
  let buildScore = 100;
  if (buildResult && !buildResult.success) {
    buildScore -= 60;
    buildScore -= Math.min(30, buildResult.errors.length * 10);
  }
  const lintResult = staticResults.find((r) => r.phase === 'lint');
  const tcResult   = staticResults.find((r) => r.phase === 'typecheck');
  if (lintResult && !lintResult.success) buildScore -= 15;
  if (tcResult   && !tcResult.success)   buildScore -= 15;

  let testScore = 100;
  if (testResult && !testResult.success) {
    testScore -= 50;
    if (testResult.summary) {
      const failRate = testResult.summary.total > 0
        ? testResult.summary.failed / testResult.summary.total
        : 1;
      testScore -= Math.round(failRate * 40);
    }
  }

  dimensions.buildTest = Math.max(0, Math.round((buildScore + testScore) / 2));

  // ── Security (10%) ────────────────────────────────────────────────────────
  let securityScore = 100;
  const secrets = projectMap?.risks?.hardcodedSecrets?.length ?? scanReport?.risks?.hardcodedSecrets?.length ?? 0;
  const suspFiles = projectMap?.risks?.suspiciousFiles?.length ?? 0;
  securityScore -= Math.min(60, secrets * 20);
  securityScore -= Math.min(20, suspFiles * 10);
  dimensions.security = Math.max(0, securityScore);

  // ── Code Quality (10%) ───────────────────────────────────────────────────
  let qualityScore = 100;
  const todos = projectMap?.todos?.length ?? 0;
  const largeFiles = projectMap?.risks?.largeFiles?.length ?? 0;
  qualityScore -= Math.min(20, Math.floor(todos / 5));   // -1 per 5 todos, up to -20
  qualityScore -= Math.min(20, largeFiles * 10);
  if (lintResult && !lintResult.success) qualityScore -= 20;
  dimensions.codeQuality = Math.max(0, qualityScore);

  // ── Documentation (5%) ───────────────────────────────────────────────────
  let docScore = 100;
  const hasDocs = (projectMap?.docs?.length ?? 0) > 0;
  const hasEnvExample = projectMap?.envFiles?.length ?? scanReport?.risks?.missingEnvExample === false;
  if (!hasDocs)       docScore -= 40;
  if (!hasEnvExample) docScore -= 30;
  dimensions.documentation = Math.max(0, docScore);

  // ── Performance (10%) ────────────────────────────────────────────────────
  let perfScore = 100;
  const buildMs = buildResult?.durationMs ?? 0;
  if (buildMs > 120000) perfScore -= 30; // >2min
  else if (buildMs > 60000)  perfScore -= 15;
  else if (buildMs > 30000)  perfScore -= 5;
  const testMs = testResult?.durationMs ?? 0;
  if (testMs > 120000) perfScore -= 20;
  else if (testMs > 60000)  perfScore -= 10;
  if (largeFiles > 0) perfScore -= Math.min(20, largeFiles * 5);
  dimensions.performance = Math.max(0, perfScore);

  // ── Stability (25%) ──────────────────────────────────────────────────────
  let stabilityScore = 100;
  const totalErrors = (buildResult?.errors?.length ?? 0) + (testResult?.errors?.length ?? 0);
  stabilityScore -= Math.min(80, totalErrors * 15);
  if (buildResult?.timedOut || testResult?.timedOut) stabilityScore -= 30;
  // Deduct for patches applied (each patch = minor instability risk)
  stabilityScore -= Math.min(20, patchHistory.length * 5);
  dimensions.stability = Math.max(0, stabilityScore);

  // ── Core functionality (20%) ─────────────────────────────────────────────
  let coreScore = 100;
  if (buildResult && !buildResult.success)       coreScore -= 40;
  if (testResult  && !testResult.success)        coreScore -= 30;
  const hasRoutes     = (projectMap?.routes?.length     ?? 0) > 0;
  const hasComponents = (projectMap?.components?.length ?? 0) > 0;
  if (!hasRoutes && !hasComponents) coreScore -= 10;
  dimensions.coreFunctionality = Math.max(0, coreScore);

  // ── Weighted total ────────────────────────────────────────────────────────
  const total = Math.round(
    Object.entries(WEIGHTS).reduce((acc, [dim, w]) => acc + (dimensions[dim] ?? 100) * w, 0)
  );

  const grade =
    total >= THRESHOLDS.PASS    ? 'PASS'    :
    total >= THRESHOLDS.WARNING ? 'WARNING' : 'FAIL';

  return {
    total,
    grade,
    dimensions,
    weights: WEIGHTS,
    thresholds: THRESHOLDS,
    breakdown: Object.entries(dimensions).map(([dim, score]) => ({
      dimension: dim,
      score,
      weight: WEIGHTS[dim],
      weighted: Math.round(score * WEIGHTS[dim]),
    })),
  };
}
