// testing/RegressionDetector.js - Detects regressions by comparing test results
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

function getBaselineDir(workspaceRoot) {
  return join(workspaceRoot, '.local-agent', 'baselines');
}

function getBaselinePath(workspaceRoot, patchId) {
  return join(getBaselineDir(workspaceRoot), `baseline-${patchId}.json`);
}

export function saveTestBaseline(testResult, patchId, workspaceRoot) {
  const dir = getBaselineDir(workspaceRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const baseline = {
    patchId,
    savedAt:  new Date().toISOString(),
    passed:   testResult.summary?.passed   ?? 0,
    failed:   testResult.summary?.failed   ?? 0,
    total:    testResult.summary?.total    ?? 0,
    success:  testResult.success           ?? false,
    testNames: testResult.testNames        ?? [],
  };
  writeFileSync(getBaselinePath(workspaceRoot, patchId), JSON.stringify(baseline, null, 2));
  return baseline;
}

export function compareWithBaseline(currentResult, patchId, workspaceRoot) {
  const path = getBaselinePath(workspaceRoot, patchId);
  if (!existsSync(path)) return { hasRegressions: false, regressions: [], improvements: [], noBaseline: true };

  const baseline = JSON.parse(readFileSync(path, 'utf8'));
  const regressions  = [];
  const improvements = [];

  if (!currentResult.success && baseline.success) {
    regressions.push(`Tests were passing before patch ${patchId}, now failing.`);
  }
  if (currentResult.success && !baseline.success) {
    improvements.push(`Tests were failing before patch ${patchId}, now passing.`);
  }

  const curFailed  = currentResult.summary?.failed ?? 0;
  const baseFailed = baseline.failed;
  if (curFailed > baseFailed) {
    regressions.push(`Failed tests increased: ${baseFailed} → ${curFailed}`);
  } else if (curFailed < baseFailed) {
    improvements.push(`Failed tests decreased: ${baseFailed} → ${curFailed}`);
  }

  return { hasRegressions: regressions.length > 0, regressions, improvements };
}

export function getBaselineSummary(workspaceRoot) {
  const dir = getBaselineDir(workspaceRoot);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.startsWith('baseline-') && f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch { return []; }
}

export function generateRegressionReport(comparison, workspaceRoot) {
  const reportsDir = join(workspaceRoot, '.local-agent', 'reports');
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(reportsDir, `regression-${ts}.md`);

  const lines = [
    '# Regression Report',
    `**Date**: ${new Date().toISOString()}`,
    `**Result**: ${comparison.hasRegressions ? 'REGRESSION DETECTED' : 'PASS'}`,
    '',
    '## Regressions',
    comparison.regressions.length ? comparison.regressions.map((r) => `- ✗ ${r}`).join('\n') : '- None detected.',
    '',
    '## Improvements',
    comparison.improvements.length ? comparison.improvements.map((i) => `- ✓ ${i}`).join('\n') : '- None.',
  ];

  writeFileSync(path, lines.join('\n'));
  return path;
}
