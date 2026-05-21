/**
 * ExecutionTimeline.js — Chronological Event Tracking
 *
 * Records and visualizes all system events chronologically:
 * - Builds, failures, patches, rollbacks
 * - Reasoning chains and decisions
 * - System state transitions
 *
 * Provides timeline queries and trend analysis.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ExecutionTimeline extends EventEmitter {
    #events = [];
    #maxEvents;
    #config;
    #stats = {
        totalEvents: 0,
        builds: 0,
        failures: 0,
        patches: 0,
        rollbacks: 0,
        recoveries: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = config;
        this.#maxEvents = config.maxEvents || 5000;
    }

    /**
     * Record a timeline event.
     * @param {object} event - { type, description, project?, metadata?, severity? }
     * @returns {object} The recorded event with id and timestamp
     */
    record(event) {
        const entry = {
            id: randomUUID(),
            timestamp: Date.now(),
            type: event.type,
            description: event.description,
            project: event.project || null,
            severity: event.severity || 'info',
            metadata: event.metadata || {},
            duration: event.duration || null,
            chainId: event.chainId || null,
        };

        this.#events.push(entry);
        this.#stats.totalEvents++;
        this.#updateTypeStats(entry.type);

        // Trim
        if (this.#events.length > this.#maxEvents) {
            this.#events = this.#events.slice(-this.#maxEvents);
        }

        this.emit('event', entry);
        return entry;
    }

    /**
     * Record a build event.
     */
    recordBuild(project, status, metadata = {}) {
        return this.record({
            type: 'build',
            description: `Build ${status}: ${project}`,
            project,
            severity: status === 'failed' ? 'error' : 'info',
            metadata: { status, ...metadata },
        });
    }

    /**
     * Record a failure event.
     */
    recordFailure(project, error, metadata = {}) {
        return this.record({
            type: 'failure',
            description: `Failure in ${project}: ${error}`,
            project,
            severity: 'error',
            metadata: { error, ...metadata },
        });
    }

    /**
     * Record a patch event.
     */
    recordPatch(project, description, metadata = {}) {
        return this.record({
            type: 'patch',
            description: `Patch applied: ${description}`,
            project,
            severity: 'info',
            metadata,
        });
    }

    /**
     * Record a rollback event.
     */
    recordRollback(project, reason, metadata = {}) {
        return this.record({
            type: 'rollback',
            description: `Rollback: ${reason}`,
            project,
            severity: 'warning',
            metadata: { reason, ...metadata },
        });
    }

    /**
     * Record a reasoning event.
     */
    recordReasoning(chainId, phase, description, metadata = {}) {
        return this.record({
            type: 'reasoning',
            description: `AI ${phase}: ${description}`,
            chainId,
            severity: 'info',
            metadata: { phase, ...metadata },
        });
    }

    /**
     * Query timeline events.
     * @param {object} query - { type?, project?, since?, until?, severity?, limit? }
     * @returns {object[]} Matching events, chronological order
     */
    query(query = {}) {
        let results = [...this.#events];

        if (query.type) results = results.filter(e => e.type === query.type);
        if (query.project) results = results.filter(e => e.project === query.project);
        if (query.severity) results = results.filter(e => e.severity === query.severity);
        if (query.chainId) results = results.filter(e => e.chainId === query.chainId);
        if (query.since) results = results.filter(e => e.timestamp >= query.since);
        if (query.until) results = results.filter(e => e.timestamp <= query.until);

        // Chronological order (oldest first)
        results.sort((a, b) => a.timestamp - b.timestamp);
        return results.slice(0, query.limit || 100);
    }

    /**
     * Get timeline for a specific project.
     */
    getProjectTimeline(project, limit = 50) {
        return this.query({ project, limit });
    }

    /**
     * Get recent events across all projects.
     */
    getRecent(limit = 30) {
        return this.#events.slice(-limit);
    }

    /**
     * Get events for a reasoning chain.
     */
    getReasoningChain(chainId) {
        return this.query({ chainId });
    }

    /**
     * Get trend analysis for a time window.
     * @param {number} windowMs - Time window in milliseconds
     * @returns {object} Trend data
     */
    getTrends(windowMs = 3600000) {
        const since = Date.now() - windowMs;
        const windowEvents = this.#events.filter(e => e.timestamp >= since);

        const byType = {};
        for (const event of windowEvents) {
            byType[event.type] = (byType[event.type] || 0) + 1;
        }

        const failures = windowEvents.filter(e => e.type === 'failure' || e.severity === 'error');
        const successes = windowEvents.filter(e => e.metadata?.status === 'success');

        return {
            window: windowMs,
            totalEvents: windowEvents.length,
            byType,
            failureRate: windowEvents.length > 0 ? failures.length / windowEvents.length : 0,
            successRate: windowEvents.length > 0 ? successes.length / windowEvents.length : 0,
            eventsPerMinute: windowEvents.length / (windowMs / 60000),
        };
    }

    /**
     * Format timeline as human-readable text.
     * @param {number} limit
     * @returns {string}
     */
    formatTimeline(limit = 20) {
        const events = this.#events.slice(-limit);
        return events.map(e => {
            const time = new Date(e.timestamp).toLocaleTimeString();
            const icon = this.#getIcon(e.type);
            return `${time} ${icon} ${e.description}`;
        }).join('\n');
    }

    #getIcon(type) {
        const icons = {
            build: '🔨',
            failure: '❌',
            patch: '🩹',
            rollback: '⏪',
            reasoning: '🧠',
            recovery: '✅',
            alert: '⚠️',
        };
        return icons[type] || '📌';
    }

    #updateTypeStats(type) {
        if (type in this.#stats) {
            this.#stats[type]++;
        }
    }

    getStats() {
        return { ...this.#stats, storedEvents: this.#events.length };
    }
}
