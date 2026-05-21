/**
 * OperationalCoherenceEngine.js — Prevent Civilization Fragmentation
 *
 * Validates:
 * - Governance ↔ Mission
 * - Execution ↔ Strategy
 * - Architecture ↔ Scaling
 * - Evolution ↔ Stability
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class OperationalCoherenceEngine extends EventEmitter {
    #config;
    #coherencePairs = new Map();
    #fragmentationAlerts = [];
    #stats = { checksPerformed: 0, fragmentationsDetected: 0, coherenceScore: 1.0 };

    constructor(config = {}) {
        super();
        this.#config = {
            pairs: config.pairs || [
                { a: 'governance', b: 'mission', weight: 0.25 },
                { a: 'execution', b: 'strategy', weight: 0.25 },
                { a: 'architecture', b: 'scaling', weight: 0.25 },
                { a: 'evolution', b: 'stability', weight: 0.25 },
            ],
            fragmentationThreshold: config.fragmentationThreshold || 0.35,
            ...config,
        };
        for (const pair of this.#config.pairs) {
            this.#coherencePairs.set(`${pair.a}↔${pair.b}`, { score: 0.7, weight: pair.weight, updatedAt: Date.now() });
        }
    }

    reportCoherence(domainA, domainB, score) {
        const key = `${domainA}↔${domainB}`;
        const clamped = Math.max(0, Math.min(1, score));
        this.#coherencePairs.set(key, { score: clamped, weight: this.#coherencePairs.get(key)?.weight || 0.2, updatedAt: Date.now() });
        this.emit('coherence:reported', { pair: key, score: clamped });
    }

    checkCoherence() {
        this.#stats.checksPerformed++;
        let weightedSum = 0, totalWeight = 0;
        const details = [];

        for (const [key, data] of this.#coherencePairs) {
            weightedSum += data.score * data.weight;
            totalWeight += data.weight;
            details.push({ pair: key, score: data.score });

            if (data.score < this.#config.fragmentationThreshold) {
                this.#stats.fragmentationsDetected++;
                const alert = { id: randomUUID(), pair: key, score: data.score, timestamp: Date.now() };
                this.#fragmentationAlerts.push(alert);
                this.emit('fragmentation:detected', alert);
            }
        }

        this.#stats.coherenceScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
        return { coherence: this.#stats.coherenceScore, details, fragmented: this.#stats.coherenceScore < this.#config.fragmentationThreshold };
    }

    getCoherenceScore() { return this.#stats.coherenceScore; }
    getAlerts(limit = 20) { return this.#fragmentationAlerts.slice(-limit); }
    getStats() { return { ...this.#stats }; }
}
