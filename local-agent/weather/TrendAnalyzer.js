// local-agent/weather/TrendAnalyzer.js
// Phase 107 — Pure trend-analysis functions (no I/O).

/**
 * Ordinary Least Squares linear regression on a time series.
 *
 * @param {Array<{ ts: string, value: number }>} timeSeries
 * @returns {{ slope: number, intercept: number, r_squared: number }}
 */
export function linearRegression(timeSeries) {
  if (!timeSeries || timeSeries.length < 2) {
    return {
      slope: 0,
      intercept: timeSeries?.[0]?.value ?? 0,
      r_squared: 0,
    };
  }

  const t0 = new Date(timeSeries[0].ts).getTime() / 1000;
  const xs = timeSeries.map((p) => new Date(p.ts).getTime() / 1000 - t0);
  const ys = timeSeries.map((p) => p.value);
  const n = timeSeries.length;

  const sumX  = xs.reduce((a, x) => a + x, 0);
  const sumY  = ys.reduce((a, y) => a + y, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope     = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // r²
  const meanY  = sumY / n;
  const ssTot  = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes  = ys.reduce((a, y, i) => a + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r_squared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return {
    slope:     round4(slope),
    intercept: round4(intercept),
    r_squared: round4(r_squared),
  };
}

/**
 * Predict the regression value at a given offset (seconds) from the first point.
 *
 * @param {{ slope: number, intercept: number }} regression
 * @param {number} offsetSeconds
 * @returns {number}
 */
export function predictAt(regression, offsetSeconds) {
  return regression.slope * offsetSeconds + regression.intercept;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function round4(v) {
  return Math.round(v * 10_000) / 10_000;
}
