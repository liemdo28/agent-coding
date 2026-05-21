/**
 * AutonomousExpansionEngine.js — Self-Expanding Civilization
 *
 * AI autonomously:
 * - Spawns agents
 * - Creates execution swarms
 * - Expands optimization pipelines
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class AutonomousExpansionEngine extends EventEmitter {
    #config;
    #expansions = [];
    #activeSwarms = new Map();
    #stats = { expansionsTriggered: 0, swarmsSpawned: 0, agentsCreated: 0, pipelinesExpanded: 0 };

    constructor(config = {}) {
        super();
        this.#config = {
            maxSwarms: config.maxSwarms || 20,
            maxAgentsPerSwarm: config.maxAgentsPerSwarm || 10,
            expansionCooldown: config.expansionCooldown || 60000,
            ...config,
        };
    }

    expand(trigger, spec) {
        this.#stats.expansionsTriggered++;
        const expansion = {
            id: randomUUID(), trigger, type: spec.type || 'swarm',
            agents: spec.agents || 1, target: spec.target,
            status: 'active', createdAt: Date.now(),
        };

        if (spec.type === 'swarm') {
            this.#activeSwarms.set(expansion.id, { ...expansion, agents: [] });
            for (let i = 0; i < (spec.agents || 1); i++) {
                this.#activeSwarms.get(expansion.id).agents.push({ id: randomUUID(), role: spec.role || 'worker' });
                this.#stats.agentsCreated++;
            }
            this.#stats.swarmsSpawned++;
        } else if (spec.type === 'pipeline') {
            this.#stats.pipelinesExpanded++;
        }

        this.#expansions.push(expansion);
        this.emit('expansion:triggered', expansion);
        return expansion;
    }

    dissolveSwarm(swarmId) {
        const swarm = this.#activeSwarms.get(swarmId);
        if (swarm) { swarm.status = 'dissolved'; this.#activeSwarms.delete(swarmId); this.emit('swarm:dissolved', { id: swarmId }); return true; }
        return false;
    }

    getActiveSwarms() { return [...this.#activeSwarms.values()]; }
    getExpansions(limit = 20) { return this.#expansions.slice(-limit); }
    getStats() { return { ...this.#stats, activeSwarms: this.#activeSwarms.size }; }
}
