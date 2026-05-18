// eng-log/ContextPriorityManager.js — log-first context priority order
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const PRIORITY_FILE = '.local-agent/engineering-log/context-priority.json';

// Default priority — logs first, source code last
export const DEFAULT_PRIORITY = [
  {
    order: 1, source: 'latest.md', type: 'engineering-log',
    description: 'Current project state — MUST read first before any implementation',
    path: '.local-agent/engineering-log/latest.md',
  },
  {
    order: 2, source: 'latest-checkpoint', type: 'engineering-log',
    description: 'Last checkpoint — tracks implementation progress and next steps',
    path: '.local-agent/engineering-log/checkpoints/',
  },
  {
    order: 3, source: 'file-purpose-index', type: 'engineering-log',
    description: 'File purpose index — locate relevant files without opening source',
    path: '.local-agent/engineering-log/file-purpose-index.json',
  },
  {
    order: 4, source: 'implementation-map', type: 'architecture',
    description: 'Module implementation map — purpose, main files, deps, status per module',
    path: '.local-agent/engineering-log/architecture/implementation-map.md',
  },
  {
    order: 5, source: 'architecture-docs', type: 'architecture',
    description: 'System architecture, runtime flow, dependency map, security model',
    path: '.local-agent/engineering-log/architecture/',
  },
  {
    order: 6, source: 'active-incidents', type: 'engineering-log',
    description: 'Active incidents and known issues — check for known blockers',
    path: '.local-agent/engineering-log/incidents/',
  },
  {
    order: 7, source: 'decisions', type: 'engineering-log',
    description: 'Architectural decisions — understand why things are built this way',
    path: '.local-agent/engineering-log/decisions/',
  },
  {
    order: 8, source: 'source-files', type: 'source',
    description: 'Source code — ONLY if engineering log context is insufficient',
    path: 'local-agent/',
  },
];

export function getContextPriority(workspaceRoot) {
  const p = join(workspaceRoot, PRIORITY_FILE);
  if (!existsSync(p)) return DEFAULT_PRIORITY;
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return DEFAULT_PRIORITY; }
}

export function setContextPriority(workspaceRoot, priorities) {
  mkdirSync(join(workspaceRoot, '.local-agent/engineering-log'), { recursive: true });
  writeFileSync(join(workspaceRoot, PRIORITY_FILE), JSON.stringify(priorities, null, 2));
}

export function resetToDefault(workspaceRoot) {
  setContextPriority(workspaceRoot, DEFAULT_PRIORITY);
}

/**
 * Rank context sources for a specific query.
 * Implementation-detail queries boost source-files rank slightly,
 * but log sources always come before source files.
 * @param {string} workspaceRoot
 * @param {string} query
 * @returns {typeof DEFAULT_PRIORITY}
 */
export function rankContextForQuery(workspaceRoot, query) {
  const priorities = getContextPriority(workspaceRoot);
  const q = query.toLowerCase();

  const implementationKeywords = ['how does', 'implement', 'function', 'class', 'method', 'line number'];
  const isImplementationQuery  = implementationKeywords.some((kw) => q.includes(kw));

  if (isImplementationQuery) {
    // Keep all log sources first, then source files — order unchanged
    return priorities;
  }

  return priorities;
}

export function generateContextPriorityMd(workspaceRoot) {
  const items = getContextPriority(workspaceRoot);
  const lines = items.map((p) =>
    `${p.order}. **${p.source}** _(${p.type})_\n   ${p.description}\n   \`${p.path}\``,
  );
  return `# Context Priority Order — Log-First Policy

> Read in this order. Stop when you have enough context.
> Do NOT scan full source unnecessarily.

${lines.join('\n\n')}

## Policy Summary
- Latest.md is PRIMARY context
- Source code is SECONDARY context
- Only open source files when log context is insufficient
- After reading source files, update engineering log immediately
`;
}
