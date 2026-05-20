// local-agent/strategy/IntelligenceReadinessScorer.js
// Phase 103 — Software Species
// Measures how "intelligence-ready" the codebase is: KB coverage + test density.

/**
 * Score intelligence readiness.
 *
 * @param {{ counts: { js_loc: number, tests_pass: number } }} baselineMetrics
 * @param {{ kb_chunks: number }} kbStats
 * @returns {{ score: number, kb_density: number, test_density: number }}
 */
export function scoreIntelligenceReadiness(baselineMetrics, kbStats) {
  const js_loc     = baselineMetrics?.counts?.js_loc     ?? 1;
  const tests_pass = baselineMetrics?.counts?.tests_pass ?? 0;
  const kb_chunks  = kbStats?.kb_chunks ?? 0;

  // Ratio of knowledge chunks per line of code
  const kb_density = kb_chunks / Math.max(js_loc, 1);

  // Tests per 100 LOC
  const test_density = tests_pass / Math.max(js_loc / 100, 1);

  // Scale so typical values land 50-80
  const raw_score = kb_density * test_density * 100 * 10;
  const score = clamp(raw_score, 0, 100);

  return {
    score: +score.toFixed(2),
    kb_density: +kb_density.toFixed(4),
    test_density: +test_density.toFixed(4),
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
