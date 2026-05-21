/**
 * StrategicContinuityEngine.js — Long-Term Strategic Persistence
 *
 * Persists and manages:
 * - Architecture roadmap
 * - Infrastructure roadmap
 * - Technical debt roadmap
 * - Organizational roadmap
 *
 * Ensures strategic continuity across system restarts, evolution cycles,
 * and governance transitions.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class StrategicContinuityEngine extends EventEmitter {
    #config;
    #roadmaps = new Map();
    #milestones = [];
    #strategicDecisions = [];
    #continuitySnapshots = [];
    #stats = {
        roadmapsManaged: 0,
        milestonesTracked: 0,
        decisionsRecorded: 0,
        snapshotsTaken: 0,
        driftDetected: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            snapshotInterval: config.snapshotInterval || 3600000,
            maxSnapshots: config.maxSnapshots || 100,
            driftThreshold: config.driftThreshold || 0.25,
            roadmapCategories: config.roadmapCategories || [
                'architecture',
                'infrastructure',
                'technical-debt',
                'organizational',
                'security',
                'performance',
            ],
            ...config,
        };

        this.#initializeRoadmaps();
    }

    /**
     * Add or update a roadmap entry.
     */
    updateRoadmap(category, entry) {
        if (!this.#roadmaps.has(category)) {
            this.#roadmaps.set(category, []);
        }

        const roadmap = this.#roadmaps.get(category);
        const existing = roadmap.find(e => e.id === entry.id);

        if (existing) {
            Object.assign(existing, entry, { updatedAt: Date.now() });
            this.emit('roadmap:updated', { category, entry: existing });
        } else {
            const newEntry = {
                id: entry.id || randomUUID(),
                title: entry.title,
                description: entry.description,
                priority: entry.priority || 'medium',
                status: entry.status || 'planned',
                horizon: entry.horizon || '1-month',
                dependencies: entry.dependencies || [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            roadmap.push(newEntry);
            this.#stats.roadmapsManaged++;
            this.emit('roadmap:entry-added', { category, entry: newEntry });
        }
    }

    /**
     * Get roadmap for a category.
     */
    getRoadmap(category) {
        return this.#roadmaps.get(category) || [];
    }

    /**
     * Get all roadmaps.
     */
    getAllRoadmaps() {
        const result = {};
        for (const [category, entries] of this.#roadmaps) {
            result[category] = [...entries];
        }
        return result;
    }

    /**
     * Record a strategic decision.
     */
    recordDecision(decision) {
        const record = {
            id: randomUUID(),
            title: decision.title,
            rationale: decision.rationale,
            impact: decision.impact || [],
            alternatives: decision.alternatives || [],
            category: decision.category,
            decidedAt: Date.now(),
            status: 'active',
        };
        this.#strategicDecisions.push(record);
        this.#stats.decisionsRecorded++;
        this.emit('decision:recorded', record);
        return record;
    }

    /**
     * Track a milestone.
     */
    trackMilestone(milestone) {
        const record = {
            id: randomUUID(),
            title: milestone.title,
            category: milestone.category,
            targetDate: milestone.targetDate,
            status: milestone.status || 'pending',
            progress: milestone.progress || 0,
            blockers: milestone.blockers || [],
            createdAt: Date.now(),
        };
        this.#milestones.push(record);
        this.#stats.milestonesTracked++;
        this.emit('milestone:tracked', record);
        return record;
    }

    /**
     * Update milestone progress.
     */
    updateMilestone(id, updates) {
        const milestone = this.#milestones.find(m => m.id === id);
        if (milestone) {
            Object.assign(milestone, updates, { updatedAt: Date.now() });
            if (milestone.progress >= 100) milestone.status = 'completed';
            this.emit('milestone:updated', milestone);
        }
        return milestone;
    }

    /**
     * Take a continuity snapshot — captures current strategic state.
     */
    takeSnapshot() {
        const snapshot = {
            id: randomUUID(),
            timestamp: Date.now(),
            roadmaps: this.getAllRoadmaps(),
            milestones: [...this.#milestones],
            decisions: this.#strategicDecisions.slice(-50),
            stats: { ...this.#stats },
        };

        this.#continuitySnapshots.push(snapshot);
        this.#stats.snapshotsTaken++;

        if (this.#continuitySnapshots.length > this.#config.maxSnapshots) {
            this.#continuitySnapshots = this.#continuitySnapshots.slice(-this.#config.maxSnapshots);
        }

        this.emit('snapshot:taken', { id: snapshot.id });
        return snapshot;
    }

    /**
     * Detect strategic drift — compare current state to last snapshot.
     */
    detectDrift() {
        if (this.#continuitySnapshots.length < 2) return { drifted: false, score: 0 };

        const latest = this.#continuitySnapshots[this.#continuitySnapshots.length - 1];
        const previous = this.#continuitySnapshots[this.#continuitySnapshots.length - 2];

        let driftScore = 0;
        const driftFactors = [];

        // Check roadmap changes
        for (const category of this.#config.roadmapCategories) {
            const currentEntries = (latest.roadmaps[category] || []).length;
            const previousEntries = (previous.roadmaps[category] || []).length;
            if (Math.abs(currentEntries - previousEntries) > 3) {
                driftScore += 0.1;
                driftFactors.push(`${category} roadmap changed significantly`);
            }
        }

        // Check milestone completion rate
        const completedNow = latest.milestones.filter(m => m.status === 'completed').length;
        const completedBefore = previous.milestones.filter(m => m.status === 'completed').length;
        if (completedNow < completedBefore) {
            driftScore += 0.2;
            driftFactors.push('Milestone regression detected');
        }

        const drifted = driftScore >= this.#config.driftThreshold;
        if (drifted) {
            this.#stats.driftDetected++;
            this.emit('drift:detected', { score: driftScore, factors: driftFactors });
        }

        return { drifted, score: driftScore, factors: driftFactors };
    }

    /**
     * Get strategic summary.
     */
    getSummary() {
        const allMilestones = this.#milestones;
        return {
            roadmapCounts: Object.fromEntries(
                [...this.#roadmaps.entries()].map(([k, v]) => [k, v.length])
            ),
            milestones: {
                total: allMilestones.length,
                pending: allMilestones.filter(m => m.status === 'pending').length,
                inProgress: allMilestones.filter(m => m.status === 'in-progress').length,
                completed: allMilestones.filter(m => m.status === 'completed').length,
                blocked: allMilestones.filter(m => m.blockers.length > 0).length,
            },
            decisions: this.#strategicDecisions.length,
            snapshots: this.#continuitySnapshots.length,
        };
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #initializeRoadmaps() {
        for (const category of this.#config.roadmapCategories) {
            if (!this.#roadmaps.has(category)) {
                this.#roadmaps.set(category, []);
            }
        }
    }
}
