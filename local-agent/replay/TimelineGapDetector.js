// local-agent/replay/TimelineGapDetector.js
// Phase 108 — Reality Reconstruction

/**
 * Scan a sorted ReplayEvent array for consecutive events with a gap larger
 * than thresholdMs. These gaps indicate periods with no recorded activity.
 *
 * @param {Array<{ ts: string }>} events      — must be sorted by ts ascending
 * @param {number}                thresholdMs — default 5 minutes (300,000 ms)
 * @returns {Array<{ from: string, to: string, gap_ms: number }>}
 */
export function detectGaps(events, thresholdMs = 300_000) {
  const gaps = [];
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].ts).getTime();
    const curr = new Date(events[i].ts).getTime();
    const diff = curr - prev;
    if (diff > thresholdMs) {
      gaps.push({ from: events[i - 1].ts, to: events[i].ts, gap_ms: diff });
    }
  }
  return gaps;
}
