/**
 * MissionAlignmentEngine.js — Continuous Mission Validation
 *
 * Continuously validates:
 * "Are we still becoming what we intended to become?"
 *
 * Checks execution, governance, architecture, and strategic alignment.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class MissionAlignmentEngine extends EventEmitter {
    #config;
    #mission;
    #alignmentScores = new Map();
    #history = [];
    #stats = { checksPerformed: 0, driftsDetected: 0, realignments: 0, overallAlignment: 1.0 };

    constructor(config = {}) {
        super();
        this.#config = {
            domains: config.domains || ['execution', 'governance', 'architecture', 'strategic', 'evolution'],
            driftThreshold: config.driftThreshold || 0.4,
            maxHistory: config.maxHistory || 200,
            ...config,
        };
        this.#mission = config.mission || 'Build autonomous engineering civilization';
        for (const domain of this.#config.domains) this.#alignmentScores.set(domain, 0.7);
    }

    /**
     * Report alignment for a domain.
     */
    reportAlignment(domain, score, evidence = '') {
        const clamped = Math.max(0, Math.min(1, score));
        this.#alignmentScores.set(domain, clamped);
        this.#history.push({ domain, score: clamped, evidence, timestamp: Date.now() });
        if (this.#history.length > this.#config.maxHistory) this.#history = this.#history.slice(-this.#config.maxHistory);

        if (clamped < this.#config.driftThreshold) {
            this.#stats.driftsDetected++;
            this.emit('drift:detected', { domain, score: clamped, mission: this.#mission });
        }
    }

    /**
     * Check overall mission alignment.
     */
    checkAlignment() {
        this.#stats.checksPerformed++;
        let sum = 0, count = 0;
        const details = {};

        for (const [domain, score] of this.#alignmentScores) {
            details[domain] = score;
            sum += score;
            count++;
        }

        this.#stats.overallAlignment = count > 0 ? sum / count : 0.5;
        const aligned = this.#stats.overallAlignment >= this.#config.driftThreshold;

        this.emit('alignment:checked', { overall: this.#stats.overallAlignment, details, aligned });
        return { overall: this.#stats.overallAlignment, details, aligned, mission: this.#mission };
    }

    /**
     * Record a realignment action.
     */
    recordRealignment(domain, action) {
        this.#stats.realignments++;
        this.emit('realignment:recorded', { domain, action });
    }

    getMission() { return this.#mission; }
    setMission(mission) { this.#mission = mission; }
    getAlignment(domain) { return this.#alignmentScores.get(domain) ?? null; }
    getHistory(limit = 50) { return this.#history.slice(-limit); }
    getStats() { return { ...this.#stats }; }
}
