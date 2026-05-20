// local-agent/weather/index.js
// Phase 107 — Weather Engine public API surface.

export { WeatherEngine }          from './WeatherEngine.js';
export { linearRegression,
         predictAt }              from './TrendAnalyzer.js';
export { computeArrivalRate }     from './ArrivalRateModel.js';
export { detectSLAStorm }         from './SLAStormDetector.js';
