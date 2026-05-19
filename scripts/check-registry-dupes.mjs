#!/usr/bin/env node
// scripts/check-registry-dupes.mjs
// Scan ~/.local-agent-global/projects.json for:
//   • Stale entries   — root path no longer exists on disk
//   • Duplicate paths — two entries resolve to the same realpath
//   • Overlap paths   — one project root is inside another's tree
//   • Duplicate names — same project name at different paths (info only)
//
// Exits 0 if clean, 1 if issues found.
//
// Usage:
//   node scripts/check-registry-dupes.mjs [--fix] [--json]
//   --fix   Remove stale entries and deduplicate (keeps most-recently-updated)
//   --json  Machine-readable output

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

// ── Helpers ───────────────────────────────────────────────────────────────────

function canonical(p) {
  try { return realpathSync(resolve(p)); } catch { return resolve(p); }
}

function pathsEqual(a, b) {
  return process.platform === 'darwin'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

function isStrictSubpath(parent, child) {
  const p = (process.platform === 'darwin' ? parent.toLowerCase() : parent);
  const c = (process.platform === 'darwin' ? child.toLowerCase()  : child);
  const pSlash = p.endsWith('/') ? p : p + '/';
  return c.startsWith(pSlash);
}

// ── Load registry ─────────────────────────────────────────────────────────────

const fix     = process.argv.includes('--fix');
const jsonOut = process.argv.includes('--json');

const registryFile = join(homedir(), '.local-agent-global', 'projects.json');

if (!existsSync(registryFile)) {
  const msg = 'No registry found at ' + registryFile;
  jsonOut ? console.log(JSON.stringify({ ok: true, message: msg, issues: [] })) : console.log(msg);
  process.exit(0);
}

let projects;
try {
  projects = JSON.parse(readFileSync(registryFile, 'utf8'));
  if (!Array.isArray(projects)) throw new Error('Registry is not an array');
} catch (err) {
  process.stderr.write('Failed to parse registry: ' + err.message + '\n');
  process.exit(2);
}

// ── Analysis ──────────────────────────────────────────────────────────────────

const issues = [];

// 1. Stale entries
const stale = projects.filter((p) => !existsSync(p.root));
for (const p of stale) {
  issues.push({ type: 'stale', severity: 'error', projectId: p.projectId, name: p.name, root: p.root,
    message: `Path does not exist on disk: "${p.root}"` });
}

// 2. Duplicate realpaths
const canonMap = new Map(); // normKey → project[]
for (const p of projects) {
  const key = canonical(p.root);
  const normKey = process.platform === 'darwin' ? key.toLowerCase() : key;
  if (!canonMap.has(normKey)) canonMap.set(normKey, []);
  canonMap.get(normKey).push(p);
}
for (const [, group] of canonMap) {
  if (group.length < 2) continue;
  const ids = group.map((p) => `${p.name} (${p.projectId})`).join(', ');
  for (const p of group) {
    issues.push({ type: 'duplicate', severity: 'error', projectId: p.projectId, name: p.name, root: p.root,
      duplicateGroup: group.map((g) => g.projectId),
      message: `Duplicate realpath with: ${ids}` });
  }
}

// 3. Overlap (subpath) — warn only
for (let i = 0; i < projects.length; i++) {
  for (let j = 0; j < projects.length; j++) {
    if (i === j) continue;
    const a = projects[i];
    const b = projects[j];
    if (isStrictSubpath(canonical(a.root), canonical(b.root))) {
      issues.push({ type: 'overlap', severity: 'warn', projectId: b.projectId, name: b.name, root: b.root,
        containedBy: a.projectId,
        message: `"${b.name}" root is inside "${a.name}" (${canonical(a.root)})` });
    }
  }
}

// 4. Duplicate names (info)
const nameMap = new Map();
for (const p of projects) {
  const key = p.name.toLowerCase();
  if (!nameMap.has(key)) nameMap.set(key, []);
  nameMap.get(key).push(p);
}
for (const [, group] of nameMap) {
  if (group.length < 2) continue;
  for (const p of group) {
    issues.push({ type: 'duplicate-name', severity: 'info', projectId: p.projectId, name: p.name, root: p.root,
      message: `Name "${p.name}" used by ${group.length} projects at different paths` });
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

const errors = issues.filter((i) => i.severity === 'error');
const warns  = issues.filter((i) => i.severity === 'warn');
const infos  = issues.filter((i) => i.severity === 'info');

if (!jsonOut) {
  console.log(`\n[check-registry-dupes] Registry: ${registryFile}`);
  console.log(`[check-registry-dupes] Projects: ${projects.length} total\n`);

  if (issues.length === 0) {
    console.log('✅  No issues found. Registry is clean.');
  } else {
    if (errors.length) {
      console.log(`❌  Errors (${errors.length}):`);
      for (const i of errors) console.log(`    ${i.type.toUpperCase().padEnd(12)} ${i.name.padEnd(30)} ${i.message}`);
    }
    if (warns.length) {
      console.log(`\n⚠   Warnings (${warns.length}):`);
      for (const i of warns) console.log(`    ${i.type.toUpperCase().padEnd(12)} ${i.name.padEnd(30)} ${i.message}`);
    }
    if (infos.length) {
      console.log(`\nℹ   Info (${infos.length}):`);
      for (const i of infos) console.log(`    ${i.type.toUpperCase().padEnd(12)} ${i.name.padEnd(30)} ${i.message}`);
    }
  }
}

// ── Fix mode ──────────────────────────────────────────────────────────────────

const removed = [];
if (fix && errors.length > 0) {
  // Remove stale entries
  const staleIds = new Set(stale.map((p) => p.projectId));

  // Deduplicate: for each duplicate group keep the most recently updated
  const dupeIdsToRemove = new Set();
  for (const [, group] of canonMap) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.addedAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.addedAt ?? 0).getTime();
      return tb - ta;
    });
    for (let i = 1; i < sorted.length; i++) dupeIdsToRemove.add(sorted[i].projectId);
  }

  const toRemove = new Set([...staleIds, ...dupeIdsToRemove]);
  const cleaned  = projects.filter((p) => {
    if (toRemove.has(p.projectId)) { removed.push(p); return false; }
    return true;
  });

  writeFileSync(registryFile, JSON.stringify(cleaned, null, 2), 'utf8');

  if (!jsonOut) {
    console.log(`\n🔧  Fixed: removed ${removed.length} entries:`);
    for (const p of removed) console.log(`    - ${p.name} (${p.projectId}) — ${p.root}`);
  }
}

if (jsonOut) {
  console.log(JSON.stringify({
    ok: issues.filter((i) => i.severity === 'error').length === 0,
    totalProjects: projects.length,
    issues,
    removed: fix ? removed : undefined,
  }, null, 2));
}

process.exit(errors.length > 0 && !fix ? 1 : 0);
