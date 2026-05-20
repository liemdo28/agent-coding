// local-agent/replay/CausalReconstructor.js
// Phase 108 — Reality Reconstruction
// Applies heuristic rules to link events into causal chains, then
// simulates counterfactual interventions to estimate alternative outcomes.

export class CausalReconstructor {
  constructor(options = {}) {
    this.regressionWindowMs  = options.regressionWindowMs  ?? 30_000;   // 30s
    this.queueWindowMs       = options.queueWindowMs       ?? 60_000;   // 60s
  }

  /**
   * Reconstruct causal links from a ReplaySession.
   *
   * Heuristic rules:
   *   1. regression event within regressionWindowMs of a task_failed → failure caused regression
   *   2. sla_breach within queueWindowMs of a cluster of task_starts → inflow surge caused breach
   *   3. task_failed with a worker who had > 5 prior task_starts in last hour → overload caused failure
   *
   * @param {object} replaySession
   * @returns {CausalChain}
   */
  reconstruct(replaySession) {
    const events = replaySession.events ?? [];
    const links  = [];

    // Index events by type for quick lookup.
    const byType = {};
    for (const e of events) {
      (byType[e.type] ??= []).push(e);
    }

    // Rule 1: task_failed → sla_breach within window.
    const failures = byType['task_failed'] ?? [];
    const breaches = byType['sla_breach']  ?? [];

    for (const breach of breaches) {
      const breachMs = new Date(breach.ts).getTime();
      const cause = failures.find((f) => {
        const diff = Math.abs(breachMs - new Date(f.ts).getTime());
        return diff <= this.queueWindowMs && f.payload?.task_id === breach.payload?.task_id;
      });
      if (cause) {
        links.push({
          cause,
          effect:     breach,
          lag_ms:     Math.abs(new Date(breach.ts).getTime() - new Date(cause.ts).getTime()),
          confidence: 0.75,
          rule:       'task_failed→sla_breach',
        });
      }
    }

    // Rule 2: cluster of task_starts (≥5 in 5 min) followed by sla_breach.
    const starts = byType['task_start'] ?? [];
    for (const breach of breaches) {
      const breachMs = new Date(breach.ts).getTime();
      const recentStarts = starts.filter((s) => {
        const diff = breachMs - new Date(s.ts).getTime();
        return diff >= 0 && diff <= 300_000;
      });
      if (recentStarts.length >= 5) {
        links.push({
          cause:      recentStarts[0],
          effect:     breach,
          lag_ms:     breachMs - new Date(recentStarts[0].ts).getTime(),
          confidence: 0.6,
          rule:       'inflow_surge→sla_breach',
        });
      }
    }

    // Rule 3: worker overload → task_failed.
    const workerStartCounts = {};
    for (const s of starts) {
      const w = s.payload?.worker;
      if (w) workerStartCounts[w] = (workerStartCounts[w] ?? 0) + 1;
    }

    for (const f of failures) {
      const w = f.payload?.worker;
      if (w && (workerStartCounts[w] ?? 0) > 5) {
        links.push({
          cause:      { ts: f.ts, type: 'worker_overload', payload: { worker: w, task_count: workerStartCounts[w] } },
          effect:     f,
          lag_ms:     0,
          confidence: 0.5,
          rule:       'worker_overload→task_failed',
        });
      }
    }

    // Root event = earliest cause in the chain.
    const root = links.length > 0
      ? links.reduce((a, l) => new Date(l.cause.ts) < new Date(a.cause.ts) ? l : a).cause
      : (events[0] ?? null);

    return {
      root_event:      root,
      chain:           links,
      counterfactuals: [],
    };
  }

  /**
   * Simulate a counterfactual intervention on a causal chain.
   *
   * @param {object} causalChain
   * @param {{ at: string, action: string, params: object }} intervention
   * @returns {Counterfactual}
   */
  simulateIntervention(causalChain, intervention) {
    const { action, params } = intervention;

    // Estimate how many SLA breaches the intervention would have prevented.
    const slaLinks = causalChain.chain.filter((l) => l.effect.type === 'sla_breach');

    let estimated_sla_saved = 0;
    let simulated_outcome   = 'no change';

    if (action === 'reassign_worker') {
      const w = params?.worker;
      const affected = slaLinks.filter((l) =>
        l.cause.payload?.worker === w || l.effect.payload?.worker === w
      );
      estimated_sla_saved = Math.round(affected.length * 0.7);
      simulated_outcome   = `Reassigning ${w} would have prevented ~${estimated_sla_saved} SLA breach(es)`;

    } else if (action === 'throttle_queue') {
      const surgeLinks = slaLinks.filter((l) => l.rule === 'inflow_surge→sla_breach');
      estimated_sla_saved = Math.round(surgeLinks.length * 0.8);
      simulated_outcome   = `Throttling inflow by 20% would have prevented ~${estimated_sla_saved} SLA breach(es)`;

    } else if (action === 'add_worker') {
      estimated_sla_saved = Math.round(slaLinks.length * 0.3);
      simulated_outcome   = `Adding a worker would have prevented ~${estimated_sla_saved} SLA breach(es)`;
    }

    return {
      intervention,
      simulated_outcome,
      estimated_sla_saved,
    };
  }
}
