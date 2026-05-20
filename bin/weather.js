#!/usr/bin/env node
// bin/weather.js — Phase 107 Weather Engine CLI
// Usage:
//   node bin/weather.js forecast         # print current weather forecast (horizon=2h)
//   node bin/weather.js forecast 4       # 4-hour horizon

import { WeatherEngine } from '../local-agent/weather/WeatherEngine.js';

const cmd     = process.argv[2] ?? 'forecast';
const horizonH = parseFloat(process.argv[3] ?? '2') || 2;

if (cmd === 'forecast') {
  const engine   = new WeatherEngine();
  const forecast = await engine.forecastAsync(horizonH);
  printForecast(forecast);
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: node bin/weather.js [forecast [horizonHours]]');
  process.exit(1);
}

// ---------------------------------------------------------------------------

function pct(v) {
  return Math.round(v * 100) + '%';
}

function printForecast(f) {
  const alert = f.alert_level.toUpperCase();
  console.log('\n── Weather Forecast ───────────────────────────────');
  console.log(`  alert          : ${alert}`);
  console.log(`  pressure index : ${f.pressure_index}/100`);
  console.log(`  horizon        : ${f.horizon_h}h`);
  console.log('');
  console.log('  Queue');
  console.log(`    predicted depth    : ${f.queue.predicted_depth}`);
  console.log(`    trend              : ${f.queue.trend}`);
  console.log(`    storm probability  : ${pct(f.queue.storm_probability)}`);
  console.log('');
  console.log('  SLA');
  console.log(`    predicted breach rate : ${pct(f.sla.predicted_breach_rate)}`);
  console.log(`    at-risk tasks         : ${f.sla.at_risk_tasks}`);
  console.log('');
  console.log('  Workers');
  console.log(`    predicted idle surplus : ${f.workers.predicted_idle_surplus}`);
  console.log('');
}
