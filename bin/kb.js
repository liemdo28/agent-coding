#!/usr/bin/env node
// bin/kb.js — Knowledge Base CLI
import { program } from 'commander';
import { join, resolve } from 'path';
import { openKnowledgeBase } from '../kb/KnowledgeBase.js';
import { seedAll, seedDomain } from '../kb/SeedLoader.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function getRoot(opts) {
  return resolve(opts.workspace ?? ROOT);
}

program
  .name('kb')
  .description('Offline Knowledge Base — TF-IDF + FTS5 RAG')
  .version('1.0.0');

// ── seed ─────────────────────────────────────────────────────────────────────

program
  .command('seed [domain]')
  .description('Seed knowledge base from source configs (all domains or one)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action((domain, opts) => {
    const root = getRoot(opts);
    console.log(`Seeding knowledge base at: ${root}`);
    const results = domain ? seedDomain(root, domain) : seedAll(root);
    let total = 0;
    for (const r of results) {
      if (r.loaded > 0 || r.error) {
        const status = r.error ? `ERROR: ${r.error}` : `${r.loaded} docs loaded`;
        console.log(`  ${r.domain.padEnd(20)} ${status}`);
        total += r.loaded;
      }
    }
    console.log(`\nTotal documents ingested: ${total}`);
  });

// ── query / search ────────────────────────────────────────────────────────────

program
  .command('query <text>')
  .description('Search the knowledge base using offline RAG (FTS5 + TF-IDF)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .option('-d, --domain <slug>',   'filter by domain')
  .option('-t, --topic <slug>',    'filter by topic')
  .option('-k, --top <n>',         'number of results', '5')
  .action((text, opts) => {
    const root = getRoot(opts);
    const kb   = openKnowledgeBase(root);
    const results = kb.query(text, {
      topK:   parseInt(opts.top, 10),
      domain: opts.domain,
      topic:  opts.topic,
    });
    kb.close();

    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    for (const r of results) {
      console.log(`\n─── #${r.rank} [score: ${r.score}] ${r.docTitle}`);
      console.log(`    Domain: ${r.domain} > ${r.topic}`);
      if (r.source_url) console.log(`    Source: ${r.source_url}`);
      if (r.license)    console.log(`    License: ${r.license}`);
      console.log(`    ${r.text.slice(0, 300).replace(/\n/g, ' ')}…`);
    }
  });

// ── list ─────────────────────────────────────────────────────────────────────

program
  .command('list [domain]')
  .description('List all documents (or documents in a domain)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .option('-t, --topic <slug>',     'filter by topic')
  .action((domain, opts) => {
    const root = getRoot(opts);
    const kb   = openKnowledgeBase(root);
    const docs = kb.list({ domain, topic: opts.topic });
    kb.close();

    if (docs.length === 0) {
      console.log('No documents found.');
      return;
    }

    console.log(`${'Domain'.padEnd(20)} ${'Topic'.padEnd(20)} ${'Title'.padEnd(45)} Words  Chunks`);
    console.log('─'.repeat(100));
    for (const d of docs) {
      console.log(
        `${d.domain.padEnd(20)} ${d.topic.padEnd(20)} ${d.title.slice(0, 44).padEnd(45)} ${String(d.word_count).padStart(5)}  ${String(d.chunk_count).padStart(6)}`
      );
    }
  });

// ── stats ─────────────────────────────────────────────────────────────────────

program
  .command('stats')
  .description('Show knowledge base statistics')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action((opts) => {
    const root = getRoot(opts);
    const kb   = openKnowledgeBase(root);
    const s    = kb.stats();
    const doms = kb.domains();
    kb.close();

    console.log('\nKnowledge Base Statistics');
    console.log('─'.repeat(40));
    console.log(`  Domains:   ${s.domains}`);
    console.log(`  Topics:    ${s.topics}`);
    console.log(`  Documents: ${s.documents}`);
    console.log(`  Chunks:    ${s.chunks}`);
    console.log(`  Words:     ${s.words.toLocaleString()}`);
    console.log('\nDomains:');
    for (const d of doms) {
      console.log(`  • ${d.slug.padEnd(22)} ${d.name}`);
    }
  });

// ── rebuild-index ─────────────────────────────────────────────────────────────

program
  .command('rebuild-index')
  .description('Rebuild TF-IDF index from all chunks in the database')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action((opts) => {
    const root = getRoot(opts);
    const kb   = openKnowledgeBase(root);
    const idf  = kb.rebuildIndex();
    const termCount = typeof idf.size === 'number' ? idf.size : Object.keys(idf).length;
    kb.close();
    console.log(`TF-IDF index rebuilt. ${termCount} unique terms indexed.`);
  });

// ── sources ───────────────────────────────────────────────────────────────────

program
  .command('sources [domain]')
  .description('Show approved sources for a domain (or all domains)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action((domain, opts) => {
    const kbDir  = resolve(dirname(fileURLToPath(import.meta.url)), '../kb/sources');
    const all    = ['coding','accounting','marketing','website','design',
                    'machine-learning','data-analyst','hr','business-analyst','logistics'];
    const target = domain ? [domain] : all;

    for (const d of target) {
      let cfg;
      try {
        cfg = JSON.parse(readFileSync(join(kbDir, `${d}.json`), 'utf8'));
      } catch { continue; }

      console.log(`\n── ${cfg.domainName} (${cfg.domain}) ──`);
      console.log(`${'Name'.padEnd(35)} ${'License'.padEnd(20)} ${'Method'.padEnd(14)} Rec`);
      console.log('─'.repeat(80));
      for (const s of cfg.sources) {
        const rec = s.recommend === 'include' ? 'INCLUDE' : s.recommend === 'reference' ? 'REF ONLY' : 'EXCLUDE';
        console.log(`${s.name.slice(0,34).padEnd(35)} ${s.license.slice(0,19).padEnd(20)} ${(s.ingestMethod||'').padEnd(14)} ${rec}`);
      }
    }
  });

program.parse(process.argv);
