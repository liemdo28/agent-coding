/**
 * local-agent/orchestration/AgentRegistry.js
 * Phase 23: Multi-Agent Coordination Framework
 */
import { EventEmitter } from 'events';

export class AgentProfile {
    constructor({ id, name, role, capabilities, constraints, metadata = {} }) {
        this.id = id || crypto.randomUUID();
        this.name = name;
        this.role = role;
        this.capabilities = capabilities;
        this.constraints = constraints || {};
        this.metadata = metadata;
        this.status = 'idle';
        this.currentTask = null;
        this.load = 0;
        this.lastActive = Date.now();
    }
}

export class AgentRegistry extends EventEmitter {
    constructor({ workspaceRoot } = {}) {
        super();
        this.root = workspaceRoot;
        this.agents = new Map();
        this.roles = new Map();
    }

    register(profile) {
        const agent = profile instanceof AgentProfile ? profile : new AgentProfile(profile);
        this.agents.set(agent.id, agent);
        if (!this.roles.has(agent.role)) this.roles.set(agent.role, []);
        this.roles.get(agent.role).push(agent.id);
        this.emit('agent-registered', agent);
        return agent;
    }

    unregister(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) return false;
        this.agents.delete(agentId);
        const roleList = this.roles.get(agent.role);
        if (roleList) {
            const idx = roleList.indexOf(agentId);
            if (idx !== -1) roleList.splice(idx, 1);
        }
        this.emit('agent-unregistered', agent);
        return true;
    }

    get(agentId) { return this.agents.get(agentId) || null; }

    findByRole(role) {
        const ids = this.roles.get(role) || [];
        return ids.map(id => this.agents.get(id)).filter(Boolean);
    }

    findAvailable(role = null, requiredCapabilities = []) {
        let candidates = role ? this.findByRole(role) : [...this.agents.values()];
        candidates = candidates.filter(a => a.status === 'idle' && a.load < 1);
        if (requiredCapabilities.length) {
            candidates = candidates.filter(a => requiredCapabilities.every(cap => a.capabilities.includes(cap)));
        }
        return candidates.sort((a, b) => a.load - b.load);
    }

    assignTask(agentId, task) {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} not found`);
        agent.status = 'busy';
        agent.currentTask = task;
        agent.load = Math.min(1, agent.load + 0.3);
        agent.lastActive = Date.now();
        this.emit('task-assigned', { agent, task });
        return agent;
    }

    completeTask(agentId, result) {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} not found`);
        agent.status = 'idle';
        agent.currentTask = null;
        agent.load = Math.max(0, agent.load - 0.3);
        agent.lastActive = Date.now();
        this.emit('task-completed', { agent, result });
        return agent;
    }

    listAgents(filter = {}) {
        let agents = [...this.agents.values()];
        if (filter.role) agents = agents.filter(a => a.role === filter.role);
        if (filter.status) agents = agents.filter(a => a.status === filter.status);
        return agents;
    }

    getStats() {
        const agents = [...this.agents.values()];
        const byRole = {};
        const byStatus = {};
        agents.forEach(a => {
            byRole[a.role] = (byRole[a.role] || 0) + 1;
            byStatus[a.status] = (byStatus[a.status] || 0) + 1;
        });
        return { total: agents.length, byRole, byStatus, avgLoad: agents.reduce((s, a) => s + a.load, 0) / agents.length || 0 };
    }
}
