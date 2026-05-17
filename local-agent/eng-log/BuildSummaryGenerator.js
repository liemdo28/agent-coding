// eng-log/BuildSummaryGenerator.js — auto-generate build/QA run summaries
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUMMARIES_DIR = '.local-agent/engineering-log/summaries';

/**
 * Generate a build/QA run summary and write it to disk.
 * @param {string} workspaceRoot
 * @param {{ commands: string[], durationMs: number, errors: string[], fixes: string[],
 *           patches: string[], qaResult: string, qaScore?: number,
 *           recommendation: string, phase?: string }} opts
 * @returns {{ path: string, filename: string }}
 */
export function generateBuildSummary(workspaceRoot, opts) {
  const dir = join(workspaceRoot, SUMMARIES_DIR);
  mkdirSync(dir, { recursive: true });

  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `build-summary-${ts}.md`;
  const durationS = opts.durationMs > 0 ? (opts.durationMs / 1000).toFixed(1) : 'n/a';

  const content = `# Build Summary — ${new Date().toISOString()}

**Phase:** ${opts.phase ?? 'n/a'}
**Duration:** ${durationS}s
**QA Result:** ${opts.qaResult}${opts.qaScore !== undefined ? ` (score: ${opts.qaScore}/100)` : ''}

## Commands Run
${opts.commands.length ? opts.commands.map((c) => `\`\`\`\n${c}\n\`\`\``).join('\n') : '- none'}

## Errors
${opts.errors.length ? opts.errors.map((e) => `- ${e}`).join('\n') : '- none'}

## Fixes Applied
${opts.fixes.length ? opts.fixes.map((f) => `- ${f}`).join('\n') : '- none'}

## Patches
${opts.patches.length ? opts.patches.map((p) => `- ${p}`).join('\n') : '- none'}

## Recommendation
${opts.recommendation}
`;

  const path = join(dir, filename);
  writeFileSync(path, content);
  return { path, filename };
}

/**
 * Quick summary helper for a completed QA run.
 * @param {string} workspaceRoot
 * @param {{ passed: boolean, score?: number, errors?: string[], phase?: string }} qaInfo
 * @returns {{ path: string, filename: string }}
 */
export function summaryFromQA(workspaceRoot, qaInfo) {
  return generateBuildSummary(workspaceRoot, {
    commands:       ['local-agent qa'],
    durationMs:     0,
    errors:         qaInfo.errors ?? [],
    fixes:          [],
    patches:        [],
    qaResult:       qaInfo.passed ? `PASS` : `FAIL`,
    qaScore:        qaInfo.score,
    phase:          qaInfo.phase ?? 'n/a',
    recommendation: qaInfo.passed
      ? 'QA passed. Ready to proceed to next phase.'
      : 'QA failed. Fix errors before proceeding.',
  });
}
