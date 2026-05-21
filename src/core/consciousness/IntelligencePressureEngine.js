/**
 * IntelligencePressureEngine.js — Cognitive & Operational Pressure
 *
 * Computes:
 * - Cognitive pressure
 * - Strategic entropy
 * - Operational chaos
 * - Execution turbulence
 *
 * Measures how much stress the civilization's intelligence is under.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class IntelligencePressureEngine extends EventEmitter {
    #config;
    #pressures = new Map();
    #history = [];
    #alerts = [];
    #stats = {
        measurementsTaken: 0,
        alertsRaised: 0,
        peakPressure: 0,
        averagePressure: 0.5,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            dimensions: config.dimensions || [
                'cognitive-pressure',
                'strategic-entropy',
                'operational-chaos',
                'execution-turbulence',
                'decision-fatigue',
                'information-overload',
            ],
            criticalThreshold: config.criticalThreshold || 0.8,
            warningThreshold: config.warningThreshold || 0.6,
            maxHistory: config.maxHistory || 500,
            ...config,
        };

        this.#initializePressures();
    }

    /**
     * Report a pressure measurement.
     */
    reportPressure(dimension, value, source = '') {
        const clamped = Math.max(0, Math.min(1, value));
        const previous = this.#pressures.get(dimension)?.value ?? 0;

        this.#pressures.set(dimension, {
            value: clamped,
            previous,
            delta: clamped - previous,
            source,
            measuredAt: Date.now(),
        });

        this.#stats.measurementsTaken++;
        this.#history.push({ dimension, value: clamped, timestamp: Date.now() });

        if (this.#history.length > this.#config.maxHistory) {
            this.#history = this.#history.slice(-this.#config.maxHistory);
        }

        // Check thresholds
        if (clamped >= this.#config.criticalThreshold) {
            this.#raiseAlert('critical', dimension, clamped);
        } else if (clamped >= this.#config.warningThreshold) {
            this.#raiseAlert('warning', dimension, clamped);
        }

        // Update peak
        if (clamped > this.#stats.peakPressure) {
            this.#stats.peakPressure = clamped;
        }

        this.emit('pressure:reported', { dimension, value: clamped });
    }

    /**
     * Compute overall pressure index.
     */
    computeOverallPressure() {
        let sum = 0;
        let count = 0;
        for (const [, data] of this.#pressures) {
            sum += data.value;
            count++;
        }
        const overall = count > 0 ? sum / count : 0;
        this.#stats.averagePressure = overall;
        return overall;
    }

    /**
     * Get pressure for a specific dimension.
     */
    getPressure(dimension) {
        return this.#pressures.get(dimension)?.value ?? null;
    }

    /**
     * Get all pressure readings.
     */
    getAllPressures() {
        const result = {};
        for (const [dim, data] of this.#pressures) {
            result[dim] = { value: data.value, delta: data.delta, source: data.source };
        }
        return result;
    }

    /**
     * Get pressure status.
     */
    getStatus() {
        const overall = this.computeOverallPressure();
        if (overall >= this.#config.criticalThreshold) return 'critical';
        if (overall >= this.#config.warningThreshold) return 'elevated';
        return 'normal';
    }

    /**
     * Get pressure trend.
     */
    getTrend(dimension, window = 20) {
        const relevant = this.#history
            .filter(h => !dimension || h.dimension === dimension)
            .slice(-window);

        if (relevant.length < 5) return 'unknown';

        const firstHalf = relevant.slice(0, Math.floor(relevant.length / 2));
        const secondHalf = relevant.slice(Math.floor(relevant.length / 2));

        const avgFirst = firstHalf.reduce((s, h) => s + h.value, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, h) => s + h.value, 0) / secondHalf.length;

        if (avgSecond > avgFirst + 0.05) return 'increasing';
        if (avgSecond < avgFirst - 0.05) return 'decreasing';
        return 'stable';
    }

    /**
     * Get active alerts.
     */
    getAlerts() {
        return this.#alerts.filter(a => a.status === 'active');
    }

    /**
     * Get pressure history.
     */
    getHistory(dimension, limit = 50) {
        return this.#history
            .filter(h => !dimension || h.dimension === dimension)
            .slice(-limit);
    }

    getStats() {
        return { ...this.#stats, overallPressure: this.computeOverallPressure(), status: this.getStatus() };
    }

    // --- Internal ---

    #initializePressures() {
        for (const dim of this.#config.dimensions) {
            this.#pressures.set(dim, { value: 0, previous: 0, delta: 0, source: '', measuredAt: Date.now() });
        }
    }

    #raiseAlert(level, dimension, value) {
        const alert = {
            id: randomUUID(),
            level,
            dimension,
            value,
            timestamp: Date.now(),
            status: 'active',
        };
        this.#alerts.push(alert);
        this.#stats.alertsRaised++;

        if (this.#alerts.length > 100) {
            this.#alerts = this.#alerts.slice(-100);
        }

        this.emit(`pressure:${level}`, alert);
    }
}
