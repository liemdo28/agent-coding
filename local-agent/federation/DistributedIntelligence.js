/**
 * local-agent/federation/DistributedIntelligence.js
 * Phase 30: Distributed Intelligence Network
 */
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export class IntelligenceNode {
    constructor({ id, name, capabilities, metadata = {} }) {
        this.id = id || crypto.randomUUID();
        this.name = name;
        this.capabilities = capabilities;
        this.metadata = metadata;
        this.status = 'active';
        this.lastSync = Date.now();
    }
}

export class DistributedIntelligence extends EventEmitter {
    constructor({ workspaceRoot, config = {} } = {}) {
        super();
        this.root = workspaceRoot;
        this.config = { syncIntervalMs: 30000, consensusTimeout: 10000, ...config };
        this.nodeId = crypto.randomUUID();
        this.nodes = new Map();
        this.intelligence = new Map();
        this.knowledgeBase = new Map();
        this.metrics = { totalQueries: 0, successfulQueries: 0, avgLatencyMs: 0 };
    }

    registerNode(node) {
        const n = node instanceof IntelligenceNode ? node : new IntelligenceNode(node);
        this.nodes.set(n.id, n);
        this.emit('node-registered', n);
        return n;
    }

    unregisterNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) { this.nodes.delete(nodeId); this.emit('node-unregistered', node); return true; }
        return false;
    }

    query(topic, params = {}) {
        const start = Date.now();
        const query = { id: crypto.randomUUID(), topic, params, from: this.nodeId, timestamp: start };
        const results = [];
        this.nodes.forEach((node) => {
            if (node.capabilities.includes(topic)) {
                results.push({ node: node.id, result: this._queryNode(node, topic, params) });
            }
        });
        const latency = Date.now() - start;
        this._updateMetrics(true, latency);
        this.emit('query', query);
        return { query, results, latencyMs: latency };
    }

    _queryNode(node, topic, params) {
        const entry = this.knowledgeBase.get(`${node.id}:${topic}`);
        if (entry) return entry.value;
        return null;
    }

    share(topic, value, options = {}) {
        const entry = { id: crypto.randomUUID(), topic, value, from: this.nodeId, timestamp: Date.now(), ttl: options.ttl || null };
        this.knowledgeBase.set(`${this.nodeId}:${topic}`, entry);
        this.intelligence.set(topic, value);
        this.emit('knowledge-shared', entry);
        return entry;
    }

    learn(topic, value) {
        this.intelligence.set(topic, value);
        this.emit('learned', { topic, value, nodeId: this.nodeId });
        return { topic, learned: true };
    }

    getIntelligence(topic) {
        return this.intelligence.get(topic) || null;
    }

    sync() {
        const sync = { id: crypto.randomUUID(), nodeId: this.nodeId, timestamp: Date.now(), nodes: this.nodes.size, knowledge: this.knowledgeBase.size };
        this.emit('sync', sync);
        return sync;
    }

    _updateMetrics(success, latencyMs) {
        this.metrics.totalQueries++;
        if (success) this.metrics.successfulQueries++;
        this.metrics.avgLatencyMs = ((this.metrics.avgLatencyMs * (this.metrics.totalQueries - 1)) + latencyMs) / this.metrics.totalQueries;
    }

    getStats() {
        return { nodeId: this.nodeId, nodes: this.nodes.size, knowledge: this.intelligence.size, ...this.metrics };
    }

    getNodes() { return [...this.nodes.values()]; }
    getKnowledge(filter = {}) {
        let entries = [...this.knowledgeBase.values()];
        if (filter.topic) entries = entries.filter(e => e.topic === filter.topic);
        return entries;
    }
}
