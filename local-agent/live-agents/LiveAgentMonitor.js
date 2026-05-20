/**
 * Live Agent Activity Monitor
 * Shows realtime status: Dev_AI, QA_AI, Marketing_AI, Security_AI
 * Status: idle, working, validating, rollback
 */
export class LiveAgentMonitor {
  constructor() {
    this.agents = new Map();
    this.listeners = [];
    this._initAgents();
  }

  _initAgents() {
    const agentDefs = [
      { id: 'dev', name: 'Dev_AI', icon: 'DEV', color: '#58a6ff', capabilities: ['coding', 'refactoring', 'debugging', 'code review'] },
      { id: 'qa', name: 'QA_AI', icon: 'QA', color: '#3fb950', capabilities: ['testing', 'validation', 'qa automation', 'security scanning'] },
      { id: 'marketing', name: 'Marketing_AI', icon: 'MKT', color: '#bc8cff', capabilities: ['content generation', 'social posts', 'SEO', 'changelog'] },
      { id: 'security', name: 'Security_AI', icon: 'SEC', color: '#f85149', capabilities: ['vulnerability scanning', 'policy enforcement', 'sandbox management', 'access control'] },
      { id: 'infra', name: 'Infra_AI', icon: 'INF', color: '#ffb454', capabilities: ['infrastructure orchestration', 'resource monitoring', 'alerts management', 'sandboxing'] },
    ];
    for (const def of agentDefs) {
      this.agents.set(def.id, {
        ...def,
        status: 'idle',
        currentTask: null,
        taskProgress: 0,
        startedAt: null,
        completedAt: null,
        logs: [],
        metrics: { tasksCompleted: 0, successRate: 100, avgDuration: 0 },
      });
    }
  }

  setStatus(agentId, status, task = null) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.status = status;
    agent.currentTask = task;
    if (status === 'working' && !agent.startedAt) agent.startedAt = Date.now();
    if (status === 'idle') {
      agent.completedAt = Date.now();
      if (agent.startedAt) {
        const duration = agent.completedAt - agent.startedAt;
        agent.metrics.avgDuration = (agent.metrics.avgDuration * (agent.metrics.tasksCompleted - 1) + duration) / agent.metrics.tasksCompleted;
      }
    }
    this._notify('status-change', { agentId, status, task });
  }

  updateProgress(agentId, progress) {
    const agent = this.agents.get(agentId);
    if (agent) { agent.taskProgress = Math.min(100, Math.max(0, progress)); this._notify('progress', { agentId, progress }); }
  }

  log(agentId, message, level = 'info') {
    const agent = this.agents.get(agentId);
    if (agent) { agent.logs.push({ message, level, timestamp: Date.now() }); if (agent.logs.length > 100) agent.logs.shift(); this._notify('log', { agentId, message, level }); }
  }

  completeTask(agentId, success = true) {
    const agent = this.agents.get(agentId);
    if (agent) { agent.metrics.tasksCompleted++; if (!success) agent.metrics.successRate = Math.max(0, agent.metrics.successRate - 1); this.setStatus(agentId, 'idle'); agent.currentTask = null; agent.taskProgress = 100; this._notify('task-complete', { agentId, success }); }
  }

  getAgent(agentId) { return this.agents.get(agentId); }
  getAllAgents() { return [...this.agents.values()]; }
  getActiveAgents() { return [...this.agents.values()].filter(a => a.status === 'working' || a.status === 'validating'); }
  getStats() {
    const agents = this.getAllAgents();
    return { total: agents.length, idle: agents.filter(a => a.status === 'idle').length, working: agents.filter(a => a.status === 'working').length, validating: agents.filter(a => a.status === 'validating').length, rollback: agents.filter(a => a.status === 'rollback').length, totalTasks: agents.reduce((acc, a) => acc + a.metrics.tasksCompleted, 0), avgSuccessRate: agents.reduce((acc, a) => acc + a.metrics.successRate, 0) / agents.length };
  }
  subscribe(listener) { this.listeners.push(listener); return () => { this.listeners = this.listeners.filter(l => l !== listener); }; }
  _notify(event, data) { for (const listener of this.listeners) { try { listener(event, data); } catch {} } }
}

export const agentMonitor = new LiveAgentMonitor();
export default LiveAgentMonitor;
