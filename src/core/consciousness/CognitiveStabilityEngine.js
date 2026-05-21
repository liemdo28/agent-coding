/**
 * CognitiveStabilityEngine.js — Cognitive Process Stability
 *
 * Detects:
 * - Recursive loops
 * - Contradictory plans
 * - Runaway optimization
 * - Unstable execution chains
 *
 * Ensures the AI's cognitive processes remain stable and productive.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CognitiveStabilityEngine extends EventEmitter {
    #config;
    #cognitiveLog = [];
    #detectedIssues = [];
    #stabilityScore = 1.0;
    #circuitBreakers = new Map();
    #stats = {
        checksPerformed: 0,
        loopsDetected: 0,
        contradictionsDetected: 0,
        runawaysDetected: 0,
        circuitBreaks: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            loopThreshold: config.loopThreshold || 3,
            windowSize: config.windowSize || 30,
            runawayThreshold: config.runawayThreshold || 10,
            maxLogSize: config.maxLogSize || 500,
            circuitBreakerCooldown: config.circuitBreakerCooldown || 60000,
            ...config,
        };
    }

    /**
     * Log a cognitive event for stability analysis.
     */
    logCognitive(event) {
        const record = {
            id: randomUUID(),
            type: event.type,
            action: event.action,
            input: event.input,
            output: event.output,
            duration: event.duration || 0,
            timestamp: Date.now(),
        };

        this.#cognitiveLog.push(record);
        if (this.#cognitiveLog.length > this.#config.maxLogSize) {
            this.#cognitiveLog = this.#cognitiveLog.slice(-this.#config.maxLogSize);
        }

        this.#analyzeStability(record);
        return record;
    }

    /**
     * Check for recursive loops.
     */
    detectLoops() {
        this.#stats.checksPerformed++;
        const window = this.#cognitiveLog.slice(-this.#config.windowSize);
        const patterns = new Map();

        for (const event of window) {
            const key = `${event.type}:${event.action}:${JSON.stringify(event.input)}`;
            patterns.set(key, (patterns.get(key) || 0) + 1);
        }

        const loops = [];
        for (const [pattern, count] of patterns) {
            if (count >= this.#config.loopThreshold) {
                loops.push({ pattern, count, severity: count / this.#config.windowSize });
            }
        }

        if (loops.length > 0) {
            this.#stats.loopsDetected += loops.length;
            this.emit('loop:detected', { loops });
        }

        return loops;
    }

    /**
     * Detect contradictory plans.
     */
    detectContradictions(plans) {
        this.#stats.checksPerformed++;
        const contradictions = [];

        for (let i = 0; i < plans.length; i++) {
            for (let j = i + 1; j < plans.length; j++) {
                if (this.#areContradictory(plans[i], plans[j])) {
                    contradictions.push({ planA: plans[i], planB: plans[j] });
                }
            }
        }

        if (contradictions.length > 0) {
            this.#stats.contradictionsDetected += contradictions.length;
            this.emit('contradiction:detected', { contradictions });
        }

        return contradictions;
    }

    /**
     * Detect runaway optimization.
     */
    detectRunaway() {
        this.#stats.checksPerformed++;
        const window = this.#cognitiveLog.slice(-this.#config.windowSize);
        const optimizations = window.filter(e => e.type === 'optimization');

        if (optimizations.length >= this.#config.runawayThreshold) {
            this.#stats.runawaysDetected++;
            const issue = {
                id: randomUUID(),
                type: 'runaway-optimization',
                count: optimizations.length,
                window: this.#config.windowSize,
                detectedAt: Date.now(),
            };
            this.#detectedIssues.push(issue);
            this.emit('runaway:detected', issue);
            return { runaway: true, count: optimizations.length };
        }

        return { runaway: false };
    }

    /**
     * Trip a circuit breaker for a cognitive process.
     */
    tripCircuitBreaker(process, reason) {
        this.#circuitBreakers.set(process, {
            trippedAt: Date.now(),
            reason,
            expiresAt: Date.now() + this.#config.circuitBreakerCooldown,
        });
        this.#stats.circuitBreaks++;
        this.emit('circuit-breaker:tripped', { process, reason });
    }

    /**
     * Check if a circuit breaker is active.
     */
    isCircuitBroken(process) {
        const breaker = this.#circuitBreakers.get(process);
        if (!breaker) return false;
        if (breaker.expiresAt < Date.now()) {
            this.#circuitBreakers.delete(process);
            return false;
        }
        return true;
    }

    /**
     * Get cognitive stability score.
     */
    getStabilityScore() {
        return this.#stabilityScore;
    }

    /**
     * Get detected issues.
     */
    getIssues(limit = 20) {
        return this.#detectedIssues.slice(-limit);
    }

    /**
     * Get active circuit breakers.
     */
    getActiveCircuitBreakers() {
        const now = Date.now();
        const active = [];
        for (const [process, breaker] of this.#circuitBreakers) {
            if (breaker.expiresAt > now) {
                active.push({ process, ...breaker });
            }
        }
        return active;
    }

    getStats() {
        return { ...this.#stats, stabilityScore: this.#stabilityScore, activeCircuitBreakers: this.#circuitBreakers.size };
    }

    // --- Internal ---

    #analyzeStability(record) {
        const loops = this.detectLoops();
        const runaway = this.detectRunaway();

        let score = 1.0;
        if (loops.length > 0) score -= loops.length * 0.15;
        if (runaway.runaway) score -= 0.3;
        if (this.#circuitBreakers.size > 0) score -= this.#circuitBreakers.size * 0.1;

        this.#stabilityScore = Math.max(0, Math.min(1, score));
    }

    #areContradictory(planA, planB) {
        if (planA.target === planB.target && planA.direction && planB.direction) {
            return planA.direction !== planB.direction;
        }
        return false;
    }
}
