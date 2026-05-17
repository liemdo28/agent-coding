// eng-log/CheckpointWriter.js — write phase/step checkpoints as Markdown files
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const CHECKPOINTS_DIR = '.local-agent/engineering-log/checkpoints';

/**
 * Count existing checkpoints.
 * @param {string} workspaceRoot
 * @returns {number}
 */
export function countCheckpoints(workspaceRoot) {
  const dir = join(workspaceRoot, CHECKPOINTS_DIR);
  if (!existsSync(dir)) return 0;
  try { return readdirSync(dir).filter((f) => f.endsWith('.md')).length; }
  catch { return 0; }
}

/**
 * Write a new checkpoint.
 * @param {string} workspaceRoot
 * @param {{ phase: string, title: string, implemented: string[], filesChanged: string[],
 *           risks: string[], decisions: string[], rollbackNotes: string,
 *           qaResult: string, nextStep: string }} opts
 * @returns {{ id: string, path: string }}
 */
export function writeCheckpoint(workspaceRoot, opts) {
  const dir = join(workspaceRoot, CHECKPOINTS_DIR);
  mkdirSync(dir, { recursive: true });

  const seq  = String(countCheckpoints(workspaceRoot) + 1).padStart(3, '0');
  const id   = `checkpoint-${seq}`;
  const ts   = new Date().toISOString();

  const content = `# Checkpoint ${seq}: ${opts.title}

**Phase:** ${opts.phase}
**Timestamp:** ${ts}
**QA Result:** ${opts.qaResult}

## What Was Implemented
${opts.implemented.map((i) => `- ${i}`).join('\n') || '- (see phase notes)'}

## Files Changed
${opts.filesChanged.map((f) => `- \`${f}\``).join('\n') || '- (see git diff)'}

## Risks
${opts.risks.map((r) => `- ${r}`).join('\n') || '- none identified'}

## Decisions Made
${opts.decisions.map((d) => `- ${d}`).join('\n') || '- none'}

## Rollback Notes
${opts.rollbackNotes || 'Standard git revert applies.'}

## Next Step
${opts.nextStep || 'See latest.md for current priorities.'}
`;

  const path = join(dir, `${id}.md`);
  writeFileSync(path, content);
  return { id, path };
}

/**
 * List all checkpoints (most recent first).
 * @param {string} workspaceRoot
 * @param {{ limit?: number }} opts
 * @returns {Array<{ id: string, path: string, preview: string }>}
 */
export function listCheckpoints(workspaceRoot, { limit = 10 } = {}) {
  const dir = join(workspaceRoot, CHECKPOINTS_DIR);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit)
      .map((f) => {
        const abs     = join(dir, f);
        const content = readFileSync(abs, 'utf8');
        const firstLine = content.split('\n')[0].replace(/^#+\s*/, '');
        return { id: f.replace('.md', ''), path: abs, preview: firstLine };
      });
  } catch { return []; }
}

/**
 * Read a specific checkpoint by ID or index.
 * @param {string} workspaceRoot
 * @param {string} idOrSeq — e.g. 'checkpoint-001' or '1'
 * @returns {string|null}
 */
export function readCheckpoint(workspaceRoot, idOrSeq) {
  const dir  = join(workspaceRoot, CHECKPOINTS_DIR);
  const seq  = String(parseInt(idOrSeq)).padStart(3, '0');
  const name = idOrSeq.startsWith('checkpoint-') ? idOrSeq : `checkpoint-${seq}`;
  const p    = join(dir, `${name}.md`);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}
