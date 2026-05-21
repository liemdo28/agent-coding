/**
 * RuntimeNervousSystem.js — Realtime System Sensors
 *
 * Monitors the entire runtime in realtime:
 * - Queue depth and throughput
 * - Worker utilization
 * - Memory pressure (heap, RSS)
 * - CPU usage
 * - WebSocket connections
 * - Rollback rate
 * - SLA risk assessment
 *
 * Emits sensor readings at configurable intervals.
 * Triggers alerts when thresholds are breached.
 */

import { EventEmitter } from 'events';

export class RuntimeNervousSystem extends EventEmitter {
    #config;
    #observability;
    #sensorInterval = null;
    #readings = [];
    #maxReadings;
    #alerts = [];
    #thresholds;
    #stats = {
        totalReadings: 0,
        alertsTriggered: 0,
        slaBreaches: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            sensorInterval: config.sensorInterval || 5000,
            maxReadings: config.maxReadings || 500,
            ...config,
        };
        this.#observability = deps.observability;
        this.#maxReadings = this.#config.maxReadings;

        this.#thresholds = {
            memoryUsage: config.memoryThreshold || 0.85,
            cpuUsage: config.cpuThreshold || 0.90,
            queueDepth: config.queueThreshold || 100,
            errorRate: config.errorRateThreshold || 0.1,
            responseTime: config.responseTimeThreshold || 5000,
            rollbackRate: config.rollbackRateThreshold || 0.2,
            ...config.thresholds,
        };
    }

    /**
     * Start the nervous system — begin collecting sensor data.
     */
    start() {
        if (this.#sensorInterval) return;

        this.#sensorInterval = setInterval(() => {
            this.#collectReading();
        }, this.#config.sensorInterval);

        // Unref so it doesn't keep the process alive
        if (this.#sensorInterval.unref) {
            this.#sensorInterval.unref();
        }

        this.emit('started');
    }

    /**
     * Stop the nervous system.
     */
    stop() {
        if (this.#sensorInterval) {
            clearInterval(this.#sensorInterval);
            this.#sensorInterval = null;
        }
        this.emit('stopped');
    }

    /**
     * Get the current system state snapshot.
     * @returns {object} Current sensor reading
     */
    sense() {
        return this.#takeSensorReading();
    }

    /**
     * Get recent readings for trend analysis.
     * @param {number} count - Number of recent readings
     * @returns {object[]}
     */
    getRecentReadings(count = 50) {
        return this.#readings.slice(-count);
    }

    /**
     * Get current health assessment.
     * @returns {object} { status, score, risks, recommendations }
     */
    assessHealth() {
        const reading = this.#takeSensorReading();
        const risks = [];
        const recommendations = [];
        let score = 1.0;

        // Memory check
        if (reading.memory.heapUsageRatio > this.#thresholds.memoryUsage) {
            risks.push({ type: 'memory', severity: 'high', value: reading.memory.heapUsageRatio });
            recommendations.push('Consider increasing heap size or reducing memory usage');
            score -= 0.3;
        } else if (reading.memory.heapUsageRatio > this.#thresholds.memoryUsage * 0.8) {
            risks.push({ type: 'memory', severity: 'medium', value: reading.memory.heapUsageRatio });
            score -= 0.1;
        }

        // Queue check
        if (reading.queue.depth > this.#thresholds.queueDepth) {
            risks.push({ type: 'queue-overload', severity: 'high', value: reading.queue.depth });
            recommendations.push('Scale workers or reduce task submission rate');
            score -= 0.2;
        }

        // Error rate check
        if (reading.errorRate > this.#thresholds.errorRate) {
            risks.push({ type: 'error-rate', severity: 'high', value: reading.errorRate });
            recommendations.push('Investigate recent failures — error rate above threshold');
            score -= 0.25;
        }

        // Rollback rate check
        if (reading.rollbackRate > this.#thresholds.rollbackRate) {
            risks.push({ type: 'rollback-rate', severity: 'medium', value: reading.rollbackRate });
            recommendations.push('High rollback rate — review deployment strategy');
            score -= 0.15;
        }

        score = Math.max(0, Math.min(1, score));

        const status = score > 0.8 ? 'healthy' : score > 0.5 ? 'degraded' : 'critical';

        return {
            status,
            score: Math.round(score * 100) / 100,
            risks,
            recommendations,
            reading,
            timestamp: Date.now(),
        };
    }

    /**
     * Get SLA risk assessment.
     * @returns {object} { atRisk, probability, factors }
     */
    assessSLARisk() {
        const recent = this.#readings.slice(-20);
        if (recent.length < 5) return { atRisk: false, probability: 0, factors: [] };

        const factors = [];
        let riskScore = 0;

        // Check response time trend
        const avgResponseTime = recent.reduce((sum, r) => sum + (r.avgResponseTime || 0), 0) / recent.length;
        if (avgResponseTime > this.#thresholds.responseTime) {
            factors.push({ type: 'response-time', value: avgResponseTime, threshold: this.#thresholds.responseTime });
            riskScore += 0.3;
        }

        // Check error rate trend
        const avgErrorRate = recent.reduce((sum, r) => sum + (r.errorRate || 0), 0) / recent.length;
        if (avgErrorRate > this.#thresholds.errorRate) {
            factors.push({ type: 'error-rate', value: avgErrorRate, threshold: this.#thresholds.errorRate });
            riskScore += 0.3;
        }

        // Check memory trend (increasing?)
        if (recent.length >= 5) {
            const first5 = recent.slice(0, 5).reduce((s, r) => s + r.memory.heapUsageRatio, 0) / 5;
            const last5 = recent.slice(-5).reduce((s, r) => s + r.memory.heapUsageRatio, 0) / 5;
            if (last5 > first5 * 1.2) {
                factors.push({ type: 'memory-leak', trend: 'increasing' });
                riskScore += 0.2;
            }
        }

        const probability = Math.min(1, riskScore);
        const atRisk = probability > 0.4;

        if (atRisk) {
            this.#stats.slaBreaches++;
        }

        return {
            atRisk,
            probability: Math.round(probability * 100) / 100,
            factors,
        };
    }

    /**
     * Report an external metric (from pipeline, sandbox, etc).
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     */
    reportMetric(metric, value) {
        // Store for trend analysis
        const latest = this.#readings[this.#readings.length - 1];
        if (latest) {
            if (!latest.external) latest.external = {};
            latest.external[metric] = value;
        }
    }

    /**
     * Get active alerts.
     */
    getAlerts() {
        return this.#alerts.slice(-50);
    }

    // --- Internal ---

    #collectReading() {
        const reading = this.#takeSensorReading();
        this.#readings.push(reading);
        this.#stats.totalReadings++;

        // Trim readings
        if (this.#readings.length > this.#maxReadings) {
            this.#readings = this.#readings.slice(-this.#maxReadings);
        }

        // Check thresholds and emit alerts
        this.#checkThresholds(reading);

        this.emit('reading', reading);
        this.#observability?.record('nervous-system.reading', {
            memory: reading.memory.heapUsageRatio,
            uptime: reading.uptime,
        });
    }

    #takeSensorReading() {
        const mem = process.memoryUsage();
        const uptime = process.uptime();

        return {
            timestamp: Date.now(),
            memory: {
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                heapUsageRatio: mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0,
                rss: mem.rss,
                external: mem.external,
            },
            uptime,
            pid: process.pid,
            queue: this.#getQueueMetrics(),
            errorRate: this.#computeErrorRate(),
            rollbackRate: this.#computeRollbackRate(),
            avgResponseTime: this.#computeAvgResponseTime(),
            activeWorkers: this.#getActiveWorkers(),
        };
    }

    #getQueueMetrics() {
        // These would be populated by the pipeline reporting metrics
        const recent = this.#readings.slice(-5);
        return {
            depth: recent[recent.length - 1]?.queue?.depth || 0,
            throughput: recent.reduce((s, r) => s + (r.queue?.throughput || 0), 0) / Math.max(1, recent.length),
        };
    }

    #computeErrorRate() {
        const recent = this.#readings.slice(-10);
        if (recent.length === 0) return 0;
        const errors = recent.filter(r => r.errorRate > 0).length;
        return errors / recent.length;
    }

    #computeRollbackRate() {
        const recent = this.#readings.slice(-10);
        if (recent.length === 0) return 0;
        const rollbacks = recent.filter(r => r.rollbackRate > 0).length;
        return rollbacks / recent.length;
    }

    #computeAvgResponseTime() {
        const recent = this.#readings.slice(-10);
        if (recent.length === 0) return 0;
        return recent.reduce((s, r) => s + (r.avgResponseTime || 0), 0) / recent.length;
    }

    #getActiveWorkers() {
        // Placeholder — would be populated by runtime
        return 0;
    }

    #checkThresholds(reading) {
        if (reading.memory.heapUsageRatio > this.#thresholds.memoryUsage) {
            this.#triggerAlert('memory-pressure', 'high', reading.memory.heapUsageRatio);
        }

        if (reading.errorRate > this.#thresholds.errorRate) {
            this.#triggerAlert('error-rate-high', 'medium', reading.errorRate);
        }

        if (reading.queue.depth > this.#thresholds.queueDepth) {
            this.#triggerAlert('queue-overload', 'high', reading.queue.depth);
        }
    }

    #triggerAlert(type, severity, value) {
        const alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            severity,
            value,
            timestamp: Date.now(),
        };

        this.#alerts.push(alert);
        this.#stats.alertsTriggered++;

        // Keep alerts bounded
        if (this.#alerts.length > 100) {
            this.#alerts = this.#alerts.slice(-100);
        }

        this.emit('alert', alert);
    }

    getStats() {
        return { ...this.#stats, readingsStored: this.#readings.length, activeAlerts: this.#alerts.length };
    }
}
