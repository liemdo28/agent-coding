/**
 * EventStreamCore.js — Append-Log Event Stream Architecture
 *
 * Everything is event-driven. No polling.
 * Implements a local append-log event stream (Redis Streams / NATS compatible interface).
 *
 * Events:
 * TASK_CREATED, BUILD_STARTED, BUILD_FAILED, PATCH_GENERATED,
 * QA_PASSED, QA_FAILED, ROLLBACK_TRIGGERED, WORKER_SPAWNED,
 * WORKER_CRASHED, PRESSURE_HIGH, SLA_BREACH, RECOVERY_STARTED
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class EventStreamCore extends EventEmitter {
    #log = [];
    #maxLog;
    #subscribers = new Map(); // topic → Set<callback>
    #wildcardSubscribers = new Set();
    #stats = {
        totalEvents: 0,
        eventsPerSecond: 0,
        topicCounts: {},
    };
    #rateWindow = [];
    #rateInterval = null;

    constructor(config = {}) {
        super();
        this.#maxLog = config.maxLog || 10000;
    }

    /**
     * Start the event stream.
     */
    start() {
        // Rate calculation interval
        this.#rateInterval = setInterval(() => {
            const now = Date.now();
            this.#rateWindow = this.#rateWindow.filter(t => now - t < 1000);
            this.#stats.eventsPerSecond = this.#rateWindow.length;
        }, 1000);
        if (this.#rateInterval.unref) this.#rateInterval.unref();
        this.emit('started');
    }

    /**
     * Stop the event stream.
     */
    stop() {
        if (this.#rateInterval) {
            clearInterval(this.#rateInterval);
            this.#rateInterval = null;
        }
        this.emit('stopped');
    }

    /**
     * Publish an event to the stream.
     * @param {string} topic - Event topic (e.g., 'TASK_CREATED', 'BUILD_FAILED')
     * @param {object} payload - Event data
     * @returns {object} The published event entry
     */
    publish(topic, payload = {}) {
        const event = {
            id: randomUUID(),
            topic,
            payload,
            timestamp: Date.now(),
            sequence: this.#log.length,
        };

        // Append to log
        this.#log.push(event);
        this.#stats.totalEvents++;
        this.#stats.topicCounts[topic] = (this.#stats.topicCounts[topic] || 0) + 1;
        this.#rateWindow.push(event.timestamp);

        // Trim log
        if (this.#log.length > this.#maxLog) {
            this.#log = this.#log.slice(-this.#maxLog);
        }

        // Notify topic subscribers
        const topicSubs = this.#subscribers.get(topic);
        if (topicSubs) {
            for (const cb of topicSubs) {
                try { cb(event); } catch { /* non-blocking */ }
            }
        }

        // Notify wildcard subscribers
        for (const cb of this.#wildcardSubscribers) {
            try { cb(event); } catch { /* non-blocking */ }
        }

        // Emit on EventEmitter for internal use
        this.emit('event', event);
        this.emit(topic, event);

        return event;
    }

    /**
     * Subscribe to a specific topic.
     * @param {string} topic
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(topic, callback) {
        if (!this.#subscribers.has(topic)) {
            this.#subscribers.set(topic, new Set());
        }
        this.#subscribers.get(topic).add(callback);

        return () => {
            this.#subscribers.get(topic)?.delete(callback);
        };
    }

    /**
     * Subscribe to ALL events (wildcard).
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribeAll(callback) {
        this.#wildcardSubscribers.add(callback);
        return () => this.#wildcardSubscribers.delete(callback);
    }

    /**
     * Subscribe to multiple topics.
     * @param {string[]} topics
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribeMany(topics, callback) {
        const unsubs = topics.map(t => this.subscribe(t, callback));
        return () => unsubs.forEach(u => u());
    }

    /**
     * Read events from the log (replay).
     * @param {object} options - { since?, topic?, limit? }
     * @returns {object[]} Events matching criteria
     */
    read(options = {}) {
        let events = [...this.#log];

        if (options.since) {
            events = events.filter(e => e.timestamp >= options.since);
        }
        if (options.topic) {
            events = events.filter(e => e.topic === options.topic);
        }
        if (options.afterSequence !== undefined) {
            events = events.filter(e => e.sequence > options.afterSequence);
        }

        return events.slice(0, options.limit || 100);
    }

    /**
     * Get the latest N events.
     */
    latest(count = 20) {
        return this.#log.slice(-count);
    }

    /**
     * Get events by topic.
     */
    byTopic(topic, limit = 50) {
        return this.#log.filter(e => e.topic === topic).slice(-limit);
    }

    /**
     * Get current stream position (for consumers to track).
     */
    getPosition() {
        return this.#log.length > 0 ? this.#log[this.#log.length - 1].sequence : -1;
    }

    /**
     * Create a consumer group that tracks position.
     * @param {string} groupName
     * @returns {object} Consumer group with read/ack methods
     */
    createConsumerGroup(groupName) {
        let position = -1;

        return {
            name: groupName,
            read: (count = 10) => {
                const events = this.#log.filter(e => e.sequence > position).slice(0, count);
                return events;
            },
            ack: (sequence) => {
                position = Math.max(position, sequence);
            },
            getPosition: () => position,
        };
    }

    getStats() {
        return {
            ...this.#stats,
            logSize: this.#log.length,
            subscribers: this.#subscribers.size,
            wildcardSubscribers: this.#wildcardSubscribers.size,
        };
    }
}
