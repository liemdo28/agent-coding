#!/usr/bin/env node
// bin/dna.js — Phase 106 Engineering DNA CLI
// Usage:
//   node bin/dna.js stats              # gene library stats
//   node bin/dna.js list [category]    # list active genes
//   node bin/dna.js ingest             # ingest from experiment-patterns.jsonl
//   node bin/dna.js mutate <geneId>    # propose a trivial test mutation

import { resolve, dirname }        from 'path';
import { fileURLToPath }           from 'url';
import { PatternLibrary }          from '../local-agent/dna/PatternLibrary.js';
import { MutationSandbox }         from '../local-agent/dna/MutationSandbox.js';
import { ingestFromExperiments }   from '../local-agent/dna/GeneIngester.js';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXP_LOG = resolve(ROOT, '.local-agent', 'experiment-patterns.jsonl');

const cmd    = process.argv[2] ?? 'stats';
const arg    = process.argv[3];

const library  = new PatternLibrary();
const sandbox  = new MutationSandbox({ library });

if (cmd === 'stats') {
  const genes = library.query({});
  const byCategory = {};
  for (const g of genes) {
    byCategory[g.category] = (byCategory[g.category] ?? 0) + 1;
  }
  console.log('\n── Engineering DNA — Gene Library ─────────────────');
  console.log(`  Total active genes: ${genes.length}`);
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${cat.padEnd(20)} ${count}`);
  }
  const mutations = sandbox.listMutations();
  console.log(`\n  Pending mutations:  ${mutations.filter(m => m.status === 'pending').length}`);
  console.log(`  Promoted mutations: ${mutations.filter(m => m.status === 'promoted').length}`);

} else if (cmd === 'list') {
  const genes = library.query({ category: arg });
  if (!genes.length) {
    console.log(arg ? `No genes for category: ${arg}` : 'Gene library is empty. Run: node bin/dna.js ingest');
    process.exit(0);
  }
  console.log(`\n  ${'ID'.padEnd(10)}  ${'Category'.padEnd(16)}  ${'Source'.padEnd(14)}  ${'Win'.padEnd(5)}  Description`);
  console.log('  ' + '─'.repeat(80));
  for (const g of genes.slice(0, 30)) {
    const total  = g.success_count + g.failure_count;
    const winStr = total > 0 ? `${g.success_count}/${total}` : '—';
    const desc   = (g.description ?? '').slice(0, 40);
    console.log(`  ${g.id.slice(0,8).padEnd(10)}  ${g.category.padEnd(16)}  ${g.source.padEnd(14)}  ${winStr.padEnd(5)}  ${desc}`);
  }

} else if (cmd === 'ingest') {
  console.log('Ingesting from experiment-patterns.jsonl…');
  const result = await ingestFromExperiments(EXP_LOG, library);
  console.log(`  Ingested: ${result.ingested}   Skipped (dedup): ${result.skipped}`);
  console.log(`  Total genes: ${library.count()}`);

} else if (cmd === 'mutate') {
  if (!arg) { console.error('Usage: node bin/dna.js mutate <geneId>'); process.exit(1); }
  const genes = library.query({});
  const gene  = genes.find((g) => g.id.startsWith(arg));
  if (!gene) { console.error(`Gene not found: ${arg}`); process.exit(1); }
  const { mutationId, path } = sandbox.proposeMutation(gene.id, {
    description: `Test mutation of ${gene.id.slice(0,8)}`,
    changes: { mutated_at: new Date().toISOString() },
  });
  console.log(`\n  Mutation proposed: ${mutationId.slice(0,8)}`);
  console.log(`  File: ${path}`);

} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: node bin/dna.js [stats|list|ingest|mutate]');
  process.exit(1);
}
