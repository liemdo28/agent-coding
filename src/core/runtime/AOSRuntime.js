/**
 * AOSRuntime.js — Unified AI Operating System Runtime
 *
 * Single entry point that consolidates all prototype agents into one
 * coherent runtime with: task pipeline, memory, self-healing, and observability.
 *
 * Replaces: super_agent_offline*.py prototypes
 * Integrates: orchestration, memory, sandbox, self-heal, semantic search
 */

import { EventEmitter } from 'events';
import { TaskPipeline } from './TaskPipeline.js';
import { MemoryEngine } from '../memory/MemoryEngine.js';
import { ProjectIntelligence } from '../intelligence/ProjectIntelligence.js';
import { SelfHealingRuntime } from '../self-heal/SelfHealingRuntime.js';
import { ExecutionSandbox } from './ExecutionSandbox.js';
import { ObservabilityBus } from '../observability/ObservabilityBus.js';
import { SemanticIndex } from '../semantic/SemanticIndex.js';
import { loadRuntimeConfig } from './config.js';

// Cognition Stack
import {
    ThinkingEngine,
    ExecutionIntelligence,
    CognitionMemory,
    RuntimeNervousSystem,
    ExecutionTimeline,
    StrategicEngine,
    ReasoningStream,
} from '../cognition/index.js';

/**
 * @typedef {'idle'|'running'|'degraded'|'recovering'|'shutdown'} RuntimeState
 */

export class AOSRuntime extends EventEmitter {
    /** @type {RuntimeState} */
    #state = 'idle';
    #config;
    #pipeline;
    #memory;
    #intelligence;
    #selfHeal;
    #sandbox;
    #observability;
    #semantic;
    #startTime = 0;
    #workers = new Map();
    #maxWorkers;

    // Cognition Stack
    #thinking;
    #executionIntelligence;
    #cognitionMemory;
    #nervousSystem;
    #timeline;
    #strategic;
    #reasoningStream;

    constructor(options = {}) {
        super();
        this.#config = loadRuntimeConfig(options);
        this.#maxWorkers = this.#config.maxWorkers || 8;
    }

    /**
     * Boot the runtime — initializes all subsystems in dependency order.
     */
    async boot() {
        if (this.#state !== 'idle' && this.#state !== 'shutdown') {
            throw new Error(`Cannot boot runtime in state: ${this.#state}`);
        }

        this.#state = 'running';
        this.#startTime = Date.now();
        this.emit('state', this.#state);

        // 1. Observability first — everything else reports to it
        this.#observability = new ObservabilityBus(this.#config.observability);
        this.#observability.record('runtime.boot', { timestamp: this.#startTime });

        // 2. Memory engine — persistent state
        this.#memory = new MemoryEngine(this.#config.memory);
        await this.#memory.initialize();
        this.#observability.record('memory.initialized');

        // 3. Semantic index — search and embeddings
        this.#semantic = new SemanticIndex(this.#config.semantic);
        await this.#semantic.initialize();
        this.#observability.record('semantic.initialized');

        // 4. Project intelligence — understands codebases
        this.#intelligence = new ProjectIntelligence(this.#config.intelligence, {
            memory: this.#memory,
            semantic: this.#semantic,
        });

        // 5. Execution sandbox — safe command execution
        this.#sandbox = new ExecutionSandbox(this.#config.sandbox);

