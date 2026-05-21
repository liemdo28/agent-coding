/**
 * GovernanceEngine.js — Civilization Governance Core
 *
 * Manages:
 * - Autonomy limits
 * - Sandbox rules
 * - Rollback authority
 * - Escalation chains
 * - Execution policies
 *
 * The central authority that ensures the civilization operates
 * within safe, strategic boundaries.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class GovernanceEngine extends EventEmitter {
    #config;
    #policies = new Map();
    #escalationChains = new Map();
    #auditLog = [];
    #activeSandboxes = new Map();
    #overrideStack = [];
    #stats = {
        policiesEnforced: 0,
        escalationsTriggered: 0,
        sandboxViolations: 0,
        rollbacksAuthorized: 0,
        actionsGoverned: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxWorkerScale: config.maxWorkerScale || 512,
            rollbackThreshold: config.rollbackThreshold || 0.35,
            humanOverrideRequired: config.humanOverrideRequired || [
                'schema_migration',
                'production_delete',
                'infra_teardown',
                'security_policy_change',
            ],
            maxAutonomyLevel: config.maxAutonomyLevel || 7,
            policyRefreshInterval: config.policyRefreshInterval || 60000,
            maxEscalationDepth: config.maxEscalationDepth || 5,
            ...config,
        };

        this.#registerDefaultPolicies();
        this.#registerDefaultEscalationChains();
    }

    /**
     * Govern an action — check policies, enforce limits, escalate if needed.
     * @param {object} action - { type, source, target, parameters, priority }
     * @returns {object} { allowed, reason, policy?, escalation? }
     */
    govern(action) {
        this.#stats.actionsGoverned++;

        // Check override stack first
        if (this.#overrideStack.length > 0) {
            const override = this.#overrideStack[this.#overrideStack.length - 1];
            if (override.type === 'freeze') {
                return { allowed: false, reason: 'Execution freeze active', override: override.id };
            }
            if (override.type === 'simulation-only') {
                action._simulationOnly = true;
            }
        }

        // Evaluate all policies
        for (const [name, policy] of this.#policies) {
            const result = policy.evaluate(action);
            if (!result.allowed) {
                this.#stats.policiesEnforced++;
                this.#audit('policy_block', { action: action.type, policy: name, reason: result.reason });

                if (result.escalate) {
                    this.#triggerEscalation(action, name, result.reason);
                }

                return { allowed: false, reason: result.reason, policy: name, escalation: result.escalate || false };
            }
        }

        // Check sandbox boundaries
        if (action.sandboxId) {
            const sandbox = this.#activeSandboxes.get(action.sandboxId);
            if (sandbox && !this.#validateSandbox(action, sandbox)) {
                this.#stats.sandboxViolations++;
                return { allowed: false, reason: 'Sandbox boundary violation' };
            }
        }

        this.#audit('action_allowed', { action: action.type, source: action.source });
        return { allowed: true };
    }

    /**
     * Register a governance policy.
     */
    registerPolicy(name, policy) {
        this.#policies.set(name, {
            name,
            evaluate: policy.evaluate,
            priority: policy.priority || 5,
            mutable: policy.mutable !== false,
            createdAt: Date.now(),
        });
        this.emit('policy:registered', { name });
    }

    /**
     * Remove a mutable policy.
     */
    removePolicy(name) {
        const policy = this.#policies.get(name);
        if (policy && policy.mutable) {
            this.#policies.delete(name);
            this.emit('policy:removed', { name });
            return true;
        }
        return false;
    }

    /**
     * Register an escalation chain.
     */
    registerEscalationChain(name, chain) {
        this.#escalationChains.set(name, {
            name,
            levels: chain.levels || [],
            timeout: chain.timeout || 300000,
        });
    }

    /**
     * Create a sandbox with boundaries.
     */
    createSandbox(id, boundaries) {
        const sandbox = {
            id,
            boundaries,
            createdAt: Date.now(),
            violations: 0,
        };
        this.#activeSandboxes.set(id, sandbox);
        this.emit('sandbox:created', sandbox);
        return sandbox;
    }

    /**
     * Authorize a rollback.
     */
    authorizeRollback(target, reason) {
        this.#stats.rollbacksAuthorized++;
        const authorization = {
            id: randomUUID(),
            target,
            reason,
            authorizedAt: Date.now(),
            expiresAt: Date.now() + 300000,
        };
        this.#audit('rollback_authorized', authorization);
        this.emit('rollback:authorized', authorization);
        return authorization;
    }

    /**
     * Push an override onto the stack (freeze, simulation-only, etc.)
     */
    pushOverride(type, metadata = {}) {
        const override = { id: randomUUID(), type, metadata, pushedAt: Date.now() };
        this.#overrideStack.push(override);
        this.emit('override:pushed', override);
        return override;
    }

    /**
     * Pop the latest override.
     */
    popOverride() {
        const override = this.#overrideStack.pop();
        if (override) this.emit('override:popped', override);
        return override;
    }

    /**
     * Get governance state snapshot.
     */
    getState() {
        return {
            stats: { ...this.#stats },
            policies: [...this.#policies.keys()],
            activeSandboxes: this.#activeSandboxes.size,
            overrideStack: this.#overrideStack.map(o => ({ id: o.id, type: o.type })),
            escalationChains: [...this.#escalationChains.keys()],
        };
    }

    getAuditLog(limit = 50) {
        return this.#auditLog.slice(-limit);
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #registerDefaultPolicies() {
        this.registerPolicy('worker-scale-limit', {
            evaluate: (action) => {
                if (action.type === 'worker-scale' && action.parameters?.count > this.#config.maxWorkerScale) {
                    return { allowed: false, reason: `Worker scale ${action.parameters.count} exceeds max ${this.#config.maxWorkerScale}` };
                }
                return { allowed: true };
            },
            priority: 1,
            mutable: false,
        });

        this.registerPolicy('human-override-required', {
            evaluate: (action) => {
                if (this.#config.humanOverrideRequired.includes(action.type)) {
                    return { allowed: false, reason: `Action '${action.type}' requires human override`, escalate: true };
                }
                return { allowed: true };
            },
            priority: 0,
            mutable: false,
        });

        this.registerPolicy('autonomy-level-check', {
            evaluate: (action) => {
                if (action.autonomyLevel && action.autonomyLevel > this.#config.maxAutonomyLevel) {
                    return { allowed: false, reason: 'Autonomy level exceeds maximum allowed' };
                }
                return { allowed: true };
            },
            priority: 2,
            mutable: true,
        });
    }

    #registerDefaultEscalationChains() {
        this.registerEscalationChain('default', {
            levels: [
                { level: 1, handler: 'ai-review', timeout: 30000 },
                { level: 2, handler: 'senior-ai-review', timeout: 60000 },
                { level: 3, handler: 'human-review', timeout: 300000 },
            ],
            timeout: 300000,
        });

        this.registerEscalationChain('critical', {
            levels: [
                { level: 1, handler: 'human-review', timeout: 60000 },
                { level: 2, handler: 'emergency-stop', timeout: 120000 },
            ],
            timeout: 120000,
        });
    }

    #triggerEscalation(action, policyName, reason) {
        this.#stats.escalationsTriggered++;
        const escalation = {
            id: randomUUID(),
            action: action.type,
            policy: policyName,
            reason,
            chain: 'default',
            level: 1,
            triggeredAt: Date.now(),
            status: 'pending',
        };
        this.emit('escalation:triggered', escalation);
        return escalation;
    }

    #validateSandbox(action, sandbox) {
        const { boundaries } = sandbox;
        if (boundaries.allowedTypes && !boundaries.allowedTypes.includes(action.type)) {
            return false;
        }
        if (boundaries.maxActions && sandbox.violations >= boundaries.maxActions) {
            return false;
        }
        return true;
    }

    #audit(event, data) {
        this.#auditLog.push({ id: randomUUID(), event, data, timestamp: Date.now() });
        if (this.#auditLog.length > 1000) {
            this.#auditLog = this.#auditLog.slice(-1000);
        }
    }
}
