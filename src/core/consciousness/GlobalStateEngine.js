/**
 * GlobalStateEngine.js — Civilization-Wide State Awareness
 *
 * Tracks:
 * - Execution health
 * - Architecture entropy
 * - Governance pressure
 * - Strategic drift
 * - Chaos probability
 *
 * Provides a unified view of the entire civilization's state.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class GlobalStateEngine extends EventEmitter {
    #config;
    #state = new Map();
    #history = [];
    #snapshots = [];
    #stats = {
        stateUpdates: 0,
        snapshotsTaken: 0,
        anomaliesDetected: 0,
        stateQueries: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            dimensions: config.dimensions || [
                'execution-health',
                'architecture-entropy',
                'governance-pressure',
                'strategic-drift',
                'chaos-probability',
                'cognitive-load',
                'evolution-velocity',
                'stability-index',
            ],
            historySize: config.historySize || 1000,
            snapshotInterval: config.snapshotInterval || 60000,
            anomalyThreshold: config.anomalyThreshold || 0.3,
            ...config,
        };

        this.#initializeState();
    }

    /**
     * Update a state dimension.
     */
    update(dimension, value, context = {}) {
        const clamped = Math.max(0, Math.min(1, value));
        const previous = this.#state.get(dimension)?.value ?? 0.5;

        this.#state.set(dimension, {
            value: clamped,
            previous,
            delta: clamped - previous,
            updatedAt: Date.now(),
            context,
        });

        this.#stats.stateUpdates++;
        this.#history.push({ dimension, value: clamped, timestamp: Date.now() });

        if (this.#history.length > this.#config.historySize) {
            this.#history = this.#history.slice(-this.#config.historySize);
        }

        // Detect anomalies
        if (Math.abs(clamped - previous) > this.#config.anomalyThreshold) {
            this.#stats.anomaliesDetected++;
            this.emit('state:anomaly', { dimension, previous, current: clamped, delta: clamped - previous });
        }

        this.emit('state:updated', { dimension, value: clamped });
    }

    /**
     * Get current value of a dimension.
     */
    get(dimension) {
        this.#stats.stateQueries++;
        return this.#state.get(dimension)?.value ?? null;
    }

    /**
     * Get full state snapshot.
     */
    getFullState() {
        this.#stats.stateQueries++;
        const result = {};
        for (const [dim, data] of this.#state) {
            result[dim] = { value: data.value, delta: data.delta, updatedAt: data.updatedAt };
        }
        return result;
    }

    /**
     * Compute overall civilization health.
     */
    computeOverallHealth() {
        let sum = 0;
        let count = 0;
        for (const [, data] of this.#state) {
            sum += data.value;
            count++;
        }
        return count > 0 ? sum / count : 0.5;
    }

    /**
     * Compute chaos probability — likelihood of system instability.
     */
    computeChaosProbability() {
        const entropy = this.get('architecture-entropy') ?? 0;
        const pressure = this.get('governance-pressure') ?? 0;
        const drift = this.get('strategic-drift') ?? 0;
        const chaos = this.get('chaos-probability') ?? 0;

        return Math.min(1, (entropy + pressure + drift + chaos) / 4);
    }

    /**
     * Take a state snapshot.
     */
    takeSnapshot() {
        const snapshot = {
            id: randomUUID(),
            state: this.getFullState(),
            overallHealth: this.computeOverallHealth(),
            chaosProbability: this.computeChaosProbability(),
            timestamp: Date.now(),
        };

        this.#snapshots.push(snapshot);
        this.#stats.snapshotsTaken++;

        if (this.#snapshots.length > 100) {
            this.#snapshots = this.#snapshots.slice(-100);
        }

        this.emit('snapshot:taken', snapshot);
        return snapshot;
    }

    /**
     * Get state history for a dimension.
     */
    getHistory(dimension, limit = 50) {
        return this.#history
            .filter(h => !dimension || h.dimension === dimension)
            .slice(-limit);
    }

    /**
     * Get state trend for a dimension.
     */
    getTrend(dimension) {
        const history = this.getHistory(dimension, 20);
        if (history.length < 5) return 'unknown';

        const first = history.slice(0, 5).reduce((s, h) => s + h.value, 0) / 5;
        const last = history.slice(-5).reduce((s, h) => s + h.value, 0) / 5;
        const diff = last - first;

        if (diff > 0.05) return 'improving';
        if (diff < -0.05) return 'degrading';
        return 'stable';
    }

    getStats() {
        return { ...this.#stats, dimensions: this.#state.size, overallHealth: this.computeOverallHealth() };
    }

    // --- Internal ---

    #initializeState() {
        for (const dim of this.#config.dimensions) {
            this.#state.set(dim, { value: 0.5, previous: 0.5, delta: 0, updatedAt: Date.now(), context: {} });
        }
    }
}
