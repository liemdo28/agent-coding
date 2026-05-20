#!/usr/bin/env node
// bin/ui-generate.js — Phase 109 Autonomous Design CLI
// Generates .local-agent/dashboard/index.html from live phase data.
// Usage:
//   node bin/ui-generate.js           # one-shot render
//   node bin/ui-generate.js watch     # watch mode, re-render every 30s

import { UIGenerator }    from '../local-agent/ui/UIGenerator.js';
import { collectAll }     from '../local-agent/sensors/index.js';
import { StrategyScorer } from '../local-agent/strategy/StrategyScorer.js';
import { EcologyBalancer } from '../local-agent/ecology/EcologyBalancer.js';
import { WeatherEngine }  from '../local-agent/weather/WeatherEngine.js';
import { PhysicsEngine }  from '../local-agent/physics/PhysicsEngine.js';

const cmd = process.argv[2];

const generator = new UIGenerator();
const scorer    = new StrategyScorer();
const balancer  = new EcologyBalancer();
const weather   = new WeatherEngine();
const physics   = new PhysicsEngine();

async function renderOnce() {
  const [sensor, strategy, forecast] = await Promise.all([
    collectAll(),
    scorer.scoreAsync(),
    weather.forecastAsync(),
  ]);
  const ecology = balancer.analyze();
  const eq      = physics.compute({ sensor, strategy, ecology, weather: forecast,
                                     species: {}, geneLibrary: {} });

  const result = generator.render({ sensor, strategy, ecology, weather: forecast,
                                     species: {}, physics: eq });
  console.log(`✓ Dashboard rendered: ${result.path}`);
  console.log(`  Theme: ${result.theme}  |  Panels: ${result.panelsRendered}`);
  console.log(`\n  Open in browser: open ${result.path}`);
  return result;
}

if (cmd === 'watch') {
  console.log('Watching — re-rendering every 30s (Ctrl-C to stop)');
  await renderOnce();
  setInterval(renderOnce, 30_000);
} else {
  await renderOnce();
}
