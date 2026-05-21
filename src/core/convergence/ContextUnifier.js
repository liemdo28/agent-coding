/**
 * ContextUnifier.js — L2: Unified Cognitive Context Assembly
 *
 * The most important engine. AI quality depends entirely on context assembly quality.
 * Combines ALL system state into a single UnifiedCognitiveContext for every decision.
 *
 * Sources:
 * - Owner intent (current task/prompt)
 * - Memory (organizational history)
 * - Runtime state (pressure, health, workers)
 * - Filesystem (project topology, recent changes)
 * - Active incidents (ongoing recovery)
 * - Swarm state (agent availability, consensus)
 * - Strategic constraints (debt, risks, priorities)
 * - Project topology (dependencies, architecture)
 */

export class ContextUnifier {
    #runtime;
    #cache = new Map();
    #cacheTTL = 5000; // 5s cache for expensive lookups
    #stats = { assemblies: 0, cacheHits: 0, avgAssemblyMs: 0 };
    #assemblyTimes = [];

    constructor(runtime) {
        this.#runtime = runtime;
    }

    /**
     * Assemble full cognitive context for a decision/task.
     * @param {object} intent - { prompt, type, project, priority, metadata }
     * @returns {UnifiedCognitiveContext}
     */
    async assemble(intent = {}) {
        const start = Date.now();
        this.#stats.assemblies++;

        const [
            memoryContext,
            runtimeState,
            filesystemState,
            swarmState,
            recentEvents,
        ] = await Promise.all([
            this.#getMemoryContext(intent),
            this.#getRuntimeState(),
            this.#getFilesystemState(intent.project),
            this.#getSwarmState(),
            this.#getRecentEvents(),
        ]);

        const orgState = this.#deriveOrganizationalState(runtimeState, swarmState, recentEvents);

        const context = {
            // Owner intent
            intent: {
                prompt: intent.prompt || null,
                type: intent.type || 'general',
                project: intent.project || null,
                priority: intent.priority || 'normal',
            },

            // Organizational memory
            memory: memoryContext,

            // Runtime health
            runtime: runtimeState,

            // Filesystem awareness
            filesystem: filesystemState,

            // Swarm coordination
            swarm: swarmState,

            // Recent activity
            recentEvents: recentEvents.slice(0, 20),

            // Derived organizational state
            orgState,

            // Strategic constraints
            constraints: this.#deriveConstraints(runtimeState, orgState),

            // Assembly metadata
            _meta: {
                assembledAt: Date.now(),
                assemblyMs: Date.now() - start,
                sources: ['memory', 'runtime', 'filesystem', 'swarm', 'events'],
            },
        };

        // Track performance
        const elapsed = Date.now() - start;
        this.#assemblyTimes.push(elapsed);
        if (this.#assemblyTimes.length > 50) this.#assemblyTimes.shift();
        this.#stats.avgAssemblyMs = Math.round(
            this.#assemblyTimes.reduce((a, b) => a + b, 0) / this.#assemblyTimes.length
        );

        return context;
    }

    /**
     * Compress context into a token-efficient string for AI consumption.
     */
    compress(context) {
        const parts = [];

        // Organizational state
        parts.push(`[State: ${context.orgState.state}] [Pressure: ${context.runtime?.pressure ?? 0}]`);

        // Intent
        if (context.intent.prompt) {
            parts.push(`Task: ${context.intent.type} | Priority: ${context.intent.priority}`);
        }

        // Memory highlights
        if (context.memory?.relevant?.length > 0) {
            parts.push('Memory:');
            for (const m of context.memory.relevant.slice(0, 5)) {
                parts.push(`  • ${m.key}: ${String(m.value).slice(0, 100)}`);
            }
        }

        // Recent executions
        if (context.memory?.recentExecutions?.length > 0) {
            parts.push('Recent:');
            for (const e of context.memory.recentExecutions.slice(0, 3)) {
                parts.push(`  • ${e.task_type}: ${e.status} (${e.duration_ms}ms)`);
            }
        }

        // Filesystem
        if (context.filesystem?.recentChanges?.length > 0) {
            parts.push('Changes:');
            for (const c of context.filesystem.recentChanges.slice(0, 3)) {
                parts.push(`  • ${c.path} (${c.type})`);
            }
        }

        // Constraints
        if (context.constraints?.length > 0) {
            parts.push('Constraints:');
            for (const c of context.constraints) {
                parts.push(`  ⚠ ${c}`);
            }
        }

        return parts.join('\n');
    }

