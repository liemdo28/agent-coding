// local-agent/weather/ArrivalRateModel.js
// Phase 107 — Task arrival-rate estimation.

/**
 * Compute task arrival rate statistics from a task array.
 *
 * @param {Array<object>} tasks         Tasks with optional `started_at` ISO string.
 * @param {number}        windowMs      Look-back window in ms (default: 1 hour).
 * @returns {{ rate_per_h: number, ema_rate: number, peak_rate: number }}
 */
export function computeArrivalRate(tasks, windowMs = 3_600_000) {
  const withTs = (tasks ?? []).filter((t) => t.started_at);

  if (withTs.length === 0) {
    return { rate_per_h: 0, ema_rate: 0, peak_rate: 0 };
  }

  const timestamps = withTs.map((t) => new Date(t.started_at).getTime());
  const maxTs      = Math.max(...timestamps);
  const windowStart = maxTs - windowMs;

  // ── rate_per_h ─────────────────────────────────────────────────────────────
  const inWindow  = timestamps.filter((ts) => ts >= windowStart).length;
  const rate_per_h = inWindow / (windowMs / 3_600_000);

  // ── peak_rate (sliding 1-hour window in 15-min steps) ───────────────────────
  const stepMs      = 15 * 60 * 1000;
  const windowH     = 3_600_000;
  const minTs       = Math.min(...timestamps);
  let   peak_rate   = 0;

  for (let start = minTs; start <= maxTs; start += stepMs) {
    const end   = start + windowH;
    const count = timestamps.filter((ts) => ts >= start && ts < end).length;
    if (count > peak_rate) peak_rate = count;
  }

  // ── ema_rate (1-hour buckets, α = 0.3) ──────────────────────────────────────
  // Build buckets from the very first event
  const firstBucketStart = Math.floor(minTs / windowH) * windowH;
  const lastBucketStart  = Math.floor(maxTs / windowH) * windowH;
  const buckets          = [];

  for (let b = firstBucketStart; b <= lastBucketStart; b += windowH) {
    const count = timestamps.filter((ts) => ts >= b && ts < b + windowH).length;
    buckets.push(count);
  }

  const ALPHA = 0.3;
  let ema = buckets[0];
  for (let i = 1; i < buckets.length; i++) {
    ema = ALPHA * buckets[i] + (1 - ALPHA) * ema;
  }
  const ema_rate = ema;

  return {
    rate_per_h: round2(rate_per_h),
    ema_rate:   round2(ema_rate),
    peak_rate:  round2(peak_rate),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function round2(v) {
  return Math.round(v * 100) / 100;
}
