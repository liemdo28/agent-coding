#!/usr/bin/env node
// scripts/kb-ingest.js — BUILD-TIME TOOL (requires internet)
// Fetches Wikipedia articles and builds the offline knowledge base.
// Run this ONCE on a dev/CI machine with internet access.
// DO NOT run on target/production machines — they are offline and use a pre-built artifact.
//
// After ingest, package and distribute with:
//   npm run kb:package   → dist/kb/knowledge.db.gz
//   Upload to GitHub Release → offline machines install with: npm run kb:install <file>
//
// Called by `npm run kb:ingest`
// Safe to re-run: idempotent (skips already-ingested articles).
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT    = dirname(dirname(fileURLToPath(import.meta.url)));
const INGEST  = join(ROOT, 'kb', 'ingest-all.js');
const DB_PATH = join(ROOT, '.local-agent', 'kb', 'knowledge.db');

console.log('═'.repeat(60));
console.log('  ⚠  BUILD-TIME TOOL — requires outbound internet access');
console.log('  ⚠  DO NOT run on offline / target machines');
console.log('     Offline machines install via: npm run kb:install <artifact>');
console.log('═'.repeat(60));
console.log('  Knowledge Base Ingest — npm run kb:ingest');
console.log('═'.repeat(60));
console.log(`  DB location : ${DB_PATH}`);
console.log(`  Source      : Wikipedia CC BY-SA 4.0 (REST API)`);
console.log(`  Idempotent  : YES — safe to re-run\n`);

if (existsSync(DB_PATH)) {
  console.log('  Existing database found — adding missing articles only.\n');
} else {
  console.log('  No database found — fresh ingest (~8-12 minutes, ~1,300 articles).\n');
}

// Domains in priority order (most useful first)
const DOMAINS = [
  'coding', 'accounting', 'marketing', 'website', 'design',
  'machine-learning', 'data-analyst', 'hr', 'business-analyst', 'logistics',
];

const result = spawnSync(
  process.execPath,
  [INGEST, ...DOMAINS],
  { stdio: 'inherit', cwd: ROOT },
);

if (result.status !== 0) {
  console.error('\n[kb-ingest] ingest-all.js exited with status', result.status);
  process.exit(result.status ?? 1);
}

console.log('\n✓ Knowledge base ready. Test with:');
console.log('  node bin/kb.js stats');
console.log('  node bin/kb.js query "your question here"');
