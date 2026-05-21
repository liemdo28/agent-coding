/**
 * RealityCoherenceEngine.js — Cross-Domain Coherence Validation
 *
 * Validates:
 * - Strategy ↔ Execution alignment
 * - Governance ↔ Optimization alignment
 * - Architecture ↔ Business alignment
 * - Evolution ↔ Mission alignment
 *
 * Ensures all parts of the civilization are working toward the same reality.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class RealityCoherenceEngine extends EventEmitter {
    #config;
    #alignments = new Map();
    #coherenceHistory = [];
    #drifts = [];
    #stats = {
        checksPerformed: 0,
        coherenceScore: 1.0,
        driftsDetected: 0,
        realignments: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            pairs: config.pairs || [
                { a: 'strategy', b: 'execution', weight: 0.25 },
                { a: 'governance', b: 'optimization', weight: 0.2 },
                { a: 'architecture', b: 'business', weight: 0.2 },
                { a: 'evolution', b: 'mission', weight: 0.2 },
                { a: 'planning', b: 'reality', weight: 0.15 },
            ],
            driftThreshold: config.driftThreshold || 0.3,
            maxHistory: config.maxHistory || 200,
            ...config,
        };

        this.#initializeAlignments();
    }

    /**
     * Report alignment between two domains.
     */
    reportAlignment(domainA, domainB, score, evidence = {}) {
        const key = `${domainA}↔${domainB}`;
        const clamped = Math.max(0, Math.min(1, score));

        this.#alignments.set(key, {
            domainA,
            domainB,
            score: clamped,
            evidence,
            reportedAt: Date.now(),
        });

        this.emit('alignment:reported', { pair: key, score: clamped });
    }

    /**
     * Check overall coherence.
     */
    checkCoherence() {
        this.#stats.checksPerformed++;
        let weightedSum = 0;
        let totalWeight = 0;
        const details = [];

        for (const pair of this.#config.pairs) {
            const key = `${pair.a}↔${pair.b}`;
            const alignment = this.#alignments.get(key);
            const score = alignment?.score ?? 0.5;

            weightedSum += score * pair.weight;
            totalWeight += pair.weight;
            details.push({ pair: key, score, weight: pair.weight });

            // Detect drift
            if (score < this.#config.driftThreshold) {
                this.#recordDrift(pair, score);
            }
        }

        const coherence = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
        this.#stats.coherenceScore = coherence;

        const record = { coherence, details, timestamp: Date.now() };
        this.#coherenceHistory.push(record);

        if (this.#coherenceHistory.length > this.#config.maxHistory) {
            this.#coherenceHistory = this.#coherenceHistory.slice(-this.#config.maxHistory);
        }

        this.emit('coherence:checked', record);
        return record;
    }

    /**
     * Get coherence score.
     */
    getCoherenceScore() {
        return this.#stats.coherenceScore;
    }

    /**
     * Get alignment for a specific pair.
     */
    getAlignment(domainA, domainB) {
        return this.#alignments.get(`${domainA}↔${domainB}`)?.score ?? null;
    }

    /**
     * Get all alignments.
     */
    getAllAlignments() {
        const result = {};
        for (const [key, data] of this.#alignments) {
            result[key] = data.score;
        }
        return result;
    }

    /**
     * Get detected drifts.
     */
    getDrifts(limit = 20) {
        return this.#drifts.slice(-limit);
    }

    /**
     * Record a realignment action.
     */
    recordRealignment(pair, action) {
        this.#stats.realignments++;
        this.emit('realignment:recorded', { pair, action });
    }

    /**
     * Get coherence history.
     */
    getHistory(limit = 50) {
        return this.#coherenceHistory.slice(-limit);
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #initializeAlignments() {
        for (const pair of this.#config.pairs) {
            const key = `${pair.a}↔${pair.b}`;
            this.#alignments.set(key, { domainA: pair.a, domainB: pair.b, score: 0.5, evidence: {}, reportedAt: Date.now() });
        }
    }

    #recordDrift(pair, score) {
        this.#stats.driftsDetected++;
        const drift = {
            id: randomUUID(),
            pair: `${pair.a}↔${pair.b}`,
            score,
            threshold: this.#config.driftThreshold,
            detectedAt: Date.now(),
        };
        this.#drifts.push(drift);

        if (this.#drifts.length > 100) {
            this.#drifts = this.#drifts.slice(-100);
        }

        this.emit('drift:detected', drift);
    }
}
