/**
 * LiveRuntime.js — 100X Execution Density Unified Runtime
 *
 * The single "alive" runtime that boots and connects ALL real subsystems:
 * - Database (PostgreSQL + SQLite hybrid)
 * - Ingestion (real file processing pipeline)
 * - AI Cognition (Ollama local models)
 * - Swarm (real multi-agent coordination)
 * - Memory (persistent organizational memory)
 * - Filesystem Intelligence (real fs watching)
 * - Self-Healing (real error recovery)
 * - Event Stream (real event-native architecture)
 * - Scheduler (real task pressure management)
 *
 * This is NOT an abstraction layer. This is the working runtime.
 */

import { EventEmitter } from 'events';
import { DatabaseCivilization } from './DatabaseCivilization.js';
import { IngestionEngine } from './IngestionEngine.js';
import { CognitionRuntime } from './CognitionRuntime.js';
import { LiveSwarm } from './LiveSwarm.js';
import { PersistentMemory } from './PersistentMemory.js';
import { LiveFilesystem } from './LiveFilesystem.js';
import { SelfHealLoop } from './SelfHealLoop.js';
import { EventNexus } from './EventNexus.js';
import { PressureScheduler } from './PressureScheduler.js';

/**
 * @typedef {'cold'|'booting'|'alive'|'degraded'|'healing'|'shutdown'} LiveState
 */

