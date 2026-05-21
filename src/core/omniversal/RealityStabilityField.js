/**
 * RealityStabilityField.js — Unified Stability Across All Domains
 *
 * Stabilizes cognition, governance, execution, economics, and evolution as one unified field.
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class RealityStabilityField extends EventEmitter {
    #config; #stability = new Map(); #interventions = []; #stats = { measurementsTaken: 0, interventionsApplied: 0, fieldStability: 1.0 };
    constructor(config = {}) { super(); this.#config = { domains: config.domains || ['cognition', 'governance', 'execution', 'economics', 'evolution', 'orchestration'], instabilityThreshold: config.instabilityThreshold || 0.3, maxInterventions: config.maxInterventions || 100, ...config }; for (const d of this.#config.domains) this.#stability.set(d, 1.0); }
    reportStability(domain, value) { const clamped = Math.max(0, Math.min(1, value)); this.#stability.set(domain, clamped); this.#stats.measurementsTaken++; if (clamped < this.#config.instabilityThreshold) { this.emit('instability:detected', { domain, stability: clamped }); } }
    stabilize(domain, action) { this.#stats.interventionsApplied++; const record = { id: randomUUID(), domain, action, timestamp: Date.now() }; this.#interventions.push(record); if (this.#interventions.length > this.#config.maxInterventions) this.#interventions = this.#interventions.slice(-this.#config.maxInterventions); this.emit('stabilization:applied', record); return record; }
    computeFieldStability() { let sum = 0, cnt = 0; for (const [, v] of this.#stability) { sum += v; cnt++; } this.#stats.fieldStability = cnt > 0 ? sum / cnt : 1; return this.#stats.fieldStability; }
    getStability(domain) { return this.#stability.get(domain) ?? null; }
    getAllStability() { const r = {}; for (const [k, v] of this.#stability) r[k] = v; return r; }
    getInterventions(limit = 20) { return this.#interventions.slice(-limit); }
    getStats() { return { ...this.#stats, fieldStability: this.computeFieldStability() }; }
}
