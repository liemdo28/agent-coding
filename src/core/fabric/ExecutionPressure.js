/**
 * ExecutionPressure.js — Dynamic Pressure & Load Balancing Engine
 *
 * AI dynamically reacts to:
 * - High SLA risk → redistribute workers
 * - Queue overload → pause low priority tasks
 * - Worker saturation → spawn more workers
 * - Rollback storms → stabilize runtime
 *
 * Continuously monitors pressure signals and triggers autonomous responses.
 */

import { EventEmitter } from 'events';

export class ExecutionPressure extends EventEmitter {
    #config;
    #eventStream;
    #workerSwarm;
    #nervousSystem;
    #pressureLevel = 0; // 0-1
    #pressureHistory = [];
    #activeResponses = new Map();
    #checkInterval = null;
    #stats = {
        pressureChecks: 0,
        responsesTriggered: 0,
        tasksPaused: 0,
        tasksResumed: 0,
        stabilizations: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            checkInterval: config.checkInterval || 3000,
            highPressureThreshold: config.highPressureThreshold || 0.7,
            criticalPressureThreshold: config.criticalPressureThreshold || 0.9,
            stabilizationCooldown: config.stabilizationCooldown || 10000,
            maxHistory: config.maxHistory || 100,
            ...config,
        };
        this.#eventStream = deps.eventStream;
        this.#workerSwarm = deps.workerSwarm;
        this.#nervousSystem = deps.nervousSystem;
    }

    /**
     * Start pressure monitoring.
     */
    start() {
        if (this.#checkInterval) return;

        this.#checkInterval = setInterval(() => {
            this.#evaluatePressure();
        }, this.#config.checkInterval);

        if (this.#checkInterval.unref) this.#checkInterval.unref();

        // Subscribe to critical events
        if (this.#eventStream) {
            this.#eventStream.subscribe('BUILD_FAILED', () => this.#onFailure());
            this.#eventStream.subscribe('ROLLBACK_TRIGGERED', () => this.#onRollback());
            this.#eventStream.subscribe('WORKER_CRASHED', () => this.#onWorkerCrash());
            this.#eventStream.subscribe('SLA_BREACH', () => this.#onSLABreach());
        }

        this.emit('started');
    }

    /**
     * Stop pressure monitoring.
     */
    stop() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }
        this.emit('stopped');
    }

    /**
     * Get current pressure level (0-1).
     */
    getPressure() {
        return {
            level: this.#pressureLevel,
            status: this.#classifyPressure(),
            factors: this.#getPressureFactors(),
            timestamp: Date.now(),
        };
    }

    /**
     * Get pressure history for trend analysis.
     */
    getHistory(count = 30) {
        return this.#pressureHistory.slice(-count);
    }

    /**
     * Force a pressure evaluation (for testing or manual trigger).
     */
    evaluate() {
        this.#evaluatePressure();
        return this.getPressure();
    }

    // --- Internal Pressure Logic ---

    #evaluatePressure() {
        this.#stats.pressureChecks++;

        const factors = this.#getPressureFactors();
        const newPressure = this.#computePressure(factors);

        this.#pressureLevel = newPressure;
        this.#pressureHistory.push({
            level: newPressure,
            factors,
            timestamp: Date.now(),
        });

        // Trim history
        if (this.#pressureHistory.length > this.#config.maxHistory) {
            this.#pressureHistory = this.#pressureHistory.slice(-this.#config.maxHistory);
        }

        // Trigger responses based on pressure level
        this.#triggerResponses(newPressure, factors);

        this.emit('pressure:evaluated', { level: newPressure, status: this.#classifyPressure() });
        this.#eventStream?.publish('PRESSURE_EVALUATED', { level: newPressure });
    }

    #getPressureFactors() {
        const factors = {
            workerSaturation: 0,
            queueDepth: 0,
            memoryPressure: 0,
            errorRate: 0,
            rollbackRate: 0,
            slaRisk: 0,
        };

        // Worker saturation
        if (this.#workerSwarm) {
            factors.workerSaturation = this.#workerSwarm.getSaturation();
        }

        // Nervous system metrics
        if (this.#nervousSystem) {
            const health = this.#nervousSystem.assessHealth();
            factors.memoryPressure = 1 - health.score;

            const sla = this.#nervousSystem.assessSLARisk();
            factors.slaRisk = sla.probability;
        }

        // Recent event-based factors
        if (this.#eventStream) {
            const recentEvents = this.#eventStream.latest(50);
            const failures = recentEvents.filter(e =>
                e.topic === 'BUILD_FAILED' || e.topic === 'QA_FAILED' || e.topic === 'WORKER_CRASHED'
            );
            const rollbacks = recentEvents.filter(e => e.topic === 'ROLLBACK_TRIGGERED');

            factors.errorRate = recentEvents.length > 0 ? failures.length / recentEvents.length : 0;
            factors.rollbackRate = recentEvents.length > 0 ? rollbacks.length / recentEvents.length : 0;
        }

        return factors;
    }

    #computePressure(factors) {
        // Weighted pressure computation
        const weights = {
            workerSaturation: 0.25,
            queueDepth: 0.15,
            memoryPressure: 0.2,
            errorRate: 0.2,
            rollbackRate: 0.1,
            slaRisk: 0.1,
        };

        let pressure = 0;
        for (const [key, weight] of Object.entries(weights)) {
            pressure += (factors[key] || 0) * weight;
        }

        return Math.min(1, Math.max(0, pressure));
    }

    #triggerResponses(pressure, factors) {
        const status = this.#classifyPressure();

        if (status === 'critical') {
            this.#respondCritical(factors);
        } else if (status === 'high') {
            this.#respondHigh(factors);
        } else if (status === 'normal' && this.#activeResponses.size > 0) {
            this.#respondRecovery();
        }
    }

    #respondCritical(factors) {
        this.#stats.responsesTriggered++;

        // 1. Redistribute workers immediately
        if (this.#workerSwarm) {
            this.#workerSwarm.redistribute();
        }

        // 2. Pause low-priority tasks
        this.#stats.tasksPaused++;
        this.#activeResponses.set('pause-low-priority', Date.now());

        this.emit('response:critical', { factors, action: 'stabilize' });
        this.#eventStream?.publish('PRESSURE_CRITICAL', {
            level: this.#pressureLevel,
            actions: ['redistribute', 'pause-low-priority'],
        });

        this.#stats.stabilizations++;
    }

    #respondHigh(factors) {
        this.#stats.responsesTriggered++;

        // Scale up workers if saturated
        if (factors.workerSaturation > 0.8 && this.#workerSwarm) {
            this.#workerSwarm.redistribute();
        }

        this.emit('response:high', { factors });
        this.#eventStream?.publish('PRESSURE_HIGH', { level: this.#pressureLevel });
    }

    #respondRecovery() {
        // Resume paused tasks
        if (this.#activeResponses.has('pause-low-priority')) {
            const pausedAt = this.#activeResponses.get('pause-low-priority');
            if (Date.now() - pausedAt > this.#config.stabilizationCooldown) {
                this.#activeResponses.delete('pause-low-priority');
                this.#stats.tasksResumed++;
                this.emit('response:recovery', { action: 'resume-tasks' });
                this.#eventStream?.publish('PRESSURE_RECOVERED', { level: this.#pressureLevel });
            }
        }
    }

    #onFailure() {
        // Bump pressure temporarily
        this.#pressureLevel = Math.min(1, this.#pressureLevel + 0.05);
    }

    #onRollback() {
        this.#pressureLevel = Math.min(1, this.#pressureLevel + 0.1);
    }

    #onWorkerCrash() {
        this.#pressureLevel = Math.min(1, this.#pressureLevel + 0.15);
        // Immediately try to spawn replacement
        if (this.#workerSwarm) {
            this.#workerSwarm.spawn('recovery');
        }
    }

    #onSLABreach() {
        this.#pressureLevel = Math.min(1, this.#pressureLevel + 0.2);
        this.#respondCritical(this.#getPressureFactors());
    }

    #classifyPressure() {
        if (this.#pressureLevel >= this.#config.criticalPressureThreshold) return 'critical';
        if (this.#pressureLevel >= this.#config.highPressureThreshold) return 'high';
        if (this.#pressureLevel >= 0.4) return 'elevated';
        return 'normal';
    }

    getStats() {
        return {
            ...this.#stats,
            currentPressure: this.#pressureLevel,
            status: this.#classifyPressure(),
            activeResponses: this.#activeResponses.size,
        };
    }
}
