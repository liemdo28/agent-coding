// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Reasoning() {
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSteps = async () => {
    try {
      const r = await api.get('/reasoning/steps');
      if (r.success) {
        setSteps(r.data);
        setProgress(r.progress);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSteps();
    const interval = setInterval(loadSteps, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Clear all reasoning history?')) return;
    try {
      const r = await api.post('/reasoning/clear');
      if (r.success) {
        setSteps([]);
        setProgress({ total: 0, completed: 0, failed: 0, active: 0 });
      }
    } catch (err) {
      alert('Failed to clear: ' + err.message);
    }
  };

  const getPercent = () => {
    if (!progress.total) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">AI Reasoning Engine</h1>
          <p className="text-muted text-sm mt-1">Real-time execution phases, logic branching, and subtask tracking.</p>
        </div>
        <button className="btn btn-secondary border border-red-500/30 hover:border-red-500/80 text-red-400 text-xs" onClick={handleClear}>
          Clear History
        </button>
      </div>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {/* Progress Card */}
      <div className="neon-card">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-semibold">Real-time Strategy Execution</div>
          <div className="text-sm font-mono text-cyan-400">{getPercent()}% Completed</div>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500" 
            style={{ width: `${getPercent()}%`, boxShadow: '0 0 8px var(--neon-cyan)' }}
          />
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4 text-center">
          <div className="border-r border-slate-800">
            <div className="text-lg font-bold font-mono text-cyan-400">{progress.total}</div>
            <div className="text-xs text-muted">Total Phases</div>
          </div>
          <div className="border-r border-slate-800">
            <div className="text-lg font-bold font-mono text-green-400">{progress.completed}</div>
            <div className="text-xs text-muted">Completed</div>
          </div>
          <div className="border-r border-slate-800">
            <div className="text-lg font-bold font-mono text-red-400">{progress.failed}</div>
            <div className="text-xs text-muted">Failed</div>
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-yellow-400 flex justify-center items-center gap-1.5">
              {progress.active > 0 && <span className="pulse-cyan" />}
              {progress.active}
            </div>
            <div className="text-xs text-muted">Running</div>
          </div>
        </div>
      </div>

      {loading && steps.length === 0 ? (
        <div className="loading-row"><div className="spinner" />Loading reasoning tree...</div>
      ) : steps.length === 0 ? (
        <div className="empty-state neon-card">
          <div className="empty-icon text-3xl mb-2">⚡</div>
          <div className="font-semibold text-slate-300">Reasoning Engine Idle</div>
          <div className="text-xs text-muted mt-1">Start a CLI agent ask task or prompt content generation to see reasoning.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step) => {
            const isActive = step.status === 'active';
            const isCompleted = step.status === 'completed';
            const isFailed = step.status === 'failed';
            
            let cardClass = "neon-card border-slate-800";
            if (isActive) cardClass = "neon-card border-cyan-500/50 shadow-[0_0_15px_rgba(0,242,254,0.1)]";
            if (isFailed) cardClass = "neon-card border-red-500/30";

            return (
              <div key={step.id} className={cardClass}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {isActive && <span className="pulse-cyan" />}
                    {isCompleted && <span className="text-green-400">✓</span>}
                    {isFailed && <span className="text-red-400">✗</span>}
                    <span className={`font-mono text-sm font-bold ${isActive ? 'text-cyan-400' : isCompleted ? 'text-green-400' : 'text-red-400'}`}>
                      {step.phase}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-muted">
                    {step.duration ? `${(step.duration / 1000).toFixed(2)}s` : 'running...'}
                  </div>
                </div>

                {step.details && Object.keys(step.details).length > 0 && (
                  <div className="mt-2 text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded border border-slate-800/80 font-mono overflow-x-auto">
                    {JSON.stringify(step.details, null, 2)}
                  </div>
                )}

                {step.subSteps && step.subSteps.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-slate-800 space-y-2">
                    {step.subSteps.map((sub) => (
                      <div key={sub.id} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 flex items-center gap-2">
                          <span className={sub.status === 'active' ? 'pulse-cyan' : 'text-slate-500'}>•</span>
                          {sub.label}
                        </span>
                        {sub.details?.path && (
                          <span className="text-[10px] font-mono text-slate-500">{sub.details.path}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {step.output && (
                  <div className="mt-3 text-xs bg-slate-950 p-3 rounded border border-slate-900 font-mono text-cyan-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {step.output}
                  </div>
                )}

                {step.error && (
                  <div className="mt-3 text-xs bg-red-950/20 p-3 rounded border border-red-900/40 font-mono text-red-400">
                    Error: {step.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
