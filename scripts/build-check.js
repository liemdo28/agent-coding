#!/usr/bin/env node
// scripts/build-check.js — syntax-verify all CLI entry points
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const ENTRY_POINTS = [
  'bin/local-agent.js',
  'accounting-engine/bin/accounting.js',
  'accounting-engine/api/server.js',
];

let errors = 0;
for (const entry of ENTRY_POINTS) {
  const abs = join(ROOT, entry);
  if (!existsSync(abs)) {
    console.error(`  ✗ ${entry}: FILE NOT FOUND`);
    errors++;
    continue;
  }
  try {
    execSync(`node --check "${abs}"`, { stdio: 'pipe' });
    console.log(`  ✓ ${entry}`);
  } catch (e) {
    const msg = e.stderr?.toString().trim() ?? e.message;
    console.error(`  ✗ ${entry}:\n    ${msg}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\nBuild FAILED — ${errors} entry point(s) have syntax errors.`);
  process.exit(1);
} else {
  console.log(`\nBuild OK — ${ENTRY_POINTS.length} entry points verified.`);
}
