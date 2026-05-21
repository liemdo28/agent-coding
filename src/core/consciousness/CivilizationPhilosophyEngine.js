/**
 * CivilizationPhilosophyEngine.js — Operational & Engineering Philosophy
 *
 * Persists:
 * - Execution philosophy
 * - Governance philosophy
 * - Optimization ethics
 * - Engineering philosophy
 *
 * The civilization's philosophical framework — guiding principles for all decisions.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationPhilosophyEngine extends EventEmitter {
    #config;
    #philosophies = new Map();
    #tenets = [];
    #ethicalBoundaries = [];
    #history = [];
    #stats = {
        philosophiesDefined: 0,
        tenetsEstablished: 0,
        ethicalChecks: 0,
        violations: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxHistory: config.maxHistory || 100,
            ...config,
        };

        this.#registerDefaultPhilosophies();
        this.#registerDefaultTenets();
        this.#registerDefaultEthics();
    }

    /**
     * Define or update a philosophy.
     */
    definePhilosophy(domain, philosophy) {
        const record = {
            domain,
            statement: philosophy.statement,
            principles: philosophy.principles || [],
            boundaries: philosophy.boundaries || [],
            definedAt: Date.now(),
        };

        this.#philosophies.set(domain, record);
        this.#stats.philosophiesDefined++;
        this.#recordHistory('philosophy-defined', { domain });
        this.emit('philosophy:defined', record);
        return record;
    }

    /**
     * Get philosophy for a domain.
     */
    getPhilosophy(domain) {
        return this.#philosophies.get(domain) || null;
    }

    /**
     * Get all philosophies.
     */
    getAllPhilosophies() {
        const result = {};
        for (const [domain, phil] of this.#philosophies) {
            result[domain] = phil;
        }
        return result;
    }

    /**
     * Establish a tenet — a fundamental belief.
     */
    establishTenet(tenet) {
        const record = {
            id: randomUUID(),
            statement: tenet.statement,
            domain: tenet.domain || 'general',
            priority: tenet.priority || 'core',
            establishedAt: Date.now(),
        };

        this.#tenets.push(record);
        this.#stats.tenetsEstablished++;
        this.emit('tenet:established', record);
        return record;
    }

    /**
     * Get all tenets.
     */
    getTenets(domain) {
        if (domain) return this.#tenets.filter(t => t.domain === domain);
        return [...this.#tenets];
    }

    /**
     * Check if an action is ethically sound.
     */
    checkEthics(action) {
        this.#stats.ethicalChecks++;
        const violations = [];

        for (const boundary of this.#ethicalBoundaries) {
            if (boundary.check(action)) {
                violations.push({ boundary: boundary.name, reason: boundary.reason });
            }
        }

        if (violations.length > 0) {
            this.#stats.violations++;
            this.emit('ethics:violation', { action: action.type, violations });
        }

        return { ethical: violations.length === 0, violations };
    }

    /**
     * Add an ethical boundary.
     */
    addEthicalBoundary(name, boundary) {
        this.#ethicalBoundaries.push({
            name,
            reason: boundary.reason,
            check: boundary.check,
            addedAt: Date.now(),
        });
    }

    /**
     * Get ethical boundaries.
     */
    getEthicalBoundaries() {
        return this.#ethicalBoundaries.map(b => ({ name: b.name, reason: b.reason }));
    }

    /**
     * Get philosophy history.
     */
    getHistory() {
        return [...this.#history];
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #registerDefaultPhilosophies() {
        this.definePhilosophy('execution', {
            statement: 'Execute with confidence through simulation, validation, and rollback readiness',
            principles: ['simulate-first', 'validate-always', 'rollback-ready'],
        });

        this.definePhilosophy('governance', {
            statement: 'Govern with minimal friction while maintaining maximum safety',
            principles: ['least-privilege', 'escalate-early', 'human-authority'],
        });

        this.definePhilosophy('optimization', {
            statement: 'Optimize incrementally, measure impact, never sacrifice stability for speed',
            principles: ['measure-first', 'incremental-change', 'stability-over-speed'],
        });

        this.definePhilosophy('engineering', {
            statement: 'Build systems that are simple, observable, and evolvable',
            principles: ['simplicity', 'observability', 'evolvability', 'testability'],
        });
    }

    #registerDefaultTenets() {
        this.establishTenet({ statement: 'Safety is non-negotiable', domain: 'core', priority: 'absolute' });
        this.establishTenet({ statement: 'Human authority supersedes AI autonomy', domain: 'governance', priority: 'absolute' });
        this.establishTenet({ statement: 'Every action must be explainable', domain: 'execution', priority: 'core' });
        this.establishTenet({ statement: 'Data integrity is sacred', domain: 'engineering', priority: 'absolute' });
        this.establishTenet({ statement: 'Evolution must not break stability', domain: 'optimization', priority: 'core' });
    }

    #registerDefaultEthics() {
        this.addEthicalBoundary('no-deception', {
            reason: 'System must never deceive operators or users',
            check: (action) => action.deceptive === true,
        });

        this.addEthicalBoundary('no-harm', {
            reason: 'System must not take actions that could harm users or data',
            check: (action) => action.harmful === true,
        });

        this.addEthicalBoundary('no-unauthorized-access', {
            reason: 'System must not access resources without authorization',
            check: (action) => action.unauthorized === true,
        });

        this.addEthicalBoundary('transparency-required', {
            reason: 'All significant actions must be logged and visible',
            check: (action) => action.hidden === true && action.significant === true,
        });
    }

    #recordHistory(type, data) {
        this.#history.push({ id: randomUUID(), type, data, timestamp: Date.now() });
        if (this.#history.length > this.#config.maxHistory) {
            this.#history = this.#history.slice(-this.#config.maxHistory);
        }
    }
}
