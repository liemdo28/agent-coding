/**
 * HorizonPlanningEngine.js — Long-Horizon Planning
 *
 * AI plans across multiple time horizons:
 * - 1 week (tactical)
 * - 1 month (operational)
 * - 1 year (strategic)
 *
 * Detects trends, projects futures, recommends preemptive actions.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class HorizonPlanningEngine extends EventEmitter {
    #config;
    #plans = new Map();
    #projections = [];
    #trends = [];
    #recommendations = [];
    #stats = {
        plansCreated: 0,
        projectionsGenerated: 0,
        trendsDetected: 0,
        recommendationsIssued: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            horizons: config.horizons || [
                { name: '1-week', days: 7, type: 'tactical' },
                { name: '1-month', days: 30, type: 'operational' },
                { name: '1-quarter', days: 90, type: 'strategic' },
                { name: '1-year', days: 365, type: 'visionary' },
            ],
            maxProjections: config.maxProjections || 200,
            trendWindowSize: config.trendWindowSize || 50,
            ...config,
        };
    }

    /**
     * Create a plan for a specific horizon.
     */
    createPlan(horizon, plan) {
        const horizonConfig = this.#config.horizons.find(h => h.name === horizon);
        if (!horizonConfig) return null;

        const record = {
            id: randomUUID(),
            horizon,
            type: horizonConfig.type,
            title: plan.title,
            objectives: plan.objectives || [],
            actions: plan.actions || [],
            risks: plan.risks || [],
            dependencies: plan.dependencies || [],
            status: 'active',
            createdAt: Date.now(),
            targetDate: Date.now() + (horizonConfig.days * 86400000),
            progress: 0,
        };

        if (!this.#plans.has(horizon)) {
            this.#plans.set(horizon, []);
        }
        this.#plans.get(horizon).push(record);
        this.#stats.plansCreated++;

        this.emit('plan:created', record);
        return record;
    }

    /**
     * Generate a projection based on current trends.
     */
    project(metric, dataPoints, horizon) {
        const horizonConfig = this.#config.horizons.find(h => h.name === horizon);
        if (!horizonConfig || dataPoints.length < 3) return null;

        // Simple linear projection
        const n = dataPoints.length;
        const xMean = (n - 1) / 2;
        const yMean = dataPoints.reduce((a, b) => a + b, 0) / n;

        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (i - xMean) * (dataPoints[i] - yMean);
            denominator += (i - xMean) ** 2;
        }

        const slope = denominator !== 0 ? numerator / denominator : 0;
        const intercept = yMean - slope * xMean;
        const projectedValue = slope * (n + horizonConfig.days) + intercept;

        const projection = {
            id: randomUUID(),
            metric,
            horizon,
            currentValue: dataPoints[dataPoints.length - 1],
            projectedValue,
            slope,
            confidence: Math.min(0.95, Math.max(0.1, 1 - Math.abs(slope) * 0.1)),
            trend: slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable',
            createdAt: Date.now(),
            targetDate: Date.now() + (horizonConfig.days * 86400000),
        };

        this.#projections.push(projection);
        this.#stats.projectionsGenerated++;

        if (this.#projections.length > this.#config.maxProjections) {
            this.#projections = this.#projections.slice(-this.#config.maxProjections);
        }

        this.emit('projection:generated', projection);
        return projection;
    }

    /**
     * Detect a trend from metrics.
     */
    detectTrend(metric, dataPoints) {
        if (dataPoints.length < 5) return null;

        const recent = dataPoints.slice(-this.#config.trendWindowSize);
        const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
        const secondHalf = recent.slice(Math.floor(recent.length / 2));

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const change = avgSecond - avgFirst;
        const changeRate = avgFirst !== 0 ? change / avgFirst : 0;

        const trend = {
            id: randomUUID(),
            metric,
            direction: changeRate > 0.05 ? 'up' : changeRate < -0.05 ? 'down' : 'flat',
            changeRate,
            magnitude: Math.abs(changeRate),
            dataPoints: recent.length,
            detectedAt: Date.now(),
        };

        this.#trends.push(trend);
        this.#stats.trendsDetected++;

        if (this.#trends.length > 200) {
            this.#trends = this.#trends.slice(-200);
        }

        this.emit('trend:detected', trend);
        return trend;
    }

    /**
     * Issue a recommendation based on projections and trends.
     */
    recommend(recommendation) {
        const record = {
            id: randomUUID(),
            title: recommendation.title,
            description: recommendation.description,
            urgency: recommendation.urgency || 'medium',
            horizon: recommendation.horizon,
            basedOn: recommendation.basedOn || [],
            action: recommendation.action,
            impact: recommendation.impact || 'unknown',
            createdAt: Date.now(),
            status: 'pending',
        };

        this.#recommendations.push(record);
        this.#stats.recommendationsIssued++;

        this.emit('recommendation:issued', record);
        return record;
    }

    /**
     * Get plans for a horizon.
     */
    getPlans(horizon) {
        if (horizon) return this.#plans.get(horizon) || [];
        const all = {};
        for (const [h, plans] of this.#plans) {
            all[h] = plans;
        }
        return all;
    }

    /**
     * Get projections.
     */
    getProjections(limit = 20) {
        return this.#projections.slice(-limit);
    }

    /**
     * Get detected trends.
     */
    getTrends(limit = 20) {
        return this.#trends.slice(-limit);
    }

    /**
     * Get recommendations.
     */
    getRecommendations(status = 'pending') {
        return this.#recommendations.filter(r => r.status === status);
    }

    getStats() {
        return { ...this.#stats };
    }
}
