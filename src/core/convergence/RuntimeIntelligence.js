/**
 * RuntimeIntelligence.js — L6: Predictive Runtime Analysis
 *
 * Runtime must THINK, not just monitor.
 * Analyzes trends, predicts failures, recommends actions.
 */

export class RuntimeIntelligence {
    #events;
    #runtime;
    #history = []; // sliding window of health snapshots
    #maxHistory = 200;
    #predictions = [];
    #interval = null;
    #stats = { analyses: 0, predictions: 0, alerts: 0 };

    constructor(runtime, events) {
        this.#runtime = runtime;
        this.#events = events;
    }

    start(intervalMs = 10000) {
        this.#interval = setInterval(() => this.#analyze(), intervalMs);
        if (this.#interval.unref) this.#interval.unref();

        this.#events?.subscribe('system.heartbeat', (data) => {
            this.#history.push({ ...data, recordedAt: Date.now() });
            if (this.#history.length > this.#maxHistory) this.#history.shift();
        });
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
    }

    #analyze() {
        this.#stats.analyses++;
        if (this.#history.length < 5) return;

        const recent = this.#history.slice(-20);
        const predictions = [];

        // Pressure trend
        const pressures = recent.map(h => h.pressure ?? 0);
        const pressureTrend = this.#trend(pressures);
        if (pressureTrend > 0.05) {
            predictions.push({
                type: 'pressure_rising',
                severity: pressureTrend > 0.1 ? 'high' : 'medium',
                message: `Pressure rising at ${(pressureTrend * 100).toFixed(1)}%/sample`,
                prediction: 'Queue overflow in ~' + Math.round(((1 - pressures[pressures.length - 1]) / pressureTrend)) + ' intervals',
            });
        }

        // Memory trend
        const memUsages = recent.map(h => h.memory?.heapUsed / h.memory?.heapTotal || 0);
        const memTrend = this.#trend(memUsages);
        if (memTrend > 0.02) {
            predictions.push({
                type: 'memory_leak',
                severity: memTrend > 0.05 ? 'high' : 'medium',
                message: `Heap growing at ${(memTrend * 100).toFixed(1)}%/sample`,
                prediction: 'OOM risk if trend continues',
            });
        }

        // Event rate spike
        const eventStats = this.#events?.getStats?.();
        if (eventStats?.eventsPerSecond > 100) {
            predictions.push({
                type: 'event_storm',
                severity: 'medium',
                message: `Event rate: ${eventStats.eventsPerSecond}/s`,
                prediction: 'Event processing backlog likely',
            });
        }

        if (predictions.length > 0) {
            this.#predictions = predictions;
            this.#stats.predictions += predictions.length;
            this.#events?.publish('runtime.intelligence.predictions', { predictions });

            for (const p of predictions.filter(p => p.severity === 'high')) {
                this.#stats.alerts++;
                this.#events?.publish('runtime.intelligence.alert', p);
            }
        }
    }

    /**
     * Calculate linear trend (slope) of a numeric series.
     */
    #trend(values) {
        if (values.length < 3) return 0;
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    getPredictions() { return this.#predictions; }

    getStats() {
        return {
            ...this.#stats,
            historySize: this.#history.length,
            activePredictions: this.#predictions.length,
            running: !!this.#interval,
        };
    }
}
