#!/usr/bin/env node
// bin/physics.js — Phase 110 Physics Engine CLI
// Usage:
//   node bin/physics.js compute    # collect live data and compute stability
//   node bin/physics.js report     # same but pretty-print stability report

import { PhysicsEngine }     from '../local-agent/physics/PhysicsEngine.js';
import { collectAll }        from '../local-agent/sensors/index.js';
import { StrategyScorer }    from '../local-agent/strategy/StrategyScorer.js';
import { EcologyBalancer }   from '../local-agent/ecology/EcologyBalancer.js';
import { WeatherEngine }     from '../local-agent/weather/WeatherEngine.js';

const cmd    = process.argv[2] ?? 'report';
const engine = new PhysicsEngine();

const scorer   = new StrategyScorer();
const balancer = new EcologyBalancer();
const weather  = new WeatherEngine();

const [sensor, strategy, forecast] = await Promise.all([
  collectAll(),
  scorer.scoreAsync(),
  weather.forecastAsync(),
]);
const ecology = balancer.analyze();

const eq = engine.compute({ sensor, strategy, ecology, weather: forecast,
                             species: {}, geneLibrary: {} });

if (cmd === 'compute') {
  console.log(JSON.stringify(eq, null, 2));
} else {
  console.log('\n' + engine.format(eq));
  console.log(`\nLogged to: ${engine.logPath}`);
}
