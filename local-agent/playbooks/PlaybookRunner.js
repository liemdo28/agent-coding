// playbooks/PlaybookRunner.js — dry-run a playbook and track progress
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { findPlaybook, BUILTIN_PLAYBOOKS } from './PlaybookLibrary.js';

/**
 * Print a playbook run plan without executing commands.
 * @param {string} query — playbook id or name
 * @returns {PlaybookRunPlan|null}
 */
export function planRun(query) {
  const pb = findPlaybook(query);
  if (!pb) return null;
  return {
    id:    pb.id,
    name:  pb.name,
    steps: pb.steps,
    note:  'Dry-run only. Commands listed are for manual execution.',
  };
}

/**
 * Export all playbooks to a target directory.
 * @param {string} targetDir
 * @returns {{ exported: number, path: string }}
 */
export function exportPlaybooks(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  let exported = 0;
  for (const pb of BUILTIN_PLAYBOOKS) {
    const p = join(targetDir, `${pb.id}.json`);
    writeFileSync(p, JSON.stringify(pb, null, 2));
    exported++;
  }
  return { exported, path: targetDir };
}
