// eng-log/ProgressTracker.js — track phases, modules, and task progress
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const PROGRESS_FILE = '.local-agent/engineering-log/progress.json';

const DEFAULT = {
  currentPhase:   null,
  completedPhases: [],
  inProgress:      [],
  pendingTasks:    [],
  blockedIssues:   [],
  priorities:      [],
  updatedAt:       null,
};

export function loadProgress(workspaceRoot) {
  const p = join(workspaceRoot, PROGRESS_FILE);
  if (!existsSync(p)) return { ...DEFAULT };
  try { return { ...DEFAULT, ...JSON.parse(readFileSync(p, 'utf8')) }; }
  catch { return { ...DEFAULT }; }
}

export function saveProgress(workspaceRoot, data) {
  const dir = join(workspaceRoot, '.local-agent', 'engineering-log');
  mkdirSync(dir, { recursive: true });
  data.updatedAt = new Date().toISOString();
  writeFileSync(join(workspaceRoot, PROGRESS_FILE), JSON.stringify(data, null, 2));
  return data;
}

export function setCurrentPhase(workspaceRoot, phase) {
  const p = loadProgress(workspaceRoot);
  p.currentPhase = phase;
  return saveProgress(workspaceRoot, p);
}

export function markCompleted(workspaceRoot, item) {
  const p = loadProgress(workspaceRoot);
  if (!p.completedPhases.includes(item)) p.completedPhases.push(item);
  p.inProgress = p.inProgress.filter((x) => x !== item);
  return saveProgress(workspaceRoot, p);
}

export function addInProgress(workspaceRoot, item) {
  const p = loadProgress(workspaceRoot);
  if (!p.inProgress.includes(item)) p.inProgress.push(item);
  return saveProgress(workspaceRoot, p);
}

export function addPendingTask(workspaceRoot, task) {
  const p = loadProgress(workspaceRoot);
  p.pendingTasks.push({ task, addedAt: new Date().toISOString() });
  return saveProgress(workspaceRoot, p);
}

export function setPriorities(workspaceRoot, priorities) {
  const p = loadProgress(workspaceRoot);
  p.priorities = priorities;
  return saveProgress(workspaceRoot, p);
}
