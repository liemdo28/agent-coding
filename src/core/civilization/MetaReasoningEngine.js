/**
 * MetaReasoningEngine.js — AI Self-Audit & Meta-Cognition
 *
 * AI audits its own:
 * - Decisions
 * - Optimizations
 * - Strategy
 * - Recursive logic
 *
 * Detects:
 * - Unstable reasoning
 * - Recursive failure loops
 * - Optimization contradictions
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class MetaReasoningEngine extends EventEmitter {
    #config;
    #reasoningLog = [];
    #audits = [];
    #contradictions = [];
    #failureLoops = [];
    #stats = {
        reasoningStepsLogged: 0,
        auditsPerformed: 0,
        contradictionsDetected: 0,
        failureLoopsDetected: 0,
        unstableReasoningEvents: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxReasoningLog: config.maxReasoningLog || 500,
            loopDetectionWindow: config.loopDetectionWindow || 20,
            contradictionThreshold: config.contradictionThreshold || 0.3,
            maxAudits: config.maxAudits || 200,
            ...config,
        };
    }

    /**
     * Log a reasoning step for later audit.
     */
    logReasoning(step) {
        const record = {
            id: randomUUID(),
            type: step.type || 'decision',
            input: step.input,
            output: step.output,
            rationale: step.rationale,
            confidence: step.confidence || 0.5,
            context: step.context || {},
            timestamp: Date.now(),
        };

        this.#reasoningLog.push(record);
        this.#stats.reasoningStepsLogged++;

        if (this.#reasoningLog.length > this.#config.maxReasoningLog) {
            this.#reasoningLog = this.#reasoningLog.slice(-this.#config.maxReasoningLog);
        }

        // Auto-detect issues
        this.#detectFailureLoop(record);
        return record;
    }

    /**
     * Perform a meta-audit of recent reasoning.
     */
    audit(scope = 'recent') {
        this.#stats.auditsPerformed++;

        const window = scope === 'recent'
            ? this.#reasoningLog.slice(-this.#config.loopDetectionWindow)
            : this.#reasoningLog;

        const audit = {
            id: randomUUID(),
            scope,
            timestamp: Date.now(),
            findings: [],
            score: 1.0,
        };

        // Check for contradictions
        const contradictions = this.#findContradictions(window);
        if (contradictions.length > 0) {
            audit.findings.push({
                type: 'contradiction',
                count: contradictions.length,
                details: contradictions,
            });
            audit.score -= contradictions.length * 0.1;
        }

        // Check for low confidence patterns
        const lowConfidence = window.filter(r => r.confidence < 0.3);
        if (lowConfidence.length > window.length * 0.3) {
            audit.findings.push({
                type: 'low-confidence-pattern',
                ratio: lowConfidence.length / window.length,
            });
            audit.score -= 0.2;
        }

        // Check for repetitive reasoning
        const repetitions = this.#findRepetitions(window);
        if (repetitions.length > 0) {
            audit.findings.push({
                type: 'repetitive-reasoning',
                patterns: repetitions,
            });
            audit.score -= repetitions.length * 0.05;
        }

        // Check for oscillating decisions
        const oscillations = this.#findOscillations(window);
        if (oscillations.length > 0) {
            audit.findings.push({
                type: 'oscillating-decisions',
                count: oscillations.length,
            });
            audit.score -= oscillations.length * 0.15;
            this.#stats.unstableReasoningEvents++;
        }

        audit.score = Math.max(0, Math.min(1, audit.score));
        audit.status = audit.score > 0.7 ? 'healthy' : audit.score > 0.4 ? 'concerning' : 'unstable';

        this.#audits.push(audit);
        if (this.#audits.length > this.#config.maxAudits) {
            this.#audits = this.#audits.slice(-this.#config.maxAudits);
        }

        this.emit('audit:completed', audit);

        if (audit.status === 'unstable') {
            this.emit('reasoning:unstable', audit);
        }

        return audit;
    }

    /**
     * Check if a proposed decision contradicts recent reasoning.
     */
    checkConsistency(decision) {
        const recentSameType = this.#reasoningLog
            .filter(r => r.type === decision.type)
            .slice(-10);

        for (const past of recentSameType) {
            if (this.#isContradiction(past, decision)) {
                const contradiction = {
                    id: randomUUID(),
                    current: decision,
                    contradicts: past,
                    detectedAt: Date.now(),
                };
                this.#contradictions.push(contradiction);
                this.#stats.contradictionsDetected++;
                this.emit('contradiction:detected', contradiction);
                return { consistent: false, contradiction };
            }
        }

        return { consistent: true };
    }

    /**
     * Get reasoning health score.
     */
    getHealthScore() {
        if (this.#audits.length === 0) return 1.0;
        const recent = this.#audits.slice(-5);
        return recent.reduce((sum, a) => sum + a.score, 0) / recent.length;
    }

    /**
     * Get audit history.
     */
    getAudits(limit = 20) {
        return this.#audits.slice(-limit);
    }

    /**
     * Get detected contradictions.
     */
    getContradictions(limit = 20) {
        return this.#contradictions.slice(-limit);
    }

    /**
     * Get detected failure loops.
     */
    getFailureLoops() {
        return [...this.#failureLoops];
    }

    getStats() {
        return { ...this.#stats, healthScore: this.getHealthScore() };
    }

    // --- Internal ---

    #detectFailureLoop(record) {
        const window = this.#reasoningLog.slice(-this.#config.loopDetectionWindow);
        const sameType = window.filter(r => r.type === record.type && r.output === record.output);

        if (sameType.length >= 3) {
            const loop = {
                id: randomUUID(),
                type: record.type,
                repeatedOutput: record.output,
                occurrences: sameType.length,
                detectedAt: Date.now(),
            };
            this.#failureLoops.push(loop);
            this.#stats.failureLoopsDetected++;
            this.emit('failure-loop:detected', loop);

            if (this.#failureLoops.length > 50) {
                this.#failureLoops = this.#failureLoops.slice(-50);
            }
        }
    }

    #findContradictions(window) {
        const contradictions = [];
        for (let i = 0; i < window.length - 1; i++) {
            for (let j = i + 1; j < window.length; j++) {
                if (this.#isContradiction(window[i], window[j])) {
                    contradictions.push({ a: window[i].id, b: window[j].id });
                }
            }
        }
        return contradictions;
    }

    #isContradiction(a, b) {
        if (a.type !== b.type) return false;
        if (JSON.stringify(a.input) === JSON.stringify(b.input) && a.output !== b.output) {
            return true;
        }
        return false;
    }

    #findRepetitions(window) {
        const outputCounts = new Map();
        for (const record of window) {
            const key = `${record.type}:${JSON.stringify(record.output)}`;
            outputCounts.set(key, (outputCounts.get(key) || 0) + 1);
        }

        const repetitions = [];
        for (const [key, count] of outputCounts) {
            if (count >= 3) {
                repetitions.push({ pattern: key, count });
            }
        }
        return repetitions;
    }

    #findOscillations(window) {
        const oscillations = [];
        const byType = new Map();

        for (const record of window) {
            if (!byType.has(record.type)) byType.set(record.type, []);
            byType.get(record.type).push(record.output);
        }

        for (const [type, outputs] of byType) {
            if (outputs.length < 4) continue;
            let flips = 0;
            for (let i = 2; i < outputs.length; i++) {
                if (outputs[i] === outputs[i - 2] && outputs[i] !== outputs[i - 1]) {
                    flips++;
                }
            }
            if (flips >= 2) {
                oscillations.push({ type, flips });
            }
        }

        return oscillations;
    }
}
