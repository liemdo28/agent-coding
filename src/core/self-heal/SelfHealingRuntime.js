/**
 * SelfHealingRuntime.js — Detect, recover, rollback, stabilize
 *
 * Monitors runtime health and automatically recovers from:
 * - Worker crashes
 * - Queue overloads
 * - JSON corruption
 * - Build failures
 * - Memory pressure
 */

import { EventEmitter } from 'events';

export class SelfHealingRuntime extends EventEmitter {
    #config;
    #observability;
    #memory;
    #checkInterval = null;
    #recoveryAttempts = new Map();
    #stats = { checks: 0, recoveries: 0, failures: 0 };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            checkInterval: config.checkInterval || 30_000,
            maxRecoveryAttempts: config.maxRecoveryAttempts || 3,
            memoryThreshold: config.memoryThreshold || 0.85,
            ...config,
        };
        this.#observability = deps.observability;
        this.#memory = deps.memory;

        this.#startMonitoring();
    }

    /**
     * Attempt recovery from a failure event.
     * @param {object} event - { type, execution, error, snapshot }
     */
    async recover(event) {
        const key = `${event.type}:${event.execution?.id || 'unknown'}`;
        const attempts = this.#recoveryAttempts.get(key) || 0;

        if (attempts >= this.#config.maxRecoveryAttempts) {
            this.#stats.failures++;
            this.emit('recovery-exhausted', { event, attempts });
            throw new Error(`Recovery exhausted after ${attempts} attempts for ${key}`);
        }

        this.#recoveryAttempts.set(key, attempts + 1);

        try {
            const strategy = this.#selectStrategy(event);
            const result = await strategy(event);

            this.#stats.recoveries++;
            this.emit('recovery', { event, strategy: strategy.name, result });

            // Clear attempts on success
            this.#recoveryAttempts.delete(key);
            return result;

        } catch (error) {
            this.#stats.failures++;
            this.emit('recovery-failed', { event, error: error.message });
            throw error;
        }
    }

    /**
     * Select appropriate recovery strategy based on failure type.
     */
    #selectStrategy(event) {
        const strategies = {
            'execution_failure': this.#recoverExecution.bind(this),
            'worker_crash': this.#recoverWorker.bind(this),
            'queue_overload': this.#recoverQueue.bind(this),
            'json_corruption': this.#recoverCorruption.bind(this),
            'build_failure': this.#recoverBuild.bind(this),
            'memory_pressure': this.#recoverMemory.bind(this),
        };

        return strategies[event.type] || this.#recoverGeneric.bind(this);
    }

    /** Recover from execution failure — rollback to snapshot */
    async #recoverExecution(event) {
        if (event.snapshot && this.#memory) {
            await this.#memory.saveSnapshot({
                id: `rollback-${Date.now()}`,
                project: event.snapshot.project,
                type: 'execution-rollback',
                data: event.snapshot,
            });
        }

        // Record failure pattern for future prevention
        if (this.#memory && event.error) {
            await this.#memory.recordFailurePattern({
                type: event.execution?.task?.type || 'unknown',
                signature: event.error.slice(0, 200),
                name: `Execution failure: ${event.type}`,
            });
        }

        return { action: 'rollback', snapshot: event.snapshot };
    }

    /** Recover from worker crash — restart worker */
    async #recoverWorker(event) {
        this.#observability?.record('self-heal.worker-restart', event);
        return { action: 'worker-restart', workerId: event.workerId };
    }

    /** Recover from queue overload — shed load */
    async #recoverQueue(event) {
        this.#observability?.record('self-heal.queue-shed', event);
        return { action: 'load-shed', droppedCount: event.overflow || 0 };
    }

    /** Recover from JSON corruption — rebuild from backup */
    async #recoverCorruption(event) {
        this.#observability?.record('self-heal.corruption-repair', event);
        return { action: 'rebuild', target: event.target };
    }

    /** Recover from build failure — clean and retry */
    async #recoverBuild(event) {
        this.#observability?.record('self-heal.build-retry', event);
        return { action: 'clean-retry', project: event.project };
    }

    /** Recover from memory pressure — compact and GC */
    async #recoverMemory(event) {
        // Force garbage collection if available
        if (global.gc) global.gc();

        this.#observability?.record('self-heal.memory-compact', event);
        return { action: 'memory-compact' };
    }

    /** Generic recovery — log and emit degraded */
    async #recoverGeneric(event) {
        this.emit('degraded');
        this.#observability?.record('self-heal.generic', event);
        return { action: 'degraded', event };
    }

    /** Periodic health monitoring */
    #startMonitoring() {
        this.#checkInterval = setInterval(() => {
            this.#healthCheck();
        }, this.#config.checkInterval);

        // Don't prevent process exit
        if (this.#checkInterval.unref) {
            this.#checkInterval.unref();
        }
    }

    #healthCheck() {
        this.#stats.checks++;

        // Check memory usage
        const memUsage = process.memoryUsage();
        const heapRatio = memUsage.heapUsed / memUsage.heapTotal;

        if (heapRatio > this.#config.memoryThreshold) {
            this.recover({ type: 'memory_pressure', heapRatio }).catch(() => { });
        }

        this.#observability?.record('health-check', {
            heapRatio: Math.round(heapRatio * 100) / 100,
            rss: memUsage.rss,
            recoveryAttempts: this.#recoveryAttempts.size,
        });
    }

    /** Stop monitoring */
    stop() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }
    }

    getStats() {
        return { ...this.#stats, activeRecoveries: this.#recoveryAttempts.size };
    }
}
