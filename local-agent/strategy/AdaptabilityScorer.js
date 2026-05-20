// local-agent/strategy/AdaptabilityScorer.js
// Phase 103 — Software Species
// Measures how quickly the project recovers from regressions (time-to-fix).

/**
 * Score adaptability based on timeline events.
 *
 * @param {Array<{ ts: string, type: string, passed?: boolean }>} timelineEvents
 * @returns {{ score: number, mean_fix_h: number, regression_count: number }}
 */
export function scoreAdaptability(timelineEvents = []) {
  const events = [...timelineEvents].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const regressions = events.filter((e) => e.type === 'regression');

  if (regressions.length === 0) {
    return { score: 80, mean_fix_h: 0, regression_count: 0 };
  }

  const fixTimes = [];

  for (const reg of regressions) {
    const regTime = new Date(reg.ts).getTime();
    // Find next qa_run event after this regression where passed === true
    const fix = events.find(
      (e) => e.type === 'qa_run' && e.passed === true && new Date(e.ts).getTime() > regTime
    );
    if (fix) {
      const fixTime = new Date(fix.ts).getTime();
      const hours = (fixTime - regTime) / (1000 * 60 * 60);
      fixTimes.push(hours);
    }
  }

  if (fixTimes.length === 0) {
    // Regressions exist but none were fixed yet — worst case adaptability
    return { score: 0, mean_fix_h: Infinity, regression_count: regressions.length };
  }

  const mean_fix_h = fixTimes.reduce((sum, h) => sum + h, 0) / fixTimes.length;
  const score = clamp(100 - mean_fix_h * 4, 0, 100);

  return {
    score: +score.toFixed(2),
    mean_fix_h: +mean_fix_h.toFixed(4),
    regression_count: regressions.length,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
