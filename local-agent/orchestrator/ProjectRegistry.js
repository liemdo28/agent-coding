// orchestrator/ProjectRegistry.js — Global project registry stored in ~/.local-agent-global/
import { join, resolve } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// ── Paths ─────────────────────────────────────────────────────────────────────

export function getGlobalDir() {
  return join(homedir(), '.local-agent-global');
}

export function getRegistryPath() {
  return join(getGlobalDir(), 'projects.json');
}

// ── Directory bootstrap ───────────────────────────────────────────────────────

export function ensureGlobalDir() {
  const dir = getGlobalDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateProjectId() {
  return 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

// ── Registry I/O ──────────────────────────────────────────────────────────────

export function loadRegistry() {
  const path = getRegistryPath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRegistry(projects) {
  ensureGlobalDir();
  writeFileSync(getRegistryPath(), JSON.stringify(projects, null, 2), 'utf8');
}

// ── CRUD operations ───────────────────────────────────────────────────────────

/**
 * Add a project to the registry.
 * Throws if the resolved rootPath is already registered.
 * Returns the new profile.
 */
export function addProject(rootPath, name) {
  const resolvedRoot = resolve(rootPath);
  const projects = loadRegistry();

  const existing = projects.find((p) => resolve(p.root) === resolvedRoot);
  if (existing) {
    throw new Error(`Project at "${resolvedRoot}" is already registered (id: ${existing.projectId})`);
  }

  const now = new Date().toISOString();
  const profile = {
    projectId:     generateProjectId(),
    name:          name || resolvedRoot.split('/').pop() || resolvedRoot,
    root:          resolvedRoot,
    framework:     null,
    language:      null,
    lastScan:      null,
    lastQA:        null,
    lastScore:     0,
    status:        'unknown',
    sandboxEnabled: true,
    addedAt:       now,
    updatedAt:     now,
  };

  projects.push(profile);
  saveRegistry(projects);
  return profile;
}

/**
 * Remove a project by ID. No-op if not found.
 */
export function removeProject(projectId) {
  const projects = loadRegistry();
  const filtered = projects.filter((p) => p.projectId !== projectId);
  saveRegistry(filtered);
}

/**
 * Get a single project by ID. Returns null if not found.
 */
export function getProject(projectId) {
  const projects = loadRegistry();
  return projects.find((p) => p.projectId === projectId) ?? null;
}

/**
 * Find a project by its root path (resolved). Returns null if not found.
 */
export function findProjectByRoot(rootPath) {
  const resolvedRoot = resolve(rootPath);
  const projects = loadRegistry();
  return projects.find((p) => resolve(p.root) === resolvedRoot) ?? null;
}

/**
 * List all projects, sorted newest-first by addedAt.
 */
export function listProjects() {
  const projects = loadRegistry();
  return [...projects].sort((a, b) => {
    const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Merge `updates` into a project entry and set updatedAt.
 * Throws if the project is not found.
 */
export function updateProject(projectId, updates) {
  const projects = loadRegistry();
  const idx = projects.findIndex((p) => p.projectId === projectId);
  if (idx === -1) {
    throw new Error(`Project "${projectId}" not found in registry`);
  }
  projects[idx] = {
    ...projects[idx],
    ...updates,
    projectId,          // never allow overwriting the ID
    updatedAt: new Date().toISOString(),
  };
  saveRegistry(projects);
  return projects[idx];
}
