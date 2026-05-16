// debug/AutoDebugLoop.js - orchestrates the autonomous build→diagnose→fix→retry loop

import { join }          from 'path';
import { existsSync, readFileSync } from 'fs';
import { runBuild, runStaticChecks } from '../qa/BuildRunner.js';
import { runTests }                  from '../qa/TestRunner.js';
import { classifyFailures, isSafeToAutoFix } from '../qa/FailureClassifier.js';
import { RetryPlanner }              from './RetryPlanner.js';
import { applyPatchBatch, estimatePatchRisk } from './SafeFixExecutor.js';
import { LocalLLMAdapter }           from '../llm/LocalLLMAdapter.js';
import { buildContext, renderContextPrompt } from '../llm/context.js';
import { logger }                    from '../core/logger.js';

// System prompt for fix generation
const FIX_SYSTEM_PROMPT = `You are a local offline AI coding agent specialized in diagnosing and fixing build/test errors.

RULES:
1. Only suggest fixes for errors explicitly listed in the context.
2. Output ONLY unified diff patches (git diff format) — nothing else.
3. Each patch must start with "--- a/<filepath>" and "+++ b/<filepath>".
4. Do NOT touch .env files, private keys, auth configuration, or database schema.
5. Keep changes minimal — fix exactly what is broken, nothing more.
6. If you cannot safely fix an error, respond with: CANNOT_FIX: <reason>

OUTPUT FORMAT (one or more patches):
\`\`\`diff
--- a/src/foo.js
+++ b/src/foo.js
@@ -10,6 +10,7 @@
 unchanged line
-old line
+new line
 unchanged line
\`\`\``;

/**
 * Parse unified diff blocks from LLM output.
 */
function extractPatches(llmOutput, workspaceRoot) {
  const patches = [];
  const blockRe = /```diff\n([\s\S]+?)```/g;
  let   m;

  while ((m = blockRe.exec(llmOutput)) !== null) {
    const diffText = m[1];
    // Extract filename from "--- a/path/to/file"
    const fileMatch = diffText.match(/^---\s+a\/(.+)$/m);
    if (!fileMatch) continue;

    const filePath = fileMatch[1].trim();
    const risk     = estimatePatchRisk([{ filePath }]);

    patches.push({ filePath, patchText: diffText, risk });
  }
  return patches;
}

/**
 * Build the LLM prompt for fix generation.
 */
function buildFixPrompt(errors, classification, workspaceRoot, config) {
  const ctx = buildContext(
    `Fix the following errors:\n${errors.slice(0, 5).map((e) =>
      `- [${e.errorType}] ${e.message}${e.file ? ` in ${e.file}:${e.line}` : ''}`
    ).join('\n')}`,
    workspaceRoot,
    config
  );
  const contextStr = renderContextPrompt(ctx);

  return [
    contextStr,
    '',
    '## Errors to Fix',
    errors.slice(0, 5).map((e) => [
      `### ${e.errorType}: ${e.message}`,
      e.file     ? `File: ${e.file}:${e.line ?? '?'}` : '',
      e.module   ? `Module: ${e.module}` : '',
      e.stackTrace?.length ? `Stack:\n${e.stackTrace.slice(0, 5).join('\n')}` : '',
    ].filter(Boolean).join('\n')).join('\n\n'),
    '',
    `## Probable Cause\n${classification.probableCause ?? 'Unknown'}`,
    '',
    'Generate minimal unified diff patches to fix the errors above.',
  ].join('\n');
}

/**
 * Run the full autonomous debug loop.
 *
 * @param {string} workspaceRoot
 * @param {object} config - Agent config
 * @param {object} options
 * @param {boolean} options.useLLM  - Whether to call the LLM for fix proposals (default true)
 * @param {Function} options.onProgress - Callback({ phase, message })
 * @returns {Promise<DebugLoopResult>}
 */
