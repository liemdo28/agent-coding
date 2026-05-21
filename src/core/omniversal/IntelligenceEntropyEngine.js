/**
 * IntelligenceEntropyEngine.js — Entropy Detection & Management
 *
 * Detects strategic entropy, cognition fragmentation, architecture decay,
 * and optimization stagnation.
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class IntelligenceEntropyEngine extends EventEmitter {
    #config; #entropy = new Map(); #alerts = []; #stats = { measurementsTaken: 0, alertsRaised: 0, totalEntropy: 0 };
    constructor(config = {}) { super(); this.#config = { dimensions: config.dimensions || ['strategic', 'cognition', 'architecture', 'optimization', 'governance', 'execution'], entropyThreshold: config.entropyThreshold || 0.7, maxAlerts: config.maxAlerts || 100, ...config }; for (const d of this.#config.dimensions) this.#entropy.set(d, 0); }
    measure(dimension, value) { const clamped = Math.max(0, Math.min(1, value)); this.#entropy.set(dimension, clamped); this.#stats.measurementsTaken++; if (clamped > this.#config.entropyThreshold) { this.#stats.alertsRaised++; const alert = { id: randomUUID(), dimension, entropy: clamped, timestamp: Date.now() }; this.#alerts.push(alert); if (this.#alerts.length > this.#config.maxAlerts) this.#alerts = this.#alerts.slice(-this.#config.maxAlerts); this.emit('entropy:critical', alert); } }
    computeTotalEntropy() { let sum = 0, cnt = 0; for (const [, v] of this.#entropy) { sum += v; cnt++; } this.#stats.totalEntropy = cnt > 0 ? sum / cnt : 0; return this.#stats.totalEntropy; }
    getEntropy(dimension) { return this.#entropy.get(dimension) ?? null; }
    getAllEntropy() { const r = {}; for (const [k, v] of this.#entropy) r[k] = v; return r; }
    getAlerts(limit = 20) { return this.#alerts.slice(-limit); }
    getStats() { return { ...this.#stats, totalEntropy: this.computeTotalEntropy() }; }
}
