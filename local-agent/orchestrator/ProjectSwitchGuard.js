// orchestrator/ProjectSwitchGuard.js — Safety checks before switching projects
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { getProject } from './ProjectRegistry.js';

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Throws an Error if projectId is not present in the registry.
 */
export function validateProjectExists(projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project "${projectId}" does not exist in the registry`);
  }
  return project;
}

/**
 * Check whether any patches in a project's .local-agent/patches/ directory
 * are still in the 'proposed' state.
 *
 * Returns { safe: boolean, pending: string[] } where pending is a list of
 * patch filenames that are proposed but not yet applied or rejected.
 */
export function checkNoPendingOperations(workspaceRoot) {
  const patchDir = join(workspaceRoot, '.local-agent', 'patches');
  if (!existsSync(patchDir)) return { safe: true, pending: [] };

  let files;
  try {
    files = readdirSync(patchDir).filter((f) => f.endsWith('.json'));
  } catch {
    return { safe: true, pending: [] };
  }

  const pending = [];
  for (const file of files) {
    try {
      const raw = readFileSync(join(patchDir, file), 'utf8');
      const patch = JSON.parse(raw);
      if (patch && patch.status === 'proposed') {
        pending.push(file);
      }
    } catch {
      // Unreadable patch — skip
    }
  }

  return { safe: pending.length === 0, pending };
}

/**
 * Validate switching away from `fromRoot` to the project identified by
 * `toProjectId`. Checks:
 *   1. The target project exists in the registry.
 *   2. The current workspace has no pending (proposed) patches.
 *
 * Returns { safe: boolean, warnings: string[] }.
 * Does NOT throw — callers should inspect the result and decide.
 */
export function validateSwitch(fromRoot, toProjectId) {
  const warnings = [];

  // Check target project exists
  const target = getProject(toProjectId);
  if (!target) {
    warnings.push(`Target project "${toProjectId}" is not registered`);
    return { safe: false, warnings };
  }

  // Check pending operations on the current workspace
  if (fromRoot) {
    const { safe, pending } = checkNoPendingOperations(fromRoot);
    if (!safe) {
      warnings.push(
        `Current project has ${pending.length} proposed patch(es) that have not been applied or rejected: ${pending.join(', ')}`
      );
    }
  }

  return { safe: warnings.length === 0, warnings };
}
