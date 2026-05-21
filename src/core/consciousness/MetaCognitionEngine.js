/**
 * MetaCognitionEngine.js — Reasoning About Reasoning
 *
 * AI reasons about:
 * - Reasoning quality
 * - Strategic quality
 * - Execution quality
 * - Optimization outcomes
 *
 * Second-order thinking — the system thinking about how it thinks.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class MetaCognitionEngine extends EventEmitter {
    #config;
    #assessments = [];
    #qualityMetrics = new Map();
    #insights = [];
    #stats = {
        assessmentsPerformed: 0,
        insightsGenerated: 0,
        qualityImprovements: 0,
        qualityDegradations: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxAssessments: config.maxAssessments || 300,
            maxInsights: config.maxInsights || 100,
            qualityDomains: config.qualityDomains || [
                'reasoning',
                'strategy',
                'execution',
                'optimization',
                'governance',
                'prediction',
            ],
            ...config,
        };

        this.#initializeMetrics();
    }

    /**
     * Assess quality of a cognitive domain.
     */
    assess(domain, evidence) {
        this.#stats.assessmentsPerformed++;

        const previous = this.#qualityMetrics.get(domain)?.score ?? 0.5;
        const score = this.#computeQualityScore(domain, evidence);

        const assessment = {
            id: randomUUID(),
            domain,
            score,
            previous,
            delta: score - previous,
            evidence,
            timestamp: Date.now(),
        };

        this.#assessments.push(assessment);
        if (this.#assessments.length > this.#config.maxAssessments) {
            this.#assessments = this.#assessments.slice(-this.#config.maxAssessments);
        }

        this.#qualityMetrics.set(domain, { score, updatedAt: Date.now() });

        if (score > previous + 0.05) this.#stats.qualityImprovements++;
        if (score < previous - 0.05) this.#stats.qualityDegradations++;

        this.emit('assessment:completed', assessment);
        return assessment;
    }

    /**
     * Generate an insight from meta-cognitive analysis.
     */
    generateInsight(observation) {
        const insight = {
            id: randomUUID(),
            type: observation.type || 'general',
            finding: observation.finding,
            implication: observation.implication,
            recommendation: observation.recommendation,
            confidence: observation.confidence ?? 0.5,
            domain: observation.domain,
            timestamp: Date.now(),
        };

        this.#insights.push(insight);
        this.#stats.insightsGenerated++;

        if (this.#insights.length > this.#config.maxInsights) {
            this.#insights = this.#insights.slice(-this.#config.maxInsights);
        }

        this.emit('insight:generated', insight);
        return insight;
    }

    /**
     * Evaluate optimization outcomes — did optimizations actually help?
     */
    evaluateOutcome(optimization) {
        const before = optimization.metricsBefore;
        const after = optimization.metricsAfter;

        let improvement = 0;
        let degradation = 0;
        const details = [];

        for (const [metric, beforeVal] of Object.entries(before)) {
            const afterVal = after[metric];
            if (afterVal === undefined) continue;
            const delta = afterVal - beforeVal;
            if (delta > 0) improvement += delta;
            else degradation += Math.abs(delta);
            details.push({ metric, before: beforeVal, after: afterVal, delta });
        }

        const netEffect = improvement - degradation;
        const effective = netEffect > 0;

        const evaluation = {
            id: randomUUID(),
            optimization: optimization.id,
            effective,
            netEffect,
            improvement,
            degradation,
            details,
            timestamp: Date.now(),
        };

        this.emit('outcome:evaluated', evaluation);
        return evaluation;
    }

    /**
     * Get quality score for a domain.
     */
    getQuality(domain) {
        return this.#qualityMetrics.get(domain)?.score ?? null;
    }

    /**
     * Get all quality metrics.
     */
    getAllQualities() {
        const result = {};
        for (const [domain, data] of this.#qualityMetrics) {
            result[domain] = data.score;
        }
        return result;
    }

    /**
     * Get overall meta-cognitive health.
     */
    getOverallQuality() {
        let sum = 0;
        let count = 0;
        for (const [, data] of this.#qualityMetrics) {
            sum += data.score;
            count++;
        }
        return count > 0 ? sum / count : 0.5;
    }

    /**
     * Get recent insights.
     */
    getInsights(limit = 20) {
        return this.#insights.slice(-limit);
    }

    /**
     * Get assessment history for a domain.
     */
    getAssessments(domain, limit = 20) {
        return this.#assessments
            .filter(a => !domain || a.domain === domain)
            .slice(-limit);
    }

    getStats() {
        return { ...this.#stats, overallQuality: this.getOverallQuality() };
    }

    // --- Internal ---

    #initializeMetrics() {
        for (const domain of this.#config.qualityDomains) {
            this.#qualityMetrics.set(domain, { score: 0.5, updatedAt: Date.now() });
        }
    }

    #computeQualityScore(domain, evidence) {
        let score = 0.5;

        if (evidence.successRate !== undefined) score = evidence.successRate;
        if (evidence.accuracy !== undefined) score = (score + evidence.accuracy) / 2;
        if (evidence.efficiency !== undefined) score = (score + evidence.efficiency) / 2;
        if (evidence.consistency !== undefined) score = (score + evidence.consistency) / 2;

        return Math.max(0, Math.min(1, score));
    }
}
