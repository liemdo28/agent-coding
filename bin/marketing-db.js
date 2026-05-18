#!/usr/bin/env node
// bin/marketing-db.js — Marketing Database CLI
import { program } from 'commander';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function dbPath(opts) {
  const root = resolve(opts.workspace ?? ROOT);
  return resolve(root, '.marketing-db/marketing.db');
}

program
  .name('marketing-db')
  .description('Offline Marketing Database — F&B / Local SEO / Multi-Brand')
  .version('1.0.0');

// ── init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialise the marketing database (creates schema + phase tracking)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action(async (opts) => {
    const { openDB: open } = await import('../marketing-db/db/MarketingDB.js');
    const path = dbPath(opts);
    const db = open(path);
    db.close();
    console.log(`✅  Marketing database initialised at: ${path}`);
    console.log('    Run "marketing-db audit" to verify readiness.');
  });

// ── audit ─────────────────────────────────────────────────────────────────────

program
  .command('audit')
  .description('Run the pre-build audit and print a summary report')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .option('--json', 'output raw JSON instead of formatted report')
  .action(async (opts) => {
    const root = resolve(opts.workspace ?? ROOT);
    const { runAudit } = await import('../marketing-db/audit/AuditEngine.js');
    const report = await runAudit(root);

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const icon = report.passed ? '✅' : '❌';
    console.log(`\n${icon}  ${report.summary}`);

    if (!report.folderStructure.ok) {
      console.log('\nMissing directories:');
      report.folderStructure.missing.forEach((d) => console.log(`  • ${d}`));
    }
    if (!report.requiredFiles.ok) {
      console.log('\nMissing files:');
      report.requiredFiles.missing.forEach((f) => console.log(`  • ${f}`));
    }
    if (!report.schemaCheck.ok) {
      console.log(`\nSchema: ${report.schemaCheck.error ?? report.schemaCheck.missingTables.join(', ')}`);
    }
    if (!report.internetPolicy.ok) {
      console.log('\nInternet policy violations:');
      report.internetPolicy.violations.forEach((v) =>
        console.log(`  • ${v.file}: ${v.issues.join(', ')}`)
      );
    }
    if (!report.telemetryCheck.ok) {
      console.log('\nTelemetry violations:');
      report.telemetryCheck.violations.forEach((v) =>
        console.log(`  • ${v.file}: ${v.issues.join(', ')}`)
      );
    }
    if (!report.fakeImplementation.ok) {
      console.log('\nFake/placeholder in core modules:');
      report.fakeImplementation.violations.forEach((v) =>
        console.log(`  • ${v.file}: ${v.issues.join(', ')}`)
      );
    }
    if (!report.brokenImports.ok) {
      console.log('\nBroken imports:');
      report.brokenImports.violations.forEach((v) =>
        console.log(`  • ${v.file}: ${v.imports.join(', ')}`)
      );
    }

    console.log(`\nReport written to: reports/audit/audit-summary.md`);
    process.exit(report.passed ? 0 : 1);
  });

// ── stats ─────────────────────────────────────────────────────────────────────

program
  .command('stats')
  .description('Show database statistics (brands, locations, campaigns, reviews)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action(async (opts) => {
    const { openDB: open, listBrands, listLocations, listCampaigns, listReviews, getPhaseStatus } = await import('../marketing-db/db/MarketingDB.js');
    const db = open(dbPath(opts));

    const brands    = listBrands(db);
    const locations = listLocations(db);
    const campaigns = listCampaigns(db, { limit: 9999 });
    const reviews   = listReviews(db,   { limit: 9999 });
    const phases    = getPhaseStatus(db);
    const done      = phases.filter((p) => p.status === 'complete').length;
    db.close();

    console.log('\nMarketing Database Statistics');
    console.log('─'.repeat(40));
    console.log(`  Brands:     ${brands.length}`);
    console.log(`  Locations:  ${locations.length}`);
    console.log(`  Campaigns:  ${campaigns.length}`);
    console.log(`  Reviews:    ${reviews.length}`);
    console.log(`  Phases:     ${done} / ${phases.length} complete`);

    if (brands.length > 0) {
      console.log('\nBrands:');
      brands.forEach((b) => console.log(`  • ${b.name.padEnd(30)} ${b.type}`));
    }
  });

// ── brands ────────────────────────────────────────────────────────────────────

program
  .command('brands')
  .description('List all brands')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action(async (opts) => {
    const { openDB: open, listBrands } = await import('../marketing-db/db/MarketingDB.js');
    const db   = open(dbPath(opts));
    const rows = listBrands(db);
    db.close();

    if (rows.length === 0) { console.log('No brands found. Run "marketing-db init" first.'); return; }
    console.log(`${'ID'.padEnd(4)} ${'Name'.padEnd(30)} ${'Type'.padEnd(15)} Website`);
    console.log('─'.repeat(80));
    rows.forEach((b) => console.log(
      `${String(b.id).padEnd(4)} ${b.name.slice(0, 29).padEnd(30)} ${(b.type ?? '').padEnd(15)} ${b.website ?? ''}`
    ));
  });

