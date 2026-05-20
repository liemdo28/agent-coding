// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Timeline() {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTimeline = async () => {
    try {
      const res = await api.get('/reasoning/timeline');
      if (res.success) {
        setTimeline(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
    const interval = setInterval(loadTimeline, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-purple">AI Audit Timeline</h1>
          <p className="text-muted text-sm mt-1">Chronological log of agent reasoning, phase transitions, and test suite executions.</p>
        </div>
      </div>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {loading && timeline.length === 0 ? (
        <div className="loading-row"><div className="spinner" />Assembling chronological logs...</div>
      ) : timeline.length === 0 ? (
        <div className="empty-state neon-card">
          <div className="empty-icon text-3xl mb-2">📅</div>
          <div className="font-semibold text-slate-300">Timeline Empty</div>
          <div className="text-xs text-muted mt-1">No execution history recorded yet. Inquire with the agent or scan a path first.</div>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-slate-800 space-y-6 font-mono text-xs">
          {timeline.map((item, idx) => {
            const isCompleted = item.status === 'completed';
            const isFailed = item.status === 'failed';
            const isActive = item.status === 'active';

            let dotClass = "absolute -left-[5px] h-2.5 w-2.5 rounded-full border border-bg ";
            if (isActive) dotClass += "bg-cyan-400 shadow-[0_0_8px_var(--neon-cyan)]";
            else if (isCompleted) dotClass += "bg-green-400";
            else if (isFailed) dotClass += "bg-red-400";
            else dotClass += "bg-slate-600";

            return (
              <div key={item.id || idx} className="relative group">
                {/* Timeline Dot */}
                <div className={dotClass} style={{ top: '6px' }} />

                <div className="neon-card bg-slate-900/10 hover:bg-slate-900/30 transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <span className={`font-bold ${isActive ? 'text-cyan-400' : isCompleted ? 'text-green-400' : 'text-red-400'}`}>
                      PHASE: {item.phase}
                    </span>
                    <span className="text-muted text-[10px]">
                      {new Date(item.start).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-slate-400 space-y-1.5 pl-2 border-l border-slate-800">
                    <div>
                      <strong>Status:</strong> <span className={isActive ? 'text-cyan-400 font-bold' : isCompleted ? 'text-green-400' : 'text-red-400'}>{item.status}</span>
                    </div>
                    {item.duration && (
                      <div>
                        <strong>Duration:</strong> {(item.duration / 1000).toFixed(2)}s
                      </div>
                    )}
                    {item.subSteps && item.subSteps.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        <strong>Sub-operations:</strong>
                        <div className="pl-3 space-y-1 text-slate-500">
                          {item.subSteps.map((sub, sIdx) => (
                            <div key={sIdx} className="flex justify-between items-center text-[11px]">
                              <span>• {sub.label}</span>
                              <span>{sub.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
