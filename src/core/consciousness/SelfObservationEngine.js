/**
 * SelfObservationEngine.js — AI Self-Monitoring
 *
 * AI monitors:
 * - Reasoning quality
 * - Hallucination risk
 * - Recursive instability
 * - Execution confidence
 *
 * The system observes itself as a thinking entity.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class SelfObservationEngine extends EventEmitter {
    #config;
    #observations = [];
    #indicators = new Map();
    #alerts = [];
    #stats = {
        observationsMade: 0,
        alertsRaised: 0,
        confidenceChecks: 0,
        hallucinationFlags: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxObservations: config.maxObservations || 500,
            confidenceThreshold: config.confidenceThreshold || 0.4,
            hallucinationThreshold: config.hallucinationThreshold || 0.6,
            instabilityWindow: config.instabilityWindow || 20,
            ...config,
        };

        this.#initializeIndicators();
    }

    /**
     * Record a self-observation.
     */
    observe(observation) {
        const record = {
            id: randomUUID(),
            type: observation.type || 'general',
            subject: observation.subject,
            finding: observation.finding,
            confidence: observation.confidence ?? 0.5,
            severity: observation.severity || 'info',
            timestamp: Date.now(),
        };

        this.#observations.push(record);
        this.#stats.observationsMade++;

        if (this.#observations.length > this.#config.maxObservations) {
            this.#observations = this.#observations.slice(-this.#config.maxObservations);
        }

        this.emit('observation:recorded', record);
        return record;
    }

    /**
     * Check reasoning quality.
     */
    checkReasoningQuality(reasoning) {
        this.#stats.confidenceChecks++;

        const quality = {
            confidence: reasoning.confidence ?? 0.5,
            coherence: this.#assessCoherence(reasoning),
            grounding: reasoning.grounded ? 1.0 : 0.3,
            novelty: reasoning.novel ? 0.7 : 1.0,
        };

        const overall = (quality.confidence + quality.coherence + quality.grounding + quality.novelty) / 4;

        if (overall < this.#config.confidenceThreshold) {
            this.#raiseAlert('low-reasoning-quality', { overall, quality, reasoning: reasoning.summary });
        }

        this.#indicators.set('reasoning-quality', overall);
        return { overall, ...quality };
    }

    /**
     * Assess hallucination risk.
     */
    assessHallucinationRisk(context) {
        const risk = {
            groundedFacts: context.groundedFacts ?? 0,
            totalClaims: context.totalClaims ?? 1,
            externalValidation: context.validated ? 0.1 : 0.5,
            noveltyFactor: context.novel ? 0.3 : 0.0,
        };

        const groundingRatio = risk.totalClaims > 0 ? risk.groundedFacts / risk.totalClaims : 0;
        const hallucinationScore = 1 - groundingRatio + risk.externalValidation + risk.noveltyFactor;
        const normalized = Math.min(1, Math.max(0, hallucinationScore / 2));

        if (normalized > this.#config.hallucinationThreshold) {
            this.#stats.hallucinationFlags++;
            this.#raiseAlert('hallucination-risk', { score: normalized, context });
        }

        this.#indicators.set('hallucination-risk', normalized);
        return { risk: normalized, grounding: groundingRatio };
    }

    /**
     * Detect recursive instability.
     */
    detectRecursiveInstability() {
        const recent = this.#observations.slice(-this.#config.instabilityWindow);
        const typeCount = new Map();

        for (const obs of recent) {
            typeCount.set(obs.type, (typeCount.get(obs.type) || 0) + 1);
        }

        const instabilities = [];
        for (const [type, count] of typeCount) {
            if (count > this.#config.instabilityWindow * 0.5) {
                instabilities.push({ type, frequency: count / recent.length });
            }
        }

        const isUnstable = instabilities.length > 0;
        this.#indicators.set('recursive-stability', isUnstable ? 0.2 : 0.9);

        if (isUnstable) {
            this.emit('instability:detected', { instabilities });
        }

        return { stable: !isUnstable, instabilities };
    }

    /**
     * Get execution confidence.
     */
    getExecutionConfidence() {
        const quality = this.#indicators.get('reasoning-quality') ?? 0.5;
        const hallucination = this.#indicators.get('hallucination-risk') ?? 0.5;
        const stability = this.#indicators.get('recursive-stability') ?? 0.5;

        return (quality + (1 - hallucination) + stability) / 3;
    }

    /**
     * Get all indicators.
     */
    getIndicators() {
        return Object.fromEntries(this.#indicators);
    }

    /**
     * Get recent observations.
     */
    getObservations(limit = 20) {
        return this.#observations.slice(-limit);
    }

    /**
     * Get active alerts.
     */
    getAlerts() {
        return this.#alerts.filter(a => a.status === 'active');
    }

    getStats() {
        return { ...this.#stats, executionConfidence: this.getExecutionConfidence() };
    }

    // --- Internal ---

    #initializeIndicators() {
        this.#indicators.set('reasoning-quality', 0.5);
        this.#indicators.set('hallucination-risk', 0.5);
        this.#indicators.set('recursive-stability', 0.9);
        this.#indicators.set('execution-confidence', 0.5);
    }

    #assessCoherence(reasoning) {
        if (!reasoning.steps || reasoning.steps.length === 0) return 0.5;
        // More steps with consistent direction = higher coherence
        return Math.min(1, 0.5 + reasoning.steps.length * 0.1);
    }

    #raiseAlert(type, data) {
        const alert = {
            id: randomUUID(),
            type,
            data,
            timestamp: Date.now(),
            status: 'active',
        };
        this.#alerts.push(alert);
        this.#stats.alertsRaised++;

        if (this.#alerts.length > 100) {
            this.#alerts = this.#alerts.slice(-100);
        }

        this.emit('alert:raised', alert);
    }
}
