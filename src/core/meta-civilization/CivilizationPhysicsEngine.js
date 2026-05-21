/**
 * CivilizationPhysicsEngine.js — Operational Physics Modeling
 *
 * Models:
 * - Execution gravity
 * - Chaos diffusion
 * - Optimization momentum
 * - Architecture entropy
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationPhysicsEngine extends EventEmitter {
    #config;
    #forces = new Map();
    #history = [];
    #stats = { computations: 0, forceUpdates: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            forces: config.forces || ['execution-gravity', 'chaos-diffusion', 'optimization-momentum', 'architecture-entropy', 'innovation-inertia', 'governance-friction'],
            maxHistory: config.maxHistory || 300,
            ...config,
        };
        for (const f of this.#config.forces) this.#forces.set(f, { magnitude: 0, direction: 'neutral', updatedAt: Date.now() });
    }

    applyForce(name, magnitude, direction = 'neutral') {
        const clamped = Math.max(-1, Math.min(1, magnitude));
        this.#forces.set(name, { magnitude: clamped, direction, updatedAt: Date.now() });
        this.#stats.forceUpdates++;
        this.#history.push({ force: name, magnitude: clamped, direction, timestamp: Date.now() });
        if (this.#history.length > this.#config.maxHistory) this.#history = this.#history.slice(-this.#config.maxHistory);
        this.emit('force:applied', { name, magnitude: clamped, direction });
    }

    computeNetForce() {
        this.#stats.computations++;
        let net = 0;
        for (const [, f] of this.#forces) net += f.magnitude;
        return net / this.#forces.size;
    }

    getForce(name) { return this.#forces.get(name) || null; }
    getAllForces() { const r = {}; for (const [k, v] of this.#forces) r[k] = v; return r; }
    getHistory(limit = 50) { return this.#history.slice(-limit); }
    getStats() { return { ...this.#stats, netForce: this.computeNetForce() }; }
}
