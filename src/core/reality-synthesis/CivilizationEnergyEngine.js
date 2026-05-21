/**
 * CivilizationEnergyEngine.js — Vitality & Momentum Tracking
 *
 * Computes:
 * - Execution vitality
 * - Innovation velocity
 * - Optimization momentum
 * - Strategic energy
 * - Chaos energy
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationEnergyEngine extends EventEmitter {
    #config;
    #energies = new Map();
    #history = [];
    #stats = { measurementsTaken: 0, peakEnergy: 0, lowEnergyAlerts: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            dimensions: config.dimensions || [
                'execution-vitality', 'innovation-velocity', 'optimization-momentum',
                'strategic-energy', 'chaos-energy', 'evolution-drive',
            ],
            lowEnergyThreshold: config.lowEnergyThreshold || 0.2,
            maxHistory: config.maxHistory || 300,
            ...config,
        };
        for (const dim of this.#config.dimensions) this.#energies.set(dim, 0.5);
    }

    /**
     * Report energy level for a dimension.
     */
    reportEnergy(dimension, value) {
        const clamped = Math.max(0, Math.min(1, value));
        this.#energies.set(dimension, clamped);
        this.#stats.measurementsTaken++;
        this.#history.push({ dimension, value: clamped, timestamp: Date.now() });
        if (this.#history.length > this.#config.maxHistory) this.#history = this.#history.slice(-this.#config.maxHistory);
        if (clamped > this.#stats.peakEnergy) this.#stats.peakEnergy = clamped;
        if (clamped < this.#config.lowEnergyThreshold) {
            this.#stats.lowEnergyAlerts++;
            this.emit('energy:low', { dimension, value: clamped });
        }
        this.emit('energy:reported', { dimension, value: clamped });
    }

    /**
     * Compute total civilization energy.
     */
    computeTotalEnergy() {
        let sum = 0, count = 0;
        for (const [, v] of this.#energies) { sum += v; count++; }
        return count > 0 ? sum / count : 0;
    }

    /**
     * Get energy balance — positive vs chaos energy.
     */
    getEnergyBalance() {
        const positive = ['execution-vitality', 'innovation-velocity', 'optimization-momentum', 'strategic-energy', 'evolution-drive'];
        const negative = ['chaos-energy'];
        const posSum = positive.reduce((s, d) => s + (this.#energies.get(d) ?? 0), 0) / positive.length;
        const negSum = negative.reduce((s, d) => s + (this.#energies.get(d) ?? 0), 0) / (negative.length || 1);
        return { productive: posSum, chaotic: negSum, balance: posSum - negSum };
    }

    getEnergy(dimension) { return this.#energies.get(dimension) ?? null; }
    getAllEnergies() { const r = {}; for (const [k, v] of this.#energies) r[k] = v; return r; }
    getHistory(limit = 50) { return this.#history.slice(-limit); }
    getStats() { return { ...this.#stats, totalEnergy: this.computeTotalEnergy() }; }
}