export class LiveRuntime extends EventEmitter {
    /** @type {LiveState} */
    #state = 'cold';
    #bootTime = 0;
    #heartbeatInterval = null;
    #metrics = {
        totalTasks: 0,
        totalEvents: 0,
        totalRecoveries: 0,
        uptimeMs: 0,
        lastHeartbeat: 0,
    };

    // Subsystems
    #events;
    #db;
    #ingestion;
    #cognition;
    #swarm;
    #memory;
    #filesystem;
    #selfHeal;
    #scheduler;

    constructor(config = {}) {
        super();
        this.config = {
            heartbeatMs: config.heartbeatMs || 5000,
            dbUrl: config.dbUrl || process.env.DATABASE_URL || 'sqlite',
            ollamaUrl: config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
            redisUrl: config.redisUrl || process.env.REDIS_URL || null,
            watchPaths: config.watchPaths || [process.cwd()],
            maxWorkers: config.maxWorkers || 8,
            maxPressure: config.maxPressure || 0.85,
            ...config,
        };
    }

    /**
     * Boot the entire runtime in dependency order.
     * Each subsystem connects to the EventNexus for cross-communication.
     */
    async boot() {
        if (this.#state !== 'cold' && this.#state !== 'shutdown') {
            throw new Error(`Cannot boot from state: ${this.#state}`);
        }

        this.#state = 'booting';
        this.#bootTime = Date.now();
        this.emit('state', this.#state);

        try {
            // 1. Event Nexus — the nervous system, everything connects here
            this.#events = new EventNexus();
            this.#events.start();

            // 2. Database — persistent truth
            this.#db = new DatabaseCivilization(this.config);
            await this.#db.initialize();
            this.#events.publish('system.db.ready', { type: this.#db.type });

            // 3. Persistent Memory — organizational knowledge
            this.#memory = new PersistentMemory(this.#db, this.#events);
            await this.#memory.initialize();
            this.#events.publish('system.memory.ready');

            // 4. AI Cognition — local model runtime
            this.#cognition = new CognitionRuntime(this.config, this.#events);
            await this.#cognition.initialize();
            this.#events.publish('system.cognition.ready', {
                available: this.#cognition.isAvailable,
                models: this.#cognition.loadedModels,
            });

            // 5. Filesystem Intelligence — real fs watching
            this.#filesystem = new LiveFilesystem(this.config, this.#events);
            await this.#filesystem.start();
            this.#events.publish('system.filesystem.ready', {
                watching: this.#filesystem.watchedPaths,
            });

            // 6. Ingestion Engine — real knowledge processing
            this.#ingestion = new IngestionEngine(this.#db, this.#cognition, this.#events);
            await this.#ingestion.initialize();
            this.#events.publish('system.ingestion.ready');

            // 7. Live Swarm — real multi-agent coordination
            this.#swarm = new LiveSwarm(this.#cognition, this.#events, this.config);
            await this.#swarm.initialize();
            this.#events.publish('system.swarm.ready', {
                agents: this.#swarm.agentCount,
            });

            // 8. Pressure Scheduler — real task execution with backpressure
            this.#scheduler = new PressureScheduler(this.#swarm, this.#events, this.config);
            this.#scheduler.start();
            this.#events.publish('system.scheduler.ready');

            // 9. Self-Heal Loop — monitors everything, recovers automatically
            this.#selfHeal = new SelfHealLoop(this, this.#events, this.config);
            this.#selfHeal.start();
            this.#events.publish('system.selfheal.ready');

            // Wire cross-system events
            this.#wireEvents();

            // Start heartbeat
            this.#startHeartbeat();

            // ALIVE
            this.#state = 'alive';
            this.emit('state', this.#state);
            this.#events.publish('system.alive', {
                bootMs: Date.now() - this.#bootTime,
                subsystems: this.getSubsystemStatus(),
            });

            return this;
        } catch (error) {
            this.#state = 'degraded';
            this.emit('state', this.#state);
            this.emit('boot-error', error);
            // Try partial operation
            this.#events?.publish('system.boot.failed', { error: error.message });
            return this;
        }
    }

    /**
     * Wire cross-system event handlers for autonomous behavior.
     */
    #wireEvents() {
        // File changes trigger ingestion
        this.#events.subscribe('fs.file.changed', async (event) => {
            if (this.#ingestion && this.#shouldIngest(event.path)) {
                await this.#ingestion.ingestFile(event.path);
                this.#metrics.totalEvents++;
            }
        });

        // New knowledge triggers memory consolidation
        this.#events.subscribe('ingestion.chunk.stored', async (event) => {
            await this.#memory.consolidate(event);
        });

        // Task completion triggers learning
        this.#events.subscribe('task.completed', async (event) => {
            this.#metrics.totalTasks++;
            await this.#memory.recordExecution(event);
        });

        // Errors trigger self-healing
        this.#events.subscribe('system.error', async (event) => {
            await this.#selfHeal.handleError(event);
        });

        // Pressure changes trigger scheduler adaptation
        this.#events.subscribe('scheduler.pressure.high', () => {
            this.#swarm.scaleUp();
        });

        this.#events.subscribe('scheduler.pressure.low', () => {
            this.#swarm.scaleDown();
        });
    }

    #shouldIngest(filePath) {
        const skip = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'];
        return !skip.some(s => filePath.includes(s));
    }

    #startHeartbeat() {
        this.#heartbeatInterval = setInterval(() => {
            this.#metrics.lastHeartbeat = Date.now();
            this.#metrics.uptimeMs = Date.now() - this.#bootTime;

            this.#events.publish('system.heartbeat', {
                state: this.#state,
                uptime: this.#metrics.uptimeMs,
                metrics: this.#metrics,
                pressure: this.#scheduler?.getPressure() ?? 0,
                memory: process.memoryUsage(),
            });
        }, this.config.heartbeatMs);

        if (this.#heartbeatInterval.unref) {
            this.#heartbeatInterval.unref();
        }
    }

    // --- Public API ---

    /**
     * Submit a task to the runtime.
     */
    async submit(task) {
        if (this.#state === 'shutdown') throw new Error('Runtime is shutdown');

        const enrichedTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...task,
            submittedAt: Date.now(),
            context: await this.#memory.getContext(task.project, task.type),
        };

        this.#events.publish('task.submitted', enrichedTask);
        return this.#scheduler.schedule(enrichedTask);
    }

    /**
     * Ask the AI a question with full context.
     */
    async ask(prompt, options = {}) {
        const context = await this.#memory.getRelevantContext(prompt);
        return this.#cognition.chat(prompt, { ...options, context });
    }

    /**
     * Stream AI response.
     */
    async *stream(prompt, options = {}) {
        const context = await this.#memory.getRelevantContext(prompt);
        yield* this.#cognition.stream(prompt, { ...options, context });
    }

    /**
     * Ingest a file or directory into the knowledge base.
     */
    async ingest(path) {
        return this.#ingestion.ingest(path);
    }

    /**
     * Search organizational memory.
     */
    async search(query, options = {}) {
        return this.#memory.search(query, options);
    }

    /**
     * Get full runtime health snapshot.
     */
    getHealth() {
        return {
            state: this.#state,
            uptime: Date.now() - this.#bootTime,
            metrics: { ...this.#metrics },
            subsystems: this.getSubsystemStatus(),
            pressure: this.#scheduler?.getPressure() ?? 0,
            memory: process.memoryUsage(),
        };
    }

    getSubsystemStatus() {
        return {
            events: this.#events?.getStats() ?? null,
            db: this.#db?.getStats() ?? null,
            memory: this.#memory?.getStats() ?? null,
            cognition: this.#cognition?.getStats() ?? null,
            filesystem: this.#filesystem?.getStats() ?? null,
            ingestion: this.#ingestion?.getStats() ?? null,
            swarm: this.#swarm?.getStats() ?? null,
            scheduler: this.#scheduler?.getStats() ?? null,
            selfHeal: this.#selfHeal?.getStats() ?? null,
        };
    }

    /**
     * Graceful shutdown.
     */
    async shutdown() {
        if (this.#state === 'shutdown') return;

        this.#state = 'shutdown';
        this.emit('state', this.#state);
        this.#events?.publish('system.shutdown');

        if (this.#heartbeatInterval) {
            clearInterval(this.#heartbeatInterval);
            this.#heartbeatInterval = null;
        }

        this.#selfHeal?.stop();
        this.#scheduler?.stop();
        this.#filesystem?.stop();
        await this.#memory?.flush();
        await this.#db?.close();
        this.#events?.stop();

        this.emit('shutdown');
    }

    // Accessors
    get state() { return this.#state; }
    get events() { return this.#events; }
    get db() { return this.#db; }
    get memory() { return this.#memory; }
    get cognition() { return this.#cognition; }
    get filesystem() { return this.#filesystem; }
    get swarm() { return this.#swarm; }
    get scheduler() { return this.#scheduler; }
}
