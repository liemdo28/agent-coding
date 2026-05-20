#!/usr/bin/env node
// bin/replay.js — Phase 108 Reality Reconstruction CLI
// Usage:
//   node bin/replay.js build <hours>         # build session for last N hours
//   node bin/replay.js causal <sessionId>    # reconstruct causal chain

import { ReplayEngine }          from '../local-agent/replay/ReplayEngine.js';
import { CausalReconstructor }   from '../local-agent/replay/CausalReconstructor.js';

const cmd = process.argv[2] ?? 'build';
const arg = process.argv[3];

const engine = new ReplayEngine();
const recon  = new CausalReconstructor();

if (cmd === 'build') {
  const hours = parseFloat(arg ?? '2');
  const to    = new Date();
  const from  = new Date(to.getTime() - hours * 3600_000);
  console.log(`Building replay session: last ${hours}h`);
  const session = engine.buildSession(from, to);
  const { path } = engine.saveSession(session);
  console.log(`\n  Session ID: ${session.id}`);
  console.log(`  Events:     ${session.summary.total_events}`);
  console.log(`  Failures:   ${session.summary.failure_events}`);
  console.log(`  SLA breaches: ${session.summary.sla_breaches}`);
  console.log(`  Timeline gaps: ${session.summary.timeline_gaps.length}`);
  console.log(`\n  Saved to: ${path}`);
  console.log(`\n  Run causal analysis: node bin/replay.js causal ${session.id}`);

} else if (cmd === 'causal') {
  if (!arg) { console.error('Usage: node bin/replay.js causal <sessionId>'); process.exit(1); }
  const session = engine.loadSession(arg);
  if (!session) { console.error(`Session not found: ${arg}`); process.exit(1); }
  const chain = recon.reconstruct(session);
  console.log(`\n── Causal Chain (${chain.chain.length} links) ───────────────────`);
  for (const l of chain.chain.slice(0, 10)) {
    console.log(`  [${l.rule}] lag=${l.lag_ms}ms  conf=${l.confidence}`);
    console.log(`    cause:  ${l.cause.type} @ ${l.cause.ts?.slice(0, 19)}`);
    console.log(`    effect: ${l.effect.type} @ ${l.effect.ts?.slice(0, 19)}`);
  }
  if (chain.chain.length > 0) {
    const cf = recon.simulateIntervention(chain, { action: 'throttle_queue', params: {} });
    console.log(`\n  Counterfactual (throttle_queue): ${cf.simulated_outcome}`);
  }
} else {
  console.error('Usage: node bin/replay.js [build [hours] | causal <sessionId>]');
  process.exit(1);
}
