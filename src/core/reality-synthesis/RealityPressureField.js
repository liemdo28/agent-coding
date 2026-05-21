/**
 * RealityPressureField.js — Multi-Dimensional Pressure Modeling
 *
 * Computes and models interactions between:
 * - Strategic pressure
 * - Architecture pressure
 * - Governance pressure
 * - Execution pressure
 * - Evolution pressure
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class RealityPressureField extends EventEmitter {
    #config;
    #fields = new Map();
    #interactions = [];
    #history = [];
    #stats = { fieldUpdates: 0, interactionsComputed: 0, cascadesDetected: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            dimensions: config.dimensions || [
                'strategic', 'architecture', 'governance', 'execution', 'evolution', 'cognitive',
            ],
            cascadeThreshold: config.cascadeThreshold || 0.7,
            maxHistory: config.maxHistory || 300,
            ...config,
        };
        for (const dim of this.#config.dimensions) this.#fields.set(dim, { value: 0, sources: [], updatedAt: Date.now() });
    }

    /**
     * Apply pressure to a field.
     */
    applyPressure(dimension, value, source = '') {
        const clamped = Math.max(0, Math.min(1, value));
        this.#fields.set(dimension, { value: clamped, sources: [source], updatedAt: Date.now() });
        this.#stats.fieldUpdates++;
        this.#history.push({ dimension, value: clamped, timestamp: Date.now() });
        if (this.#history.length > this.#config.maxHistory) this.#history = this.#history.slice(-this.#config.maxHistory);
        this.emit('pressure:applied', { dimension, value: clamped });
    }

    /**
     * Compute field interactions — how pressures affect each other.
     */
    computeInteractions() {
        this.#stats.interactionsComputed++;
        const interactions = [];
        const dims = [...this.#fields.entries()];

        for (let i = 0; i < dims.length; i++) {
            for (let j = i + 1; j < dims.length; j++) {
                const [nameA, fieldA] = dims[i];
                const [nameB, fieldB] = dims[j];
                const combined = (fieldA.value + fieldB.value) / 2;
                if (combined > this.#config.cascadeThreshold) {
                    interactions.push({ fields: [nameA, nameB], combinedPressure: combined, type: 'cascade-risk' });
                    this.#stats.cascadesDetected++;
                }
            }
        }

        this.#interactions = interactions;
        if (interactions.length > 0) this.emit('cascade:detected', { interactions });
        return interactions;
    }

    /**
     * Get total field pressure.
     */
    getTotalPressure() {
        let sum = 0, count = 0;
        for (const [, f] of this.#fields) { sum += f.value; count++; }
        return count > 0 ? sum / count : 0;
    }

    getField(dimension) { return this.#fields.get(dimension)?.value ?? null; }
    getAllFields() { const r = {}; for (const [k, v] of this.#fields) r[k] = v.value; return r; }
    getInteractions() { return [...this.#interactions]; }
    getHistory(limit = 50) { return this.#history.slice(-limit); }
    getStats() { return { ...this.#stats, totalPressure: this.getTotalPressure() }; }
}
