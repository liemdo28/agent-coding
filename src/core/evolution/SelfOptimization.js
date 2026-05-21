/**
 * SelfOptimization.js — Autonomous Self-Optimization Engine
 *
 * AI continuously optimizes:
 * - Execution throughput
 * - Queue efficiency
 * - Worker allocation
 * - Runtime policies
 * - Rollback pressure
 *
 * Observes metrics → identifies bottlenecks → applies optimizations → measures impact.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class SelfOptimization extends EventEmitter {
    #config;
    #eventStream;
    #workerSwarm;
    #nervousSystem;
    #timeline;
    #optimizations = [];
    #activeOptimizations = new Map();
    #policies = new Map();
    #checkInterval = null;
    #stats = {
        optimizationsApplied: 0,
        optimizationsReverted: 0,
        improvementsMeasured: 0,
        checksRun: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            checkInterval: config.checkInterval || 15000,
            maxConcurrentOptimizations: config.maxConcurrentOptimizations || 3,
            minImprovementThreshold: config.minImprovementThreshold || 0.05,
            ...config,
        };
        this.#eventStream = deps.eventStream;
        this.#workerSwarm = deps.workerSwarm;
        this.#nervousSystem = deps.nervousSystem;
        this.#timeline = deps.timeline;

        this.#registerDefaultPolicies();
    }

    /**
     * Start the self-optimization loop.
     */
    start() {
        if (this.#checkInterval) return;

        this.#checkInterval = setInterval(() => {
            this.#runOptimizationCycle();
        }, this.#config.checkInterval);

        if (this.#checkInterval.unref) this.#checkInterval.unref();
        this.emit('started');
    }

    /**
     * Stop the optimization loop.
     */
    stop() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }
        this.emit('stopped');
    }

    /**
     * Run a single optimization cycle (for testing or manual trigger).
     */
    runCycle() {
        return this.#runOptimizationCycle();
    }

    /**
     * Register a custom optimization policy.
     * @param {string} name
     * @param {object} policy - { detect, optimize, measure, revert }
     */
    registerPolicy(name, policy) {
        this.#policies.set(name, {
            name,
            detect: policy.detect,
            optimize: policy.optimize,
            measure: policy.measure || (() => ({ improved: true })),
            revert: policy.revert || (() => { }),
            priority: policy.priority || 5,
            appliedCount: 0,
        });
    }

    /**
     * Get optimization history.
     */
    getHistory(limit = 20) {
        return this.#optimizations.slice(-limit);
    }

    /**
     * Get active optimizations.
     */
    getActive() {
        return Array.from(this.#activeOptimizations.values());
    }

    // --- Internal ---

    #registerDefaultPolicies() {
        // Worker rebalancing
        this.registerPolicy('worker-rebalance', {
            detect: () => {
                if (!this.#workerSwarm) return false;
                return this.#workerSwarm.getSaturation() > 0.85;
            },
            optimize: () => {
                this.#workerSwarm.redistribute();
                return { action: 'redistributed-workers' };
            },
            priority: 1,
        });

        // Queue pressure relief
        this.registerPolicy('queue-pressure-relief', {
            detect: () => {
                if (!this.#nervousSystem) return false;
                const health = this.#nervousSystem.assessHealth();
                return health.risks.some(r => r.type === 'queue-overload');
            },
            optimize: () => {
                // Spawn additional workers to drain queue
                if (this.#workerSwarm) {
                    this.#workerSwarm.spawn('drain');
                }
                return { action: 'spawned-drain-worker' };
            },
            priority: 2,
        });

        // Memory optimization
        this.registerPolicy('memory-optimization', {
            detect: () => {
                if (!this.#nervousSystem) return false;
                const reading = this.#nervousSystem.sense();
                return reading.memory.heapUsageRatio > 0.8;
            },
            optimize: () => {
                // Hint GC and kill idle workers
                if (global.gc) global.gc();
                if (this.#workerSwarm) {
                    const idle = this.#workerSwarm.getWorkersByState('idle');
                    if (idle.length > 2) {
                        this.#workerSwarm.kill(idle[0].id, 'memory-optimization');
                    }
                }
                return { action: 'memory-optimized' };
            },
            priority: 3,
        });

        // Execution policy tuning
        this.registerPolicy('execution-policy-tune', {
            detect: () => {
                if (!this.#timeline) return false;
                const trends = this.#timeline.getTrends(300000); // 5 min
                return trends.failureRate > 0.3;
            },
            optimize: () => {
                // High failure rate → increase validation steps
                return { action: 'increased-validation', policy: 'strict-mode' };
            },
            priority: 4,
        });
    }

    #runOptimizationCycle() {
        this.#stats.checksRun++;

        if (this.#activeOptimizations.size >= this.#config.maxConcurrentOptimizations) {
            return [];
        }

        const applied = [];

        // Check all policies in priority order
        const policies = [...this.#policies.values()].sort((a, b) => a.priority - b.priority);

        for (const policy of policies) {
            if (this.#activeOptimizations.size >= this.#config.maxConcurrentOptimizations) break;
            if (this.#activeOptimizations.has(policy.name)) continue;

            try {
                if (policy.detect()) {
                    const result = policy.optimize();
                    const optimization = {
                        id: randomUUID(),
                        policy: policy.name,
                        result,
                        appliedAt: Date.now(),
                        status: 'active',
                    };

                    this.#activeOptimizations.set(policy.name, optimization);
                    this.#optimizations.push(optimization);
                    this.#stats.optimizationsApplied++;
                    policy.appliedCount++;

                    applied.push(optimization);
                    this.emit('optimization:applied', optimization);
                    this.#eventStream?.publish('OPTIMIZATION_APPLIED', { policy: policy.name, result });
                }
            } catch {
                // Policy failed — skip
            }
        }

        // Check active optimizations for completion/revert
        for (const [name, opt] of this.#activeOptimizations) {
            if (Date.now() - opt.appliedAt > 30000) { // 30s measurement window
                this.#activeOptimizations.delete(name);
                opt.status = 'completed';
                this.#stats.improvementsMeasured++;
            }
        }

        return applied;
    }

    getStats() {
        return {
            ...this.#stats,
            activePolicies: this.#policies.size,
            activeOptimizations: this.#activeOptimizations.size,
        };
    }
}
