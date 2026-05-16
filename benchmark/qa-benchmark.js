// benchmark/qa-benchmark.js - measure QA engine performance targets
// Run: node benchmark/qa-benchmark.js <project-path>

import { performance } from 'perf_hooks';
import { resolve }     from 'path';
import { existsSync }  from 'fs';
import { loadConfig }  from '../local-agent/core/config.js';
import { runBuild }    from '../local-agent/qa/BuildRunner.js';
import { runTests }    from '../local-agent/qa/TestRunner.js';
import { parseErrors } from '../local-agent/qa/ErrorParser.js';

const TARGETS = {
  build_ms:  30000,  // small project build < 30s
  test_ms:   60000,  // test suite < 60s
  parse_ms:   500,   // error parsing < 500ms
};

async function benchmark(projectPath) {
  console.log(`\nQA Benchmark — ${projectPath}\n${'─'.repeat(50)}`);
  const root = resolve(projectPath);
  if (!existsSync(root)) {
    console.error(`Path not found: ${root}`);
    process.exit(1);
  }

  const config = loadConfig(root);
  const results = [];

  // ── Error parser benchmark ─────────────────────────────────────────────
  const sampleLog = `Cannot find module '@/components/Button'\nSyntaxError: Unexpected token\nError: build failed`;
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) parseErrors(sampleLog);
  const parseMs = (performance.now() - t0) / 1000;
  results.push({ name: 'Error parse (avg)', ms: parseMs, target: TARGETS.parse_ms });

  // ── Build benchmark ────────────────────────────────────────────────────
  const bt0 = performance.now();
  const buildResult = await runBuild(root, config);
  const buildMs = performance.now() - bt0;
  results.push({ name: 'Build', ms: buildMs, target: TARGETS.build_ms, success: buildResult.success });

  // ── Test benchmark ────────────────────────────────────────────────────
  const tt0 = performance.now();
  const testResult = await runTests(root, config);
  const testMs = performance.now() - tt0;
  results.push({ name: 'Test suite', ms: testMs, target: TARGETS.test_ms, success: testResult.success });

  // ── Report ────────────────────────────────────────────────────────────
  console.log('\nResults:\n');
  for (const r of results) {
    const ok     = r.ms <= r.target;
    const status = ok ? '✓ PASS' : '✗ SLOW';
    console.log(`  ${status}  ${r.name.padEnd(25)} ${r.ms.toFixed(0).padStart(7)}ms  (target: ${r.target}ms)`);
  }
  console.log();
}

const projectPath = process.argv[2] ?? '.';
benchmark(projectPath).catch((err) => { console.error(err.message); process.exit(1); });
