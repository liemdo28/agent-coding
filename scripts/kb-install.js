#!/usr/bin/env node
// scripts/kb-install.js — RUNTIME INSTALL TOOL
// Extracts a pre-built knowledge.db.gz artifact onto the local machine.
// Run ONCE on the target (offline) machine after downloading the release artifact.
// NO internet required — all reads are from the local .gz file.
//
//   npm run kb:install <path-to-knowledge.db.gz>
//   npm run kb:install dist/kb/knowledge.db.gz
//
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, copyFileSync } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = dirname(dirname(fileURLToPath(import.meta.url)));
const KB_DIR = join(ROOT, '.local-agent', 'kb');
const DB_OUT = join(KB_DIR, 'knowledge.db');

const src = process.argv[2];

console.log('KB Install — installs a pre-built knowledge.db.gz onto this machine');
console.log('─'.repeat(60));
console.log('  NO internet required — fully offline operation');
console.log('');

if (!src) {
  console.error('ERROR: No source file specified.');
  console.error('Usage:  npm run kb:install <path-to-knowledge.db.gz>');
  console.error('');
  console.error('Obtain the artifact from a GitHub Release (on an internet-connected machine)');
  console.error('then transfer it to this machine and run this command.');
  process.exit(1);
}

const srcResolved = resolve(src);
if (!existsSync(srcResolved)) {
  console.error(`ERROR: File not found: ${srcResolved}`);
  process.exit(1);
}

const srcStat = statSync(srcResolved);
if (!srcResolved.endsWith('.gz') && !srcResolved.endsWith('.db')) {
  console.error('ERROR: Expected a .gz (compressed) or .db (plain SQLite) file.');
  process.exit(1);
}

if (!existsSync(KB_DIR)) mkdirSync(KB_DIR, { recursive: true });

// Back up existing DB if present
if (existsSync(DB_OUT)) {
  const backup = DB_OUT + '.bak';
  copyFileSync(DB_OUT, backup);
  console.log(`  Backed up existing DB → ${backup}`);
}

console.log(`  Source: ${srcResolved}`);
console.log(`  Size:   ${(srcStat.size / 1024 / 1024).toFixed(1)} MB`);
console.log('');

if (srcResolved.endsWith('.db')) {
  // Plain SQLite — just copy
  console.log('Step 1/1  Copying (plain SQLite)...');
  copyFileSync(srcResolved, DB_OUT);
} else {
  // Compressed — decompress
  console.log('Step 1/1  Decompressing...');
  await pipeline(
    createReadStream(srcResolved),
    createGunzip(),
    createWriteStream(DB_OUT),
  );
}

const outStat = statSync(DB_OUT);
console.log(`         Done. DB size: ${(outStat.size / 1024 / 1024).toFixed(1)} MB`);

console.log('\n' + '═'.repeat(60));
console.log(`  Knowledge base installed → ${DB_OUT}`);
console.log('');
console.log('  Test with:');
console.log('    npm run kb:stats');
console.log('    npm run kb:query "your question here"');
console.log('─'.repeat(60));
