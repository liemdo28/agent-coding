#!/usr/bin/env node
// bin/species.js — Phase 103 Software Species CLI
// Usage:
//   node bin/species.js classify     # live classify current project
//   node bin/species.js history      # show last 30 days of species history

import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { StrategyScorer }   from '../local-agent/strategy/StrategyScorer.js';
import { SpeciesClassifier } from '../local-agent/strategy/SpeciesClassifier.js';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cmd     = process.argv[2] ?? 'classify';

const scorer     = new StrategyScorer();
const classifier = new SpeciesClassifier();

// ── Formatting helpers ──────────────────────────────────────────────────────

const SPECIES_LABEL = {
  optimal:   'OPTIMAL   🌟',
  pioneer:   'PIONEER   🚀',
  workhorse: 'WORKHORSE 🐂',
  fragile:   'FRAGILE   ⚠️ ',
  stagnant:  'STAGNANT  💤',
};

function bar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

function printProfile(p) {
  const label = SPECIES_LABEL[p.species_class] ?? p.species_class.toUpperCase();
  console.log('\n── Software Species Profile ─────────────────────────────────');
  console.log(`  timestamp     : ${p.ts}`);
  console.log(`  project       : ${p.project_path}`);
  console.log(`  species class : ${label}`);
  console.log(`  composite     : ${String(p.composite).padStart(6)} / 100`);
  console.log('');
  console.log(`  adaptability  : ${String(p.adaptability).padStart(6)}  ${bar(p.adaptability)}`);
  console.log(`  stability     : ${String(p.stability).padStart(6)}  ${bar(p.stability)}`);
  console.log(`  scalability   : ${String(p.scalability).padStart(6)}  ${bar(p.scalability)}`);
  console.log(`  intelligence  : ${String(p.intelligence).padStart(6)}  ${bar(p.intelligence)}`);
  console.log('');
}

function printHistory(rows) {
  if (!rows.length) {
    console.log('No history found. Run: node bin/species.js classify');
    return;
  }
  console.log(`\n── Species History (${rows.length} entries, most recent first) ──────────`);
  console.log(
    '  ' +
    'Timestamp'.padEnd(22) +
    'Class'.padEnd(12) +
    'Composite'.padEnd(11) +
    'Adapt'.padEnd(8) +
    'Stab'.padEnd(8) +
    'Scale'.padEnd(8) +
    'Intel'
  );
  console.log('  ' + '─'.repeat(80));
  for (const r of rows) {
    const ts = r.ts.slice(0, 19).replace('T', ' ');
    console.log(
      '  ' +
      ts.padEnd(22) +
      (r.species_class ?? '?').padEnd(12) +
      String(r.composite).padEnd(11) +
      String(r.adaptability).padEnd(8) +
      String(r.stability).padEnd(8) +
      String(r.scalability).padEnd(8) +
      r.intelligence
    );
  }
  console.log('');
}

// ── Command dispatch ─────────────────────────────────────────────────────────

if (cmd === 'classify') {
  console.log('Collecting sensors and classifying project…');
  const profile = await classifier.classifyAsync(ROOT, scorer);
  printProfile(profile);
} else if (cmd === 'history') {
  const rows = classifier.getHistory(ROOT, 30);
  printHistory(rows);
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: node bin/species.js [classify|history]');
  process.exit(1);
}
