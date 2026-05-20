#!/usr/bin/env node
// bin/strategy.js — Phase 102 CLI
// Usage:
//   node bin/strategy.js score          # collect live sensors and print score
//   node bin/strategy.js history        # show last 24h of strategy log
//   node bin/strategy.js matrix         # show tradeoff matrix

import { resolve, dirname }       from 'path';
import { fileURLToPath }          from 'url';
import { StrategyScorer }         from '../local-agent/strategy/StrategyScorer.js';
import { readStrategyLog }        from '../local-agent/strategy/StrategyHistory.js';
import { buildTradeoffMatrix,
         formatTradeoffMatrix }   from '../local-agent/strategy/TradeoffMatrix.js';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG     = resolve(ROOT, '.local-agent', 'strategy-log.jsonl');

const cmd = process.argv[2] ?? 'score';
const scorer = new StrategyScorer({ logPath: LOG });

if (cmd === 'score') {
  console.log('Collecting sensors…');
  const s = await scorer.scoreAsync();
  console.log('\n── Strategy Score ──────────────────────────────');
  console.log(`  timestamp       : ${s.ts}`);
  console.log(`  composite       : ${s.composite} / 100`);
  console.log(`  recommendation  : ${s.recommendation.toUpperCase()}`);
  console.log('');
  console.log(`  performance     : ${s.performance.score}   cpu_pressure=${s.performance.cpu_pressure}  kb_latency_ratio=${s.performance.kb_latency_ratio}  queue_pressure=${s.performance.queue_pressure}`);
  console.log(`  cost            : ${s.cost.score}   worker_efficiency=${s.cost.worker_efficiency}  sla_breach_rate=${s.cost.sla_breach_rate}`);
  console.log(`  maintainability : ${s.maintainability.score}   qa_pass_rate=${s.maintainability.qa_pass_rate}  kb_coverage=${s.maintainability.kb_coverage}`);
  console.log('\nLogged to:', LOG);
} else if (cmd === 'history') {
  const entries = readStrategyLog(LOG, { limit: 20 });
  if (!entries.length) { console.log('No history yet. Run: node bin/strategy.js score'); process.exit(0); }
  console.log(`\nLast ${entries.length} strategy scores (most recent first):\n`);
  for (const e of entries) {
    const ts = e.ts.slice(0, 19).replace('T', ' ');
    console.log(`  ${ts}  composite=${String(e.composite).padStart(3)}  ${e.recommendation}`);
  }
} else if (cmd === 'matrix') {
  const entries = readStrategyLog(LOG, { limit: 10 });
  if (!entries.length) {
    console.log('No history yet — collecting live score first…');
    await scorer.scoreAsync();
    process.exit(0);
  }
  const matrix = buildTradeoffMatrix(entries);
  console.log('\n' + formatTradeoffMatrix(matrix));
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: node bin/strategy.js [score|history|matrix]');
  process.exit(1);
}