// ── locations ─────────────────────────────────────────────────────────────────

program
  .command('locations [brand]')
  .description('List locations (optionally filtered by brand name or ID)')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action(async (brand, opts) => {
    const { openDB: open, getBrand, listLocations } = await import('../marketing-db/db/MarketingDB.js');
    const db   = open(dbPath(opts));
    let brand_id;
    if (brand) {
      const b = getBrand(db, isNaN(brand) ? brand : Number(brand));
      if (!b) { console.error(`Brand not found: ${brand}`); db.close(); process.exit(1); }
      brand_id = b.id;
    }
    const rows = listLocations(db, brand_id);
    db.close();

    if (rows.length === 0) { console.log('No locations found.'); return; }
    console.log(`${'ID'.padEnd(4)} ${'Brand'.padEnd(20)} ${'Name'.padEnd(25)} ${'City'.padEnd(15)} State`);
    console.log('─'.repeat(80));
    rows.forEach((l) => console.log(
      `${String(l.id).padEnd(4)} ${(l.brand_name ?? '').slice(0, 19).padEnd(20)} ${l.name.slice(0, 24).padEnd(25)} ${l.city.padEnd(15)} ${l.state ?? ''}`
    ));
  });

// ── campaigns ─────────────────────────────────────────────────────────────────

program
  .command('campaigns')
  .description('List campaigns')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .option('-b, --brand <id>',       'filter by brand ID')
  .option('-s, --status <status>',  'filter by status (draft|approved|live|ended)')
  .option('-n, --limit <n>',        'number of results', '20')
  .action(async (opts) => {
    const { openDB: open, listCampaigns } = await import('../marketing-db/db/MarketingDB.js');
    const db   = open(dbPath(opts));
    const rows = listCampaigns(db, {
      brand_id: opts.brand ? Number(opts.brand) : undefined,
      status:   opts.status,
      limit:    parseInt(opts.limit, 10),
    });
    db.close();

    if (rows.length === 0) { console.log('No campaigns found.'); return; }
    console.log(`${'ID'.padEnd(4)} ${'Brand'.padEnd(18)} ${'Title'.padEnd(32)} ${'Status'.padEnd(10)} Risk`);
    console.log('─'.repeat(80));
    rows.forEach((c) => console.log(
      `${String(c.id).padEnd(4)} ${(c.brand_name ?? '').slice(0, 17).padEnd(18)} ${c.title.slice(0, 31).padEnd(32)} ${c.status.padEnd(10)} ${c.risk_level}`
    ));
  });

// ── reviews ───────────────────────────────────────────────────────────────────

program
  .command('reviews')
  .description('List reviews')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .option('-b, --brand <id>',       'filter by brand ID')
  .option('-r, --rating <n>',       'filter by star rating (1-5)')
  .option('--escalated',            'show only escalated reviews')
  .option('-n, --limit <n>',        'number of results', '20')
  .action(async (opts) => {
    const { openDB: open, listReviews } = await import('../marketing-db/db/MarketingDB.js');
    const db   = open(dbPath(opts));
    const rows = listReviews(db, {
      brand_id:             opts.brand ? Number(opts.brand) : undefined,
      rating:               opts.rating ? Number(opts.rating) : undefined,
      escalation_required:  opts.escalated ? 1 : undefined,
      limit:                parseInt(opts.limit, 10),
    });
    db.close();

    if (rows.length === 0) { console.log('No reviews found.'); return; }
    console.log(`${'ID'.padEnd(4)} ${'★'.padEnd(3)} ${'Sentiment'.padEnd(10)} ${'Escalated'.padEnd(10)} ${'Source'.padEnd(12)} Snippet`);
    console.log('─'.repeat(90));
    rows.forEach((r) => console.log(
      `${String(r.id).padEnd(4)} ${String(r.rating ?? '?').padEnd(3)} ${(r.sentiment ?? '').padEnd(10)} ${r.escalation_required ? '⚠ YES' : 'no'.padEnd(9)} ${(r.source ?? '').padEnd(12)} ${(r.text ?? '').slice(0, 40).replace(/\n/g, ' ')}`
    ));
  });

// ── phases ────────────────────────────────────────────────────────────────────

program
  .command('phases')
  .description('Show implementation phase completion status')
  .option('-w, --workspace <path>', 'workspace root', ROOT)
  .action(async (opts) => {
    const { openDB: open, getPhaseStatus } = await import('../marketing-db/db/MarketingDB.js');
    const db    = open(dbPath(opts));
    const rows  = getPhaseStatus(db);
    db.close();

    const done  = rows.filter((p) => p.status === 'complete').length;
    console.log(`\nPhase Completion: ${done} / ${rows.length}`);
    console.log('─'.repeat(60));
    rows.forEach((p) => {
      const icon = p.status === 'complete' ? '✅' : p.status === 'in_progress' ? '🔄' : '⬜';
      console.log(`  ${icon} Phase ${String(p.phase).padStart(2)}: ${p.name}`);
    });
  });

program.parse(process.argv);
