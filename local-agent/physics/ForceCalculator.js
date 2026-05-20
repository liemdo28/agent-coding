// local-agent/physics/ForceCalculator.js
// Phase 110 — Physics Engine
// Pure function: computes all six force dimensions from a system snapshot.
// Positive forces are destabilizing; negative forces are stabilizing.

/**
 * @param {object} snapshot
 *   snapshot.ecology   — EcologyReport (Phase 104)
 *   snapshot.strategy  — StrategyScore (Phase 102)
 *   snapshot.sensor    — sensor reading (Phase 101)
 *   snapshot.weather   — WeatherForecast (Phase 107)
 *   snapshot.species   — SpeciesProfile (Phase 103)
 *   snapshot.geneLibrary — { gene_success_count: number } (Phase 106)
 * @param {object} baselineMetrics  — contents of metrics/baseline-2026-05-18.json
 * @returns {{ queue_pressure, sla_breach_force, skill_gap_force, kb_latency_drag,
 *             ecology_restoration, pattern_inheritance }}
 */
export function computeForces(snapshot, baselineMetrics = {}) {
  const ecology  = snapshot.ecology  ?? {};
  const strategy = snapshot.strategy ?? {};
  const sensor   = snapshot.sensor   ?? {};
  const weather  = snapshot.weather  ?? {};
  const genes    = snapshot.geneLibrary ?? {};

  const queueDepth    = ecology.queue?.depth ?? sensor.workers?.queue_depth ?? 0;
  const slaBreach     = strategy.cost?.sla_breach_rate ?? 0;
  const skillGaps     = (ecology.workers?.skill_gaps ?? []).length;

  const baselineP50   = baselineMetrics?.performance?.kb_query_p50_ms ?? 106;
  const currentP50    = sensor.kb?.query_p50_ms ?? baselineP50;
  const kbLatencyRatio = baselineP50 > 0 ? currentP50 / baselineP50 : 1;

  const sustainable   = ecology.queue?.sustainable ?? true;
  const geneSuccess   = genes.gene_success_count    ?? 0;

  // Formula from architecture spec.
  const queue_pressure       = +(queueDepth / 50 * 40).toFixed(2);          // max 40 at depth=50
  const sla_breach_force     = +(slaBreach * 30).toFixed(2);                 // max 30 at 100% breach
  const skill_gap_force      = +(skillGaps * 5).toFixed(2);                  // 5 per gap
  const kb_latency_drag      = +((kbLatencyRatio - 1) * 10).toFixed(2);     // 0 at baseline
  const ecology_restoration  = sustainable ? -15 : 0;                         // -15 if sustainable
  const pattern_inheritance  = +((geneSuccess / 100) * -10).toFixed(2);      // up to -10

  return {
    queue_pressure,
    sla_breach_force,
    skill_gap_force,
    kb_latency_drag,
    ecology_restoration,
    pattern_inheritance,
  };
}

/** Sum all force values into a net force scalar. */
export function netForce(forces) {
  return +Object.values(forces).reduce((a, v) => a + v, 0).toFixed(2);
}
