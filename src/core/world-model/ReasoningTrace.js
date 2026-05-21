/**
 * ReasoningTrace.js — AI Explainability Engine
 *
 * AI must explain:
 * - Why a patch was generated
 * - Why a rollback was triggered
 * - Why workers were scaled
 * - Why risk increased
 *
 * Records full reasoning traces for every AI decision.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ReasoningTrace extends EventEmitter {
    #traces = [];
    #maxTraces;
    #stats = {
        totalTraces: 0,
        byType: {},
    };

    constructor(config = {}) {
        super();
        this.#maxTraces = config.maxTraces || 1000;
    }

    /**
     * Record a reasoning trace for an AI decision.
     * @param {object} trace - { type, decision, reasoning, inputs, confidence, alternatives }
     * @returns {object} The recorded trace
     */
    record(trace) {
        const entry = {
            id: randomUUID(),
            timestamp: Date.now(),
            type: trace.type,
            decision: trace.decision,
            reasoning: trace.reasoning || [],
            inputs: trace.inputs || {},
            confidence: trace.confidence || 0,
            alternatives: trace.alternatives || [],
            outcome: trace.outcome || null,
            project: trace.project || null,
        };

        this.#traces.push(entry);
        this.#stats.totalTraces++;
        this.#stats.byType[entry.type] = (this.#stats.byType[entry.type] || 0) + 1;

        if (this.#traces.length > this.#maxTraces) {
            this.#traces = this.#traces.slice(-this.#maxTraces);
        }

        this.emit('trace:recorded', entry);
        return entry;
    }

    /**
     * Explain a specific decision by ID.
     */
    explain(traceId) {
        const trace = this.#traces.find(t => t.id === traceId);
        if (!trace) return null;

        return {
            ...trace,
            explanation: this.#formatExplanation(trace),
        };
    }

    /**
     * Explain the most recent decision of a given type.
     */
    explainLatest(type) {
        const trace = [...this.#traces].reverse().find(t => t.type === type);
        if (!trace) return null;
        return this.explain(trace.id);
    }

    /**
     * Query traces by criteria.
     * @param {object} query - { type?, project?, since?, minConfidence?, limit? }
     */
    query(query = {}) {
        let results = [...this.#traces];

        if (query.type) results = results.filter(t => t.type === query.type);
        if (query.project) results = results.filter(t => t.project === query.project);
        if (query.since) results = results.filter(t => t.timestamp >= query.since);
        if (query.minConfidence) results = results.filter(t => t.confidence >= query.minConfidence);

        results.sort((a, b) => b.timestamp - a.timestamp);
        return results.slice(0, query.limit || 20);
    }

    /**
     * Get recent traces.
     */
    getRecent(count = 10) {
        return this.#traces.slice(-count);
    }

    /**
     * Record outcome for a previous decision (for learning).
     */
    recordOutcome(traceId, outcome) {
        const trace = this.#traces.find(t => t.id === traceId);
        if (trace) {
            trace.outcome = outcome;
            trace.outcomeRecordedAt = Date.now();
            this.emit('trace:outcome', { traceId, outcome });
        }
        return trace;
    }

    /**
     * Get decision accuracy for a type (based on recorded outcomes).
     */
    getAccuracy(type) {
        const withOutcome = this.#traces.filter(t => t.type === type && t.outcome !== null);
        if (withOutcome.length === 0) return { accuracy: null, sampleSize: 0 };

        const successful = withOutcome.filter(t => t.outcome === 'success' || t.outcome === true);
        return {
            accuracy: Math.round((successful.length / withOutcome.length) * 100) / 100,
            sampleSize: withOutcome.length,
        };
    }

    /**
     * Format a human-readable explanation.
     */
    #formatExplanation(trace) {
        const lines = [];
        lines.push(`Decision: ${trace.decision}`);
        lines.push(`Type: ${trace.type}`);
        lines.push(`Confidence: ${Math.round(trace.confidence * 100)}%`);

        if (trace.reasoning.length > 0) {
            lines.push('Reasoning:');
            for (const step of trace.reasoning) {
                lines.push(`  → ${step}`);
            }
        }

        if (trace.alternatives.length > 0) {
            lines.push('Alternatives considered:');
            for (const alt of trace.alternatives) {
                lines.push(`  - ${alt.description || alt} (rejected: ${alt.reason || 'lower confidence'})`);
            }
        }

        if (trace.outcome) {
            lines.push(`Outcome: ${trace.outcome}`);
        }

        return lines.join('\n');
    }

    getStats() {
        return { ...this.#stats, storedTraces: this.#traces.length };
    }
}
