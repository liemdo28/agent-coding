#!/usr/bin/env node
// scripts/lint-check.js — syntax-check all JS source files using node --check
// Parallel batched execution eliminates per-file Node startup overhead.
import { exec }        from 'child_process';
import { promisify }   from 'util';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname }     from 'path';

const execAsync = promisify(exec);

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SCAN_DIRS   = ['bin', 'local-agent', 'accounting-engine'];
const SKIP_PATHS  = ['node_modules', '.git', 'sample-project'];
const CONCURRENCY = 32;   // parallel node --check processes

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

async function checkFile(f) {
  try {
    await execAsync(`node --check "${f}"`, { timeout: 10_000 });
    return null;
  } catch (e) {
    return { file: f, error: e.stderr?.toString().trim() ?? e.message };
  }
}

async function main() {
  const files = SCAN_DIRS.flatMap(collectJS);
  const t0    = Date.now();
  const errs  = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const results = await Promise.all(files.slice(i, i + CONCURRENCY).map(checkFile));
    for (const r of results) {
      if (r) {
        console.error(`LINT ERROR: ${relative(ROOT, r.file)}\n  ${r.error}`);
        errs.push(r);
      }
    }
  }

  const ms = Date.now() - t0;
  if (errs.length > 0) {
    console.error(`\nLint FAILED — ${errs.length} file(s) with syntax errors. (${ms}ms)`);
    process.exit(1);
  } else {
    console.log(`Lint OK — ${files.length} files checked, 0 errors. (${ms}ms)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
