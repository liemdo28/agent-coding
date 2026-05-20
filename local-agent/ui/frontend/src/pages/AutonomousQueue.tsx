// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function AutonomousQueue() {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form State
  const [newTask, setNewTask] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('MEDIUM');
  const [score, setScore] = useState(5.0);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('queue'); // queue, history

  const loadQueueData = async () => {
    try {
      const res = await api.get('/queue');
      if (res.success && res.data) {
        setQueue(res.data.queue || []);
        setHistory(res.data.history || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
    const interval = setInterval(loadQueueData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      setSubmitting(true);
      const res = await api.post('/queue/add', {
        task: newTask,
        priority: {
          level: priorityLevel,
          score: parseFloat(score),
          factors: {
            urgency: priorityLevel === 'CRITICAL' ? 9 : (priorityLevel === 'HIGH' ? 8 : 5),
            complexity: 5
          }
        }
      });
      if (res.success) {
        setNewTask('');
        loadQueueData();
      }
    } catch (err) {
      alert('Failed to add task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (level) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-400 bg-red-950/60 border-red-900';
      case 'HIGH': return 'text-orange-400 bg-orange-950/60 border-orange-900';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-950/40 border-yellow-900/60';
      default: return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">Autonomous Task Queue</h1>
          <p className="text-muted text-sm mt-1">
            Prioritized orchestration execution queue managing agent task priority, scoring, and run logs.
          </p>
        </div>
      </div>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Add task to queue */}
        <div className="neon-card flex flex-col justify-between">
          <form onSubmit={handleAddTask} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider border-b border-slate-800 pb-2">
              Queue Custom Task
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-400">Task Objective</label>
              <textarea
                placeholder="e.g. Run vulnerability audit on rawwebsite or fix build package issues..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2.5 min-h-[80px] focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-400">Priority Level</label>
                <select
                  value={priorityLevel}
                  onChange={(e) => {
                    setPriorityLevel(e.target.value);
                    if (e.target.value === 'CRITICAL') setScore(9.5);
                    else if (e.target.value === 'HIGH') setScore(8.0);
                    else setScore(5.0);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-400">Execution Score (0-10)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn btn-primary text-xs font-mono py-2 rounded"
            >
              {submitting ? 'Enqueuing...' : 'Inject Task to Queue'}
            </button>
          </form>

          <div className="text-[10px] text-muted font-mono leading-relaxed mt-6 border-t border-slate-900 pt-3">
            <strong>Orchestrator Scoring Formula:</strong> Tasks are prioritized based on factor metrics:
            <div className="text-cyan-400 mt-1">Score = (Urgency * 0.7) + (Complexity * 0.3)</div>
          </div>
        </div>

        {/* Right Tabbed panel: Active queue vs History */}
        <div className="lg:col-span-2 neon-card flex flex-col min-h-[450px]">
          <div className="flex border-b border-slate-800 mb-4">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 text-xs font-mono font-bold tracking-wider border-b-2 transition-all ${
                activeTab === 'queue' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Queue ({queue.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-xs font-mono font-bold tracking-wider border-b-2 transition-all ${
                activeTab === 'history' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed History ({history.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <div className="loading-row"><div className="spinner" />Loading queue...</div>
            ) : activeTab === 'queue' ? (
              queue.length === 0 ? (
                <div className="text-center text-xs text-muted py-12">No active tasks in queue.</div>
              ) : (
                queue.map((item, index) => (
                  <div key={item.id} className="border border-slate-800 bg-slate-950/40 p-3.5 rounded-lg flex flex-col md:flex-row justify-between gap-3 items-start md:items-center">
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-cyan-500">#{item.id}</span>
                        <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                        <span className="text-[10px] font-mono text-purple-400">Score: {item.score}</span>
                      </div>
                      <p className="text-xs text-slate-200 font-mono font-semibold">{item.task}</p>
                      <div className="text-[10px] text-muted font-mono">
                        Added: {new Date(item.addedAt).toLocaleTimeString()} | Attempts: {item.attempts}/3
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full pulse-orange" />
                      <span className="text-[10px] font-mono uppercase text-orange-400">Pending</span>
                    </div>
                  </div>
                ))
              )
            ) : (
              history.length === 0 ? (
                <div className="text-center text-xs text-muted py-12">No completed tasks in history.</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="border border-slate-800 bg-slate-950/20 p-3.5 rounded-lg flex flex-col md:flex-row justify-between gap-3 items-start md:items-center">
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-500">#{item.id}</span>
                        <span className="text-[9px] font-mono bg-green-950/50 text-green-400 border border-green-900/60 px-2 py-0.5 rounded">
                          COMPLETED
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">Score: {item.score}</span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{item.task}</p>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Completed: {new Date(item.completedAt).toLocaleTimeString()}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-green-400 font-bold">✓ Success</span>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
