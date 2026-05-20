// local-agent/cosmic-engine/TranscendentMemoryCore.js
/**
 * Phase 120: AI Transcendent Memory Core
 * Memory spans ALL projects, ALL timelines, ALL execution histories, ALL organizational evolution
 */

export class TranscendentMemory {
    constructor() {
        this.memories = new Map();
        this.index = new Map();
        this.timelines = new Map();
        this.crossProjectLinks = new Map();
        this.evolutionaryHistory = new Map();
    }

    async storeExperience(experience) {
        const memory = {
            id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...experience,
            timestamp: Date.now(),
            dimensions: this.createDimensions(experience),
            connections: [],
            importance: this.calculateImportance(experience)
        };

        this.memories.set(memory.id, memory);
        this.indexMemory(memory);

        return memory;
    }

    createDimensions(experience) {
        return {
            time: experience.timestamp || Date.now(),
            project: experience.projectId || 'unknown',
            type: experience.type || 'general',
            domain: experience.domain || 'engineering',
            complexity: experience.complexity || 0.5,
            impact: experience.impact || 0.5
        };
    }

    calculateImportance(experience) {
        let importance = 0.5;
        if (experience.success && experience.impact > 0.7) importance += 0.2;
        if (experience.failure) importance += 0.15;
        if (experience.learning) importance += 0.1;
        if (experience.patternDetected) importance += 0.15;
        return Math.min(1, importance);
    }

    indexMemory(memory) {
        // Index by time
        const timeKey = this.getTimeKey(memory.dimensions.time);
        if (!this.index.has(timeKey)) this.index.set(timeKey, new Set());
        this.index.get(timeKey).add(memory.id);

        // Index by project
        const projectKey = `project:${memory.dimensions.project}`;
        if (!this.index.has(projectKey)) this.index.set(projectKey, new Set());
        this.index.get(projectKey).add(memory.id);

        // Index by type
        const typeKey = `type:${memory.dimensions.type}`;
        if (!this.index.has(typeKey)) this.index.set(typeKey, new Set());
        this.index.get(typeKey).add(memory.id);

        // Index by domain
        const domainKey = `domain:${memory.dimensions.domain}`;
        if (!this.index.has(domainKey)) this.index.set(domainKey, new Set());
        this.index.get(domainKey).add(memory.id);
    }

