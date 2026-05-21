/**
 * AliveSystem.js — THE SINGLE ENTRY POINT
 *
 * Boots LiveRuntime + Convergence Layer into one living cognitive organism.
 * This is the final operational form:
 *
 *   Persistent Local-First Autonomous Engineering Intelligence Runtime Environment
 *
 * Usage:
 *   const system = new AliveSystem();
 *   await system.boot();
 *   // System is now alive — thinking, remembering, predicting, evolving.
 *   const result = await system.think({ prompt: '...', type: 'coding' });
 */

import { LiveRuntime } from './LiveRuntime.js';
import { ContextUnifier } from '../convergence/ContextUnifier.js';
import { CognitionBridge } from '../convergence/CognitionBridge.js';
import { CognitionLoop } from '../convergence/CognitionLoop.js';
import { ExecutionCompression } from '../convergence/ExecutionCompression.js';
import { RuntimeIntelligence } from '../convergence/RuntimeIntelligence.js';
import { OrgStateMachine } from '../convergence/OrgStateMachine.js';
import { MemoryEvolution } from '../convergence/MemoryEvolution.js';
import { StrategicCore } from '../convergence/StrategicCore.js';

export class AliveSystem {
    #live;
    #contextUnifier;
    #bridge;
    #loop;
    #compression;
    #intelligence;
    #orgState;
    #memoryEvolution;
    #strategic;
    #bootedAt = 0;

    constructor(config = {}) {
        this.#live = new LiveRuntime(config);
    }

    /**
     * Boot the entire living system.
     * After this call, the system is alive and thinking continuously.
     */
    async boot() {
        // 1. Boot infrastructure
        await this.#live.boot();
        this.#bootedAt = Date.now();

        const events = this.#live.events;
        const db = this.#live.db;

        // 2. Boot convergence layer
        this.#compression = new ExecutionCompression(events);
        this.#orgState = new OrgStateMachine(events);
        this.#orgState.start();

        this.#contextUnifier = new ContextUnifier(this.#live);
        this.#bridge = new CognitionBridge(this.#live, events, this.#contextUnifier, this.#compression);
        this.#bridge.start();

        this.#intelligence = new RuntimeIntelligence(this.#live, events);
        this.#intelligence.start();

        this.#memoryEvolution = new MemoryEvolution(db, events);
        this.#memoryEvolution.start();

        this.#strategic = new StrategicCore(this.#live, events, db);
        this.#strategic.start();

        // 3. Start the continuous cognition loop — THE HEARTBEAT
        this.#loop = new CognitionLoop({
            runtime: this.#live,
            events,
            contextUnifier: this.#contextUnifier,
            compression: this.#compression,
            intelligence: this.#intelligence,
            orgState: this.#orgState,
            memoryEvolution: this.#memoryEvolution,
            strategic: this.#strategic,
        });
        this.#loop.start();

        // 4. Wire org state changes to loop speed
        events.subscribe('org.state.changed', (data) => {
            this.#loop.adjustSpeed(data.to);
        });

        events.publish('system.fully.alive', {
            bootMs: Date.now() - this.#bootedAt,
            subsystems: 18,
        });

        return this;
    }

    /**
     * PRIMARY API: Think with full organizational cognition.
     * Assembles context, routes through swarm, persists learnings.
     */
    async think(intent) {
        return this.#bridge.think(intent);
    }

    /**
     * Ask the AI with memory-augmented context.
     */
    async ask(prompt, options = {}) {
        return this.#live.ask(prompt, options);
    }

    /**
     * Stream AI response with context.
     */
    async *stream(prompt, options = {}) {
        yield* this.#live.stream(prompt, options);
    }

    /**
     * Submit a task to the scheduler.
     */
    async submit(task) {
        return this.#live.submit(task);
    }

    /**
     * Ingest knowledge into the system.
     */
    async ingest(path) {
        return this.#live.ingest(path);
    }

    /**
     * Search organizational memory.
     */
    async search(query, options = {}) {
        return this.#live.search(query, options);
    }

    /**
     * Get full system health — infrastructure + cognition.
     */
    getHealth() {
        return {
            ...this.#live.getHealth(),
            cognition: {
                loop: this.#loop?.getStats() ?? null,
                orgState: this.#orgState?.getStats() ?? null,
                intelligence: this.#intelligence?.getStats() ?? null,
                compression: this.#compression?.getStats() ?? null,
                memoryEvolution: this.#memoryEvolution?.getStats() ?? null,
                strategic: this.#strategic?.getStats() ?? null,
                bridge: this.#bridge?.getStats() ?? null,
                context: this.#contextUnifier?.getStats() ?? null,
            },
        };
    }

    /**
     * Get organizational state and behavior.
     */
    getOrgState() {
        return this.#orgState?.getStats() ?? { state: 'unknown' };
    }

    /**
     * Get active predictions.
     */
    getPredictions() {
        return this.#intelligence?.getPredictions() ?? [];
    }

    /**
     * Get strategic risks and proposals.
     */
    getStrategic() {
        return {
            risks: this.#strategic?.getRisks() ?? [],
            proposals: this.#strategic?.getProposals() ?? [],
        };
    }

    /**
     * Graceful shutdown.
     */
    async shutdown() {
        this.#loop?.stop();
        this.#intelligence?.stop();
        this.#memoryEvolution?.stop();
        this.#strategic?.stop();
        await this.#live.shutdown();
    }

    // Accessors
    get state() { return this.#live.state; }
    get orgState() { return this.#orgState?.state ?? 'unknown'; }
    get events() { return this.#live.events; }
    get memory() { return this.#live.memory; }
    get swarm() { return this.#live.swarm; }
    get filesystem() { return this.#live.filesystem; }
    get cognition() { return this.#live.cognition; }
}
