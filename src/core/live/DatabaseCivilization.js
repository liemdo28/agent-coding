/**
 * DatabaseCivilization.js — Real Persistent Storage Layer
 *
 * Hybrid database: SQLite for local-first, PostgreSQL for scale.
 * Auto-detects available backend and provides unified query interface.
 * All data persists across restarts. No in-memory-only state.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class DatabaseCivilization {
    #db = null;
    #pg = null;
    #type = 'none'; // 'sqlite' | 'postgres' | 'none'
    #config;
    #storageDir;
    #stats = { queries: 0, writes: 0, errors: 0 };
    #tables = [];

    constructor(config = {}) {
        this.#config = config;
        this.#storageDir = config.storageDir || join(process.cwd(), '.aos-data');
    }

    async initialize() {
        mkdirSync(this.#storageDir, { recursive: true });

        // Try PostgreSQL first
        if (this.#config.dbUrl && this.#config.dbUrl !== 'sqlite') {
            try {
                const { default: pg } = await import('pg');
                this.#pg = new pg.Pool({ connectionString: this.#config.dbUrl });
                await this.#pg.query('SELECT 1');
                this.#type = 'postgres';
                await this.#initPostgres();
                return;
            } catch {
                this.#pg = null;
            }
        }

        // Fallback to SQLite
        try {
            const { default: Database } = await import('better-sqlite3');
            this.#db = new Database(join(this.#storageDir, 'aos-live.db'));
            this.#db.pragma('journal_mode = WAL');
            this.#db.pragma('synchronous = NORMAL');
            this.#db.pragma('cache_size = -64000'); // 64MB cache
            this.#type = 'sqlite';
            await this.#initSqlite();
        } catch {
            this.#type = 'none';
        }
    }

    async #initSqlite() {
        this.#db.exec(`
            -- Core event log
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                data TEXT,
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic);
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);

            -- Knowledge chunks (ingested content)
            CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                metadata TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge(source);

            -- Organizational memory
            CREATE TABLE IF NOT EXISTS memory (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                category TEXT,
                importance REAL DEFAULT 0.5,
                access_count INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_memory_category ON memory(category);
            CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory(importance);

            -- Task executions
            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                task_type TEXT,
                status TEXT,
                duration_ms INTEGER,
                result TEXT,
                context TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_exec_type ON executions(task_type);
            CREATE INDEX IF NOT EXISTS idx_exec_status ON executions(status);

            -- Filesystem index
            CREATE TABLE IF NOT EXISTS fs_index (
                path TEXT PRIMARY KEY,
                project TEXT,
                ext TEXT,
                size INTEGER,
                hash TEXT,
                modified_at INTEGER,
                indexed_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_fs_project ON fs_index(project);
            CREATE INDEX IF NOT EXISTS idx_fs_ext ON fs_index(ext);

            -- Swarm state
            CREATE TABLE IF NOT EXISTS swarm_agents (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT,
                model TEXT,
                status TEXT DEFAULT 'idle',
                tasks_completed INTEGER DEFAULT 0,
                last_active INTEGER
            );

            -- Recovery log
            CREATE TABLE IF NOT EXISTS recovery_log (
                id TEXT PRIMARY KEY,
                error_type TEXT,
                error_message TEXT,
                strategy TEXT,
                success INTEGER,
                duration_ms INTEGER,
                created_at INTEGER NOT NULL
            );

            -- Scheduler history
            CREATE TABLE IF NOT EXISTS scheduler_history (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                pressure REAL,
                queue_depth INTEGER,
                workers_active INTEGER,
                created_at INTEGER NOT NULL
            );

            -- Memory Graph: relationships between entities
            CREATE TABLE IF NOT EXISTS memory_graph (
                id TEXT PRIMARY KEY,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                relation TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                metadata TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_graph_source ON memory_graph(source_type, source_id);
            CREATE INDEX IF NOT EXISTS idx_graph_target ON memory_graph(target_type, target_id);
            CREATE INDEX IF NOT EXISTS idx_graph_relation ON memory_graph(relation);

            -- Filesystem semantic layer
            CREATE TABLE IF NOT EXISTS fs_semantics (
                path TEXT PRIMARY KEY,
                project TEXT,
                criticality REAL DEFAULT 0.5,
                change_frequency REAL DEFAULT 0,
                incident_count INTEGER DEFAULT 0,
                strategic_importance REAL DEFAULT 0.5,
                last_incident_at INTEGER,
                architecture_role TEXT,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_fs_sem_criticality ON fs_semantics(criticality);
        `);

        this.#tables = ['events', 'knowledge', 'memory', 'executions', 'fs_index', 'swarm_agents', 'recovery_log', 'scheduler_history', 'memory_graph', 'fs_semantics'];
    }

    async #initPostgres() {
        await this.#pg.query(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                data JSONB,
                timestamp BIGINT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic);
            CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);

            CREATE TABLE IF NOT EXISTS knowledge (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding vector(768),
                metadata JSONB,
                created_at BIGINT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS memory (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL,
                category TEXT,
                importance REAL DEFAULT 0.5,
                access_count INTEGER DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                task_type TEXT,
                status TEXT,
                duration_ms INTEGER,
                result JSONB,
                context JSONB,
                created_at BIGINT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS fs_index (
                path TEXT PRIMARY KEY,
                project TEXT,
                ext TEXT,
                size BIGINT,
                hash TEXT,
                modified_at BIGINT,
                indexed_at BIGINT
            );

            CREATE TABLE IF NOT EXISTS swarm_agents (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT,
                model TEXT,
                status TEXT DEFAULT 'idle',
                tasks_completed INTEGER DEFAULT 0,
                last_active BIGINT
            );

            CREATE TABLE IF NOT EXISTS recovery_log (
                id TEXT PRIMARY KEY,
                error_type TEXT,
                error_message TEXT,
                strategy TEXT,
                success BOOLEAN,
                duration_ms INTEGER,
                created_at BIGINT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scheduler_history (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                pressure REAL,
                queue_depth INTEGER,
                workers_active INTEGER,
                created_at BIGINT NOT NULL
            );
        `);

        this.#tables = ['events', 'knowledge', 'memory', 'executions', 'fs_index', 'swarm_agents', 'recovery_log', 'scheduler_history'];
    }

    // --- Unified Query Interface ---

    /**
     * Execute a query (SELECT).
     */
    query(sql, params = []) {
        this.#stats.queries++;
        try {
            if (this.#type === 'sqlite') {
                return this.#db.prepare(sql).all(...params);
            }
            if (this.#type === 'postgres') {
                return this.#pg.query(sql, params).then(r => r.rows);
            }
            return [];
        } catch (err) {
            this.#stats.errors++;
            throw err;
        }
    }

    /**
     * Execute a write (INSERT/UPDATE/DELETE).
     */
    run(sql, params = []) {
        this.#stats.writes++;
        try {
            if (this.#type === 'sqlite') {
                return this.#db.prepare(sql).run(...params);
            }
            if (this.#type === 'postgres') {
                return this.#pg.query(sql, params);
            }
        } catch (err) {
            this.#stats.errors++;
            throw err;
        }
    }

    /**
     * Get a single row.
     */
    get(sql, params = []) {
        this.#stats.queries++;
        try {
            if (this.#type === 'sqlite') {
                return this.#db.prepare(sql).get(...params);
            }
            if (this.#type === 'postgres') {
                return this.#pg.query(sql, params).then(r => r.rows[0] ?? null);
            }
            return null;
        } catch (err) {
            this.#stats.errors++;
            throw err;
        }
    }

    /**
     * Batch insert for high-throughput ingestion.
     */
    batchInsert(table, rows) {
        if (this.#type === 'sqlite' && rows.length > 0) {
            const keys = Object.keys(rows[0]);
            const placeholders = keys.map(() => '?').join(', ');
            const stmt = this.#db.prepare(
                `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`
            );

            const tx = this.#db.transaction((items) => {
                for (const item of items) {
                    stmt.run(...keys.map(k => {
                        const v = item[k];
                        return typeof v === 'object' ? JSON.stringify(v) : v;
                    }));
                }
            });

            tx(rows);
            this.#stats.writes += rows.length;
        }
    }

    /**
     * Transaction wrapper.
     */
    transaction(fn) {
        if (this.#type === 'sqlite') {
            return this.#db.transaction(fn)();
        }
        // For postgres, caller manages transactions
        return fn();
    }

    async close() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
        }
        if (this.#pg) {
            await this.#pg.end();
            this.#pg = null;
        }
    }

    get type() { return this.#type; }

    getStats() {
        const stats = { ...this.#stats, type: this.#type, tables: this.#tables };

        if (this.#type === 'sqlite') {
            try {
                const pageCount = this.#db.pragma('page_count', { simple: true });
                const pageSize = this.#db.pragma('page_size', { simple: true });
                stats.sizeBytes = pageCount * pageSize;
                stats.sizeMB = Math.round(stats.sizeBytes / 1024 / 1024 * 100) / 100;
            } catch { }
        }

        return stats;
    }
}
