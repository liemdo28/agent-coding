// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({ total: 4, idle: 4, working: 0, validating: 0, rollback: 0, totalTasks: 0, avgSuccessRate: 100 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulation state
  const [simAgent, setSimAgent] = useState('dev');
  const [simStatus, setSimStatus] = useState('working');
  const [simTask, setSimTask] = useState('Implementing new component');
  const [simProgress, setSimProgress] = useState(35);
  const [simLog, setSimLog] = useState('Parsing local files and scanning symbols');

  const loadAgentData = async () => {
    try {
      const r = await api.get('/agents/status');
      if (r.success) {
        setAgents(r.data);
        setStats(r.stats);
      }
      
      const logRes = await api.get('/agents/logs');
      if (logRes.success) {
        setLogs(logRes.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentData();
    const interval = setInterval(loadAgentData, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = async () => {
    try {
      const r = await api.post(`/agents/${simAgent}/status`, {
        status: simStatus,
        task: simTask,
        progress: Number(simProgress),
        logMessage: simLog,
        logLevel: 'info',
      });
      if (r.success) {
        loadAgentData();
      }
    } catch (err) {
      alert('Simulation trigger failed: ' + err.message);
    }
  };

  const completeSimulation = async () => {
    try {
      const r = await api.post(`/agents/${simAgent}/status`, {
        status: 'idle',
        progress: 100,
        logMessage: `Task completed successfully: ${simTask}`,
      });
      if (r.success) {
        loadAgentData();
      }
    } catch (err) {
      alert('Failed to complete simulation: ' + err.message);
    }
  };

  const getStatusPulseClass = (status) => {
    switch (status) {
      case 'working': return 'pulse-cyan';
      case 'validating': return 'pulse-green';
      case 'rollback': return 'pulse-pink';
      default: return 'bg-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-purple">Live Agents Activity</h1>
          <p className="text-muted text-sm mt-1">Multi-agent collaboration hub. Monitor live logs and dispatch tasks.</p>
        </div>
      </div>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neon-card text-center">
          <div className="text-xl font-bold font-mono text-cyan-400">{stats.working}</div>
          <div className="text-xs text-muted">Working Agents</div>
        </div>
        <div className="neon-card text-center">
          <div className="text-xl font-bold font-mono text-green-400">{stats.validating}</div>
          <div className="text-xs text-muted">Validating / QA</div>
        </div>
        <div className="neon-card text-center">
          <div className="text-xl font-bold font-mono text-purple-400">{stats.totalTasks}</div>
          <div className="text-xs text-muted">Total Tasks Run</div>
        </div>
        <div className="neon-card text-center">
          <div className="text-xl font-bold font-mono text-green-400">{Math.round(stats.avgSuccessRate)}%</div>
          <div className="text-xs text-muted">Success Rate</div>
        </div>
      </div>

      {/* Agents grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="neon-card flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${getStatusPulseClass(agent.status)}`} />
                  <span className="font-bold text-slate-200" style={{ color: agent.color }}>
                    {agent.name}
                  </span>
                </div>
                <span className="text-xs font-mono uppercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {agent.status}
                </span>
              </div>

              <div className="text-xs text-slate-400 mb-3 min-h-[36px]">
                {agent.currentTask ? (
                  <>
                    <strong className="text-slate-300">Task:</strong> {agent.currentTask}
                  </>
                ) : (
                  <span className="text-muted italic">Waiting for assignments...</span>
                )}
              </div>

              {agent.status !== 'idle' && (
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px] font-mono text-muted">
                    <span>Progress</span>
                    <span>{agent.taskProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${agent.taskProgress}%`, 
                        backgroundColor: agent.color,
                        boxShadow: `0 0 8px ${agent.color}`
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-3">
                {agent.capabilities.map((c) => (
                  <span key={c} className="text-[10px] bg-slate-900 border border-slate-800/80 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="flex justify-between text-xs font-mono text-muted">
                <span>Completed Tasks</span>
                <span>{agent.metrics.tasksCompleted}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Simulation Dispatcher Controls */}
      <div className="neon-card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <span>⚙️</span> Sim-Agent Simulation Control Center
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-muted">Target Agent</label>
            <select 
              value={simAgent} 
              onChange={(e) => setSimAgent(e.target.value)}
              className="bg-slate-900 text-slate-200 border border-slate-800 rounded p-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="dev">Dev_AI</option>
              <option value="qa">QA_AI</option>
              <option value="marketing">Marketing_AI</option>
              <option value="security">Security_AI</option>
              <option value="infra">Infra_AI</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted">Simulated Status</label>
            <select 
              value={simStatus} 
              onChange={(e) => setSimStatus(e.target.value)}
              className="bg-slate-900 text-slate-200 border border-slate-800 rounded p-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="working">working</option>
              <option value="validating">validating</option>
              <option value="rollback">rollback</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted">Task Name</label>
            <input 
              value={simTask}
              onChange={(e) => setSimTask(e.target.value)}
              className="bg-slate-900 text-slate-200 border border-slate-800 rounded p-2 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted">Progress (%)</label>
            <input 
              type="number"
              value={simProgress}
              onChange={(e) => setSimProgress(e.target.value)}
              className="bg-slate-900 text-slate-200 border border-slate-800 rounded p-2 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="text-muted">New Log Message</label>
            <input 
              value={simLog}
              onChange={(e) => setSimLog(e.target.value)}
              className="bg-slate-900 text-slate-200 border border-slate-800 rounded p-2 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary text-xs" onClick={triggerSimulation}>
            Send Task/Status
          </button>
          <button className="btn btn-secondary text-xs border border-green-500/30 text-green-400 hover:border-green-500/80" onClick={completeSimulation}>
            Mark Current as Done
          </button>
        </div>
      </div>

      {/* Real-time Agents Activity log */}
      <div className="neon-card">
        <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span>📋</span> Agent Execution Feed
        </h2>
        <div className="bg-slate-950 p-4 rounded border border-slate-900 max-h-60 overflow-y-auto space-y-2 font-mono text-xs text-slate-300">
          {logs.length === 0 ? (
            <div className="text-muted italic">No logs recorded yet. Dispatch a task above.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="text-muted flex-shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="font-bold flex-shrink-0" style={{ color: agents.find(a => a.id === log.agentId)?.color ?? '#fff' }}>
                  {log.agentName}:
                </span>
                <span className="break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