        // 6. Self-healing — monitors and recovers
        this.#selfHeal = new SelfHealingRuntime(this.#config.selfHeal, {
            observability: this.#observability,
            memory: this.#memory,
        });
        this.#selfHeal.on('recovery', (event) => {
            this.#observability.record('self-heal.recovery', event);
            if (this.#state === 'degraded') {
                this.#state = 'running';
                this.emit('state', this.#state);
            }
        });
        this.#selfHeal.on('degraded', () => {
            this.#state = 'degraded';
            this.emit('state', this.#state);
        });

        // 7. Task pipeline — the execution engine
        this.#pipeline = new TaskPipeline(this.#config.pipeline, {
            sandbox: this.#sandbox,
            memory: this.#memory,
            intelligence: this.#intelligence,
            observability: this.#observability,
            selfHeal: this.#selfHeal,
        });

        // === COGNITION STACK ===

        // 8. Execution Timeline — chronological event tracking
        this.#timeline = new ExecutionTimeline(this.#config.cognition?.timeline);
        this.#observability.record('cognition.timeline.initialized');

        // 9. Cognition Memory — episodic, strategic, organizational
        this.#cognitionMemory = new CognitionMemory(this.#memory, this.#config.cognition?.memory);
        await this.#cognitionMemory.initialize();
        this.#observability.record('cognition.memory.initialized');

        // 10. Thinking Engine — reasoning graphs, thought trees
        this.#thinking = new ThinkingEngine(this.#config.cognition?.thinking, {
            memory: this.#memory,
            observability: this.#observability,
        });
        this.#observability.record('cognition.thinking.initialized');

        // 11. Execution Intelligence — log parsing, error analysis
        this.#executionIntelligence = new ExecutionIntelligence(this.#config.cognition?.execution, {
            memory: this.#memory,
        });
        this.#observability.record('cognition.execution-intelligence.initialized');

        // 12. Runtime Nervous System — realtime sensors
        this.#nervousSystem = new RuntimeNervousSystem(this.#config.cognition?.nervous, {
            observability: this.#observability,
        });
        this.#nervousSystem.start();
        this.#observability.record('cognition.nervous-system.started');

        // 13. Strategic Engine — autonomous proposals
        this.#strategic = new StrategicEngine(this.#config.cognition?.strategic, {
            memory: this.#cognitionMemory,
            intelligence: this.#intelligence,
            timeline: this.#timeline,
            nervousSystem: this.#nervousSystem,
        });
        this.#observability.record('cognition.strategic.initialized');

        // 14. Reasoning Stream — realtime UI stream
        this.#reasoningStream = new ReasoningStream(this.#config.cognition?.stream);
        this.#reasoningStream.start();
        this.#reasoningStream.connectToThinkingEngine(this.#thinking);
        this.#observability.record('cognition.reasoning-stream.started');

        // === END COGNITION STACK ===

        this.#observability.record('runtime.ready', {
            bootTime: Date.now() - this.#startTime,
            maxWorkers: this.#maxWorkers,
            cognitionEnabled: true,
        });

        this.emit('ready');
        return this;
    }

    /**
     * Submit a task to the runtime pipeline.
     * @param {object} task - { type, command, project, priority, metadata }
     * @returns {Promise<object>} execution result
     */
    async execute(task) {
        if (this.#state === 'shutdown') {
            throw new Error('Runtime is shut down');
        }
        if (this.#state === 'recovering') {
            await this.#waitForRecovery();
        }

        const enrichedTask = await this.#intelligence.enrichTask(task);
        this.#observability.record('task.submitted', { id: enrichedTask.id, type: enrichedTask.type });

        const result = await this.#pipeline.execute(enrichedTask);

        // Persist execution to memory
        await this.#memory.recordExecution({
            taskId: enrichedTask.id,
            type: enrichedTask.type,
            result: result.status,
            duration: result.duration,
            timestamp: Date.now(),
        });

        this.#observability.record('task.completed', {
            id: enrichedTask.id,
            status: result.status,
            duration: result.duration,
        });

        return result;
    }

    /**
     * Analyze a project and build intelligence profile.
     * @param {string} projectPath
     * @returns {Promise<object>} project profile
     */
    async analyzeProject(projectPath) {
        return this.#intelligence.analyze(projectPath);
    }

    /**
     * Semantic search across indexed projects.
     * @param {string} query
     * @param {object} options
     * @returns {Promise<Array>} search results
     */
    async search(query, options = {}) {
        return this.#semantic.search(query, options);
    }

    /**
     * Get runtime health and metrics.
     */
    getHealth() {
        return {
            state: this.#state,
            uptime: this.#state !== 'idle' ? Date.now() - this.#startTime : 0,
            pipeline: this.#pipeline?.getStats() ?? null,
            memory: this.#memory?.getStats() ?? null,
            workers: this.#workers.size,
            maxWorkers: this.#maxWorkers,
        };
    }

    /**
     * Execute a full AI reasoning chain for a problem.
     * @param {object} problem - { description, project, context, constraints }
     * @returns {Promise<object>} reasoning result with plan and confidence
     */
    async reason(problem) {
        return this.#thinking.reason(problem);
    }

    /**
     * Analyze build/test output with execution intelligence.
     * @param {string} rawLog - Raw log output
     * @param {object} context - { project, command, type }
     * @returns {object} Structured analysis
     */
    analyzeLogs(rawLog, context = {}) {
        return this.#executionIntelligence.analyze(rawLog, context);
    }

    /**
     * Run strategic analysis on a project.
     * @param {string} projectPath
     * @returns {Promise<object>} Strategic proposals
     */
    async strategicAnalysis(projectPath) {
        const profile = await this.#intelligence.analyze(projectPath);
        return this.#strategic.analyze(profile);
    }

    /**
     * Get the reasoning stream for UI consumption.
     */
    getReasoningStream() {
        return this.#reasoningStream;
    }

    /**
     * Get the execution timeline.
     */
    getTimeline() {
        return this.#timeline;
    }

    /**
     * Get full runtime health including cognition stack.
     */
    getHealth() {
        return {
            state: this.#state,
            uptime: this.#state !== 'idle' ? Date.now() - this.#startTime : 0,
            pipeline: this.#pipeline?.getStats() ?? null,
            memory: this.#memory?.getStats() ?? null,
            workers: this.#workers.size,
            maxWorkers: this.#maxWorkers,
            cognition: {
                thinking: this.#thinking?.getStats() ?? null,
                executionIntelligence: this.#executionIntelligence?.getStats() ?? null,
                cognitionMemory: this.#cognitionMemory?.getStats() ?? null,
                nervousSystem: this.#nervousSystem?.getStats() ?? null,
                timeline: this.#timeline?.getStats() ?? null,
                strategic: this.#strategic?.getStats() ?? null,
                reasoningStream: this.#reasoningStream?.getStats() ?? null,
            },
        };
    }

    /**
     * Graceful shutdown.
     */
    async shutdown() {
        if (this.#state === 'shutdown') return;

        this.#observability?.record('runtime.shutdown');
        this.#state = 'shutdown';
        this.emit('state', this.#state);

        // Stop cognition stack
        this.#nervousSystem?.stop();
        this.#reasoningStream?.stop();
        await this.#cognitionMemory?.flush();

        // Drain pipeline
        await this.#pipeline?.drain();

        // Persist memory
        await this.#memory?.flush();

        // Stop self-heal monitoring
        this.#selfHeal?.stop();

        this.emit('shutdown');
    }

    /** Wait for recovery to complete before accepting new tasks */
    #waitForRecovery() {
        return new Promise((resolve) => {
            if (this.#state !== 'recovering') return resolve();
            this.once('state', (state) => {
                if (state === 'running' || state === 'degraded') resolve();
            });
        });
    }

    get state() { return this.#state; }
    get observability() { return this.#observability; }
    get memory() { return this.#memory; }
    get intelligence() { return this.#intelligence; }
    get semantic() { return this.#semantic; }
}
