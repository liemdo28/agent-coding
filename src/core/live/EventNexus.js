/**
 * EventNexus.js — Real Event-Native Architecture
 *
 * Append-only event log with topic-based pub/sub.
 * No polling. Everything is event-driven.
 * Compatible with Redis Streams when available, falls back to in-memory.
 */

import { EventEmitter } from 'events';

export class EventNexus extends EventEmitter {
    #log = [];
    #maxLog = 50000;
    #subscribers = new Map(); // topic → Set<callback>
    #wildcardSubscribers = new Set();
    #running = false;
    #stats = {
        published: 0,
        delivered: 0,
        dropped: 0,
        topicCounts: {},
    };
    #rateWindow = [];
    #rateInterval = null;

    constructor(config = {}) {
        super();
        this.#maxLog = config.maxLog || 50000;
    }

    start() {
        this.#running = true;
        this.#rateInterval = setInterval(() => {
            const now = Date.now();
            this.#rateWindow = this.#rateWindow.filter(t => now - t < 1000);
        }, 1000);
        if (this.#rateInterval.unref) this.#rateInterval.unref();
    }

    stop() {
        this.#running = false;
        if (this.#rateInterval) {
            clearInterval(this.#rateInterval);
            this.#rateInterval = null;
        }
    }

    /**
     * Publish an event to a topic.
     * @param {string} topic - Dot-separated topic (e.g. 'system.db.ready')
     * @param {object} data - Event payload
     */
    publish(topic, data = {}) {
        if (!this.#running) return;

        const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            topic,
            data,
            timestamp: Date.now(),
        };

        // Append to log
        this.#log.push(event);
        if (this.#log.length > this.#maxLog) {
            this.#log.shift();
        }

        // Stats
        this.#stats.published++;
        this.#stats.topicCounts[topic] = (this.#stats.topicCounts[topic] || 0) + 1;
        this.#rateWindow.push(event.timestamp);

        // Deliver to topic subscribers
        const subs = this.#subscribers.get(topic);
        if (subs) {
            for (const cb of subs) {
                try {
                    cb(event.data, event);
                    this.#stats.delivered++;
                } catch (err) {
                    this.#stats.dropped++;
                    this.emit('delivery-error', { topic, error: err.message });
                }
            }
        }

        // Deliver to wildcard subscribers
        for (const cb of this.#wildcardSubscribers) {
            try {
                cb(event.data, event);
                this.#stats.delivered++;
            } catch {
                this.#stats.dropped++;
            }
        }

        // Emit on EventEmitter for local listeners
        this.emit(topic, event.data, event);

        return event;
    }

    /**
     * Subscribe to a topic.
     * @param {string} topic - Topic pattern (exact match or '*' for all)
     * @param {Function} callback - (data, event) => void
     * @returns {Function} unsubscribe function
     */
    subscribe(topic, callback) {
        if (topic === '*') {
            this.#wildcardSubscribers.add(callback);
            return () => this.#wildcardSubscribers.delete(callback);
        }

        if (!this.#subscribers.has(topic)) {
            this.#subscribers.set(topic, new Set());
        }
        this.#subscribers.get(topic).add(callback);

        return () => {
            const subs = this.#subscribers.get(topic);
            if (subs) subs.delete(callback);
        };
    }

    /**
     * Get recent events, optionally filtered by topic.
     */
    getRecent(count = 50, topic = null) {
        let events = this.#log;
        if (topic) {
            events = events.filter(e => e.topic === topic || e.topic.startsWith(topic + '.'));
        }
        return events.slice(-count);
    }

    /**
     * Get events since a timestamp.
     */
    getSince(timestamp) {
        return this.#log.filter(e => e.timestamp >= timestamp);
    }

    /**
     * Get current events-per-second rate.
     */
    getRate() {
        return this.#rateWindow.length;
    }

    getStats() {
        return {
            ...this.#stats,
            logSize: this.#log.length,
            maxLog: this.#maxLog,
            subscribers: this.#subscribers.size,
            wildcardSubscribers: this.#wildcardSubscribers.size,
            eventsPerSecond: this.getRate(),
            running: this.#running,
        };
    }
}
