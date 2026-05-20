// local-agent/sensors/index.js — Sensor registry + runner

import { collect as collectSystem }  from './system-sensor.js';
import { collect as collectKB }      from './kb-sensor.js';
import { collect as collectWorkers } from './worker-sensor.js';
import { collect as collectScan }    from './scan-sensor.js';

/**
 * Run all sensors and return a merged metrics object.
 * Each sensor is wrapped in a try/catch so a single failure cannot
 * block the rest of the collection.
 *
 * @returns {Promise<{collected_at, version, system, kb, workers, scan}>}
 */
export async function collectAll() {
  const [system, kb, workers, scan] = await Promise.all([
    safeCollect('system',  collectSystem),
    safeCollect('kb',      collectKB),
    safeCollect('workers', collectWorkers),
    safeCollect('scan',    collectScan),
  ]);

  return {
    collected_at: new Date().toISOString(),
    version:      '1.0',
    system,
    kb,
    workers,
    scan,
  };
}

/**
 * Start a continuous collection loop that writes metrics on every tick.
 * The callback (if provided) receives the metrics object on each tick.
 *
 * @param {number}   intervalMs - collection interval in milliseconds
 * @param {Function} [onCollect] - optional callback(metrics)
 * @returns {{ stop: Function }} - call stop() to halt the loop
 */
export function startWatch(intervalMs, onCollect) {
  let running = true;

  async function loop() {
    while (running) {
      const metrics = await collectAll();
      if (typeof onCollect === 'function') {
        try { onCollect(metrics); } catch { /* ignore callback errors */ }
      }
      // Wait for the next tick (simple setTimeout-based sleep)
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  loop().catch(() => {}); // fire-and-forget

  return {
    stop() { running = false; },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function safeCollect(name, fn) {
  try {
    const result = await Promise.resolve(fn());
    return result;
  } catch (err) {
    return { error: err.message, sensor: name };
  }
}
