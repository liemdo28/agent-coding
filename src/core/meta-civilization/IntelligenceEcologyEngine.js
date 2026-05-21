/**
 * IntelligenceEcologyEngine.js — Ecosystem Health Detection
 *
 * Detects:
 * - Overloaded systems
 * - Dead knowledge zones
 * - Stagnant architectures
 * - Optimization deserts
 * - Strategic monocultures
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class IntelligenceEcologyEngine extends EventEmitter {
    #config;
    #zones = new Map();
    #issues = [];
    #stats = { scansPerformed: 0, issuesDetected: 0, healthyZones: 0, unhealthyZones: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            zones: config.zones || ['cognition', 'execution', 'governance', 'architecture', 'optimization', 'strategy', 'knowledge'],
            stagnationThreshold: config.stagnationThreshold || 0.2,
            overloadThreshold: config.overloadThreshold || 0.85,
            maxIssues: config.maxIssues || 100,
            ...config,
        };
        for (const z of this.#config.zones) this.#zones.set(z, { activity: 0.5, diversity: 0.5, health: 0.5, lastUpdate: Date.now() });
    }

    reportZone(zone, metrics) {
        this.#zones.set(zone, { ...metrics, lastUpdate: Date.now() });
    }

    scan() {
        this.#stats.scansPerformed++;
        const issues = [];
        let healthy = 0, unhealthy = 0;

        for (const [zone, metrics] of this.#zones) {
            if ((metrics.activity ?? 0.5) < this.#config.stagnationThreshold) {
                issues.push({ zone, type: 'stagnant', activity: metrics.activity });
            }
            if ((metrics.activity ?? 0.5) > this.#config.overloadThreshold) {
                issues.push({ zone, type: 'overloaded', activity: metrics.activity });
            }
            if ((metrics.diversity ?? 0.5) < this.#config.stagnationThreshold) {
                issues.push({ zone, type: 'monoculture', diversity: metrics.diversity });
            }
            if ((metrics.health ?? 0.5) < 0.3) { unhealthy++; } else { healthy++; }
        }

        this.#stats.issuesDetected += issues.length;
        this.#stats.healthyZones = healthy;
        this.#stats.unhealthyZones = unhealthy;
        for (const issue of issues) { this.#issues.push({ id: randomUUID(), ...issue, detectedAt: Date.now() }); }
        if (this.#issues.length > this.#config.maxIssues) this.#issues = this.#issues.slice(-this.#config.maxIssues);

        if (issues.length > 0) this.emit('ecology:issues', { issues });
        return { issues, healthy, unhealthy };
    }

    getZone(zone) { return this.#zones.get(zone) || null; }
    getAllZones() { const r = {}; for (const [k, v] of this.#zones) r[k] = v; return r; }
    getIssues(limit = 20) { return this.#issues.slice(-limit); }
    getStats() { return { ...this.#stats }; }
}
