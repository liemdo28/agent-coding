// local-agent/sensors/system-sensor.js — OS/process metrics

import os from 'os';

/**
 * Collect OS and process-level metrics.
 * @returns {{ cpu_load_1m, cpu_load_5m, cpu_count, mem_used_mb, mem_total_mb,
 *             mem_pct, heap_used_mb, heap_total_mb, uptime_s, timestamp }}
 */
export function collect() {
  try {
    const loadavg    = os.loadavg();
    const cpuCount   = os.cpus().length;
    const totalMem   = os.totalmem();
    const freeMem    = os.freemem();
    const usedMem    = totalMem - freeMem;
    const memUsage   = process.memoryUsage();

    return {
      cpu_load_1m:   Math.round(loadavg[0] * 100) / 100,
      cpu_load_5m:   Math.round(loadavg[1] * 100) / 100,
      cpu_count:     cpuCount,
      mem_used_mb:   Math.round(usedMem / 1024 / 1024),
      mem_total_mb:  Math.round(totalMem / 1024 / 1024),
      mem_pct:       Math.round((usedMem / totalMem) * 100 * 10) / 10,
      heap_used_mb:  Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      uptime_s:      Math.round(os.uptime()),
      timestamp:     new Date().toISOString(),
    };
  } catch (err) {
    return {
      cpu_load_1m:   null,
      cpu_load_5m:   null,
      cpu_count:     null,
      mem_used_mb:   null,
      mem_total_mb:  null,
      mem_pct:       null,
      heap_used_mb:  null,
      heap_total_mb: null,
      uptime_s:      null,
      timestamp:     new Date().toISOString(),
      error:         err.message,
    };
  }
}
