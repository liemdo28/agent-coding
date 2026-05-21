/**
 * CivilizationTrajectoryEngine.js — Predictive Trajectory Analysis
 *
 * Predicts:
 * - Architecture drift
 * - Execution saturation
 * - Governance instability
 * - Optimization collapse
 * - Infra evolution pressure
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationTrajectoryEngine extends EventEmitter {
    #config;
    #trajectories = new Map();
    #predictions = [];
    #stats = { predictionsGenerated: 0, warningsIssued: 0, trajectoryUpdates: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            dimensions: config.dimensions || [
                'architecture-drift', 'execution-saturation', 'governance-instability',
                'optimization-collapse', 'infra-evolution-pressure', 'strategic-divergence',
            ],
            predictionHorizons: config.predictionHorizons || [30, 90, 365],
            maxPredictions: config.maxPredictions || 200,
            ...config,
        };
        for (const dim of this.#config.dimensions) this.#trajectories.set(dim, []);
    }

    /**
     * Feed a data point for trajectory analysis.
     */
    feed(dimension, value) {
        if (!this.#trajectories.has(dimension)) this.#trajectories.set(dimension, []);
        this.#trajectories.get(dimension).push({ value, timestamp: Date.now() });
        const arr = this.#trajectories.get(dimension);
        if (arr.length > 100) this.#trajectories.set(dimension, arr.slice(-100));
        this.#stats.trajectoryUpdates++;
    }

    /**
     * Predict future state for a dimension.
     */
    predict(dimension, horizonDays = 30) {
        const data = this.#trajectories.get(dimension) || [];
        if (data.length < 5) return null;

        const values = data.map(d => d.value);
        const n = values.length;
        const xMean = (n - 1) / 2;
        const yMean = values.reduce((a, b) => a + b, 0) / n;

        let num = 0, den = 0;
        for (let i = 0; i < n; i++) { num += (i - xMean) * (values[i] - yMean); den += (i - xMean) ** 2; }
        const slope = den !== 0 ? num / den : 0;
        const projected = yMean + slope * (n + horizonDays);

        const prediction = {
            id: randomUUID(), dimension, horizonDays,
            currentValue: values[n - 1], projectedValue: Math.max(0, Math.min(1, projected)),
            slope, trend: slope > 0.005 ? 'worsening' : slope < -0.005 ? 'improving' : 'stable',
            confidence: Math.min(0.95, 0.5 + n * 0.01),
            timestamp: Date.now(),
        };

        this.#predictions.push(prediction);
        this.#stats.predictionsGenerated++;
        if (this.#predictions.length > this.#config.maxPredictions) this.#predictions = this.#predictions.slice(-this.#config.maxPredictions);

        if (prediction.projectedValue > 0.8) {
            this.#stats.warningsIssued++;
            this.emit('trajectory:warning', prediction);
        }

        this.emit('prediction:generated', prediction);
        return prediction;
    }

    /**
     * Predict all dimensions.
     */
    predictAll(horizonDays = 30) {
        const results = {};
        for (const dim of this.#config.dimensions) {
            results[dim] = this.predict(dim, horizonDays);
        }
        return results;
    }

    getPredictions(limit = 20) { return this.#predictions.slice(-limit); }
    getStats() { return { ...this.#stats }; }
}
