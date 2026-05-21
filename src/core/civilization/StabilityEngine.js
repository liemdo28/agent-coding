/**
 * StabilityEngine.js — Civilization Stability Score Computation
 *
 * Computes a realtime civilization stability score based on:
 * - Rollback storms
 * - Queue pressure
 * - Worker overload
 * - Infrastructure instability
 * - Architecture risk
 *
 * Score range: 0.0 (critical) to 1.0 (perfectly stable)
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class StabilityEngine extends EventEmitter {
    #config;
    #metrics = new Map();
    #history = [];
    #alerts = [];
    #currentScore = 1.0;
    #dimensions = new Map();
    #checkInterval = null;
    #stats = {
        checksPerformed: 0,
        alertsRaised: 0,
        criticalEvents: 0,
        recoveries: 0,
        averageScore: 1.0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            checkInterval: config.checkInterval || 10000,
            criticalThreshold: config.criticalThreshold || 0.3,
            warningThreshold: config.warningThreshold || 0.6,
            historySize: config.historySize || 500,
            dimensions: config.dimensions || [
                'rollback-pressure',
                'queue-pressure',
                'worker-load',
                'infra-stability',
                'architecture-risk',
                'governance-health',
                'memory-pressure',
            ],
            weights: config.weights || {
                'rollback-pressure': 0.2,
                'queue-pressure': 0.15,
                'worker-load': 0.15,
                'infra-stability': 0.2,
                'architecture-risk': 0.15,
                'governance-health': 0.1,
                'memory-pressure': 0.05,
            },
            ...config,
        };

        this.#initializeDimensions();
    }

    /**
     * Start continuous stability monitoring.
     */
    start() {
        if (this.#checkInterval) return;
        this.#checkInterval = setInterval(() => this.computeScore(), this.#config.checkInterval);
        this.emit('stability:started');
    }

    /**
     * Stop monitoring.
     */
    stop() {
        if (this.#checkInterval) {
            clearInterval(this.#checkInterval);
            this.#checkInterval = null;
        }
        this.emit('stability:stopped');
    }

    /**
     * Report a metric value for a stability dimension.
     * @param {string} dimension - Dimension name
     * @param {number} value - 0.0 (worst) to 1.0 (best)
     */
    reportMetric(dimension, value) {
        const clamped = Math.max(0, Math.min(1, value));
        this.#metrics.set(dimension, { value: clamped, reportedAt: Date.now() });
        this.#dimensions.set(dimension, clamped);
    }

    /**
     * Compute the overall stability score.
     */
    computeScore() {
        this.#stats.checksPerformed++;
        const weights = this.#config.weights;
        let totalWeight = 0;
        let weightedSum = 0;

        for (const [dimension, weight] of Object.entries(weights)) {
            const value = this.#dimensions.get(dimension) ?? 1.0;
            weightedSum += value * weight;
            totalWeight += weight;
        }

        const previousScore = this.#currentScore;
        this.#currentScore = totalWeight > 0 ? weightedSum / totalWeight : 1.0;

        // Record history
        this.#history.push({
            score: this.#currentScore,
            dimensions: Object.fromEntries(this.#dimensions),
            timestamp: Date.now(),
        });

        if (this.#history.length > this.#config.historySize) {
            this.#history = this.#history.slice(-this.#config.historySize);
        }

        // Update average
        const sum = this.#history.reduce((acc, h) => acc + h.score, 0);
        this.#stats.averageScore = sum / this.#history.length;

        // Check thresholds
        this.#evaluateThresholds(previousScore);

        this.emit('stability:computed', { score: this.#currentScore, dimensions: Object.fromEntries(this.#dimensions) });
        return this.#currentScore;
    }

    /**
     * Get current stability score.
     */
    getScore() {
        return this.#currentScore;
    }

    /**
     * Get stability status.
     */
    getStatus() {
        if (this.#currentScore <= this.#config.criticalThreshold) return 'critical';
        if (this.#currentScore <= this.#config.warningThreshold) return 'warning';
        return 'healthy';
    }

    /**
     * Get dimension breakdown.
     */
    getDimensions() {
        return Object.fromEntries(this.#dimensions);
    }

    /**
     * Get stability history.
     */
    getHistory(limit = 50) {
        return this.#history.slice(-limit);
    }

    /**
     * Get active alerts.
     */
    getAlerts() {
        return this.#alerts.filter(a => a.status === 'active');
    }

    /**
     * Get full stability report.
     */
    getReport() {
        return {
            score: this.#currentScore,
            status: this.getStatus(),
            dimensions: this.getDimensions(),
            alerts: this.getAlerts(),
            trend: this.#computeTrend(),
            stats: { ...this.#stats },
        };
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #initializeDimensions() {
        for (const dim of this.#config.dimensions) {
            this.#dimensions.set(dim, 1.0);
        }
    }

    #evaluateThresholds(previousScore) {
        const score = this.#currentScore;

        // Crossed into critical
        if (score <= this.#config.criticalThreshold && previousScore > this.#config.criticalThreshold) {
            this.#stats.criticalEvents++;
            const alert = {
                id: randomUUID(),
                level: 'critical',
                message: `Stability critical: ${(score * 100).toFixed(1)}%`,
                score,
                timestamp: Date.now(),
                status: 'active',
            };
            this.#alerts.push(alert);
            this.#stats.alertsRaised++;
            this.emit('stability:critical', alert);
        }

        // Crossed into warning
        if (score <= this.#config.warningThreshold && previousScore > this.#config.warningThreshold) {
            const alert = {
                id: randomUUID(),
                level: 'warning',
                message: `Stability warning: ${(score * 100).toFixed(1)}%`,
                score,
                timestamp: Date.now(),
                status: 'active',
            };
            this.#alerts.push(alert);
            this.#stats.alertsRaised++;
            this.emit('stability:warning', alert);
        }

        // Recovery
        if (score > this.#config.warningThreshold && previousScore <= this.#config.warningThreshold) {
            this.#stats.recoveries++;
            // Resolve active alerts
            for (const alert of this.#alerts) {
                if (alert.status === 'active') alert.status = 'resolved';
            }
            this.emit('stability:recovered', { score });
        }

        // Trim alerts
        if (this.#alerts.length > 200) {
            this.#alerts = this.#alerts.slice(-200);
        }
    }

    #computeTrend() {
        if (this.#history.length < 5) return 'stable';
        const recent = this.#history.slice(-5);
        const first = recent[0].score;
        const last = recent[recent.length - 1].score;
        const diff = last - first;

        if (diff > 0.05) return 'improving';
        if (diff < -0.05) return 'degrading';
        return 'stable';
    }
}
