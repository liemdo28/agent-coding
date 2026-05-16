// orchestrator/ProjectSelector.js — Manage which project is currently selected
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { getGlobalDir, ensureGlobalDir, getProject } from './ProjectRegistry.js';

// ── Path helper ───────────────────────────────────────────────────────────────

export function getSelectedPath() {
  return join(getGlobalDir(), 'selected.json');
}

// ── Read / write selected project ─────────────────────────────────────────────

/**
 * Returns the currently selected project as { projectId, projectRoot },
 * or null if nothing is selected.
 */
export function getSelected() {
  const path = getSelectedPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const obj = JSON.parse(raw);
    if (obj && obj.projectId && obj.projectRoot) return obj;
    return null;
  } catch {
    return null;
  }
}

/**
 * Select a project by ID.
 * Loads it from the registry to get projectRoot, then writes selected.json.
 * Throws if the project is not found in the registry.
 */
export function selectProject(projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project "${projectId}" not found in registry`);
  }
  ensureGlobalDir();
  const selection = { projectId: project.projectId, projectRoot: project.root };
  writeFileSync(getSelectedPath(), JSON.stringify(selection, null, 2), 'utf8');
  return selection;
}

/**
 * Clear the current selection. No-op if nothing is selected.
 */
export function clearSelection() {
  const path = getSelectedPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Returns the project root of the currently selected project, or null.
 */
export function getSelectedRoot() {
  const sel = getSelected();
  return sel ? sel.projectRoot : null;
}

/**
 * Returns true if the given projectId is currently selected.
 */
export function isSelected(projectId) {
  const sel = getSelected();
  return sel !== null && sel.projectId === projectId;
}
