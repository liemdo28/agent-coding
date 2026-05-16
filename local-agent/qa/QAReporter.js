// qa/QAReporter.js - generate QA reports in JSON and Markdown formats

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

function fmtMs(ms) {
  if (!ms) return 'n/a';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function resultIcon(success) {
  return success ? '✅' : '❌';
}

function gradeColor(grade) {
  return grade === 'PASS' ? '🟢' : grade === 'WARNING' ? '🟡' : '🔴';
}

/**
 * Build the full QA report JSON object.
 */
export function buildQAReportJSON({
  workspaceRoot, projectMap, scanReport,
  buildResult, staticResults = [], testResult,
  qaScore, regression, debugResult, config,
}) {
  const ts = new Date().toISOString();

  const projectName = (() => {
    const pkg = projectMap?.configFiles?.['package.json'];
    return pkg?.name ?? workspaceRoot.split('/').pop();
  })();

  const allErrors = [
    ...(buildResult?.errors ?? []),
    ...(staticResults.flatMap((r) => r.errors ?? [])),
    ...(testResult?.errors  ?? []),
    ...(debugResult?.allErrors ?? []),
  ];

  const rollbackCmds = (debugResult?.patchesApplied ?? [])
    .filter((p) => p.rollbackCmd)
    .map((p) => ({ file: p.filePath, cmd: p.rollbackCmd }));

  return {
    generatedAt:   ts,
    projectName,
    projectRoot:   workspaceRoot,
    framework:     projectMap?.frameworks?.[0] ?? 'unknown',
    language:      projectMap?.languages?.[0]  ?? 'unknown',
    packageManager: projectMap?.packageManager ?? 'unknown',

    commandsExecuted: [
      buildResult   ? { phase: 'build',     command: buildResult.command,    success: buildResult.success,   durationMs: buildResult.durationMs }   : null,
      testResult    ? { phase: 'test',       command: testResult.command,     success: testResult.success,    durationMs: testResult.durationMs }     : null,
      ...staticResults.map((r) => ({ phase: r.phase, command: r.command, success: r.success, durationMs: r.durationMs })),
    ].filter(Boolean),

    buildSuccess: buildResult?.success ?? null,
    testSuccess:  testResult?.success  ?? null,
    testSummary:  testResult?.summary  ?? null,

    totalErrors:  allErrors.length,
    errors:       allErrors.slice(0, 50),

    patchesGenerated: debugResult?.loopResults?.flatMap((l) => l.patches ?? []).length ?? 0,
    patchesApplied:   debugResult?.patchesApplied?.length ?? 0,
    retryLoops:       debugResult?.loopCount ?? 0,
    rollbackCommands: rollbackCmds,

    secretCount:  projectMap?.risks?.hardcodedSecrets?.length ?? 0,

    qaScore: {
      total:      qaScore?.total ?? 0,
      grade:      qaScore?.grade ?? 'FAIL',
      dimensions: qaScore?.dimensions ?? {},
    },

    regression: {
      hasPrevious:  regression?.hasPrevious  ?? false,
      regressions:  regression?.regressions  ?? [],
      improvements: regression?.improvements ?? [],
      riskScore:    regression?.riskScore    ?? 0,
    },

    remainingIssues: allErrors.slice(0, 20).map((e) => ({
      type:    e.errorType,
      message: e.message,
      file:    e.file,
      line:    e.line,
    })),
  };
}

/**
 * Build the Markdown QA report.
 */
export function buildQAReportMarkdown(report) {
  const { qaScore, buildSuccess, testSuccess, commandsExecuted, errors,
          patchesApplied, retryLoops, regression, remainingIssues, rollbackCommands } = report;

  const grade = qaScore?.grade ?? 'FAIL';
  const total = qaScore?.total ?? 0;

  const dimLines = Object.entries(qaScore?.dimensions ?? {}).map(([dim, score]) => {
    const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    return `| ${dim.padEnd(20)} | ${String(score).padStart(3)} | ${bar} |`;
  }).join('\n');

  const cmdLines = commandsExecuted.map((c) =>
    `| \`${c.command}\` | ${resultIcon(c.success)} | ${fmtMs(c.durationMs)} |`
  ).join('\n');

  const errorLines = errors.slice(0, 15).map((e) =>
    `| \`${e.errorType}\` | ${(e.message ?? '').slice(0, 60)} | ${e.file ? `\`${e.file}:${e.line}\`` : '—'} |`
  ).join('\n') || '| — | No errors | — |';

  const regressionLines = regression?.regressions?.map((r) =>
    `- **${r.severity?.toUpperCase() ?? 'INFO'}** ${r.message}`
  ).join('\n') || '_None detected_';

  const improvementLines = regression?.improvements?.map((r) =>
    `- ✅ ${r.message}`
  ).join('\n') || '_None_';

  const remainingLines = remainingIssues.slice(0, 10).map((i) =>
    `- [\`${i.type}\`] ${i.message}${i.file ? ` — \`${i.file}:${i.line}\`` : ''}`
  ).join('\n') || '_None_';

  const rollbackLines = rollbackCommands?.map((r) =>
    `- \`${r.file}\`\n  \`\`\`bash\n  ${r.cmd}\n  \`\`\``
  ).join('\n') || '_No patches applied_';

  return `# QA Report — ${report.projectName}

_Generated: ${report.generatedAt}_

## ${gradeColor(grade)} Overall Result: ${grade} — Score ${total}/100

| Field | Value |
|-------|-------|
| **Project** | ${report.projectName} |
| **Root** | \`${report.projectRoot}\` |
| **Framework** | ${report.framework} |
| **Language** | ${report.language} |
| **Build** | ${resultIcon(buildSuccess ?? false)} ${buildSuccess ? 'PASS' : 'FAIL'} |
| **Tests** | ${resultIcon(testSuccess ?? false)} ${testSuccess ? 'PASS' : 'FAIL'} |
| **Errors** | ${report.totalErrors} |
| **Retry Loops** | ${retryLoops} |
| **Patches Applied** | ${patchesApplied} |

## Score Breakdown

| Dimension | Score | Bar |
|-----------|-------|-----|
${dimLines}

## Commands Executed

| Command | Result | Duration |
|---------|--------|----------|
${cmdLines}

## Errors Detected (first 15)

| Type | Message | Location |
|------|---------|----------|
${errorLines}

## Regression Analysis

${regression?.hasPrevious
  ? `_Compared to run at: ${regression.previousRun}_\n\n### Regressions\n${regressionLines}\n\n### Improvements\n${improvementLines}`
  : '_No previous run to compare against._'}

## Remaining Issues

${remainingLines}

## Rollback Commands

${rollbackLines}
`;
}

/**
 * Write QA reports (JSON + Markdown) to the reports directory.
 */
export function writeQAReports(workspaceRoot, report) {
  const reportsDir = join(workspaceRoot, '.local-agent', 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const ts    = report.generatedAt.replace(/[:.]/g, '-');
  const base  = `qa-report-${ts}`;
  const jsonPath = join(reportsDir, `${base}.json`);
  const mdPath   = join(reportsDir, `${base}.md`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(mdPath,   buildQAReportMarkdown(report),   'utf8');

  return { jsonPath, mdPath };
}
