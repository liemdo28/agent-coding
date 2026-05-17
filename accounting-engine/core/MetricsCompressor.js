// core/MetricsCompressor.js - Hourly aggregation of old resource_metrics rows
// Keeps raw samples for the recent retention window; collapses older rows
// into hourly averages to control disk growth on long-running systems.
import { withTransaction } from './DatabaseManager.js';

const DEFAULT_RAW_RETENTION_HOURS = 24;

/**
 * Compress resource_metrics older than rawRetentionHours into hourly averages.
 * Runs inside a single transaction: delete old raw rows, insert hourly aggregates.
 * @returns {{ rowsBefore, rowsAfter, rowsSaved, hoursCompressed, cutoff }}
 */
export function compressMetrics(db, options = {}) {
  const rawRetentionHours = options.rawRetentionHours ?? DEFAULT_RAW_RETENTION_HOURS;
  const cutoff = new Date(Date.now() - rawRetentionHours * 3_600_000).toISOString();

  let rowsBefore, rowsAfter, hoursCompressed;

  withTransaction(db, () => {
    rowsBefore = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;

    // Hourly averages for everything older than the cutoff
    const hourlyAverages = db.prepare(`
      SELECT
        session_id,
        strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) AS hour_bucket,
        ROUND(AVG(cpu_pct), 4)          AS cpu_pct,
        ROUND(AVG(memory_mb), 4)        AS memory_mb,
        ROUND(AVG(heap_used_mb), 4)     AS heap_used_mb,
        ROUND(AVG(heap_total_mb), 4)    AS heap_total_mb,
        ROUND(AVG(rss_mb), 4)           AS rss_mb,
        ROUND(AVG(memory_delta_pct), 4) AS memory_delta_pct,
        ROUND(AVG(gpu_mb), 4)           AS gpu_mb,
        ROUND(AVG(disk_free_mb), 4)     AS disk_free_mb
      FROM resource_metrics
      WHERE timestamp < ?
      GROUP BY session_id, hour_bucket
    `).all(cutoff);

    // Delete the raw rows
    db.prepare('DELETE FROM resource_metrics WHERE timestamp < ?').run(cutoff);

    // Re-insert one aggregated row per (session, hour)
    const ins = db.prepare(`
      INSERT INTO resource_metrics
        (session_id, timestamp, cpu_pct, memory_mb, heap_used_mb, heap_total_mb,
         rss_mb, memory_delta_pct, gpu_mb, disk_free_mb)
      VALUES
        (@session_id, @hour_bucket, @cpu_pct, @memory_mb, @heap_used_mb, @heap_total_mb,
         @rss_mb, @memory_delta_pct, @gpu_mb, @disk_free_mb)
    `);
    for (const row of hourlyAverages) ins.run(row);

    hoursCompressed = hourlyAverages.length;
    rowsAfter = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
  })();

  return {
    rowsBefore,
    rowsAfter,
    rowsSaved:       rowsBefore - rowsAfter,
    hoursCompressed,
    cutoff,
  };
}

/**
 * Return storage stats for resource_metrics (no writes).
 */
export function getMetricsStorageStats(db) {
  const counts  = db.prepare(`
    SELECT COUNT(*) as total, MIN(timestamp) as oldest, MAX(timestamp) as newest
    FROM resource_metrics
  `).get();
  const pageSize  = db.pragma('page_size')[0].page_size;
  const pageCount = db.pragma('page_count')[0].page_count;
  return {
    total_samples: counts.total,
    oldest_sample: counts.oldest,
    newest_sample: counts.newest,
    db_size_mb:    Math.round((pageSize * pageCount) / 1_048_576 * 100) / 100,
  };
}
