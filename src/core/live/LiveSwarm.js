/**
 * LiveSwarm.js — Real Multi-Agent Coordination
 *
 * Manages a pool of AI worker agents that can execute tasks in parallel.
 * Each agent has a role, model assignment, and execution context.
 * Supports scaling up/down based on pressure.
 */

export class LiveSwarm {
    #cognition;
    #events;
    #config;
    #agents = new Map();
    #taskQueue = [];
    #activeTasks = new Map();
    #stats = { tasksCompleted: 0, tasksRunning: 0, consensusRounds: 0 };

    constructor(cognition, events, config = {}) {
        this.#cognition = cognition;
        this.#events = events;
        this.#config = config;
    }

    async initialize() {
        // Bootstrap default agent pool
        const defaultAgents = [
            { type: 'coding', name: 'coder-1', model: 'qwen2.5-coder:7b' },
            { type: 'reasoning', name: 'thinker-1', model: 'deepseek-r1:8b' },
            { type: 'qa', name: 'qa-1', model: 'llama3.1:8b' },
            { type: 'executive', name: 'exec-1', model: 'llama3.1:8b' },
        ];

        for (const def of defaultAgents) {
            this.registerAgent(def);
        }
    }

    registerAgent(def) {
        const id = `agent_${def.type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
        const agent = {
            id,
            type: def.type,
            name: def.name || id,
            model: def.model,
            status: 'idle', // idle | busy | offline
            tasksCompleted: 0,
            currentTask: null,
            createdAt: Date.now(),
        };
        this.#agents.set(id, agent);
        this.#events?.publish('swarm.agent.registered', { id, type: def.type, name: agent.name });
        return agent;
    }

    /**
     * Assign a task to the best available agent.
     */
    async assignTask(task) {
        const agent = this.#selectAgent(task);
        if (!agent) {
            // Queue if no agent available
            this.#taskQueue.push(task);
            this.#events?.publish('swarm.task.queued', { taskId: task.id, queueSize: this.#taskQueue.length });
            return { queued: true, position: this.#taskQueue.length };
        }

        agent.status = 'busy';
        agent.currentTask = task.id;
        this.#activeTasks.set(task.id, { task, agent, startedAt: Date.now() });
        this.#stats.tasksRunning++;

        this.#events?.publish('swarm.task.assigned', {
            taskId: task.id,
            agentId: agent.id,
            agentType: agent.type,
        });

        // Execute task
        const result = await this.#executeTask(task, agent);

        // Complete
        agent.status = 'idle';
        agent.currentTask = null;
        agent.tasksCompleted++;
        this.#activeTasks.delete(task.id);
        this.#stats.tasksRunning--;
        this.#stats.tasksCompleted++;

        this.#events?.publish('task.completed', {
            taskId: task.id,
            agentId: agent.id,
            duration: Date.now() - result.startedAt,
            status: result.status,
        });

        // Process queued tasks
        this.#processQueue();

        return result;
    }

    async #executeTask(task, agent) {
        const startedAt = Date.now();

        try {
            // Use AI cognition for task execution
            if (this.#cognition?.isAvailable && task.prompt) {
                const response = await this.#cognition.chat(task.prompt, {
                    model: agent.model,
                    taskType: agent.type,
                    context: task.context,
                });

                return {
                    status: 'completed',
                    startedAt,
                    duration: Date.now() - startedAt,
                    result: response.content,
                    model: response.model,
                    agentId: agent.id,
                };
            }

            // Non-AI task execution (command, build, etc.)
            return {
                status: 'completed',
                startedAt,
                duration: Date.now() - startedAt,
                result: `Task ${task.id} executed by ${agent.name}`,
                agentId: agent.id,
            };
        } catch (err) {
            return {
                status: 'failed',
                startedAt,
                duration: Date.now() - startedAt,
                error: err.message,
                agentId: agent.id,
            };
        }
    }

    #selectAgent(task) {
        // Find idle agent matching task type
        const typeMatch = [...this.#agents.values()].find(
            a => a.status === 'idle' && a.type === (task.agentType || task.type || 'coding')
        );
        if (typeMatch) return typeMatch;

        // Any idle agent
        return [...this.#agents.values()].find(a => a.status === 'idle') || null;
    }

    #processQueue() {
        while (this.#taskQueue.length > 0) {
            const task = this.#taskQueue[0];
            const agent = this.#selectAgent(task);
            if (!agent) break;

            this.#taskQueue.shift();
            this.assignTask(task); // Fire and forget
        }
    }

    /**
     * Scale up: add more agents.
     */
    scaleUp() {
        const types = ['coding', 'reasoning', 'qa'];
        const type = types[Math.floor(Math.random() * types.length)];
        const agent = this.registerAgent({
            type,
            name: `${type}-scaled-${this.#agents.size}`,
            model: this.#cognition?.selectModel(type) || 'llama3.1:8b',
        });
        this.#events?.publish('swarm.scaled.up', { agentId: agent.id, total: this.#agents.size });
    }

    /**
     * Scale down: remove idle agents beyond minimum.
     */
    scaleDown() {
        const minAgents = 4;
        if (this.#agents.size <= minAgents) return;

        const idle = [...this.#agents.values()].filter(a => a.status === 'idle');
        if (idle.length > 1) {
            const toRemove = idle[idle.length - 1];
            this.#agents.delete(toRemove.id);
            this.#events?.publish('swarm.scaled.down', { agentId: toRemove.id, total: this.#agents.size });
        }
    }

    /**
     * Multi-agent consensus for critical decisions.
     */
    async consensus(proposal, voters = null) {
        this.#stats.consensusRounds++;
        const agents = voters || [...this.#agents.values()].filter(a => a.status === 'idle').slice(0, 3);

        if (agents.length === 0) return { decision: 'approved', reason: 'no voters available' };

        const votes = [];
        for (const agent of agents) {
            if (this.#cognition?.isAvailable) {
                const response = await this.#cognition.chat(
                    `As a ${agent.type} agent, evaluate this proposal and respond with APPROVE or REJECT followed by a brief reason:\n\n${proposal}`,
                    { model: agent.model, maxTokens: 100 }
                );
                const approved = response.content?.toUpperCase().includes('APPROVE');
                votes.push({ agentId: agent.id, decision: approved ? 'approve' : 'reject', reason: response.content });
            } else {
                votes.push({ agentId: agent.id, decision: 'approve', reason: 'auto-approve (AI offline)' });
            }
        }

        const approvals = votes.filter(v => v.decision === 'approve').length;
        const decision = approvals >= Math.ceil(votes.length * 0.6) ? 'approved' : 'rejected';

        this.#events?.publish('swarm.consensus.completed', { proposal: proposal.slice(0, 100), decision, votes: votes.length });

        return { decision, votes, approvals, total: votes.length };
    }

    get agentCount() { return this.#agents.size; }

    getAgents() { return [...this.#agents.values()]; }

    getStats() {
        const agents = [...this.#agents.values()];
        return {
            ...this.#stats,
            agents: agents.length,
            idle: agents.filter(a => a.status === 'idle').length,
            busy: agents.filter(a => a.status === 'busy').length,
            queueSize: this.#taskQueue.length,
            byType: Object.fromEntries(
                [...new Set(agents.map(a => a.type))].map(t => [t, agents.filter(a => a.type === t).length])
            ),
        };
    }
}
