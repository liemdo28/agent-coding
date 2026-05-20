#!/usr/bin/env node
// bin/ecology.js — Phase 104 Execution Ecology CLI
// Usage:
//   node bin/ecology.js report      # one-shot analysis + print report
//   node bin/ecology.js watch 30    # watch loop, 30s interval, print on rebalance

import { EcologyBalancer } from '../local-agent/ecology/EcologyBalancer.js';

const cmd      = process.argv[2] ?? 'report';
const interval = parseInt(process.argv[3] ?? '60') * 1000;

const balancer = new EcologyBalancer();

function printReport(r) {
  const P = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
  console.log('\n── Ecology Report ─────────────────────────────────────');
  console.log(`  ${new Date(r.ts).toISOString()}  pressure: ${P[r.queue.pressure] ?? '?'} ${r.queue.pressure.toUpperCase()}`);
  console.log('');
  console.log('  Queue');
  console.log(`    depth         : ${r.queue.depth}`);
  console.log(`    inflow/h      : ${r.queue.inflow_rate_per_h}`);
  console.log(`    outflow/h     : ${r.queue.outflow_rate_per_h}`);
  console.log(`    sustainable   : ${r.queue.sustainable ? 'yes' : 'NO'}`);
  console.log('');
  console.log('  Workers');
  console.log(`    total         : ${r.workers.total}`);
  console.log(`    busy          : ${r.workers.busy}   idle: ${r.workers.idle}`);
  console.log(`    overloaded    : ${r.workers.overloaded.length}   underutilized: ${r.workers.underutilized.length}`);
  if (r.workers.skill_gaps.length) {
    console.log('    skill gaps    :');
    for (const g of r.workers.skill_gaps) {
      console.log(`      ${g.skill.padEnd(10)} failure=${Math.round(g.failure_rate*100)}%  workers=${g.worker_count}`);
    }
  }
  console.log('');
  console.log('  Food Chain');
  for (const n of r.food_chain) {
    if (!n.count) continue;
    console.log(`    ${n.priority}  count=${n.count}  done=${n.done}  failed=${n.failed}  completion=${Math.round(n.completion_rate*100)}%  avgDur=${n.avg_duration_h}h  slaBreach=${n.sla_breach_count}`);
  }
  if (r.recommendation.length) {
    console.log('');
    console.log('  Recommendations');
    for (const a of r.recommendation) {
      const u = a.urgency === 'high' ? '⚠' : '·';
      console.log(`    ${u} [${a.action}] ${a.detail}`);
    }
  }
  console.log('');
}

if (cmd === 'report') {
  const report = balancer.analyze();
  printReport(report);
} else if (cmd === 'watch') {
  console.log(`Watching ecology every ${interval / 1000}s… (Ctrl-C to stop)`);
  balancer.on('rebalance', (r) => {
    console.log('\n⚠  REBALANCE EVENT');
    printReport(r);
  });
  balancer.watch(interval);
  // Also print the first snapshot immediately (already triggered by watch())
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: node bin/ecology.js [report|watch [intervalSeconds]]');
  process.exit(1);
}
