/**
 * CivilizationGovernance.js — Safety & Governance Engine
 *
 * Prevents:
 * - Runaway optimization
 * - Unsafe autonomy
 * - Recursive instability
 * - Destructive evolution
 *
 * Enforces:
 * - Sandbox boundaries
 * - Execution limits
 * - Rollback authority
 * - Escalation rules
 * - Human override
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationGovernance extends EventEmitter {
    #config;
    #rules = new Map();
    #violations = [];
    #escalations = [];
    #limits;
    #stats = {
        checksPerformed: 0,
        violationsDetected: 0,
        escalationsTriggered: 0,
        actionsBlocked: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxOptimizationsPerHour: config.maxOptimizationsPerHour || 20,
            maxWorkersSpawned: config.maxWorkersSpawned || 32,
            maxRollbacksPerHour: config.maxRollbacksPerHour || 10,
            maxMemoryUsage: config.maxMemoryUsage || 0.9,
            requireHumanApproval: config.requireHumanApproval || ['production-deploy', 'data-migration', 'infra-change'],
            ...config,
        };

        this.#limits = {
            optimizationsThisHour: 0,
            rollbacksThisHour: 0,
            workersSpawned: 0,
            lastReset: Date.now(),
        };

        this.#registerDefaultRules();
    }

    /**
     * Check if an action is allowed by governance rules.
     * @param {object} action - { type, target, parameters, source }
     * @returns {object} { allowed, reason, escalation? }
     */
    check(action) {
        this.#stats.checksPerformed++;
        this.#resetLimitsIfNeeded();

        // Check all rules
        for (const [, rule] of this.#rules) {
            const result = rule.check(action);
            if (!result.allowed) {
                this.#stats.actionsBlocked++;
                this.#recordViolation(action, rule.name, result.reason);

                if (result.escalate) {
                    this.#escalate(action, rule.name, result.reason);
                }

                return {
                    allowed: false,
                    reason: result.reason,
                    rule: rule.name,
                    escalation: result.escalate || false,
                };
            }
        }

        // Update limits
        this.#updateLimits(action);

        return { allowed: true };
    }

    /**
     * Register a governance rule.
     * @param {string} name
     * @param {object} rule - { check: (action) => { allowed, reason, escalate? } }
     */
    registerRule(name, rule) {
        this.#rules.set(name, { name, check: rule.check, priority: rule.priority || 5 });
    }

    /**
     * Request human approval for a sensitive action.
     * @param {object} action
     * @returns {object} Escalation record
     */
    requestApproval(action) {
        const escalation = {
            id: randomUUID(),
            action,
            requestedAt: Date.now(),
            status: 'pending',
            reason: 'Requires human approval',
        };

        this.#escalations.push(escalation);
        this.#stats.escalationsTriggered++;
        this.emit('approval:requested', escalation);

        return escalation;
    }

    /**
     * Approve a pending escalation.
     */
    approve(escalationId) {
        const esc = this.#escalations.find(e => e.id === escalationId);
        if (esc) {
            esc.status = 'approved';
            esc.resolvedAt = Date.now();
            this.emit('approval:granted', esc);
        }
        return esc;
    }

    /**
     * Deny a pending escalation.
     */
    deny(escalationId, reason) {
        const esc = this.#escalations.find(e => e.id === escalationId);
        if (esc) {
            esc.status = 'denied';
            esc.resolvedAt = Date.now();
            esc.denyReason = reason;
            this.emit('approval:denied', esc);
        }
        return esc;
    }

    /**
     * Get pending escalations.
     */
    getPendingEscalations() {
        return this.#escalations.filter(e => e.status === 'pending');
    }

    /**
     * Get violation history.
     */
    getViolations(limit = 20) {
        return this.#violations.slice(-limit);
    }

    /**
     * Emergency stop — block all autonomous actions.
     */
    emergencyStop() {
        this.registerRule('emergency-stop', {
            check: () => ({ allowed: false, reason: 'Emergency stop active' }),
            priority: 0,
        });
        this.emit('emergency:stop');
    }

    /**
     * Resume after emergency stop.
     */
    resume() {
        this.#rules.delete('emergency-stop');
        this.emit('emergency:resumed');
    }

    // --- Internal ---

    #registerDefaultRules() {
        // Rate limit optimizations
        this.registerRule('optimization-rate-limit', {
            check: (action) => {
                if (action.type !== 'optimization') return { allowed: true };
                if (this.#limits.optimizationsThisHour >= this.#config.maxOptimizationsPerHour) {
                    return { allowed: false, reason: 'Optimization rate limit exceeded', escalate: true };
                }
                return { allowed: true };
            },
            priority: 1,
        });

        // Worker spawn limit
        this.registerRule('worker-spawn-limit', {
            check: (action) => {
                if (action.type !== 'worker-spawn') return { allowed: true };
                if (this.#limits.workersSpawned >= this.#config.maxWorkersSpawned) {
                    return { allowed: false, reason: 'Maximum worker limit reached' };
                }
                return { allowed: true };
            },
            priority: 2,
        });

        // Rollback storm prevention
        this.registerRule('rollback-storm-prevention', {
            check: (action) => {
                if (action.type !== 'rollback') return { allowed: true };
                if (this.#limits.rollbacksThisHour >= this.#config.maxRollbacksPerHour) {
                    return { allowed: false, reason: 'Rollback storm detected — pausing', escalate: true };
                }
                return { allowed: true };
            },
            priority: 1,
        });

        // Human approval required
        this.registerRule('human-approval-required', {
            check: (action) => {
                if (this.#config.requireHumanApproval.includes(action.type)) {
                    return { allowed: false, reason: 'Requires human approval', escalate: true };
                }
                return { allowed: true };
            },
            priority: 0,
        });

        // Memory safety
        this.registerRule('memory-safety', {
            check: (action) => {
                if (action.type === 'worker-spawn') {
                    const mem = process.memoryUsage();
                    const ratio = mem.heapUsed / mem.heapTotal;
                    if (ratio > this.#config.maxMemoryUsage) {
                        return { allowed: false, reason: 'Memory too high to spawn workers' };
                    }
                }
                return { allowed: true };
            },
            priority: 1,
        });
    }

    #recordViolation(action, ruleName, reason) {
        this.#violations.push({
            id: randomUUID(),
            action: action.type,
            rule: ruleName,
            reason,
            timestamp: Date.now(),
        });
        this.#stats.violationsDetected++;

        if (this.#violations.length > 500) {
            this.#violations = this.#violations.slice(-500);
        }
    }

    #escalate(action, ruleName, reason) {
        const escalation = {
            id: randomUUID(),
            action,
            rule: ruleName,
            reason,
            requestedAt: Date.now(),
            status: 'pending',
        };
        this.#escalations.push(escalation);
        this.#stats.escalationsTriggered++;
        this.emit('escalation', escalation);
    }

    #updateLimits(action) {
        if (action.type === 'optimization') this.#limits.optimizationsThisHour++;
        if (action.type === 'rollback') this.#limits.rollbacksThisHour++;
        if (action.type === 'worker-spawn') this.#limits.workersSpawned++;
    }

    #resetLimitsIfNeeded() {
        const hourMs = 3600000;
        if (Date.now() - this.#limits.lastReset > hourMs) {
            this.#limits.optimizationsThisHour = 0;
            this.#limits.rollbacksThisHour = 0;
            this.#limits.lastReset = Date.now();
        }
    }

    getStats() {
        return { ...this.#stats, pendingEscalations: this.getPendingEscalations().length, rules: this.#rules.size };
    }
}
