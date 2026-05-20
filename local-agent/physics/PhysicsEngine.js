// local-agent/physics/PhysicsEngine.js
// Phase 110 — Physics Engine
// Aggregates outputs of all prior phases into a single stability equation,
// models execution state as a physics system with forces and entropy.

import { existsSync, readFileSync,
         appendFileSync, mkdirSync }  from 'fs';
import { resolve, dirname }           from 'path';
import { fileURLToPath }              from 'url';
import { computeForces, netForce }    from './ForceCalculator.js';
import { accumulateEntropy,
         readLastEntropy }            from './EntropyTracker.js';
import { formatStabilityReport }      from './StabilityReport.js';

const ROOT         = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE_PATH = resolve(ROOT, 'metrics', 'baseline-2026-05-18.json');
const LOG_PATH     = resolve(ROOT, '.local-agent', 'physics-log.jsonl');

function loadJSON(p) {
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }

export class PhysicsEngine {
  /**
   * @param {object} options
   * @param {string} [options.logPath]          path to physics-log.jsonl
   * @param {string} [options.baselinePath]     path to baseline metrics JSON
   * @param {number} [options.entropyDecayRate] default 0.05
   */
  constructor(options = {}) {
    this.logPath        = options.logPath        ?? LOG_PATH;
    this.baselinePath   = options.baselinePath   ?? BASELINE_PATH;
    this.decayRate      = options.entropyDecayRate ?? 0.05;
    this._baseline      = loadJSON(this.baselinePath);
  }

  /**
   * Compute a StabilityEquation from a pre-collected snapshot.
   * Pure given snapshot — reads previous entropy from log for continuity.
   *
   * @param {object} snapshot  — { sensor, strategy, ecology, weather, species, geneLibrary }
   * @returns {StabilityEquation}
   */
  compute(snapshot) {
    const forces = computeForces(snapshot, this._baseline);
    const nf     = netForce(forces);

    const prevEntropy = readLastEntropy(this.logPath);
    const { newEntropy, delta, trend } = accumulateEntropy(prevEntropy, nf, this.decayRate);

    // stability_index = clamp(-100, 100, -net_force * 2 - entropy * 0.5)
    const stability_index = clamp(-100, 100,
      Math.round(-nf * 2 - newEntropy * 0.5));

    const phase_state = this.getPhaseState({ stability_index, entropy: { current: newEntropy } });

    const restorations = this.suggestRestorations({ forces, net_force: nf, stability_index });

    const eq = {
      ts: new Date().toISOString(),
      forces,
      net_force:       nf,
      entropy: {
        current: newEntropy,
        delta,
        trend,
      },
      stability_index,
      phase_state,
      restoration_actions: restorations,
    };

    this._appendLog(eq);
    return eq;
  }

  /**
   * Live async variant: gathers data from all phase dependencies, calls compute().
   *
   * @param {object} deps  — { sensorBus, strategyScorer, ecologyBalancer, weatherEngine,
   *                           speciesClassifier, library }
   * @returns {Promise<StabilityEquation>}
   */
  async computeAsync(deps = {}) {
    const [sensorReading, strategyScore, ecologyReport, weatherForecast] = await Promise.all([
      deps.sensorBus?.collectAll?.()          ?? Promise.resolve({}),
      deps.strategyScorer?.scoreAsync?.()     ?? Promise.resolve({}),
      Promise.resolve(deps.ecologyBalancer?.analyze?.() ?? {}),
      deps.weatherEngine?.forecastAsync?.()   ?? Promise.resolve({}),
    ]);

    const speciesProfile = deps.speciesClassifier
      ? await deps.speciesClassifier.classifyAsync?.('.', deps.strategyScorer).catch(() => {})
      : {};

    const geneLibrary = deps.library
      ? { gene_success_count: deps.library.count?.() ?? 0 }
      : {};

    return this.compute({
      sensor:      sensorReading,
      strategy:    strategyScore,
      ecology:     ecologyReport,
      weather:     weatherForecast,
      species:     speciesProfile,
      geneLibrary,
    });
  }

  /**
   * Derive phase state from stability_index and entropy.
   *
   * @param {{ stability_index: number, entropy: { current: number } }} eq
   * @returns {'stable'|'meta_stable'|'oscillating'|'diverging'|'critical'}
   */
  getPhaseState({ stability_index, entropy }) {
    const e = entropy?.current ?? 0;
    if (stability_index < -50 || e > 80)                          return 'critical';
    if (stability_index < -20)                                    return 'diverging';
    if (Math.abs(stability_index) < 20 && e > 40)                 return 'oscillating';
    if (stability_index >= 20 && stability_index < 60 && e < 40)  return 'meta_stable';
    if (stability_index >= 60)                                    return 'stable';
    return 'diverging';
  }

  /**
   * Suggest restoration actions for the dominant destabilizing forces.
   *
   * @param {{ forces: object, net_force: number, stability_index: number }} eq
   * @returns {RestorationAction[]}
   */
  suggestRestorations({ forces, net_force, stability_index }) {
    const actions = [];
    if (net_force <= 0) return actions;  // system converging — no intervention needed

    if (forces.queue_pressure > 10) {
      actions.push({
        force:           'queue_pressure',
        action:          'Throttle task inflow or scale worker pool',
        estimated_delta: Math.round(forces.queue_pressure * 0.5),
      });
    }
    if (forces.sla_breach_force > 8) {
      actions.push({
        force:           'sla_breach_force',
        action:          'Run ecology:report and apply rebalance recommendations',
        estimated_delta: Math.round(forces.sla_breach_force * 0.4),
      });
    }
    if (forces.skill_gap_force > 5) {
      actions.push({
        force:           'skill_gap_force',
        action:          'Address skill gaps identified by ecology:report',
        estimated_delta: Math.round(forces.skill_gap_force * 0.6),
      });
    }
    if (forces.kb_latency_drag > 3) {
      actions.push({
        force:           'kb_latency_drag',
        action:          'Expand KB (run kb:ingest) or optimize FTS5 index',
        estimated_delta: Math.round(forces.kb_latency_drag * 0.8),
      });
    }

    return actions.slice(0, 3);  // top 3 most impactful
  }

  /** Format a StabilityEquation for CLI display. */
  format(eq) { return formatStabilityReport(eq); }

  // ── Internal ───────────────────────────────────────────────────────────────

  _appendLog(eq) {
    try {
      mkdirSync(dirname(this.logPath), { recursive: true });
      appendFileSync(this.logPath, JSON.stringify(eq) + '\n', 'utf8');
    } catch { /* non-critical */ }
  }
}
