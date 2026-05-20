/**
 * local-agent/federation/FederationProtocol.js
 * Phase 29: Sovereign Federation Protocol
 */
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export class FederationProtocol extends EventEmitter {
    constructor({ workspaceRoot, config = {} } = {}) {
        super();
        this.root = workspaceRoot;
        this.config = {
            syncIntervalMs: 60000,
            artifactExpiry: 7 * 24 * 60 * 60 * 1000,
            maxArtifactSize: 100 * 1024 * 1024,
            ...config,
        };
        this.peerId = crypto.randomUUID();
        this.peers = new Map();
        this.artifacts = new Map();
        this.pendingSync = [];
    }

    registerPeer(peer) {
        const p = { id: peer.id || crypto.randomUUID(), name: peer.name, address: peer.address, capabilities: peer.capabilities || [], lastSeen: Date.now(), status: 'connected' };
        this.peers.set(p.id, p);
        this.emit('peer-registered', p);
        return p;
    }

    removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) { this.peers.delete(peerId); this.emit('peer-removed', peer); return true; }
        return false;
    }

    publishArtifact({ type, content, metadata = {}, ttl = null }) {
        const artifact = { id: crypto.randomUUID(), peerId: this.peerId, type, content, metadata, createdAt: Date.now(), expiresAt: ttl ? Date.now() + ttl : null };
        this.artifacts.set(artifact.id, artifact);
        this.emit('artifact-published', artifact);
        return artifact;
    }

    subscribe(topic, handler) {
        this.on(`topic:${topic}`, handler);
        return () => this.off(`topic:${topic}`, handler);
    }

    publish(topic, message) {
        const msg = { id: crypto.randomUUID(), topic, message, peerId: this.peerId, timestamp: Date.now() };
        this.emit(`topic:${topic}`, msg);
        return msg.id;
    }

    requestArtifact(artifactId, peerId) {
        const artifact = this.artifacts.get(artifactId);
        if (!artifact) throw new Error(`Artifact ${artifactId} not found`);
        const peer = this.peers.get(peerId);
        if (!peer) throw new Error(`Peer ${peerId} not found`);
        return { artifact, peer };
    }

    getPeers(filter = {}) {
        let peers = [...this.peers.values()];
        if (filter.status) peers = peers.filter(p => p.status === filter.status);
        return peers;
    }

    getArtifacts(filter = {}) {
        let artifacts = [...this.artifacts.values()];
        if (filter.type) artifacts = artifacts.filter(a => a.type === filter.type);
        if (filter.peerId) artifacts = artifacts.filter(a => a.peerId === filter.peerId);
        return artifacts;
    }

    sync() {
        const sync = { id: crypto.randomUUID(), timestamp: Date.now(), peers: this.peers.size, artifacts: this.artifacts.size };
        this.pendingSync.push(sync);
        this.emit('sync', sync);
        return sync;
    }

    getStats() {
        return { peerId: this.peerId, peers: this.peers.size, artifacts: this.artifacts.size, pendingSync: this.pendingSync.length };
    }
}
