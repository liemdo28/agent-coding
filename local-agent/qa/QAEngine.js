// qa/QAEngine.js - top-level QA orchestrator

import { join }          from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadConfig }       from '../core/config.js';
import { initLogger, logger } from '../core/logger.js';
import { isWorkspaceInitialized } from '../core/workspace.js';
import { runPolicyChecks }  from '../core/policy.js';
import { runBuild, runStaticChecks } from './BuildRunner.js';
import { runTests }         from './TestRunner.js';
import { scoreQA }          from './QAScorer.js';
import { detectRegressions } from './RegressionDetector.js';
import { buildQAReportJSON, writeQAReports } from './QAReporter.js';
import { runAutoDebugLoop } from '../debug/AutoDebugLoop.js';

function loadProjectMap(workspaceRoot) {
  const p = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function loadScanReport(workspaceRoot) {
  const p = join(workspaceRoot, '.local-agent', 'scan-report.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Run a complete QA pass.
 *
 * @param {string} workspaceRoot
 * @param {object} options
 * @param {boolean} options.deep        - Run static checks + full test suite
 * @param {boolean} options.autoFix     - Engage auto debug loop (requires LLM)
 * @param {Function} options.onProgress - Progress callback({ phase, message })
 * @returns {Promise<QAEngineResult>}
 */
export async function runQA(workspaceRoot, options = {}) {
  const { deep = false, autoFix = false, onProgress = () => {} } = options;

  // ── Setup ─────────────────────────────────────────────────────────────────
  const config     = loadConfig(workspaceRoot);
  initLogger(workspaceRoot, 'info', false);

  if (!isWorkspaceInitialized(workspaceRoot)) {
    throw new Error('Workspace not initialized. Run: local-agent init');
  }

  // Policy gate
  const policy = runPolicyChecks(workspaceRoot, config);
  if (!policy.passed) {
    throw new Error(`Policy check failed (${policy.failCount} violations). Run: local-agent policy-check`);
  }

  const projectMap  = loadProjectMap(workspaceRoot);
  const scanReport  = loadScanReport(workspaceRoot);
  const reportsDir  = join(workspaceRoot, '.local-agent', 'reports');

  // ── Build ─────────────────────────────────────────────────────────────────
  onProgress({ phase: 'build', message: 'Running build...' });
  const buildResult = await runBuild(workspaceRoot, config);
  logger.info('qa: build done', { success: buildResult.success, errors: buildResult.errors.length });

  // ── Static checks (deep mode) ─────────────────────────────────────────────
  let staticResults = [];
  if (deep) {
    onProgress({ phase: 'static', message: 'Running lint + typecheck...' });
    staticResults = await runStaticChecks(workspaceRoot, config);
    logger.info('qa: static checks done', { count: staticResults.length });
  }

  // ── Tests ─────────────────────────────────────────────────────────────────
  onProgress({ phase: 'test', message: 'Running tests...' });
  const testResult = await runTests(workspaceRoot, config);
  logger.info('qa: test done', { success: testResult.success, summary: testResult.summary });

  // ── Auto debug loop (optional) ─────────────────────────────────────────────
  let debugResult = null;
  if (autoFix && (!buildResult.success || !testResult.success)) {
    onProgress({ phase: 'debug', message: 'Engaging auto debug loop...' });
    debugResult = await runAutoDebugLoop(workspaceRoot, config, {
      useLLM: true,
      onProgress,
    });
    logger.info('qa: debug loop done', { loops: debugResult.loopCount, patches: debugResult.patchesApplied.length });
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const finalBuildResult = debugResult?.buildResult ?? buildResult;
  const finalTestResult  = debugResult?.testResult  ?? testResult;

  const qaScore = scoreQA({
    buildResult:   finalBuildResult,
    staticResults,
    testResult:    finalTestResult,
    projectMap,
    scanReport,
    patchHistory:  debugResult?.patchesApplied ?? [],
  });
  logger.info('qa: score', { total: qaScore.total, grade: qaScore.grade });

  // ── Regression detection ───────────────────────────────────────────────────
  const regression = detectRegressions({
    qaScore,
    buildSuccess: finalBuildResult.success,
    testSuccess:  finalTestResult.success,
    totalErrors:  (finalBuildResult.errors?.length ?? 0) + (finalTestResult.errors?.length ?? 0),
    secretCount:  projectMap?.risks?.hardcodedSecrets?.length ?? 0,
  }, reportsDir);

  // ── Write report ──────────────────────────────────────────────────────────
  const reportJSON = buildQAReportJSON({
    workspaceRoot,
    projectMap,
    scanReport,
    buildResult:   finalBuildResult,
    staticResults,
    testResult:    finalTestResult,
    qaScore,
    regression,
    debugResult,
    config,
  });

  const { jsonPath, mdPath } = writeQAReports(workspaceRoot, reportJSON);
  logger.info('qa: reports written', { jsonPath, mdPath });

  return {
    qaScore,
    regression,
    buildResult:  finalBuildResult,
    testResult:   finalTestResult,
    staticResults,
    debugResult,
    report:       reportJSON,
    reportPaths:  { json: jsonPath, md: mdPath },
  };
}
