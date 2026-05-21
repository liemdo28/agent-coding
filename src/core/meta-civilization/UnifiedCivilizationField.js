/**
 * UnifiedCivilizationField.js — One Operational Field
 *
 * Unifies cognition, execution, governance, economy, evolution,
 * and trajectory into one operational field.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class UnifiedCivilizationField extends EventEmitter {
    #config;
    #field = new Map();
    #fieldState = { coherence: 1.0, energy: 0.5, entropy: 0, timestamp: Date.now() };
    #history = [];
    #stats = { fieldUpdates: 0, computations: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            components: config.components || ['cognition', 'execution', 'governance', 'economy', 'evolution', 'trajectory'],
            maxHistory: config.maxHistory || 200,
            ...config,
        };
        for (const c of this.#config.components) this.#field.set(c, { strength: 0.5, vector: 'neutral', contribution: 0 });
    }

    updateComponent(component, state) {
        this.#field.set(component, { ...state, updatedAt: Date.now() });
        this.#stats.fieldUpdates++;
    }

    computeField() {
        this.#stats.computations++;
        let totalStrength = 0, entropy = 0, count = 0;
        const vectors = new Set();

        for (const [, state] of this.#field) {
            totalStrength += state.strength ?? 0.5;
            if (state.vector) vectors.add(state.vector);
            count++;
        }

        entropy = vectors.size / count; // More diverse vectors = more entropy
        const coherence = 1 - entropy;
        const energy = count > 0 ? totalStrength / count : 0;

        this.#fieldState = { coherence, energy, entropy, timestamp: Date.now() };
        this.#history.push(this.#fieldState);
        if (this.#history.length > this.#config.maxHistory) this.#history = this.#history.slice(-this.#config.maxHistory);

        this.emit('field:computed', this.#fieldState);
        return this.#fieldState;
    }

    getFieldState() { return { ...this.#fieldState }; }
    getComponent(component) { return this.#field.get(component) || null; }
    getAllComponents() { const r = {}; for (const [k, v] of this.#field) r[k] = v; return r; }
    getHistory(limit = 50) { return this.#history.slice(-limit); }
    getStats() { return { ...this.#stats, ...this.#fieldState }; }
}
