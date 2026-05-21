/**
 * ObservabilityBus.js — Real-time event bus for runtime monitoring
 *
 * Provides: event recording, metrics, timeline, WebSocket-ready streaming
 */

import { EventEmitter } from 'events';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

export class ObservabilityBus extends EventEmitter {
    #config;
    #buffer = [];
    #metrics = new Map();
    #timeline = [];
    #storageDir;
    #flushTimer = null;

    constructor(config = {}) {
        super();
        this.#config = {
            bufferSize: config.bufferSize || 1000,
            flushInterval: config.flushInterval || 5_000,
            storageDir: config.storageDir || join(process.cwd(), '.super-agent-ai', 'telemetry'),
            ...config,
        };
        this.#storageDir = this.#config.storageDir;
        mkdirSync(this.#storageDir, { recursive: true });
        this.#startFlushing();
    }

    /**
     * Record an event.
     * @param {string} event - dot-notation event name
     * @param {object} data - event payload
     */
    record(event, data = {}) {
        const entry = {
            event,
            data,
            timestamp: Date.now(),
        };

        this.#buffer.push(entry);
        this.#timeline.push(entry);

        // Update metrics counter
        const count = this.#metrics.get(event) || 0;
        this.#metrics.set(event, count + 1);

        // Emit for real-time subscribers (WebSocket, UI)
        this.emit('event', entry);
        this.emit(event, data);

        // Trim buffer
        if (this.#buffer.length > this.#config.bufferSize) {
            this.#buffer = this.#buffer.slice(-Math.floor(this.#config.bufferSize / 2));
        }

        // Trim timeline
        if (this.#timeline.length > 5000) {
            this.#timeline = this.#timeline.slice(-2500);
        }
    }

    /**
     * Get recent events, optionally filtered.
     * @param {object} options - { event, limit, since }
     */
    getEvents(options = {}) {
        let events = this.#timeline;

        if (options.event) {
            events = events.filter(e => e.event === options.event);
        }
        if (options.since) {
            events = events.filter(e => e.timestamp >= options.since);
        }

        const limit = options.limit || 100;
        return events.slice(-limit);
    }

    /**
     * Get aggregated metrics.
     */
    getMetrics() {
        return Object.fromEntries(this.#metrics);
    }

    /**
     * Get execution timeline for UI rendering.
     * @param {number} limit
     */
    getTimeline(limit = 50) {
        return this.#timeline.slice(-limit);
    }

    /**
     * Subscribe to events via callback (for WebSocket streaming).
     * @param {function} callback
     * @returns {function} unsubscribe
     */
    subscribe(callback) {
        this.on('event', callback);
        return () => this.off('event', callback);
    }

    #startFlushing() {
        this.#flushTimer = setInterval(() => {
            this.#flushToDisk();
        }, this.#config.flushInterval);

        if (this.#flushTimer.unref) {
            this.#flushTimer.unref();
        }
    }

    #flushToDisk() {
        if (this.#buffer.length === 0) return;

        const logFile = join(this.#storageDir, `events-${new Date().toISOString().slice(0, 10)}.jsonl`);
        const lines = this.#buffer.map(e => JSON.stringify(e)).join('\n') + '\n';

        try {
            appendFileSync(logFile, lines);
        } catch {
            // Storage write failed — non-critical
        }

        this.#buffer = [];
    }

    stop() {
        if (this.#flushTimer) {
            clearInterval(this.#flushTimer);
            this.#flushTimer = null;
        }
        this.#flushToDisk();
    }
}
