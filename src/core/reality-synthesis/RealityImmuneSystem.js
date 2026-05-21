/**
 * RealityImmuneSystem.js — Civilization-Scale Threat Detection
 *
 * Detects:
 * - Coherence collapse
 * - Execution chaos
 * - Governance divergence
 * - Mission drift
 * - Strategic fragmentation
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class RealityImmuneSystem extends EventEmitter {
    #config;
    #threats = [];
    #defenses = new Map();
    #healthIndicators = new Map();
    #stats = { threatsDetected: 0, defensesActivated: 0, recoveries: 0, immuneHealth: 1.0 };

    constructor(config = {}) {
        super();
        this.#config = {
            threatTypes: config.threatTypes || [
                'coherence-collapse', 'execution-chaos', 'governance-divergence',
                'mission-drift', 'strategic-fragmentation', 'reality-desync',
            ],
            threatThreshold: config.threatThreshold || 0.6,
            maxThreats: config.maxThreats || 100,
            ...config,
        };
        this.#registerDefaultDefenses();
    }

    /**
     * Report a health indicator.
     */
    reportHealth(indicator, value) {
        const clamped = Math.max(0, Math.min(1, value));
        this.#healthIndicators.set(indicator, { value: clamped, reportedAt: Date.now() });
        if (clamped < (1 - this.#config.threatThreshold)) {
            this.detectThreat(indicator, 1 - clamped);
        }
    }

    /**
     * Detect a threat.
     */
    detectThreat(type, severity, context = {}) {
        const threat = {
            id: randomUUID(), type, severity: Math.max(0, Math.min(1, severity)),
            context, detectedAt: Date.now(), status: 'active', response: null,
        };
        this.#threats.push(threat);
        this.#stats.threatsDetected++;
        if (this.#threats.length > this.#config.maxThreats) this.#threats = this.#threats.slice(-this.#config.maxThreats);

        // Auto-defend
        const defense = this.#defenses.get(type);
        if (defense) {
            threat.response = defense.respond(threat);
            this.#stats.defensesActivated++;
            this.emit('defense:activated', { threat: threat.id, response: threat.response });
        }

        this.emit('threat:detected', threat);
        return threat;
    }

    /**
     * Register a defense mechanism.
     */
    registerDefense(threatType, defense) {
        this.#defenses.set(threatType, { respond: defense.respond, registeredAt: Date.now() });
    }

    /**
     * Trigger recovery.
     */
    triggerRecovery(reason) {
        this.#stats.recoveries++;
        for (const threat of this.#threats) {
            if (threat.status === 'active') { threat.status = 'resolved'; threat.resolvedAt = Date.now(); }
        }
        this.emit('recovery:triggered', { reason });
        return { resolved: this.#threats.filter(t => t.status === 'resolved').length };
    }

    /**
     * Get immune health.
     */
    getImmuneHealth() {
        if (this.#healthIndicators.size === 0) return 1.0;
        let sum = 0;
        for (const [, ind] of this.#healthIndicators) sum += ind.value;
        this.#stats.immuneHealth = sum / this.#healthIndicators.size;
        return this.#stats.immuneHealth;
    }

    getActiveThreats() { return this.#threats.filter(t => t.status === 'active'); }
    getStats() { return { ...this.#stats, immuneHealth: this.getImmuneHealth() }; }

    #registerDefaultDefenses() {
        this.registerDefense('coherence-collapse', { respond: () => ({ action: 'freeze-mutations', severity: 'high' }) });
        this.registerDefense('execution-chaos', { respond: () => ({ action: 'drain-and-stabilize', severity: 'high' }) });
        this.registerDefense('governance-divergence', { respond: () => ({ action: 'enforce-baseline-policies', severity: 'medium' }) });
        this.registerDefense('mission-drift', { respond: () => ({ action: 'realign-to-mission', severity: 'medium' }) });
        this.registerDefense('strategic-fragmentation', { respond: () => ({ action: 'consolidate-strategy', severity: 'high' }) });
        this.registerDefense('reality-desync', { respond: () => ({ action: 'force-reality-sync', severity: 'critical' }) });
    }
}