    async #getMemoryContext(intent) {
        const memory = this.#runtime?.memory;
        if (!memory) return { relevant: [], recentExecutions: [] };

        const [relevant, execContext] = await Promise.all([
            intent.prompt ? memory.search(intent.prompt, { limit: 10 }) : Promise.resolve([]),
            memory.getContext(intent.project, intent.type),
        ]);

        return {
            relevant: relevant || [],
            recentExecutions: execContext?.executions || [],
            projectMemory: execContext?.projectMemory || {},
        };
    }

    #getRuntimeState() {
        const health = this.#runtime?.getHealth?.();
        if (!health) return { state: 'unknown', pressure: 0 };

        return {
            state: health.state,
            pressure: health.pressure ?? 0,
            uptime: health.uptime ?? 0,
            memoryUsage: health.memory ?? process.memoryUsage(),
        };
    }

    #getFilesystemState(project) {
        const fs = this.#runtime?.filesystem;
        if (!fs) return { projects: [], recentChanges: [] };

        const events = this.#runtime?.events;
        const recentChanges = events
            ? events.getRecent(10, 'fs.file.changed').map(e => e.data)
            : [];

        return {
            projects: fs.getProjects?.() || [],
            recentChanges,
            stats: fs.getStats?.() || {},
        };
    }

    #getSwarmState() {
        const swarm = this.#runtime?.swarm;
        if (!swarm) return { agents: 0, idle: 0, busy: 0 };

        const stats = swarm.getStats?.();
        return {
            agents: stats?.agents || 0,
            idle: stats?.idle || 0,
            busy: stats?.busy || 0,
            queueSize: stats?.queueSize || 0,
            byType: stats?.byType || {},
        };
    }

    #getRecentEvents() {
        const events = this.#runtime?.events;
        if (!events) return [];
        return events.getRecent(30);
    }

    /**
     * Derive organizational state from subsystem states.
     */
    #deriveOrganizationalState(runtime, swarm, events) {
        const pressure = runtime?.pressure ?? 0;
        const hasIncident = events.some(e => e.topic?.includes('incident') || e.topic?.includes('error'));
        const isRecovering = events.some(e => e.topic?.includes('recovery'));
        const highPressure = pressure > 0.7;

        let state = 'stable';
        if (hasIncident) state = 'incident';
        else if (isRecovering) state = 'recovery';
        else if (highPressure) state = 'high_pressure';
        else if (swarm.busy > swarm.idle) state = 'focused';

        return {
            state,
            pressure,
            agentUtilization: swarm.agents > 0 ? swarm.busy / swarm.agents : 0,
            eventRate: events.length,
        };
    }

    /**
     * Derive active constraints based on state.
     */
    #deriveConstraints(runtime, orgState) {
        const constraints = [];

        if (orgState.state === 'incident') {
            constraints.push('INCIDENT ACTIVE: prioritize recovery over new work');
        }
        if (orgState.state === 'high_pressure') {
            constraints.push('HIGH PRESSURE: defer non-critical tasks');
        }
        if (orgState.pressure > 0.9) {
            constraints.push('CRITICAL PRESSURE: shed load immediately');
        }
        if (orgState.agentUtilization > 0.8) {
            constraints.push('SWARM SATURATED: queue new tasks');
        }

        return constraints;
    }

    getStats() {
        return { ...this.#stats };
    }
}