    getTimeKey(timestamp) {
        const date = new Date(timestamp);
        return `time:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    async recall(params) {
        const results = [];
        const memoryIds = new Set();

        // Query by time range
        if (params.timeRange) {
            const timeKeys = this.getTimeKeysInRange(params.timeRange.start, params.timeRange.end);
            for (const key of timeKeys) {
                const ids = this.index.get(key);
                if (ids) ids.forEach(id => memoryIds.add(id));
            }
        }

        // Query by project
        if (params.projectId) {
            const key = `project:${params.projectId}`;
            const ids = this.index.get(key);
            if (ids) ids.forEach(id => memoryIds.add(id));
        }

        // Query by type
        if (params.type) {
            const key = `type:${params.type}`;
            const ids = this.index.get(key);
            if (ids) ids.forEach(id => memoryIds.add(id));
        }

        // Query by domain
        if (params.domain) {
            const key = `domain:${params.domain}`;
            const ids = this.index.get(key);
            if (ids) ids.forEach(id => memoryIds.add(id));
        }

        // Retrieve memories
        for (const id of memoryIds) {
            const memory = this.memories.get(id);
            if (memory) {
                if (this.matchesQuery(memory, params)) {
                    results.push(memory);
                }
            }
        }

        // Sort by relevance and importance
        results.sort((a, b) => {
            const aRelevance = this.calculateRelevance(a, params);
            const bRelevance = this.calculateRelevance(b, params);
            return (bRelevance * b.importance) - (aRelevance * a.importance);
        });

        return results.slice(0, params.limit || 10);
    }

    matchesQuery(memory, params) {
        if (params.minImportance && memory.importance < params.minImportance) return false;
        if (params.keywords) {
            const content = JSON.stringify(memory).toLowerCase();
            return params.keywords.some(kw => content.includes(kw.toLowerCase()));
        }
        return true;
    }

    calculateRelevance(memory, params) {
        let relevance = 0;
        if (params.keywords) {
            const content = JSON.stringify(memory).toLowerCase();
            const matches = params.keywords.filter(kw => content.includes(kw.toLowerCase())).length;
            relevance += matches / params.keywords.length;
        }
        return relevance;
    }

    getTimeKeysInRange(start, end) {
        const keys = [];
        const startDate = new Date(start);
        const endDate = new Date(end);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            keys.push(this.getTimeKey(d.getTime()));
        }

        return keys;
    }

    createLink(memory1Id, memory2Id, relationship) {
        const memory1 = this.memories.get(memory1Id);
        const memory2 = this.memories.get(memory2Id);

        if (memory1 && memory2) {
            memory1.connections.push({ memoryId: memory2Id, relationship, strength: 1 });
            memory2.connections.push({ memoryId: memory1Id, relationship, strength: 1 });

            this.crossProjectLinks.set(`${memory1Id}-${memory2Id}`, {
                from: memory1Id,
                to: memory2Id,
                relationship,
                createdAt: Date.now()
            });
        }
    }
}

export class MemoryTimeMachine {
    constructor() {
        this.snapshots = new Map();
        this.branches = new Map();
        this.causalChain = new Map();
    }

    createSnapshot(state, label) {
        const snapshot = {
            id: `snapshot-${Date.now()}`,
            state: JSON.parse(JSON.stringify(state)),
            label,
            timestamp: Date.now(),
            causalLinks: []
        };

        this.snapshots.set(snapshot.id, snapshot);
        return snapshot;
    }

    createBranch(baseSnapshotId, name) {
        const base = this.snapshots.get(baseSnapshotId);
        if (!base) throw new Error('Base snapshot not found');

        const branch = {
            id: `branch-${Date.now()}`,
            name,
            baseSnapshot: baseSnapshotId,
            snapshots: [baseSnapshotId],
            createdAt: Date.now(),
            mergedInto: null
        };

        this.branches.set(branch.id, branch);
        return branch;
    }

    addToBranch(branchId, snapshotId) {
        const branch = this.branches.get(branchId);
        const snapshot = this.snapshots.get(snapshotId);

        if (!branch || !snapshot) throw new Error('Branch or snapshot not found');

        branch.snapshots.push(snapshotId);

        // Create causal link
        const lastSnapshotId = branch.snapshots[branch.snapshots.length - 2];
        if (lastSnapshotId) {
            this.createCausalLink(lastSnapshotId, snapshotId);
        }

        return branch;
    }

    createCausalLink(fromSnapshotId, toSnapshotId) {
        const link = {
            id: `causal-${Date.now()}`,
            from: fromSnapshotId,
            to: toSnapshotId,
            timestamp: Date.now()
        };

        if (!this.causalChain.has(fromSnapshotId)) {
            this.causalChain.set(fromSnapshotId, []);
        }
        this.causalChain.get(fromSnapshotId).push(link);

        return link;
    }

    mergeBranches(sourceBranchId, targetBranchId) {
        const source = this.branches.get(sourceBranchId);
        const target = this.branches.get(targetBranchId);

        if (!source || !target) throw new Error('Branch not found');

        source.mergedInto = targetBranchId;
        source.snapshots.forEach(snapshotId => {
            if (!target.snapshots.includes(snapshotId)) {
                target.snapshots.push(snapshotId);
            }
        });

        return target;
    }

    getTimeline(branchId) {
        const branch = this.branches.get(branchId);
        if (!branch) throw new Error('Branch not found');

        return branch.snapshots.map(snapshotId => {
            const snapshot = this.snapshots.get(snapshotId);
            return {
                id: snapshot.id,
                label: snapshot.label,
                timestamp: snapshot.timestamp,
                state: snapshot.state
            };
        });
    }

    reconstructState(snapshotId) {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) throw new Error('Snapshot not found');
        return snapshot.state;
    }

    getCausalChain(snapshotId) {
        const chain = [];
        let currentId = snapshotId;

        while (currentId) {
            const snapshot = this.snapshots.get(currentId);
            if (!snapshot) break;
            chain.unshift(snapshot);

            // Find what led to this snapshot
            const links = Array.from(this.causalChain.entries())
                .filter(([_, links]) => links.some(l => l.to === currentId));

            currentId = links.length > 0 ? links[0][1][0].from : null;
        }

        return chain;
    }

    projectFuture(baseSnapshotId, steps) {
        const base = this.snapshots.get(baseSnapshotId);
        if (!base) throw new Error('Base snapshot not found');

        const projections = [];
        let currentState = base.state;

        for (let i = 0; i < steps; i++) {
            // Simplified projection - in reality would use ML model
            const projectedState = this.applyTransformation(currentState);
            const projection = {
                step: i + 1,
                state: projectedState,
                confidence: 1 - (0.1 * (i + 1)),
                timestamp: Date.now() + (i * 86400000)
            };
            projections.push(projection);
            currentState = projectedState;
        }

        return projections;
    }

    applyTransformation(state) {
        // Simplified state transformation
        if (typeof state === 'object' && state !== null) {
            const result = {};
            for (const [key, value] of Object.entries(state)) {
                if (typeof value === 'number') {
                    result[key] = value * (1 + (Math.random() - 0.5) * 0.1);
                } else {
                    result[key] = value;
                }
            }
            return result;
        }
        return state;
    }
}

export class CosmicKnowledgeGraph {
    constructor() {
        this.entities = new Map();
        this.relationships = new Map();
        this.domains = new Set();
    }

    addEntity(entity) {
        this.entities.set(entity.id, {
            ...entity,
            properties: entity.properties || {},
            metadata: {
                createdAt: Date.now(),
                lastUpdated: Date.now(),
                confidence: 1
            }
        });

        if (entity.domain) {
            this.domains.add(entity.domain);
        }
    }

    addRelationship(fromId, toId, type, properties = {}) {
        const id = `${fromId}-${type}-${toId}`;
        this.relationships.set(id, {
            id,
            from: fromId,
            to: toId,
            type,
            properties,
            metadata: {
                createdAt: Date.now(),
                confidence: 1
            }
        });
        return id;
    }

    query(pattern) {
        const results = [];

        for (const [id, entity] of this.entities) {
            if (this.matchesPattern(entity, pattern)) {
                results.push(entity);
            }
        }

        return results;
    }

    matchesPattern(entity, pattern) {
        if (pattern.type && entity.type !== pattern.type) return false;
        if (pattern.domain && entity.domain !== pattern.domain) return false;
        if (pattern.label && !entity.label?.includes(pattern.label)) return false;
        return true;
    }

    getRelatedEntities(entityId, depth = 1) {
        const related = new Set();
        const queue = [{ id: entityId, depth: 0 }];

        while (queue.length > 0) {
            const { id, depth: currentDepth } = queue.shift();

            if (currentDepth >= depth) continue;

            for (const [_, rel] of this.relationships) {
                if (rel.from === id && !related.has(rel.to)) {
                    related.add(rel.to);
                    queue.push({ id: rel.to, depth: currentDepth + 1 });
                }
                if (rel.to === id && !related.has(rel.from)) {
                    related.add(rel.from);
                    queue.push({ id: rel.from, depth: currentDepth + 1 });
                }
            }
        }

        return Array.from(related).map(id => this.entities.get(id)).filter(Boolean);
    }
}

export default TranscendentMemoryCore;