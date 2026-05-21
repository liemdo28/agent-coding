/**
 * FutureStateEngine.js — Multi-Horizon Future Simulation
 *
 * Simulates:
 * - 30-day future
 * - 90-day future
 * - 1-year future
 *
 * Projects system state forward based on current trends.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class FutureStateEngine extends EventEmitter {
    #config;
    #simulations = [];
    #currentMetrics = new Map();
    #stats = { simulationsRun: 0, warningsGenerated: 0, scenariosExplored: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            horizons: config.horizons || [
                { name: '30-day', days: 30 },
                { name: '90-day', days: 90 },
                { name: '1-year', days: 365 },
            ],
            metrics: config.metrics || [
                'worker-count', 'queue-depth', 'infra-capacity',
                'architecture-complexity', 'governance-load', 'execution-throughput',
            ],
            warningThreshold: config.warningThreshold || 0.85,
            maxSimulations: config.maxSimulations || 100,
            ...config,
        };
    }

    /**
     * Feed current metric value.
     */
    feedMetric(metric, value) {
        if (!this.#currentMetrics.has(metric)) this.#currentMetrics.set(metric, []);
        this.#currentMetrics.get(metric).push({ value, timestamp: Date.now() });
        const arr = this.#currentMetrics.get(metric);
        if (arr.length > 60) this.#currentMetrics.set(metric, arr.slice(-60));
    }

    /**
     * Simulate future state across all horizons.
     */
    simulate() {
        this.#stats.simulationsRun++;
        const results = {};

        for (const horizon of this.#config.horizons) {
            const projections = {};
            const warnings = [];

            for (const metric of this.#config.metrics) {
                const data = this.#currentMetrics.get(metric) || [];
                if (data.length < 3) { projections[metric] = null; continue; }

                const values = data.map(d => d.value);
                const n = values.length;
                const slope = (values[n - 1] - values[0]) / n;
                const projected = values[n - 1] + slope * horizon.days;
                const clamped = Math.max(0, Math.min(1, projected));

                projections[metric] = { current: values[n - 1], projected: clamped, slope, horizon: horizon.name };

                if (clamped > this.#config.warningThreshold) {
                    warnings.push({ metric, projected: clamped, horizon: horizon.name, message: `${metric} projected to reach ${(clamped * 100).toFixed(0)}% in ${horizon.days} days` });
                    this.#stats.warningsGenerated++;
                }
            }

            results[horizon.name] = { projections, warnings, simulatedAt: Date.now() };
            this.#stats.scenariosExplored++;
        }

        const simulation = { id: randomUUID(), results, timestamp: Date.now() };
        this.#simulations.push(simulation);
        if (this.#simulations.length > this.#config.maxSimulations) this.#simulations = this.#simulations.slice(-this.#config.maxSimulations);

        this.emit('simulation:completed', simulation);
        return simulation;
    }

    getSimulations(limit = 10) { return this.#simulations.slice(-limit); }
    getLatest() { return this.#simulations[this.#simulations.length - 1] || null; }
    getStats() { return { ...this.#stats }; }
}
