#!/usr/bin/env node
// bin/experiments.js — Phase 105 Autonomous Scientist CLI
// Usage:
//   node bin/experiments.js suggest      # suggest hypotheses from live ecology report
//   node bin/experiments.js run <id>     # run experiment by id
//   node bin/experiments.js list         # list all experiments

import { EcologyBalancer }   from '../local-agent/ecology/EcologyBalancer.js';
import { suggestHypotheses } from '../local-agent/experiments/HypothesisBuilder.js';
import { ExperimentEngine }  from '../local-agent/experiments/ExperimentEngine.js';

const cmd  = process.argv[2] ?? 'list';
const arg1 = process.argv[3];

const engine = new ExperimentEngine();

switch (cmd) {

  case 'suggest': {
    const balancer = new EcologyBalancer();
    const report   = balancer.analyze();
    const list     = suggestHypotheses(report);

    if (list.length === 0) {
      console.log('No hypotheses to suggest based on current ecology report.');
      break;
    }

    console.log('\n── Hypothesis Suggestions ──────────────────────────────────────');
    list.forEach((s, i) => {
      console.log(`\n  [${i + 1}] ${s.hypothesis}`);
      console.log(`       variable       : ${s.variable}`);
      console.log(`       metric         : ${s.metric}`);
      console.log(`       controlFilter  : ${JSON.stringify(s.controlFilter)}`);
      console.log(`       treatmentFilter: ${JSON.stringify(s.treatmentFilter)}`);
    });
    console.log('');
    break;
  }

  case 'run': {
    if (!arg1) {
      console.error('Usage: node bin/experiments.js run <experimentId>');
      process.exit(1);
    }
    try {
      const result = engine.runExperiment(arg1);
      console.log('\n── Experiment Result ───────────────────────────────────────────');
      console.log(`  id         : ${result.id}`);
      console.log(`  hypothesis : ${result.hypothesis}`);
      console.log(`  metric     : ${result.metric}`);
      console.log(`  control_n  : ${result.control_n}  mean=${result.control_mean?.toFixed(4)}`);
      console.log(`  treatment_n: ${result.treatment_n}  mean=${result.treatment_mean?.toFixed(4)}`);
      console.log(`  p_value    : ${result.p_value?.toFixed(4)}`);
      console.log(`  significant: ${result.significant ? 'YES' : 'no'}`);
      console.log(`  effect_size: ${result.effect_size?.toFixed(4)}`);
      console.log(`  conclusion : ${result.conclusion}`);
      console.log('');
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    break;
  }

  case 'list': {
    const rows = engine.listExperiments();

    if (rows.length === 0) {
      console.log('No experiments defined yet. Use `node bin/experiments.js suggest` to get started.');
      break;
    }

    console.log('\n── Experiments ─────────────────────────────────────────────────');
    for (const r of rows) {
      const sig = r.significant ? '✓ SIGNIFICANT' : '  not significant';
      const pv  = r.p_value != null ? ` p=${r.p_value.toFixed(3)}` : '';
      console.log(`  [${r.status.padEnd(8)}] ${r.id.slice(0, 8)}… ${r.hypothesis.slice(0, 60)}${pv} ${r.status === 'complete' ? sig : ''}`);
    }
    console.log('');
    break;
  }

  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Usage: node bin/experiments.js [suggest|run <id>|list]');
    process.exit(1);
}
