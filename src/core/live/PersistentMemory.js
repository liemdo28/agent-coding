/**
 * PersistentMemory.js — Real Organizational Memory
 *
 * Everything the system learns persists across restarts.
 * Supports: execution history, project context, failure patterns,
 * strategic decisions, and semantic search over memory.
 */

export class PersistentMemory {
    #db;
    #events;
    #cache = new Map();
    #stats = { reads: 0, writes: 0, searches: 0, consolidations: 0 };

    constructor(db, events) {
        this.#db = db;
        this.#events = events;
    }

    async initialize() {
        // Load hot memory into cache
        if (this.#db.type !== 'none') {
            try {
                const hot = this.#db.query(
                    'SELECT key, value FROM memory ORDER BY access_count DESC LIMIT 200'
                );
                for (const row of hot) {
                    this.#cache.set(row.key, JSON.parse(row.value));
                }
            } catch { }
        }
    }

    /**
     * Store a memory entry.
     */
    async set(key, value, options = {}) {
        this.#stats.writes++;
        const now = Date.now();
        const serialized = JSON.stringify(value);

        this.#cache.set(key, value);

        if (this.#db.type !== 'none') {
            this.#db.run(
                `INSERT OR REPLACE INTO memory (key, value, category, importance, access_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 0, ?, ?)`,
                [key, serialized, options.category || 'general', options.importance || 0.5, now, now]
            );
        }

        this.#events?.publish('memory.written', { key, category: options.category });
    }

    /**
     * Get a memory entry.
     */
    async get(key) {
        this.#stats.reads++;

        if (this.#cache.has(key)) return this.#cache.get(key);

        if (this.#db.type !== 'none') {
            const row = this.#db.get('SELECT value FROM memory WHERE key = ?', [key]);
            if (row) {
                const value = JSON.parse(row.value);
                this.#cache.set(key, value);
                // Increment access count
                this.#db.run('UPDATE memory SET access_count = access_count + 1 WHERE key = ?', [key]);
                return value;
            }
        }

        return null;
    }

    /**
     * Record a task execution for learning.
     */
    async recordExecution(event) {
        this.#stats.writes++;
        const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        if (this.#db.type !== 'none') {
            this.#db.run(
                `INSERT INTO executions (id, task_type, status, duration_ms, result, context, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    event.type || event.task_type || 'unknown',
                    event.status || 'completed',
                    event.duration || event.duration_ms || 0,
                    JSON.stringify(event.result || {}),
                    JSON.stringify(event.context || {}),
                    Date.now(),
                ]
            );
        }
    }

    /**
     * Get context for a task (recent executions + project memory).
     */
    async getContext(project, taskType) {
        this.#stats.reads++;

        if (this.#db.type === 'none') return { executions: [], projectMemory: {} };

        const executions = this.#db.query(
            'SELECT * FROM executions WHERE task_type = ? ORDER BY created_at DESC LIMIT 10',
            [taskType || '']
        );

        const projectMemory = {};
        if (project) {
            const rows = this.#db.query(
                "SELECT key, value FROM memory WHERE category = ? OR key LIKE ?",
                [`project:${project}`, `${project}:%`]
            );
            for (const row of rows) {
                projectMemory[row.key] = JSON.parse(row.value);
            }
        }

        return { executions, projectMemory };
    }

    /**
     * Get relevant context for a prompt (for AI augmentation).
     */
    async getRelevantContext(prompt) {
        this.#stats.searches++;

        // Simple keyword-based relevance (upgrade to embeddings when available)
        const keywords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);

        if (this.#db.type === 'none' || keywords.length === 0) return '';

        // Search memory
        const results = [];
        for (const keyword of keywords.slice(0, 5)) {
            const rows = this.#db.query(
                "SELECT key, value FROM memory WHERE key LIKE ? OR value LIKE ? LIMIT 5",
                [`%${keyword}%`, `%${keyword}%`]
            );
            results.push(...rows);
        }

        // Search recent executions
        const recentExec = this.#db.query(
            'SELECT task_type, status, result FROM executions ORDER BY created_at DESC LIMIT 5'
        );

        const context = [];
        if (results.length > 0) {
            context.push('Relevant memory:');
            const seen = new Set();
            for (const r of results.slice(0, 10)) {
                if (!seen.has(r.key)) {
                    seen.add(r.key);
                    context.push(`- ${r.key}: ${r.value.slice(0, 200)}`);
                }
            }
        }

        if (recentExec.length > 0) {
            context.push('\nRecent executions:');
            for (const e of recentExec) {
                context.push(`- ${e.task_type}: ${e.status}`);
            }
        }

        return context.join('\n');
    }

    /**
     * Search memory by keyword.
     */
    async search(query, options = {}) {
        this.#stats.searches++;
        const limit = options.limit || 20;

        if (this.#db.type === 'none') return [];

        return this.#db.query(
            "SELECT key, value, category, importance FROM memory WHERE key LIKE ? OR value LIKE ? ORDER BY importance DESC LIMIT ?",
            [`%${query}%`, `%${query}%`, limit]
        );
    }

    /**
     * Consolidate new knowledge into memory patterns.
     */
    async consolidate(event) {
        this.#stats.consolidations++;

        // Store ingested knowledge reference
        if (event.source) {
            await this.set(`knowledge:${event.source}`, {
                source: event.source,
                chunks: event.chunks || 1,
                timestamp: Date.now(),
            }, { category: 'knowledge', importance: 0.6 });
        }
    }

    /**
     * Get failure patterns for a task type.
     */
    async getFailurePatterns(taskType) {
        if (this.#db.type === 'none') return [];

        return this.#db.query(
            "SELECT * FROM executions WHERE task_type = ? AND status = 'failed' ORDER BY created_at DESC LIMIT 20",
            [taskType]
        );
    }

    // ═══════════════════════════════════════════════════════════
    // MEMORY GRAPH — Relationships between entities
    // ═══════════════════════════════════════════════════════════

    /**
     * Link two entities in the memory graph.
     */
    async link(sourceType, sourceId, targetType, targetId, relation, weight = 1.0, metadata = null) {
        if (this.#db.type === 'none') return;

        const id = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.#db.run(
            `INSERT OR REPLACE INTO memory_graph (id, source_type, source_id, target_type, target_id, relation, weight, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, sourceType, sourceId, targetType, targetId, relation, weight, metadata ? JSON.stringify(metadata) : null, Date.now()]
        );

        this.#events?.publish('memory.graph.linked', { sourceType, sourceId, targetType, targetId, relation });
    }

    /**
     * Get all relationships for an entity.
     */
    async getRelations(entityType, entityId) {
        if (this.#db.type === 'none') return [];

        const outgoing = this.#db.query(
            'SELECT * FROM memory_graph WHERE source_type = ? AND source_id = ? ORDER BY weight DESC',
            [entityType, entityId]
        );
        const incoming = this.#db.query(
            'SELECT * FROM memory_graph WHERE target_type = ? AND target_id = ? ORDER BY weight DESC',
            [entityType, entityId]
        );

        return { outgoing, incoming };
    }

    /**
     * Find connected entities by relation type.
     */
    async findConnected(entityType, entityId, relation) {
        if (this.#db.type === 'none') return [];

        return this.#db.query(
            'SELECT * FROM memory_graph WHERE source_type = ? AND source_id = ? AND relation = ? ORDER BY weight DESC LIMIT 20',
            [entityType, entityId, relation]
        );
    }

    /**
     * Strengthen a relationship (increase weight).
     */
    async strengthenLink(sourceType, sourceId, targetType, targetId, relation) {
        if (this.#db.type === 'none') return;

        this.#db.run(
            `UPDATE memory_graph SET weight = MIN(10.0, weight + 0.5)
             WHERE source_type = ? AND source_id = ? AND target_type = ? AND target_id = ? AND relation = ?`,
            [sourceType, sourceId, targetType, targetId, relation]
        );
    }

    // ═══════════════════════════════════════════════════════════
    // FILESYSTEM SEMANTICS
    // ═══════════════════════════════════════════════════════════

    /**
     * Update semantic score for a file.
     */
    async updateFileSemantics(path, updates) {
        if (this.#db.type === 'none') return;

        const existing = this.#db.get('SELECT * FROM fs_semantics WHERE path = ?', [path]);
        if (existing) {
            const sets = [];
            const params = [];
            for (const [key, value] of Object.entries(updates)) {
                sets.push(`${key} = ?`);
                params.push(value);
            }
            sets.push('updated_at = ?');
            params.push(Date.now());
            params.push(path);
            this.#db.run(`UPDATE fs_semantics SET ${sets.join(', ')} WHERE path = ?`, params);
        } else {
            this.#db.run(
                `INSERT INTO fs_semantics (path, project, criticality, change_frequency, incident_count, strategic_importance, architecture_role, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [path, updates.project || null, updates.criticality || 0.5, updates.change_frequency || 0, updates.incident_count || 0, updates.strategic_importance || 0.5, updates.architecture_role || null, Date.now()]
            );
        }
    }

    /**
     * Get most critical files.
     */
    async getCriticalFiles(limit = 20) {
        if (this.#db.type === 'none') return [];
        return this.#db.query('SELECT * FROM fs_semantics ORDER BY criticality DESC LIMIT ?', [limit]);
    }

    /**
     * Record file involvement in an incident.
     */
    async recordFileIncident(path) {
        if (this.#db.type === 'none') return;
        this.#db.run(
            `UPDATE fs_semantics SET incident_count = incident_count + 1, last_incident_at = ?, criticality = MIN(1.0, criticality + 0.1) WHERE path = ?`,
            [Date.now(), path]
        );
    }

    /**
     * Flush cache to disk.
     */
    async flush() {
        // Cache is already persisted on write for DB-backed mode
        // This is a no-op for safety
    }

    getStats() {
        let graphEdges = 0;
        let semanticFiles = 0;
        if (this.#db.type !== 'none') {
            try {
                graphEdges = this.#db.get('SELECT COUNT(*) as cnt FROM memory_graph')?.cnt || 0;
                semanticFiles = this.#db.get('SELECT COUNT(*) as cnt FROM fs_semantics')?.cnt || 0;
            } catch { }
        }

        return {
            ...this.#stats,
            cacheSize: this.#cache.size,
            dbType: this.#db?.type || 'none',
            graphEdges,
            semanticFiles,
        };
    }
}
