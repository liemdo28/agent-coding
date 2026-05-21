/**
 * CognitionMemory.js — Enhanced Memory with Episodic, Strategic, Organizational layers
 *
 * Extends the base MemoryEngine with cognition-specific memory types:
 * - Episodic: previous fixes, failures, specific events
 * - Strategic: successful workflows, best architectures, optimization patterns
 * - Organizational: project history, engineering evolution, team patterns
 *
 * This wraps the existing MemoryEngine and adds higher-level cognition memory.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CognitionMemory extends EventEmitter {
    #baseMemory;
    #episodic = [];
    #strategic = new Map();
    #organizational = new Map();
    #maxEpisodic;
    #stats = {
        episodicWrites: 0,
        strategicWrites: 0,
        organizationalWrites: 0,
        recalls: 0,
    };

    constructor(baseMemory, config = {}) {
        super();
        this.#baseMemory = baseMemory;
        this.#maxEpisodic = config.maxEpisodic || 1000;
    }

    /**
     * Initialize — load persisted cognition memory from base memory.
     */
    async initialize() {
        if (!this.#baseMemory) return;

        // Load episodic memory
        const episodic = await this.#baseMemory.getProjectMemory('_cognition', 'episodic');
        if (Array.isArray(episodic)) {
            this.#episodic = episodic;
        }

        // Load strategic memory
        const strategic = await this.#baseMemory.getProjectMemory('_cognition', 'strategic');
        if (strategic && typeof strategic === 'object') {
            for (const [k, v] of Object.entries(strategic)) {
                this.#strategic.set(k, v);
            }
        }

        // Load organizational memory
        const org = await this.#baseMemory.getProjectMemory('_cognition', 'organizational');
        if (org && typeof org === 'object') {
            for (const [k, v] of Object.entries(org)) {
                this.#organizational.set(k, v);
            }
        }
    }

    // --- EPISODIC MEMORY ---

    /**
     * Record an episode (a specific event with context).
     * @param {object} episode - { type, project, description, outcome, metadata }
     */
    async recordEpisode(episode) {
        const entry = {
            id: randomUUID(),
            timestamp: Date.now(),
            type: episode.type,
            project: episode.project,
            description: episode.description,
            outcome: episode.outcome, // 'success' | 'failure' | 'partial'
            metadata: episode.metadata || {},
            tags: episode.tags || [],
        };

        this.#episodic.push(entry);
        this.#stats.episodicWrites++;

        // Trim if over limit
        if (this.#episodic.length > this.#maxEpisodic) {
            this.#episodic = this.#episodic.slice(-this.#maxEpisodic);
        }

        this.emit('episode:recorded', entry);
        await this.#persist('episodic');
        return entry;
    }

    /**
     * Recall episodes matching criteria.
     * @param {object} query - { type?, project?, outcome?, limit? }
     * @returns {object[]} Matching episodes, most recent first
     */
    recallEpisodes(query = {}) {
        this.#stats.recalls++;
        let results = [...this.#episodic];

        if (query.type) results = results.filter(e => e.type === query.type);
        if (query.project) results = results.filter(e => e.project === query.project);
        if (query.outcome) results = results.filter(e => e.outcome === query.outcome);
        if (query.tags?.length) {
            results = results.filter(e => query.tags.some(t => e.tags.includes(t)));
        }

        results.sort((a, b) => b.timestamp - a.timestamp);
        return results.slice(0, query.limit || 20);
    }

    /**
     * Recall previous fixes for a specific error type.
     */
    recallFixes(errorType, project) {
        return this.recallEpisodes({
            type: 'fix',
            project,
            outcome: 'success',
            limit: 10,
        }).filter(e => e.metadata?.errorType === errorType);
    }

    /**
     * Recall previous failures for learning.
     */
    recallFailures(project, limit = 10) {
        return this.recallEpisodes({ project, outcome: 'failure', limit });
    }

    // --- STRATEGIC MEMORY ---

    /**
     * Store a strategic insight (successful workflow, architecture pattern, etc).
     * @param {string} key - Unique identifier for this strategy
     * @param {object} strategy - { description, approach, confidence, applicability }
     */
    async recordStrategy(key, strategy) {
        const entry = {
            ...strategy,
            key,
            recordedAt: Date.now(),
            useCount: (this.#strategic.get(key)?.useCount || 0) + 1,
        };

        this.#strategic.set(key, entry);
        this.#stats.strategicWrites++;
        this.emit('strategy:recorded', entry);
        await this.#persist('strategic');
        return entry;
    }

    /**
     * Recall a strategy by key or find best matching strategies.
     * @param {string|object} query - Key string or { type?, tags?, minConfidence? }
     */
    recallStrategy(query) {
        this.#stats.recalls++;

        if (typeof query === 'string') {
            return this.#strategic.get(query) || null;
        }

        const results = [];
        for (const [, strategy] of this.#strategic) {
            let match = true;
            if (query.type && strategy.type !== query.type) match = false;
            if (query.minConfidence && (strategy.confidence || 0) < query.minConfidence) match = false;
            if (query.tags?.length && !query.tags.some(t => strategy.tags?.includes(t))) match = false;
            if (match) results.push(strategy);
        }

        return results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }

    /**
     * Get the best known workflow for a task type.
     */
    getBestWorkflow(taskType) {
        const strategies = this.recallStrategy({ type: 'workflow', tags: [taskType] });
        return strategies[0] || null;
    }

    /**
     * Get the best architecture pattern for a project type.
     */
    getBestArchitecture(projectType) {
        const strategies = this.recallStrategy({ type: 'architecture', tags: [projectType] });
        return strategies[0] || null;
    }

    // --- ORGANIZATIONAL MEMORY ---

    /**
     * Record organizational knowledge (project history, team patterns, evolution).
     * @param {string} domain - e.g., 'project-history', 'team-patterns', 'evolution'
     * @param {string} key
     * @param {object} data
     */
    async recordOrganizational(domain, key, data) {
        const fullKey = `${domain}:${key}`;
        const entry = {
            domain,
            key,
            data,
            updatedAt: Date.now(),
            version: (this.#organizational.get(fullKey)?.version || 0) + 1,
        };

        this.#organizational.set(fullKey, entry);
        this.#stats.organizationalWrites++;
        this.emit('organizational:recorded', entry);
        await this.#persist('organizational');
        return entry;
    }

    /**
     * Recall organizational knowledge.
     * @param {string} domain
     * @param {string} key
     */
    recallOrganizational(domain, key) {
        this.#stats.recalls++;
        if (key) {
            return this.#organizational.get(`${domain}:${key}`)?.data || null;
        }

        // Return all entries for a domain
        const results = [];
        for (const [k, v] of this.#organizational) {
            if (k.startsWith(`${domain}:`)) {
                results.push(v);
            }
        }
        return results;
    }

    /**
     * Get project evolution history.
     */
    getProjectHistory(project) {
        return this.recallOrganizational('project-history', project);
    }

    /**
     * Get engineering evolution timeline.
     */
    getEvolutionTimeline() {
        return this.recallOrganizational('evolution');
    }

    // --- Persistence ---

    async #persist(type) {
        if (!this.#baseMemory) return;

        try {
            switch (type) {
                case 'episodic':
                    await this.#baseMemory.setProjectMemory('_cognition', 'episodic', this.#episodic.slice(-200));
                    break;
                case 'strategic':
                    await this.#baseMemory.setProjectMemory('_cognition', 'strategic', Object.fromEntries(this.#strategic));
                    break;
                case 'organizational':
                    await this.#baseMemory.setProjectMemory('_cognition', 'organizational', Object.fromEntries(this.#organizational));
                    break;
            }
        } catch {
            // Persistence failure — non-critical
        }
    }

    async flush() {
        await this.#persist('episodic');
        await this.#persist('strategic');
        await this.#persist('organizational');
    }

    getStats() {
        return {
            ...this.#stats,
            episodicCount: this.#episodic.length,
            strategicCount: this.#strategic.size,
            organizationalCount: this.#organizational.size,
        };
    }
}
