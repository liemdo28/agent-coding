#!/usr/bin/env node
// scripts/kb-package.js — BUILD-TIME TOOL
// Creates a distributable knowledge.db.gz artifact from the local database.
// Run on a machine with internet AFTER kb:ingest is complete.
// Output is attached to a GitHub Release for offline machines to download.
//
//   npm run kb:package
//   → dist/knowledge.db.gz  (ready for GitHub Release upload)
//
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT   = dirname(dirname(fileURLToPath(import.meta.url)));
const DB_SRC = join(ROOT, '.local-agent', 'kb', 'knowledge.db');
const IDF_SRC = join(ROOT, '.local-agent', 'kb', 'idf.json');
const DIST   = join(ROOT, 'dist', 'kb');
const DB_OUT = join(DIST, 'knowledge.db.gz');

console.log('KB Package — BUILD-TIME TOOL (requires local database from kb:ingest)');
console.log('─'.repeat(60));

if (!existsSync(DB_SRC)) {
  console.error('ERROR: No database found at', DB_SRC);
  console.error('Run `npm run kb:ingest` first on a machine with internet access.');
  process.exit(1);
}

// Step 1 — Checkpoint WAL so the DB file is self-contained
console.log('Step 1/3  Checkpointing WAL...');
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = new Database(DB_SRC);
const ckpt = db.pragma('wal_checkpoint(TRUNCATE)')[0];
const pageSize  = db.pragma('page_size')[0].page_size;
const pageCount = db.pragma('page_count')[0].page_count;
const logicalMB = (pageSize * pageCount / 1024 / 1024).toFixed(1);

// Collect stats for manifest
const stats = {
  documents: db.prepare('SELECT COUNT(*) AS n FROM documents').get().n,
  chunks:    db.prepare('SELECT COUNT(*) AS n FROM chunks').get().n,
  words:     db.prepare('SELECT SUM(word_count) AS n FROM documents').get().n,
  domains:   db.prepare('SELECT COUNT(*) AS n FROM domains').get().n,
};
db.close();
console.log(`         WAL busy=${ckpt.busy} log=${ckpt.log} checkpointed=${ckpt.checkpointed}`);
console.log(`         Logical size: ${logicalMB} MB`);

// Step 2 — Compress
if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
console.log(`Step 2/3  Compressing → ${DB_OUT}`);
await pipeline(
  createReadStream(DB_SRC),
  createGzip({ level: 9 }),
  createWriteStream(DB_OUT),
);
const compressedMB = (statSync(DB_OUT).size / 1024 / 1024).toFixed(1);
console.log(`         Compressed size: ${compressedMB} MB`);

// Step 3 — Write manifest
const manifest = {
  builtAt:        new Date().toISOString(),
  sourceFile:     'knowledge.db',
  compressedFile: 'knowledge.db.gz',
  compressedSizeMB: parseFloat(compressedMB),
  logicalSizeMB:  parseFloat(logicalMB),
  ...stats,
  license:        'CC BY-SA 4.0 (Wikipedia contributors)',
  installInstructions: 'npm run kb:install dist/kb/knowledge.db.gz  (or drag onto .local-agent/kb/)',
};
const MANIFEST = join(DIST, 'manifest.json');
const { writeFileSync } = await import('fs');
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log('Step 3/3  Manifest written →', MANIFEST);

console.log('\n' + '═'.repeat(60));
console.log('  Artifact ready:  dist/kb/knowledge.db.gz');
console.log('  Manifest:        dist/kb/manifest.json');
console.log('  Docs:            ' + stats.documents);
console.log('  Chunks:          ' + stats.chunks.toLocaleString());
console.log('  Words:           ' + stats.words.toLocaleString());
console.log('─'.repeat(60));
console.log('  Next step: attach dist/kb/knowledge.db.gz to a GitHub Release.');
console.log('  Offline machines install with: npm run kb:install <path-to-gz>');
