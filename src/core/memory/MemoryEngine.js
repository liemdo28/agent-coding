/**
 * MemoryEngine.js — Unified persistent memory system
 *
 * Consolidates: project memory, execution memory, strategic memory, rollback memory
 * Storage: SQLite via better-sqlite3 at ~/.super-agent-ai/memory/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export class MemoryEngine {
    #config;
    #db = null;
    #storageDir;
    #cache = new Map();
    #dirty = false;
    #stats = { reads: 0, writes: 0, hits: 0, misses: 0 };

    constructor(config = {}) {
        this.#config = config;
        this.#storageDir = config.storageDir || join(process.cwd(), '.super-agent-ai', 'memory');
    }

    async initialize() {
        mkdirSync(this.#storageDir, { recursive: true });

        try {
            // Try to use better-sqlite3 for structured storage
            const Database = (await import('better-sqlite3')).default;
            this.#db = new Database(join(this.#storageDir, 'aos-memory.db'));
            this.#db.pragma('journal_mode = WAL');
            this.#createTables();
        } catch {
            // Fallback to JSON file storage if better-sqlite3 not available
            this.#db = null;
        }

        // Load cached state
        this.#loadCache();
    }

    #createTables() {
        this.#db.exec(`
            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                type TEXT,
                result TEXT,
                duration INTEGER,
                timestamp INTEGER,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS project_memory (
                project TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT,
                updated_at INTEGER,
                PRIMARY KEY (project, key)
            );

            CREATE TABLE IF NOT EXISTS strategic_memory (
                key TEXT PRIMARY KEY,
                value TEXT,
                category TEXT,
                updated_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS rollback_snapshots (
                id TEXT PRIMARY KEY,
                project TEXT,
                type TEXT,
                data TEXT,
                created_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS failure_patterns (
                id TEXT PRIMARY KEY,
                type TEXT,
                signature TEXT,
                name TEXT,
                count INTEGER DEFAULT 1,
                last_seen INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_exec_task ON executions(task_id);
            CREATE INDEX IF NOT EXISTS idx_exec_type ON executions(type);
            CREATE INDEX IF NOT EXISTS idx_exec_ts ON executions(timestamp);
            CREATE INDEX IF NOT EXISTS idx_patterns_type ON failure_patterns(type);
        `);
    }

    /**
     * Record a task execution.
     */
    async recordExecution(entry) {
        this.#stats.writes++;
        const id = entry.taskId + '-' + entry.timestamp;

        if (this.#db) {
            this.#db.prepare(`
                INSERT OR REPLACE INTO executions (id, task_id, type, result, duration, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(id, entry.taskId, entry.type, entry.result, entry.duration, entry.timestamp, JSON.stringify(entry.metadata || {}));
        } else {
            this.#cache.set(`exec:${id}`, entry);
            this.#dirty = true;
        }
    }

    /**
     * Get context for a task type in a project.
     */
    async getContext(project, type) {
        this.#stats.reads++;

        if (this.#db) {
            const recent = this.#db.prepare(`
                SELECT * FROM executions WHERE type = ? ORDER BY timestamp DESC LIMIT 10
            `).all(type || '');

            const projectData = project ? this.#db.prepare(`
                SELECT key, value FROM project_memory WHERE project = ?
            `).all(project) : [];

            return {
                recentExecutions: recent,
                projectContext: Object.fromEntries(projectData.map(r => [r.key, JSON.parse(r.value || '{}')])),
            };
        }

        return { recentExecutions: [], projectContext: {} };
    }

    /**
     * Get known failure patterns for a task type.
     */
    async getFailurePatterns(type) {
        if (!this.#db) return [];

        return this.#db.prepare(`
            SELECT * FROM failure_patterns WHERE type = ? ORDER BY count DESC LIMIT 20
        `).all(type || '');
    }

    /**
     * Record a failure pattern for future detection.
     */
    async recordFailurePattern(pattern) {
        if (!this.#db) return;

        const existing = this.#db.prepare(`
            SELECT id, count FROM failure_patterns WHERE type = ? AND signature = ?
        `).get(pattern.type, pattern.signature);

        if (existing) {
            this.#db.prepare(`
                UPDATE failure_patterns SET count = count + 1, last_seen = ? WHERE id = ?
            `).run(Date.now(), existing.id);
        } else {
            const id = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            this.#db.prepare(`
                INSERT INTO failure_patterns (id, type, signature, name, count, last_seen)
                VALUES (?, ?, ?, ?, 1, ?)
            `).run(id, pattern.type, pattern.signature, pattern.name, Date.now());
        }
    }

    /**
     * Store project-level memory.
     */
    async setProjectMemory(project, key, value) {
        this.#stats.writes++;
        if (this.#db) {
            this.#db.prepare(`
                INSERT OR REPLACE INTO project_memory (project, key, value, updated_at)
                VALUES (?, ?, ?, ?)
            `).run(project, key, JSON.stringify(value), Date.now());
        } else {
            this.#cache.set(`proj:${project}:${key}`, value);
            this.#dirty = true;
        }
    }

    /**
     * Get project-level memory.
     */
    async getProjectMemory(project, key) {
        this.#stats.reads++;
        if (this.#db) {
            const row = this.#db.prepare(`
                SELECT value FROM project_memory WHERE project = ? AND key = ?
            `).get(project, key);
            return row ? JSON.parse(row.value) : null;
        }
        return this.#cache.get(`proj:${project}:${key}`) || null;
    }

    /**
     * Store a rollback snapshot.
     */
    async saveSnapshot(snapshot) {
        if (!this.#db) return;
        this.#db.prepare(`
            INSERT OR REPLACE INTO rollback_snapshots (id, project, type, data, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(snapshot.id, snapshot.project, snapshot.type, JSON.stringify(snapshot.data), Date.now());
    }

    /**
     * Flush all pending writes to disk.
     */
    async flush() {
        if (this.#dirty && !this.#db) {
            const data = Object.fromEntries(this.#cache);
            writeFileSync(join(this.#storageDir, 'cache.json'), JSON.stringify(data, null, 2));
            this.#dirty = false;
        }
    }

    #loadCache() {
        const cachePath = join(this.#storageDir, 'cache.json');
        if (!this.#db && existsSync(cachePath)) {
            try {
                const data = JSON.parse(readFileSync(cachePath, 'utf8'));
                for (const [k, v] of Object.entries(data)) {
                    this.#cache.set(k, v);
                }
            } catch {
                // Ignore corrupt cache
            }
        }
    }

    getStats() {
        return {
            ...this.#stats,
            cacheSize: this.#cache.size,
            hasSqlite: !!this.#db,
            storageDir: this.#storageDir,
        };
    }

    close() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
        }
    }
}
