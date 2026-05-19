#!/usr/bin/env node
// scripts/registry-sync.mjs
// Update a project's root path in ~/.local-agent-global/projects.json.
// Used by merge-projects-advanced.sh --sync-registry.
//
// Usage:
//   node scripts/registry-sync.mjs --old-path /src/path --new-path /dest/path [--dry-run]

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

function canonical(p) {
  try { return realpathSync(resolve(p)); } catch { return resolve(p); }
}
function pathsEqual(a, b) {
  return process.platform === 'darwin'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const dryRun  = args.includes('--dry-run');
const oldPath = get('--old-path');
const newPath = get('--new-path');

if (!oldPath || !newPath) {
  process.stderr.write('Usage: registry-sync.mjs --old-path PATH --new-path PATH [--dry-run]\n');
  process.exit(1);
}

const registryFile = join(homedir(), '.local-agent-global', 'projects.json');
if (!existsSync(registryFile)) {
  console.log('[registry-sync] No registry found — nothing to sync.');
  process.exit(0);
}

let projects;
try {
  projects = JSON.parse(readFileSync(registryFile, 'utf8'));
  if (!Array.isArray(projects)) throw new Error('Registry is not an array');
} catch (err) {
  process.stderr.write(`[registry-sync] Failed to parse registry: ${err.message}\n`);
  process.exit(2);
}

const oldCanon = canonical(oldPath);
const newCanon = canonical(newPath);

// Check if newPath is already occupied by a DIFFERENT project
const conflict = projects.find(
  (p) => pathsEqual(canonical(p.root), newCanon) && !pathsEqual(canonical(p.root), oldCanon)
);
if (conflict) {
  process.stderr.write(
    `[registry-sync] CONFLICT: "${newCanon}" is already registered as "${conflict.name}" (${conflict.projectId})\n`
  );
  process.exit(3);
}

let changed = 0;
for (const p of projects) {
  if (pathsEqual(canonical(p.root), oldCanon)) {
    if (dryRun) {
      console.log(`[registry-sync] dry-run: would update "${p.name}" (${p.projectId})  ${oldCanon} → ${newCanon}`);
    } else {
      console.log(`[registry-sync] Updating "${p.name}" (${p.projectId})  ${oldCanon} → ${newCanon}`);
      p.root      = newCanon;
      p.updatedAt = new Date().toISOString();
    }
    changed++;
  }
}

if (changed === 0) {
  console.log(`[registry-sync] No registry entries matched "${oldCanon}"`);
  process.exit(0);
}

if (!dryRun) {
  writeFileSync(registryFile, JSON.stringify(projects, null, 2), 'utf8');
  console.log(`[registry-sync] Saved. ${changed} entry/entries updated.`);
} else {
  console.log(`[registry-sync] dry-run complete. ${changed} entry/entries would be updated.`);
}
