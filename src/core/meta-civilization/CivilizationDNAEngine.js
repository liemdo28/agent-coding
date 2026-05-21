/**
 * CivilizationDNAEngine.js — Civilization Genetic Code
 *
 * Persists:
 * - Governance DNA
 * - Optimization DNA
 * - Architecture DNA
 * - Strategic DNA
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class CivilizationDNAEngine extends EventEmitter {
    #config;
    #genome = new Map();
    #mutations = [];
    #stats = { genesRegistered: 0, mutationsApplied: 0, expressionsTriggered: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            strands: config.strands || ['governance', 'optimization', 'architecture', 'strategic', 'execution', 'evolution'],
            maxMutations: config.maxMutations || 100,
            ...config,
        };
        for (const strand of this.#config.strands) this.#genome.set(strand, []);
    }

    registerGene(strand, gene) {
        if (!this.#genome.has(strand)) this.#genome.set(strand, []);
        const record = { id: randomUUID(), name: gene.name, traits: gene.traits || {}, expression: gene.expression || 'active', registeredAt: Date.now() };
        this.#genome.get(strand).push(record);
        this.#stats.genesRegistered++;
        this.emit('gene:registered', { strand, gene: record });
        return record;
    }

    mutate(strand, geneName, mutation) {
        const genes = this.#genome.get(strand) || [];
        const gene = genes.find(g => g.name === geneName);
        if (gene) {
            Object.assign(gene.traits, mutation);
            gene.mutatedAt = Date.now();
            this.#mutations.push({ id: randomUUID(), strand, gene: geneName, mutation, timestamp: Date.now() });
            this.#stats.mutationsApplied++;
            if (this.#mutations.length > this.#config.maxMutations) this.#mutations = this.#mutations.slice(-this.#config.maxMutations);
            this.emit('gene:mutated', { strand, gene: geneName });
            return true;
        }
        return false;
    }

    express(strand) {
        this.#stats.expressionsTriggered++;
        return (this.#genome.get(strand) || []).filter(g => g.expression === 'active');
    }

    getGenome() { const r = {}; for (const [k, v] of this.#genome) r[k] = v; return r; }
    getStrand(strand) { return this.#genome.get(strand) || []; }
    getMutations(limit = 20) { return this.#mutations.slice(-limit); }
    getStats() { return { ...this.#stats }; }
}
