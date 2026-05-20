#!/usr/bin/env node
// scripts/collect-metrics.js — CLI runner for the Global Sensor Fabric
// Usage: node scripts/collect-metrics.js  OR  npm run metrics:collect

import { collectAll } from '../local-agent/sensors/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR   = join(PROJECT_ROOT, '.super-agent-fullauto-kpi', 'sensors');
const OUTPUT_PATH  = join(OUTPUT_DIR, 'metrics.json');

async function main() {
  try {
    // Collect all sensor data
    const metrics = await collectAll();

    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write metrics.json
    writeFileSync(OUTPUT_PATH, JSON.stringify(metrics, null, 2), 'utf8');

    // Print summary to stdout
    const sys  = metrics.system  ?? {};
    const kb   = metrics.kb      ?? {};
    const wkr  = metrics.workers ?? {};
    const scan = metrics.scan    ?? {};

    console.log('');
    console.log('Global Sensor Fabric — metrics collected');
    console.log('─'.repeat(50));
    console.log(`  Collected at  : ${metrics.collected_at}`);
    console.log(`  Output        : ${OUTPUT_PATH}`);
    console.log('');
    console.log('  [system]');
    console.log(`    CPU load 1m : ${sys.cpu_load_1m ?? 'n/a'}`);
    console.log(`    CPU count   : ${sys.cpu_count ?? 'n/a'}`);
    console.log(`    Mem used    : ${sys.mem_used_mb ?? 'n/a'} MB / ${sys.mem_total_mb ?? 'n/a'} MB (${sys.mem_pct ?? 'n/a'}%)`);
    console.log(`    Heap used   : ${sys.heap_used_mb ?? 'n/a'} MB`);
    console.log('');
    console.log('  [kb]');
    console.log(`    Available   : ${kb.available ?? false}`);
    console.log(`    Documents   : ${kb.kb_documents ?? 'n/a'}`);
    console.log(`    Chunks      : ${kb.kb_chunks ?? 'n/a'}`);
    console.log(`    Query p50   : ${kb.query_p50_ms != null ? kb.query_p50_ms + ' ms' : 'n/a'}`);
    console.log(`    DB size     : ${kb.db_size_mb != null ? kb.db_size_mb + ' MB' : 'n/a'}`);
    console.log('');
    console.log('  [workers]');
    console.log(`    Total       : ${wkr.total_workers ?? 0}`);
    console.log(`    Active      : ${wkr.active_workers ?? 0}  |  Idle: ${wkr.idle_workers ?? 0}`);
    console.log(`    SLA breaches: ${wkr.sla_breach_count ?? 0}`);
    console.log(`    Throughput  : ${wkr.throughput_per_min ?? 0} tasks/min`);
    if (wkr.top_bottleneck) {
      console.log(`    Bottleneck  : ${wkr.top_bottleneck}`);
    }
    console.log('');
    console.log('  [scan]');
    console.log(`    Last scan   : ${scan.last_scan_ms != null ? scan.last_scan_ms + ' ms' : 'n/a'}`);
    console.log(`    Baseline    : ${scan.baseline_ms != null ? scan.baseline_ms + ' ms' : 'n/a'}`);
    console.log(`    Status      : ${scan.status ?? 'unknown'}`);
    console.log('─'.repeat(50));
    console.log('');

  } catch (err) {
    // Non-blocking: log the error but exit 0
    console.error('[collect-metrics] Unexpected error:', err.message);
  }

  process.exit(0);
}

main();
