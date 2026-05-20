#!/usr/bin/env node
// scripts/lint-check.js — syntax-check all JS source files using node --check
import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SCAN_DIRS   = ['bin', 'local-agent', 'accounting-engine'];
const SKIP_PATHS  = ['node_modules', '.git', 'sample-project', 'ui/frontend/dist'];

function collectJS(dir) {
  const abs = join(ROOT, dir);
  const files = [];
  try {
    for (const name of readdirSync(abs)) {
      const full = join(abs, name);
      const rel  = relative(ROOT, full);
      if (SKIP_PATHS.some((s) => rel.includes(`${s}/`) || rel === s)) continue;
      try {
        if (statSync(full).isDirectory()) { files.push(...collectJS(rel)); continue; }
      } catch { continue; }
      if (name.endsWith('.js')) files.push(full);
    }
  } catch { /* dir may not exist */ }
  return files;
}

const files  = SCAN_DIRS.flatMap(collectJS);
let   errors = 0;

for (const f of files) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
  } catch (e) {
    const msg = e.stderr?.toString().trim() ?? e.message;
    console.error(`LINT ERROR: ${relative(ROOT, f)}\n  ${msg}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\nLint FAILED — ${errors} file(s) with syntax errors.`);
  process.exit(1);
} else {
  console.log(`Lint OK — ${files.length} files checked, 0 errors.`);
}
