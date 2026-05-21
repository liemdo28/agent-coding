/**
 * CausalGraph.js — Causal Reasoning Engine
 *
 * AI understands cause-effect chains:
 * - dependency duplication → build slowdown → queue saturation → SLA degradation
 * - memory leak → worker crash → rollback storm → service outage
 *
 * Builds causal graphs from observed events and enables predictive reasoning.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CausalGraph extends EventEmitter {
    #nodes = new Map(); // cause/effect nodes
    #edges = []; // causal links
    #patterns = []; // known causal patterns
    #observations = []; // observed causal chains
    #config;
    #stats = {
        nodesCreated: 0,
        edgesCreated: 0,
        patternsRegistered: 0,
        chainsObserved: 0,
        predictionsGenerated: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxObservations: config.maxObservations || 500,
            ...config,
        };
        this.#registerBuiltinPatterns();
    }

    /**
     * Register a causal pattern (known cause-effect relationship).
     * @param {object} pattern - { cause, effect, probability, description }
     */
    registerPattern(pattern) {
        const entry = {
            id: randomUUID(),
            cause: pattern.cause,
            effect: pattern.effect,
            probability: pattern.probability || 0.7,
            description: pattern.description || '',
            observedCount: 0,
            registeredAt: Date.now(),
        };
        this.#patterns.push(entry);
        this.#stats.patternsRegistered++;

        // Also add as graph nodes/edges
        this.#ensureNode(pattern.cause);
        this.#ensureNode(pattern.effect);
        this.#addEdge(pattern.cause, pattern.effect, pattern.probability);

        return entry;
    }

    /**
     * Observe a causal event (something happened).
     * @param {string} event - Event type
     * @param {object} context - Additional context
     */
    observe(event, context = {}) {
        const observation = {
            id: randomUUID(),
            event,
            context,
            timestamp: Date.now(),
            predictedEffects: this.predict(event),
        };

        this.#observations.push(observation);
        this.#stats.chainsObserved++;

        // Trim observations
        if (this.#observations.length > this.#config.maxObservations) {
            this.#observations = this.#observations.slice(-this.#config.maxObservations);
        }

        // Update pattern observation counts
        for (const pattern of this.#patterns) {
            if (pattern.cause === event) {
                pattern.observedCount++;
            }
        }

        this.emit('observed', observation);
        return observation;
    }

    /**
     * Predict effects of a given cause.
     * @param {string} cause - The cause event
     * @param {number} depth - How deep to trace effects
     * @returns {object[]} Predicted effects with probabilities
     */
    predict(cause, depth = 3) {
        this.#stats.predictionsGenerated++;
        const predictions = [];
        const visited = new Set();

        this.#traceCausalChain(cause, 1.0, depth, predictions, visited);

        return predictions.sort((a, b) => b.probability - a.probability);
    }

    /**
     * Explain why something happened (trace backwards).
     * @param {string} effect - The observed effect
     * @returns {object[]} Possible causes with probabilities
     */
    explain(effect) {
        const causes = [];

        for (const edge of this.#edges) {
            if (edge.to === effect) {
                causes.push({
                    cause: edge.from,
                    probability: edge.probability,
                    description: this.#findPatternDescription(edge.from, effect),
                });
            }
        }

        // Also check recent observations for temporal correlation
        const recentEffects = this.#observations
            .filter(o => o.event === effect)
            .slice(-5);

        for (const obs of recentEffects) {
            // Look for events that happened shortly before
            const before = this.#observations.filter(o =>
                o.timestamp < obs.timestamp &&
                o.timestamp > obs.timestamp - 60000 &&
                o.event !== effect
            );
            for (const prior of before) {
                if (!causes.find(c => c.cause === prior.event)) {
                    causes.push({
                        cause: prior.event,
                        probability: 0.3, // Low confidence for temporal correlation
                        description: 'Temporal correlation observed',
                        temporal: true,
                    });
                }
            }
        }

        return causes.sort((a, b) => b.probability - a.probability);
    }

    /**
     * Get the full causal chain from a root cause.
     * @param {string} rootCause
     * @returns {object} Chain visualization
     */
    getChain(rootCause) {
        const chain = { root: rootCause, steps: [] };
        const visited = new Set();
        let current = [rootCause];

        while (current.length > 0 && chain.steps.length < 10) {
            const next = [];
            for (const node of current) {
                if (visited.has(node)) continue;
                visited.add(node);

                const effects = this.#edges
                    .filter(e => e.from === node)
                    .map(e => ({ effect: e.to, probability: e.probability }));

                if (effects.length > 0) {
                    chain.steps.push({ cause: node, effects });
                    next.push(...effects.map(e => e.effect));
                }
            }
            current = next;
        }

        return chain;
    }

    /**
     * Get all registered patterns.
     */
    getPatterns() {
        return [...this.#patterns];
    }

    /**
     * Get the graph structure for visualization.
     */
    getGraphData() {
        return {
            nodes: [...this.#nodes.values()],
            edges: [...this.#edges],
        };
    }

    // --- Internal ---

    #registerBuiltinPatterns() {
        const builtins = [
            { cause: 'dependency-duplication', effect: 'build-slowdown', probability: 0.8, description: 'Duplicated deps increase build time' },
            { cause: 'build-slowdown', effect: 'queue-saturation', probability: 0.6, description: 'Slow builds fill the queue' },
            { cause: 'queue-saturation', effect: 'sla-degradation', probability: 0.7, description: 'Saturated queue misses SLA targets' },
            { cause: 'memory-leak', effect: 'worker-crash', probability: 0.85, description: 'Memory leaks crash workers' },
            { cause: 'worker-crash', effect: 'rollback-storm', probability: 0.5, description: 'Crashed workers trigger rollbacks' },
            { cause: 'rollback-storm', effect: 'service-outage', probability: 0.4, description: 'Rollback storms can cause outages' },
            { cause: 'circular-dependency', effect: 'build-failure', probability: 0.9, description: 'Circular deps break builds' },
            { cause: 'outdated-dependency', effect: 'security-vulnerability', probability: 0.6, description: 'Old deps have known CVEs' },
            { cause: 'no-tests', effect: 'regression-bugs', probability: 0.7, description: 'No tests means regressions slip through' },
            { cause: 'god-service', effect: 'scaling-bottleneck', probability: 0.75, description: 'Monolithic services cannot scale independently' },
            { cause: 'missing-rate-limit', effect: 'ddos-vulnerability', probability: 0.8, description: 'No rate limiting enables abuse' },
            { cause: 'no-monitoring', effect: 'silent-failure', probability: 0.85, description: 'Without monitoring, failures go undetected' },
        ];

        for (const pattern of builtins) {
            this.registerPattern(pattern);
        }
    }

    #ensureNode(name) {
        if (!this.#nodes.has(name)) {
            this.#nodes.set(name, { id: name, name, createdAt: Date.now() });
            this.#stats.nodesCreated++;
        }
    }

    #addEdge(from, to, probability) {
        // Avoid duplicates
        if (!this.#edges.find(e => e.from === from && e.to === to)) {
            this.#edges.push({ from, to, probability });
            this.#stats.edgesCreated++;
        }
    }

    #traceCausalChain(cause, currentProb, depth, predictions, visited) {
        if (depth <= 0 || visited.has(cause)) return;
        visited.add(cause);

        const effects = this.#edges.filter(e => e.from === cause);
        for (const edge of effects) {
            const combinedProb = currentProb * edge.probability;
            if (combinedProb < 0.05) continue; // Too unlikely

            predictions.push({
                effect: edge.to,
                probability: Math.round(combinedProb * 100) / 100,
                depth: visited.size,
                chain: [...visited, edge.to],
            });

            this.#traceCausalChain(edge.to, combinedProb, depth - 1, predictions, new Set(visited));
        }
    }

    #findPatternDescription(cause, effect) {
        const pattern = this.#patterns.find(p => p.cause === cause && p.effect === effect);
        return pattern?.description || '';
    }

    getStats() {
        return { ...this.#stats, observations: this.#observations.length };
    }
}
