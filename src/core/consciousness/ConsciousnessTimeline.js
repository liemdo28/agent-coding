/**
 * ConsciousnessTimeline.js — Evolution of Consciousness
 *
 * Tracks:
 * - Reasoning evolution
 * - Architecture evolution
 * - Governance evolution
 * - Optimization evolution
 *
 * A chronological record of how the civilization's consciousness has evolved.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ConsciousnessTimeline extends EventEmitter {
    #config;
    #events = [];
    #milestones = [];
    #phases = [];
    #currentPhase = null;
    #stats = {
        eventsRecorded: 0,
        milestonesReached: 0,
        phasesCompleted: 0,
        totalDuration: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxEvents: config.maxEvents || 2000,
            maxMilestones: config.maxMilestones || 100,
            categories: config.categories || [
                'reasoning',
                'architecture',
                'governance',
                'optimization',
                'consciousness',
                'stability',
            ],
            ...config,
        };

        this.#startPhase('awakening', 'Initial consciousness phase');
    }

    /**
     * Record a consciousness event.
     */
    record(event) {
        const record = {
            id: randomUUID(),
            category: event.category || 'general',
            type: event.type,
            description: event.description,
            significance: event.significance || 'normal',
            data: event.data || {},
            phase: this.#currentPhase?.name,
            timestamp: Date.now(),
        };

        this.#events.push(record);
        this.#stats.eventsRecorded++;

        if (this.#events.length > this.#config.maxEvents) {
            this.#events = this.#events.slice(-this.#config.maxEvents);
        }

        if (record.significance === 'milestone') {
            this.#recordMilestone(record);
        }

        this.emit('event:recorded', record);
        return record;
    }

    /**
     * Mark a milestone in consciousness evolution.
     */
    markMilestone(milestone) {
        const record = {
            id: randomUUID(),
            title: milestone.title,
            category: milestone.category,
            description: milestone.description,
            impact: milestone.impact || 'medium',
            phase: this.#currentPhase?.name,
            timestamp: Date.now(),
        };

        this.#milestones.push(record);
        this.#stats.milestonesReached++;

        if (this.#milestones.length > this.#config.maxMilestones) {
            this.#milestones = this.#milestones.slice(-this.#config.maxMilestones);
        }

        this.emit('milestone:reached', record);
        return record;
    }

    /**
     * Transition to a new consciousness phase.
     */
    transitionPhase(name, description) {
        if (this.#currentPhase) {
            this.#currentPhase.endedAt = Date.now();
            this.#currentPhase.duration = this.#currentPhase.endedAt - this.#currentPhase.startedAt;
            this.#phases.push(this.#currentPhase);
            this.#stats.phasesCompleted++;
        }

        this.#startPhase(name, description);
        this.emit('phase:transitioned', this.#currentPhase);
        return this.#currentPhase;
    }

    /**
     * Get timeline events.
     */
    getEvents(options = {}) {
        let results = [...this.#events];

        if (options.category) {
            results = results.filter(e => e.category === options.category);
        }
        if (options.significance) {
            results = results.filter(e => e.significance === options.significance);
        }
        if (options.since) {
            results = results.filter(e => e.timestamp >= options.since);
        }

        return results.slice(-(options.limit || 50));
    }

    /**
     * Get milestones.
     */
    getMilestones(limit = 20) {
        return this.#milestones.slice(-limit);
    }

    /**
     * Get phase history.
     */
    getPhases() {
        return [...this.#phases, this.#currentPhase].filter(Boolean);
    }

    /**
     * Get current phase.
     */
    getCurrentPhase() {
        return this.#currentPhase ? { ...this.#currentPhase } : null;
    }

    /**
     * Get evolution summary by category.
     */
    getEvolutionSummary() {
        const summary = {};
        for (const category of this.#config.categories) {
            const events = this.#events.filter(e => e.category === category);
            summary[category] = {
                totalEvents: events.length,
                recentEvents: events.slice(-5).length,
                lastEvent: events[events.length - 1]?.timestamp || null,
            };
        }
        return summary;
    }

    getStats() {
        return {
            ...this.#stats,
            currentPhase: this.#currentPhase?.name,
            totalEvents: this.#events.length,
            totalMilestones: this.#milestones.length,
        };
    }

    // --- Internal ---

    #startPhase(name, description) {
        this.#currentPhase = {
            id: randomUUID(),
            name,
            description,
            startedAt: Date.now(),
            endedAt: null,
            duration: null,
        };
    }

    #recordMilestone(event) {
        this.markMilestone({
            title: event.description,
            category: event.category,
            description: `Auto-milestone from significant event`,
            impact: 'medium',
        });
    }
}
