// qa/RegressionDetector.js - detect regressions by comparing QA runs over time

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load the most recent previous QA JSON report from the reports directory.
 */
function loadPreviousReport(reportsDir) {
  if (!existsSync(reportsDir)) return null;

  const files = readdirSync(reportsDir)
    .filter((f) => f.startsWith('qa-report-') && f.endsWith('.json'))
    .sort()
    .reverse(); // most recent first

  for (const file of files) {
    try {
      return JSON.parse(readFileSync(join(reportsDir, file), 'utf8'));
    } catch { /* skip corrupt files */ }
  }
  return null;
}

/**
 * Compare current QA results with the previous run and flag regressions.
 *
 * @param {object} current  - Current QAScore + run metadata
 * @param {string} reportsDir
 * @returns {RegressionResult}
 */
export function detectRegressions(current, reportsDir) {
  const previous = loadPreviousReport(reportsDir);

  if (!previous) {
    return {
      hasPrevious:   false,
      regressions:   [],
      improvements:  [],
      riskScore:     0,
      summary:       'No previous QA run to compare against.',
    };
  }

  const regressions  = [];
  const improvements = [];

  // ── Score delta ──────────────────────────────────────────────────────────
  const prevTotal = previous.qaScore?.total ?? previous.score?.total ?? null;
  const currTotal = current.qaScore?.total  ?? null;
  if (prevTotal !== null && currTotal !== null) {
    const delta = currTotal - prevTotal;
    if (delta < -10) {
      regressions.push({
        type:    'SCORE_REGRESSION',
        message: `Overall QA score dropped by ${Math.abs(delta)} points (${prevTotal} → ${currTotal})`,
        delta,
        severity: delta < -25 ? 'high' : 'medium',
      });
    } else if (delta > 5) {
      improvements.push({ type: 'SCORE_IMPROVEMENT', message: `QA score improved by ${delta} points`, delta });
    }
  }

  // ── Error count delta ────────────────────────────────────────────────────
  const prevErrors = previous.totalErrors ?? 0;
  const currErrors = current.totalErrors  ?? 0;
  if (currErrors > prevErrors) {
    regressions.push({
      type:    'ERROR_REGRESSION',
      message: `Error count increased: ${prevErrors} → ${currErrors}`,
      delta:   currErrors - prevErrors,
      severity: (currErrors - prevErrors) > 5 ? 'high' : 'medium',
    });
  } else if (currErrors < prevErrors) {
    improvements.push({
      type: 'ERROR_IMPROVEMENT',
      message: `Error count reduced: ${prevErrors} → ${currErrors}`,
      delta: prevErrors - currErrors,
    });
  }

  // ── Build status ─────────────────────────────────────────────────────────
  const prevBuildOk = previous.buildSuccess ?? null;
  const currBuildOk = current.buildSuccess  ?? null;
  if (prevBuildOk === true && currBuildOk === false) {
    regressions.push({
      type:     'BUILD_REGRESSION',
      message:  'Build was passing but now fails — a recent change broke the build',
      severity: 'high',
    });
  } else if (prevBuildOk === false && currBuildOk === true) {
    improvements.push({ type: 'BUILD_IMPROVEMENT', message: 'Build is now passing' });
  }

  // ── Test status ──────────────────────────────────────────────────────────
  const prevTestOk = previous.testSuccess ?? null;
  const currTestOk = current.testSuccess  ?? null;
  if (prevTestOk === true && currTestOk === false) {
    regressions.push({
      type:     'TEST_REGRESSION',
      message:  'Tests were passing but now fail',
      severity: 'high',
    });
  } else if (prevTestOk === false && currTestOk === true) {
    improvements.push({ type: 'TEST_IMPROVEMENT', message: 'Tests are now passing' });
  }

  // ── Security regressions (new secrets detected) ──────────────────────────
  const prevSecrets = previous.secretCount ?? 0;
  const currSecrets = current.secretCount  ?? 0;
  if (currSecrets > prevSecrets) {
    regressions.push({
      type:     'SECURITY_REGRESSION',
      message:  `New possible hardcoded secret(s) detected: ${prevSecrets} → ${currSecrets}`,
      severity: 'high',
    });
  }

  // ── Overall regression risk ───────────────────────────────────────────────
  const highRegressions = regressions.filter((r) => r.severity === 'high').length;
  const riskScore = Math.min(1,
    regressions.length * 0.15 + highRegressions * 0.25
  );

  return {
    hasPrevious:  true,
    previousRun:  previous.generatedAt ?? 'unknown',
    regressions,
    improvements,
    riskScore:    +riskScore.toFixed(3),
    summary: regressions.length === 0
      ? 'No regressions detected vs. previous run.'
      : `${regressions.length} regression(s) detected.`,
  };
}
