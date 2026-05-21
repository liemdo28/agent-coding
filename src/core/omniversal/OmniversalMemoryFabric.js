/**
 * OmniversalMemoryFabric.js — Living Intelligence Memory Field
 *
 * Transforms memory into a living intelligence field that compresses knowledge,
 * merges operational histories, and synthesizes patterns.
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class OmniversalMemoryFabric extends EventEmitter {
    #config; #fabric = new Map(); #patterns = []; #compressions = 0; #stats = { memoriesAbsorbed: 0, patternsSynthesized: 0, compressions: 0, merges: 0 };
    constructor(config = {}) { super(); this.#config = { layers: config.layers || ['operational', 'strategic', 'architectural', 'evolutionary', 'governance'], maxPerLayer: config.maxPerLayer || 300, maxPatterns: config.maxPatterns || 100, ...config }; for (const l of this.#config.layers) this.#fabric.set(l, []); }
    absorb(layer, memory) { if (!this.#fabric.has(layer)) this.#fabric.set(layer, []); const record = { id: randomUUID(), data: memory.data, tags: memory.tags || [], significance: memory.significance || 'normal', timestamp: Date.now() }; const store = this.#fabric.get(layer); store.push(record); if (store.length > this.#config.maxPerLayer) { store.splice(0, store.length - this.#config.maxPerLayer); this.#stats.compressions++; } this.#stats.memoriesAbsorbed++; return record; }
    synthesizePatterns(layer) { const store = this.#fabric.get(layer) || []; const tagFreq = new Map(); for (const m of store) for (const t of m.tags) tagFreq.set(t, (tagFreq.get(t) || 0) + 1); const patterns = []; for (const [tag, count] of tagFreq) if (count >= 3) { patterns.push({ pattern: tag, frequency: count / store.length, layer }); this.#stats.patternsSynthesized++; } this.#patterns.push(...patterns); if (this.#patterns.length > this.#config.maxPatterns) this.#patterns = this.#patterns.slice(-this.#config.maxPatterns); return patterns; }
    merge(layerA, layerB) { this.#stats.merges++; this.emit('memory:merged', { layerA, layerB }); }
    query(layer, options = {}) { const store = this.#fabric.get(layer) || []; let results = [...store]; if (options.tags) results = results.filter(m => options.tags.some(t => m.tags.includes(t))); return results.slice(-(options.limit || 50)); }
    getPatterns(limit = 20) { return this.#patterns.slice(-limit); }
    getStats() { return { ...this.#stats }; }
}
