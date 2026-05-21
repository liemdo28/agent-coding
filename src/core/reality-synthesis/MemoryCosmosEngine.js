/**
 * MemoryCosmosEngine.js — Unified Operational Memory
 *
 * Merges:
 * - Cognition memory
 * - Execution memory
 * - Governance memory
 * - Evolution memory
 * - Strategic memory
 *
 * Into one unified operational memory cosmos.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class MemoryCosmosEngine extends EventEmitter {
    #config;
    #cosmos = new Map();
    #crossReferences = [];
    #stats = { memoriesIngested: 0, crossReferencesCreated: 0, queriesServed: 0, cosmosSize: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            domains: config.domains || ['cognition', 'execution', 'governance', 'evolution', 'strategic', 'architecture'],
            maxPerDomain: config.maxPerDomain || 500,
            maxCrossReferences: config.maxCrossReferences || 200,
            ...config,
        };
        for (const domain of this.#config.domains) this.#cosmos.set(domain, []);
    }

    /**
     * Ingest a memory into the cosmos.
     */
    ingest(domain, memory) {
        if (!this.#cosmos.has(domain)) this.#cosmos.set(domain, []);
        const record = {
            id: randomUUID(), domain,
            data: memory.data, tags: memory.tags || [],
            significance: memory.significance || 'normal',
            connections: memory.connections || [],
            timestamp: Date.now(),
        };
        const store = this.#cosmos.get(domain);
        store.push(record);
        if (store.length > this.#config.maxPerDomain) store.splice(0, store.length - this.#config.maxPerDomain);
        this.#stats.memoriesIngested++;
        this.#stats.cosmosSize++;

        // Auto cross-reference
        if (record.connections.length > 0) {
            for (const conn of record.connections) {
                this.#crossReferences.push({ from: record.id, to: conn, domain, timestamp: Date.now() });
                this.#stats.crossReferencesCreated++;
            }
            if (this.#crossReferences.length > this.#config.maxCrossReferences) {
                this.#crossReferences = this.#crossReferences.slice(-this.#config.maxCrossReferences);
            }
        }

        this.emit('memory:ingested', { id: record.id, domain });
        return record;
    }

    /**
     * Query across all domains.
     */
    query(options = {}) {
        this.#stats.queriesServed++;
        let results = [];

        const domains = options.domains || [...this.#cosmos.keys()];
        for (const domain of domains) {
            const store = this.#cosmos.get(domain) || [];
            for (const mem of store) {
                if (options.tags && !options.tags.some(t => mem.tags.includes(t))) continue;
                if (options.significance && mem.significance !== options.significance) continue;
                if (options.since && mem.timestamp < options.since) continue;
                results.push(mem);
            }
        }

        results.sort((a, b) => b.timestamp - a.timestamp);
        return results.slice(0, options.limit || 50);
    }

    /**
     * Get cross-domain connections for a memory.
     */
    getConnections(memoryId) {
        return this.#crossReferences.filter(r => r.from === memoryId || r.to === memoryId);
    }

    /**
     * Get cosmos summary.
     */
    getSummary() {
        const sizes = {};
        for (const [domain, store] of this.#cosmos) sizes[domain] = store.length;
        return { sizes, totalMemories: this.#stats.cosmosSize, crossReferences: this.#crossReferences.length };
    }

    getStats() { return { ...this.#stats }; }
}
