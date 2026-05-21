/**
 * AutonomousPolicyEngine.js — Dynamic Policy Generation
 *
 * AI dynamically creates and adjusts:
 * - Execution policies
 * - QA strictness policies
 * - Concurrency limits
 * - Rollback policies
 *
 * Reacts to system conditions and adapts governance in realtime.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class AutonomousPolicyEngine extends EventEmitter {
    #config;
    #activePolicies = new Map();
    #policyHistory = [];
    #triggers = new Map();
    #conditions = new Map();
    #stats = {
        policiesGenerated: 0,
        policiesRevoked: 0,
        triggersActivated: 0,
        adaptations: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxActivePolicies: config.maxActivePolicies || 50,
            policyTTL: config.policyTTL || 3600000,
            adaptationCooldown: config.adaptationCooldown || 30000,
            ...config,
        };

        this.#registerDefaultTriggers();
    }

    /**
     * Generate a new policy based on observed conditions.
     */
    generatePolicy(trigger, context = {}) {
        const policy = {
            id: randomUUID(),
            trigger,
            context,
            rules: this.#deriveRules(trigger, context),
            createdAt: Date.now(),
            expiresAt: Date.now() + this.#config.policyTTL,
            status: 'active',
        };

        this.#activePolicies.set(policy.id, policy);
        this.#policyHistory.push(policy);
        this.#stats.policiesGenerated++;

        if (this.#policyHistory.length > 500) {
            this.#policyHistory = this.#policyHistory.slice(-500);
        }

        this.emit('policy:generated', policy);
        return policy;
    }

    /**
     * Revoke an active policy.
     */
    revokePolicy(policyId) {
        const policy = this.#activePolicies.get(policyId);
        if (policy) {
            policy.status = 'revoked';
            policy.revokedAt = Date.now();
            this.#activePolicies.delete(policyId);
            this.#stats.policiesRevoked++;
            this.emit('policy:revoked', policy);
            return true;
        }
        return false;
    }

    /**
     * React to a system condition — may generate or adjust policies.
     */
    react(condition, metrics = {}) {
        this.#conditions.set(condition, { metrics, observedAt: Date.now() });

        const trigger = this.#triggers.get(condition);
        if (trigger) {
            this.#stats.triggersActivated++;
            const actions = trigger.handler(metrics);

            for (const action of actions) {
                if (action.type === 'generate-policy') {
                    this.generatePolicy(condition, { ...metrics, ...action.context });
                } else if (action.type === 'tighten') {
                    this.#tightenPolicy(action.target, action.factor);
                } else if (action.type === 'relax') {
                    this.#relaxPolicy(action.target, action.factor);
                }
            }

            this.#stats.adaptations++;
            this.emit('adaptation', { condition, actions });
        }
    }

    /**
     * Register a trigger that generates policies on conditions.
     */
    registerTrigger(condition, handler) {
        this.#triggers.set(condition, { condition, handler, registeredAt: Date.now() });
    }

    /**
     * Evaluate an action against all active policies.
     */
    evaluate(action) {
        this.#cleanExpiredPolicies();

        for (const [, policy] of this.#activePolicies) {
            if (policy.status !== 'active') continue;
            for (const rule of policy.rules) {
                if (rule.applies(action) && !rule.allows(action)) {
                    return { allowed: false, reason: rule.reason, policy: policy.id };
                }
            }
        }
        return { allowed: true };
    }

    /**
     * Get all active policies.
     */
    getActivePolicies() {
        this.#cleanExpiredPolicies();
        return [...this.#activePolicies.values()];
    }

    /**
     * Get current conditions.
     */
    getConditions() {
        return Object.fromEntries(this.#conditions);
    }

    getStats() {
        return { ...this.#stats, activePolicies: this.#activePolicies.size };
    }

    // --- Internal ---

    #registerDefaultTriggers() {
        this.registerTrigger('rollback-storm', (metrics) => {
            const actions = [];
            if (metrics.rollbackRate > 0.5) {
                actions.push({
                    type: 'generate-policy',
                    context: { concurrencyLimit: Math.max(1, Math.floor(metrics.currentConcurrency * 0.5)) },
                });
                actions.push({ type: 'tighten', target: 'qa-strictness', factor: 1.5 });
            }
            return actions;
        });

        this.registerTrigger('queue-saturation', (metrics) => {
            const actions = [];
            if (metrics.queueDepth > metrics.maxDepth * 0.8) {
                actions.push({
                    type: 'generate-policy',
                    context: { throttle: true, maxNewTasks: 5 },
                });
            }
            return actions;
        });

        this.registerTrigger('worker-overload', (metrics) => {
            const actions = [];
            if (metrics.cpuUsage > 0.9) {
                actions.push({ type: 'tighten', target: 'concurrency', factor: 0.5 });
            }
            return actions;
        });

        this.registerTrigger('stability-degradation', (metrics) => {
            const actions = [];
            if (metrics.stabilityScore < 0.4) {
                actions.push({
                    type: 'generate-policy',
                    context: { mode: 'conservative', maxAutonomy: 3 },
                });
            }
            return actions;
        });
    }

    #deriveRules(trigger, context) {
        const rules = [];

        if (context.concurrencyLimit) {
            rules.push({
                applies: (action) => action.type === 'task-execute',
                allows: (action) => (action.concurrentCount || 0) < context.concurrencyLimit,
                reason: `Concurrency limited to ${context.concurrencyLimit} due to ${trigger}`,
            });
        }

        if (context.throttle) {
            rules.push({
                applies: (action) => action.type === 'task-submit',
                allows: () => false,
                reason: `Task submission throttled due to ${trigger}`,
            });
        }

        if (context.maxAutonomy) {
            rules.push({
                applies: (action) => action.autonomyLevel !== undefined,
                allows: (action) => action.autonomyLevel <= context.maxAutonomy,
                reason: `Autonomy capped at ${context.maxAutonomy} due to ${trigger}`,
            });
        }

        return rules;
    }

    #tightenPolicy(target, factor) {
        this.emit('policy:tightened', { target, factor });
    }

    #relaxPolicy(target, factor) {
        this.emit('policy:relaxed', { target, factor });
    }

    #cleanExpiredPolicies() {
        const now = Date.now();
        for (const [id, policy] of this.#activePolicies) {
            if (policy.expiresAt && policy.expiresAt < now) {
                policy.status = 'expired';
                this.#activePolicies.delete(id);
            }
        }
    }
}
