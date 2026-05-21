/**
 * MetaGovernanceEngine.js — Govern Governance Itself
 *
 * - Audit policies
 * - Evolve policies
 * - Detect contradictions
 * - Detect instability
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class MetaGovernanceEngine extends EventEmitter {
    #config;
    #policies = new Map();
    #audits = [];
    #contradictions = [];
    #stats = { auditsPerformed: 0, contradictionsFound: 0, policiesEvolved: 0, instabilitiesDetected: 0 };

    constructor(config = {}) {
        super();
        this.#config = { maxAudits: config.maxAudits || 100, ...config };
    }

    registerPolicy(name, policy) { this.#policies.set(name, { ...policy, registeredAt: Date.now() }); }

    auditPolicies() {
        this.#stats.auditsPerformed++;
        const contradictions = [];
        const policies = [...this.#policies.entries()];

        for (let i = 0; i < policies.length; i++) {
            for (let j = i + 1; j < policies.length; j++) {
                const [nameA, polA] = policies[i];
                const [nameB, polB] = policies[j];
                if (polA.direction && polB.direction && polA.target === polB.target && polA.direction !== polB.direction) {
                    contradictions.push({ policies: [nameA, nameB], target: polA.target });
                    this.#stats.contradictionsFound++;
                }
            }
        }

        this.#contradictions.push(...contradictions);
        const audit = { id: randomUUID(), policiesAudited: policies.length, contradictions: contradictions.length, timestamp: Date.now() };
        this.#audits.push(audit);
        if (this.#audits.length > this.#config.maxAudits) this.#audits = this.#audits.slice(-this.#config.maxAudits);

        if (contradictions.length > 0) this.emit('contradiction:detected', { contradictions });
        this.emit('audit:completed', audit);
        return audit;
    }

    evolvePolicy(name, updates) {
        const policy = this.#policies.get(name);
        if (policy) { Object.assign(policy, updates, { evolvedAt: Date.now() }); this.#stats.policiesEvolved++; this.emit('policy:evolved', { name }); return true; }
        return false;
    }

    getPolicies() { return [...this.#policies.keys()]; }
    getContradictions(limit = 20) { return this.#contradictions.slice(-limit); }
    getAudits(limit = 20) { return this.#audits.slice(-limit); }
    getStats() { return { ...this.#stats, totalPolicies: this.#policies.size }; }
}
