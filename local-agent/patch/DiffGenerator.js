// patch/DiffGenerator.js - generate unified diffs via LLM or manual input

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { createPatch }   from 'diff';
import { LocalLLMAdapter }          from '../llm/LocalLLMAdapter.js';
import { buildContext, renderContextPrompt } from '../llm/context.js';
import { assertPathInWorkspace }    from '../core/policy.js';

// System prompt for patch generation
const PATCH_SYSTEM_PROMPT = `You are a local offline AI coding assistant that generates safe code patches.

RULES:
1. Output ONLY unified diff patches in standard git format — no prose explanation.
2. Each patch starts with "--- a/<filepath>" and "+++ b/<filepath>".
3. Include correct @@ hunk headers with line numbers.
4. Never touch .env files, private keys, auth configuration, or payment logic.
5. Keep changes minimal — fix exactly what was asked, nothing more.
6. If you cannot safely implement the task, output: CANNOT_PATCH: <reason>

OUTPUT FORMAT:
\`\`\`diff
--- a/src/example.js
+++ b/src/example.js
@@ -1,5 +1,6 @@
 unchanged
-old line
+new line
 unchanged
\`\`\``;

/**
 * Parse diff blocks from raw LLM output.
 */
export function extractDiffBlocks(llmOutput) {
  const blocks = [];
  const re = /```diff\n([\s\S]+?)```/g;
  let m;

  while ((m = re.exec(llmOutput)) !== null) {
    const diffText  = m[1];
    const fileMatch = diffText.match(/^---\s+a\/(.+)$/m);
    if (!fileMatch) continue;
    const filePath = fileMatch[1].trim();
    blocks.push({ filePath, patchText: diffText });
  }
  return blocks;
}

/**
 * Generate a unified diff between two strings (for manual/computed diffs).
 *
 * @param {string} filePath      - Relative path (used as label)
 * @param {string} originalContent
 * @param {string} proposedContent
 * @returns {string} unified diff
 */
export function generateUnifiedDiff(filePath, originalContent, proposedContent) {
  return createPatch(
    filePath,
    originalContent,
    proposedContent,
    'original',
    'proposed',
    { context: 4 }
  );
}

/**
 * Use the local LLM to generate patch(es) for a given task.
 *
 * @param {string} task          - Description of what to fix/change
 * @param {string} workspaceRoot
 * @param {object} config        - Loaded agent config
 * @returns {Promise<{ patches: DiffBlock[], llmOutput: string, cannotPatch?: string }>}
 */
export async function generatePatchesViaLLM(task, workspaceRoot, config) {
  const adapter = new LocalLLMAdapter(config.llm);

  // Check availability
  const avail = await adapter.checkAvailability();
  if (!avail.available) {
    throw new Error(`LLM not available at ${config.llm.baseUrl}: ${avail.reason}`);
  }

  // Build context
  const context   = buildContext(task, workspaceRoot, config);
  const userPrompt = [
    renderContextPrompt(context),
    '',
    `## Task\n${task}`,
    '',
    'Generate the minimal unified diff patch(es) to accomplish this task.',
    'Follow the output format exactly.',
  ].join('\n');

  const llmOutput = await adapter.chat(PATCH_SYSTEM_PROMPT, userPrompt);

  // Check for explicit refusal
  const cannotMatch = llmOutput.match(/CANNOT_PATCH:\s*(.+)/i);
  if (cannotMatch) {
    return { patches: [], llmOutput, cannotPatch: cannotMatch[1].trim() };
  }

  const patches = extractDiffBlocks(llmOutput);
  return { patches, llmOutput };
}

/**
 * Read the current content of a file within the workspace.
 */
export function readWorkspaceFile(relPath, workspaceRoot) {
  const abs = resolve(workspaceRoot, relPath);
  assertPathInWorkspace(abs, workspaceRoot);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}
