/**
 * ReasoningStream.js — AI Reasoning UI Stream
 *
 * Provides realtime streaming of AI reasoning activity:
 * - "AI analyzing architecture..."
 * - "AI generating patch..."
 * - "AI validating rollback risk..."
 * - "AI predicting outcome..."
 *
 * Consumers (UI, CLI, WebSocket) subscribe to the stream
 * and receive formatted reasoning events in realtime.
 */

import { EventEmitter } from 'events';

export class ReasoningStream extends EventEmitter {
    #buffer = [];
    #maxBuffer;
    #subscribers = new Set();
    #active = false;
    #currentChain = null;
    #stats = {
        totalMessages: 0,
        chainsStreamed: 0,
    };

    constructor(config = {}) {
        super();
        this.#maxBuffer = config.maxBuffer || 200;
    }

    /**
     * Start streaming reasoning activity.
     */
    start() {
        this.#active = true;
        this.emit('stream:started');
    }

    /**
     * Stop streaming.
     */
    stop() {
        this.#active = false;
        this.emit('stream:stopped');
    }

    /**
     * Push a reasoning message to the stream.
     * @param {object} message - { phase, description, confidence?, chainId?, metadata? }
     */
    push(message) {
        if (!this.#active) return;

        const entry = {
            timestamp: Date.now(),
            phase: message.phase,
            description: message.description,
            confidence: message.confidence || null,
            chainId: message.chainId || this.#currentChain,
            icon: this.#getPhaseIcon(message.phase),
            formatted: this.#format(message),
            metadata: message.metadata || {},
        };

        this.#buffer.push(entry);
        this.#stats.totalMessages++;

        // Trim buffer
        if (this.#buffer.length > this.#maxBuffer) {
            this.#buffer = this.#buffer.slice(-this.#maxBuffer);
        }

        // Emit to all listeners
        this.emit('message', entry);

        // Notify subscribers
        for (const subscriber of this.#subscribers) {
            try {
                subscriber(entry);
            } catch {
                // Remove broken subscribers
                this.#subscribers.delete(subscriber);
            }
        }

        return entry;
    }

    /**
     * Subscribe to the reasoning stream.
     * @param {Function} callback - Called with each new message
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.#subscribers.add(callback);
        return () => this.#subscribers.delete(callback);
    }

    /**
     * Begin a new reasoning chain in the stream.
     */
    beginChain(chainId, problem) {
        this.#currentChain = chainId;
        this.#stats.chainsStreamed++;
        this.push({
            phase: 'start',
            description: `Beginning analysis: ${problem}`,
            chainId,
        });
    }

    /**
     * End the current reasoning chain.
     */
    endChain(chainId, result) {
        this.push({
            phase: 'complete',
            description: `Analysis complete — confidence: ${Math.round((result?.confidence?.overall || 0) * 100)}%`,
            chainId,
            confidence: result?.confidence?.overall,
        });
        this.#currentChain = null;
    }

    /**
     * Stream common reasoning phases.
     */
    streamObserve(description) {
        return this.push({ phase: 'observe', description: `Observing: ${description}` });
    }

    streamAnalyze(description) {
        return this.push({ phase: 'analyze', description: `Analyzing: ${description}` });
    }

    streamReason(description, confidence) {
        return this.push({ phase: 'reason', description: `Reasoning: ${description}`, confidence });
    }

    streamPlan(description) {
        return this.push({ phase: 'plan', description: `Planning: ${description}` });
    }

    streamSimulate(description) {
        return this.push({ phase: 'simulate', description: `Simulating: ${description}` });
    }

    streamExecute(description) {
        return this.push({ phase: 'execute', description: `Executing: ${description}` });
    }

    streamValidate(description, confidence) {
        return this.push({ phase: 'validate', description: `Validating: ${description}`, confidence });
    }

    streamReflect(description) {
        return this.push({ phase: 'reflect', description: `Reflecting: ${description}` });
    }

    streamLearn(description) {
        return this.push({ phase: 'learn', description: `Learning: ${description}` });
    }

    /**
     * Get recent stream buffer.
     * @param {number} count
     */
    getRecent(count = 30) {
        return this.#buffer.slice(-count);
    }

    /**
     * Get formatted stream output (for CLI display).
     * @param {number} count
     * @returns {string}
     */
    getFormattedOutput(count = 20) {
        return this.#buffer.slice(-count).map(e => e.formatted).join('\n');
    }

    /**
     * Connect to a ThinkingEngine to auto-stream its reasoning.
     * @param {import('./ThinkingEngine.js').ThinkingEngine} thinkingEngine
     */
    connectToThinkingEngine(thinkingEngine) {
        thinkingEngine.on('reasoning:start', ({ chainId, problem }) => {
            this.beginChain(chainId, problem);
        });

        thinkingEngine.on('reasoning:phase', ({ chainId, phase, result }) => {
            const desc = this.#describePhaseResult(phase, result);
            this.push({ phase, description: desc, chainId });
        });

        thinkingEngine.on('reasoning:complete', (result) => {
            this.endChain(result.chainId, result);
        });

        thinkingEngine.on('reasoning:error', ({ chainId, error }) => {
            this.push({ phase: 'error', description: `Error: ${error}`, chainId });
        });
    }

    // --- Internal ---

    #format(message) {
        const icon = this.#getPhaseIcon(message.phase);
        const conf = message.confidence ? ` [${Math.round(message.confidence * 100)}%]` : '';
        return `${icon} AI ${message.phase}: ${message.description}${conf}`;
    }

    #getPhaseIcon(phase) {
        const icons = {
            start: '🚀',
            observe: '👁️',
            analyze: '🔬',
            reason: '🧠',
            plan: '📋',
            simulate: '🎯',
            execute: '⚡',
            validate: '✅',
            reflect: '💭',
            learn: '📚',
            complete: '🏁',
            error: '❌',
        };
        return icons[phase] || '▶️';
    }

    #describePhaseResult(phase, result) {
        switch (phase) {
            case 'observe':
                return `Detected ${result?.signals?.length || 0} signal(s), type: ${result?.type || 'unknown'}`;
            case 'analyze':
                return `Complexity: ${result?.complexity || 'unknown'}, ${result?.relatedPatterns?.length || 0} pattern(s) found`;
            case 'reason':
                return `Generated ${result?.hypotheses || result?.children?.length || 0} hypothesis(es)`;
            case 'plan':
                return `${result?.steps?.length || 0} step(s) planned, approach: ${result?.approach || 'direct'}`;
            case 'simulate':
                return `Predicted outcome: ${result?.predictedOutcome || 'unknown'}, ${result?.risks?.length || 0} risk(s)`;
            case 'reflect':
                return `Confidence: ${result?.confidence?.overall || 'N/A'}, approach: ${result?.selectedApproach || 'N/A'}`;
            default:
                return JSON.stringify(result)?.slice(0, 80) || 'processing...';
        }
    }

    get isActive() { return this.#active; }
    get subscriberCount() { return this.#subscribers.size; }

    getStats() {
        return { ...this.#stats, bufferSize: this.#buffer.length, subscribers: this.#subscribers.size };
    }
}
