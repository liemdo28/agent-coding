/**
 * UnifiedCivilizationMemory.js — Civilization Memory Core
 *
 * Persists:
 * - Governance history
 * - Optimization evolution
 * - Architecture evolution
 * - Strategic evolution
 *
 * The collective memory of the civilization — enables learning from the past.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class UnifiedCivilizationMemory extends EventEmitter {
    #config;
    #stores = new Map();
    #timeline = [];
    #epochs = [];
    #currentEpoch = null;
    #stats = {
        memoriesStored: 0,
        memoriesRetrieved: 0,
        epochsCompleted: 0,
        patternsDetected: 0,
        totalSize: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxMemoriesPerStore: config.maxMemoriesPerStore || 1000,
            maxTimelineSize: config.maxTimelineSize || 5000,
            maxEpochs: config.maxEpochs || 50,
            stores: config.stores || [
                'governance',
                'optimization',
                'architecture',
                'strategic',
                'incidents',
                'decisions',
                'evolution',
            ],
            ...config,
        };

        this.#initializeStores();
        this.#startEpoch();
    }

    /**
     * Store a memory in a specific category.
     */
    store(category, memory) {
        if (!this.#stores.has(category)) {
            this.#stores.set(category, []);
        }

        const record = {
            id: randomUUID(),
            category,
            data: memory.data,
            context: memory.context || {},
            tags: memory.tags || [],
            significance: memory.significance || 'normal',
            timestamp: Date.now(),
            epoch: this.#currentEpoch?.id,
        };

        const store = this.#stores.get(category);
        store.push(record);
        this.#stats.memoriesStored++;
        this.#stats.totalSize++;

        // Add to timeline
        this.#timeline.push({ id: record.id, category, significance: record.significance, timestamp: record.timestamp });

        // Trim
        if (store.length > this.#config.maxMemoriesPerStore) {
            store.splice(0, store.length - this.#config.maxMemoriesPerStore);
        }
        if (this.#timeline.length > this.#config.maxTimelineSize) {
            this.#timeline = this.#timeline.slice(-this.#config.maxTimelineSize);
        }

        this.emit('memory:stored', { id: record.id, category });
        return record;
    }

    /**
     * Retrieve memories by category.
     */
    retrieve(category, options = {}) {
        this.#stats.memoriesRetrieved++;
        const store = this.#stores.get(category) || [];

        let results = [...store];

        if (options.tags) {
            results = results.filter(m => options.tags.some(t => m.tags.includes(t)));
        }
        if (options.significance) {
            results = results.filter(m => m.significance === options.significance);
        }
        if (options.since) {
            results = results.filter(m => m.timestamp >= options.since);
        }
        if (options.limit) {
            results = results.slice(-options.limit);
        }

        return results;
    }

    /**
     * Search across all memory stores.
     */
    search(query) {
        this.#stats.memoriesRetrieved++;
        const results = [];

        for (const [category, store] of this.#stores) {
            for (const memory of store) {
                if (this.#matchesQuery(memory, query)) {
                    results.push({ ...memory, category });
                }
            }
        }

        return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, query.limit || 50);
    }

    /**
     * Get the civilization timeline.
     */
    getTimeline(limit = 100) {
        return this.#timeline.slice(-limit);
    }

    /**
     * Start a new epoch — marks a significant phase in civilization evolution.
     */
    startNewEpoch(name, description) {
        if (this.#currentEpoch) {
            this.#currentEpoch.endedAt = Date.now();
            this.#currentEpoch.status = 'completed';
            this.#epochs.push(this.#currentEpoch);
            this.#stats.epochsCompleted++;

            if (this.#epochs.length > this.#config.maxEpochs) {
                this.#epochs = this.#epochs.slice(-this.#config.maxEpochs);
            }
        }

        this.#currentEpoch = {
            id: randomUUID(),
            name,
            description,
            startedAt: Date.now(),
            status: 'active',
            memoriesCount: 0,
        };

        this.emit('epoch:started', this.#currentEpoch);
        return this.#currentEpoch;
    }

    /**
     * Detect patterns in memory — finds recurring themes.
     */
    detectPatterns(category, windowSize = 20) {
        const store = this.#stores.get(category) || [];
        const recent = store.slice(-windowSize);

        if (recent.length < 5) return [];

        const tagFrequency = new Map();
        for (const memory of recent) {
            for (const tag of memory.tags) {
                tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
            }
        }

        const patterns = [];
        for (const [tag, count] of tagFrequency) {
            if (count >= windowSize * 0.3) {
                patterns.push({ pattern: tag, frequency: count / recent.length, category });
            }
        }

        this.#stats.patternsDetected += patterns.length;
        return patterns;
    }

    /**
     * Get epoch history.
     */
    getEpochs() {
        return [...this.#epochs, this.#currentEpoch].filter(Boolean);
    }

    /**
     * Get memory summary.
     */
    getSummary() {
        const storeSizes = {};
        for (const [category, store] of this.#stores) {
            storeSizes[category] = store.length;
        }

        return {
            stores: storeSizes,
            timelineSize: this.#timeline.length,
            currentEpoch: this.#currentEpoch?.name || null,
            epochsCompleted: this.#stats.epochsCompleted,
            totalMemories: this.#stats.totalSize,
        };
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #initializeStores() {
        for (const store of this.#config.stores) {
            this.#stores.set(store, []);
        }
    }

    #startEpoch() {
        this.#currentEpoch = {
            id: randomUUID(),
            name: 'genesis',
            description: 'Initial civilization epoch',
            startedAt: Date.now(),
            status: 'active',
            memoriesCount: 0,
        };
    }

    #matchesQuery(memory, query) {
        if (query.tags && !query.tags.some(t => memory.tags.includes(t))) return false;
        if (query.significance && memory.significance !== query.significance) return false;
        if (query.since && memory.timestamp < query.since) return false;
        if (query.text) {
            const text = JSON.stringify(memory.data).toLowerCase();
            if (!text.includes(query.text.toLowerCase())) return false;
        }
        return true;
    }
}
