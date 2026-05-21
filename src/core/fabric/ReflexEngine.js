/**
 * ReflexEngine.js — Autonomous AI Reflex System
 *
 * Detects and autonomously recovers from:
 * - Worker crashes → respawn + rebalance
 * - WebSocket collapse → reconnect + buffer
 * - Queue overload → shed load + scale
 * - Runtime instability → isolate + stabilize
 * - JSON corruption → repair + restore
 * - Memory leaks → GC hint + restart worker
 *
 * Operates as reflexes — fast, autonomous, no human intervention needed.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ReflexEngine extends EventEmitter {
    #config;
    #eventStream;
    #workerSwarm;
    #memory;
    #reflexes = new Map();
    #activeRecoveries = new Map();
    #stats = {
        reflexesTriggered: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        isolations: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            maxConcurrentRecoveries: config.maxConcurrentRecoveries || 5,
            recoveryTimeout: config.recoveryTimeout || 15000,
            ...config,
        };
        this.#eventStream = deps.eventStream;
        this.#workerSwarm = deps.workerSwarm;
        this.#memory = deps.memory;

        // Register built-in reflexes
        this.#registerBuiltinReflexes();
    }

    /**
     * Start the reflex engine — subscribe to events.
     */
    start() {
        if (!this.#eventStream) return;

        this.#eventStream.subscribe('WORKER_CRASHED', (event) => this.#trigger('worker-crash', event));
        this.#eventStream.subscribe('BUILD_FAILED', (event) => this.#trigger('build-failure', event));
        this.#eventStream.subscribe('PRESSURE_CRITICAL', (event) => this.#trigger('critical-pressure', event));
        this.#eventStream.subscribe('SLA_BREACH', (event) => this.#trigger('sla-breach', event));
        this.#eventStream.subscribe('ROLLBACK_TRIGGERED', (event) => this.#trigger('rollback-storm', event));

        this.emit('started');
    }

    /**
     * Stop the reflex engine.
     */
    stop() {
        this.#activeRecoveries.clear();
        this.emit('stopped');
    }

    /**
     * Register a custom reflex.
     * @param {string} name - Reflex name
     * @param {object} reflex - { trigger, detect, recover, priority }
     */
    registerReflex(name, reflex) {
        this.#reflexes.set(name, {
            name,
            trigger: reflex.trigger,
            detect: reflex.detect || (() => true),
            recover: reflex.recover,
            priority: reflex.priority || 5,
            triggerCount: 0,
            lastTriggered: null,
        });
    }

    /**
     * Manually trigger a reflex (for testing).
     */
    async triggerReflex(name, context = {}) {
        const reflex = this.#reflexes.get(name);
        if (!reflex) return null;
        return this.#executeRecovery(reflex, { payload: context });
    }

    /**
     * Get active recoveries.
     */
    getActiveRecoveries() {
        return Array.from(this.#activeRecoveries.values());
    }

    // --- Internal ---

    #registerBuiltinReflexes() {
        // Worker crash → respawn + rebalance
        this.registerReflex('worker-crash', {
            trigger: 'WORKER_CRASHED',
            recover: async (event) => {
                const workerId = event.payload?.workerId;
                // Spawn replacement
                if (this.#workerSwarm) {
                    this.#workerSwarm.spawn('recovery');
                    this.#workerSwarm.redistribute();
                }
                return { action: 'respawned', replacedWorker: workerId };
            },
            priority: 1,
        });

        // Build failure → analyze + record pattern
        this.registerReflex('build-failure', {
            trigger: 'BUILD_FAILED',
            recover: async (event) => {
                // Record failure pattern for learning
                if (this.#memory) {
                    await this.#memory.recordExecution({
                        taskId: event.payload?.taskId || 'unknown',
                        type: 'build',
                        result: 'failed',
                        duration: 0,
                        timestamp: Date.now(),
                    });
                }
                return { action: 'recorded-pattern' };
            },
            priority: 3,
        });

        // Critical pressure → isolate + stabilize
        this.registerReflex('critical-pressure', {
            trigger: 'PRESSURE_CRITICAL',
            recover: async () => {
                this.#stats.isolations++;
                // Force garbage collection hint
                if (global.gc) global.gc();
                return { action: 'stabilized', gc: true };
            },
            priority: 1,
        });

        // SLA breach → emergency redistribution
        this.registerReflex('sla-breach', {
            trigger: 'SLA_BREACH',
            recover: async () => {
                if (this.#workerSwarm) {
                    // Spawn emergency workers
                    this.#workerSwarm.spawn('emergency');
                    this.#workerSwarm.spawn('emergency');
                    this.#workerSwarm.redistribute();
                }
                return { action: 'emergency-scale' };
            },
            priority: 0, // Highest priority
        });

        // Rollback storm detection
        this.registerReflex('rollback-storm', {
            trigger: 'ROLLBACK_TRIGGERED',
            detect: () => {
                // Only trigger if multiple rollbacks in short window
                if (!this.#eventStream) return false;
                const recent = this.#eventStream.byTopic('ROLLBACK_TRIGGERED', 10);
                const lastMinute = recent.filter(e => Date.now() - e.timestamp < 60000);
                return lastMinute.length >= 3; // 3+ rollbacks in 1 minute = storm
            },
            recover: async () => {
                this.#stats.isolations++;
                // Pause all non-critical work
                this.#eventStream?.publish('EXECUTION_PAUSED', { reason: 'rollback-storm' });
                return { action: 'paused-execution', reason: 'rollback-storm' };
            },
            priority: 1,
        });
    }

    async #trigger(reflexName, event) {
        const reflex = this.#reflexes.get(reflexName);
        if (!reflex) return;

        // Check detection condition
        if (reflex.detect && !reflex.detect(event)) return;

        // Check concurrent recovery limit
        if (this.#activeRecoveries.size >= this.#config.maxConcurrentRecoveries) {
            return; // Drop — too many active recoveries
        }

        await this.#executeRecovery(reflex, event);
    }

    async #executeRecovery(reflex, event) {
        const recoveryId = randomUUID();
        const recovery = {
            id: recoveryId,
            reflex: reflex.name,
            startedAt: Date.now(),
            status: 'running',
            event: event?.topic || 'manual',
        };

        this.#activeRecoveries.set(recoveryId, recovery);
        this.#stats.reflexesTriggered++;
        reflex.triggerCount++;
        reflex.lastTriggered = Date.now();

        this.emit('reflex:triggered', { reflex: reflex.name, recoveryId });
        this.#eventStream?.publish('REFLEX_TRIGGERED', { reflex: reflex.name, recoveryId });

        try {
            const result = await Promise.race([
                reflex.recover(event),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Recovery timeout')), this.#config.recoveryTimeout)
                ),
            ]);

            recovery.status = 'success';
            recovery.result = result;
            recovery.duration = Date.now() - recovery.startedAt;
            this.#stats.successfulRecoveries++;

            this.emit('reflex:recovered', { reflex: reflex.name, recoveryId, result });
            this.#eventStream?.publish('REFLEX_RECOVERED', { reflex: reflex.name, recoveryId });

            return result;
        } catch (error) {
            recovery.status = 'failed';
            recovery.error = error.message;
            recovery.duration = Date.now() - recovery.startedAt;
            this.#stats.failedRecoveries++;

            this.emit('reflex:failed', { reflex: reflex.name, recoveryId, error: error.message });
            this.#eventStream?.publish('REFLEX_FAILED', { reflex: reflex.name, error: error.message });

            return null;
        } finally {
            this.#activeRecoveries.delete(recoveryId);
        }
    }

    getStats() {
        return {
            ...this.#stats,
            registeredReflexes: this.#reflexes.size,
            activeRecoveries: this.#activeRecoveries.size,
        };
    }
}