export async function runAutoDebugLoop(workspaceRoot, config, options = {}) {
  const { useLLM = true, onProgress = () => {} } = options;

  const retryConfig = config.retryConfig ?? {
    maxRetryLoops: 3,
    maxFilesChangedPerLoop: 10,
    maxPatchRisk: 0.75,
    requireApprovalForHighRisk: true,
  };

  const planner      = new RetryPlanner(retryConfig);
  const allPatches   = [];
  const loopResults  = [];

  let   llmAdapter = null;
  if (useLLM) {
    try {
      llmAdapter = new LocalLLMAdapter(config.llm);
      const avail = await llmAdapter.checkAvailability();
      if (!avail.available) {
        onProgress({ phase: 'llm', message: `LLM unavailable: ${avail.reason} — running without auto-fix` });
        llmAdapter = null;
      }
    } catch (err) {
      onProgress({ phase: 'llm', message: `LLM init error: ${err.message} — running without auto-fix` });
      llmAdapter = null;
    }
  }

  // ── Initial run ───────────────────────────────────────────────────────────
  onProgress({ phase: 'build', message: 'Running initial build...' });
  let buildResult   = await runBuild(workspaceRoot, config);
  let staticResults = await runStaticChecks(workspaceRoot, config);

  onProgress({ phase: 'test', message: 'Running tests...' });
  let testResult = await runTests(workspaceRoot, config);

  loopResults.push({ loop: 0, buildResult, testResult, staticResults, patches: [] });

  // ── Retry loop ────────────────────────────────────────────────────────────
  while (true) {
    const allErrors = [
      ...(buildResult.errors   ?? []),
      ...(testResult.errors    ?? []),
      ...(staticResults.flatMap((r) => r.errors ?? [])),
    ];

    const classification = classifyFailures(allErrors);
    const safetyCheck    = isSafeToAutoFix(classification, retryConfig);
    const evalResult     = planner.evaluate({ buildResult, testResult }, classification, 0);

    if (!evalResult.shouldRetry || !llmAdapter || !safetyCheck.safe) {
      onProgress({
        phase:   'loop-end',
        message: evalResult.reason || safetyCheck.reason || 'No retry',
      });
      break;
    }

    planner.beginLoop(allErrors, classification);
    onProgress({ phase: 'fix', message: `Loop ${planner.currentLoop}: querying LLM for fix proposals...` });

    // Generate fix proposals via LLM
    let patches = [];
    try {
      const fixPrompt = buildFixPrompt(allErrors, classification, workspaceRoot, config);
      const llmResponse = await llmAdapter.chat(FIX_SYSTEM_PROMPT, fixPrompt);
      patches = extractPatches(llmResponse, workspaceRoot);
      logger.info('auto-debug: patches extracted', { count: patches.length });
    } catch (err) {
      onProgress({ phase: 'fix', message: `LLM error: ${err.message}` });
      break;
    }

    if (!patches.length) {
      onProgress({ phase: 'fix', message: 'LLM could not generate patches — stopping' });
      break;
    }

    // Apply patches
    onProgress({ phase: 'apply', message: `Applying ${patches.length} patch(es)...` });
    const applyResult = await applyPatchBatch(patches, workspaceRoot, config);
    allPatches.push(...applyResult.results.filter((r) => r.success));

    // Re-run build and tests
    onProgress({ phase: 'build', message: `Re-running build after patch...` });
    buildResult   = await runBuild(workspaceRoot, config);
    staticResults = await runStaticChecks(workspaceRoot, config);

    onProgress({ phase: 'test', message: 'Re-running tests...' });
    testResult = await runTests(workspaceRoot, config);

    loopResults.push({
      loop:    planner.currentLoop,
      buildResult,
      testResult,
      staticResults,
      patches: applyResult.results,
    });

    planner.endLoop(applyResult, { buildResult, testResult });
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const finalErrors = [
    ...(buildResult.errors ?? []),
    ...(testResult.errors  ?? []),
  ];

  return {
    loopCount:      planner.currentLoop,
    loopHistory:    planner.history,
    loopResults,
    buildResult,
    testResult,
    staticResults,
    allErrors:      finalErrors,
    classification: classifyFailures(finalErrors),
    patchesApplied: allPatches,
    buildSuccess:   buildResult.success,
    testSuccess:    testResult.success,
    totalErrors:    finalErrors.length,
  };
}
