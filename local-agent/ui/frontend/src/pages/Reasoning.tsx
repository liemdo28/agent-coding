// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';

export default function Reasoning() {
  const [steps, setSteps] = useState([]);
  const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Task Planner Sandbox state
  const [sandboxGoal, setSandboxGoal] = useState('Optimize database connection pooling & scan auth vulnerabilities on dashboard');
  const [sandboxPlan, setSandboxPlan] = useState(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningError, setPlanningError] = useState(null);

  // SSE Stream logic
  useEffect(() => {
    setLoading(true);
    const eventSource = new EventSource('/api/reasoning/stream');

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'init') {
          setSteps(payload.steps || []);
        } else if (payload.type === 'phase-start') {
          setSteps((prev) => {
            const exists = prev.find(s => s.id === payload.data.id);
            if (exists) return prev.map(s => s.id === payload.data.id ? payload.data : s);
            return [...prev, payload.data];
          });
        } else if (payload.type === 'sub-step') {
          setSteps((prev) => {
            return prev.map(s => {
              if (s.phase === payload.data.phase) {
                const subSteps = s.subSteps || [];
                const subExists = subSteps.find(sub => sub.id === payload.data.subStep.id);
                const updatedSubSteps = subExists 
                  ? subSteps.map(sub => sub.id === payload.data.subStep.id ? payload.data.subStep : sub)
                  : [...subSteps, payload.data.subStep];
                return { ...s, subSteps: updatedSubSteps };
              }
              return s;
            });
          });
        } else if (payload.type === 'phase-complete' || payload.type === 'phase-fail') {
          setSteps((prev) => {
            return prev.map(s => s.id === payload.data.id ? payload.data : s);
          });
        }
        
        if (payload.progress) {
          setProgress(payload.progress);
        }
        setError(null);
      } catch (err) {
        console.error('SSE JSON parse error:', err);
      } finally {
        setLoading(false);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE stream error:', err);
      setError('Connection to live reasoning stream lost. Retrying...');
      setLoading(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Fetch initial decision graph from Sandbox Goal
  useEffect(() => {
    triggerGoalPlanning();
  }, []);

  const triggerGoalPlanning = async () => {
    if (!sandboxGoal.trim()) return;
    setPlanningLoading(true);
    setPlanningError(null);
    try {
      const r = await api.post('/cognition/plan', { goal: sandboxGoal });
      if (r.success) {
        setSandboxPlan(r.data);
      } else {
        setPlanningError(r.error || 'Failed to generate task plan');
      }
    } catch (err) {
      setPlanningError(err.message);
    } finally {
      setPlanningLoading(false);
    }
  };

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

  // Pre-calculate positions for the SVG Decision Graph layout
  const renderDecisionGraphSvg = () => {
    if (!sandboxPlan || !sandboxPlan.decisionGraph) return null;
    const { nodes, edges } = sandboxPlan.decisionGraph;
    
    // Statically lay out nodes inside a responsive viewport
    // Vertical flowchart: x=250, y spreads from 40 to 450
    const nodeCoords = {};
    let stepIndex = 0;
    
    nodes.forEach((node) => {
      if (node.id === 'goal') {
        nodeCoords[node.id] = { x: 250, y: 30 };
      } else if (node.id === 'dep') {
        nodeCoords[node.id] = { x: 250, y: 90 };
      } else if (node.id === 'risk') {
        nodeCoords[node.id] = { x: 250, y: 150 };
      } else if (node.id === 'plan') {
        nodeCoords[node.id] = { x: 250, y: 210 };
      } else {
        // Cascade subtask steps
        nodeCoords[node.id] = { x: 250, y: 280 + (stepIndex * 65) };
        stepIndex++;
      }
    });

    const totalHeight = 310 + (stepIndex * 65);

    return (
      <div className="relative w-full overflow-x-auto bg-slate-950/80 p-4 rounded-lg border border-slate-800">
        <div className="text-xs font-mono text-cyan-400/80 mb-2 uppercase tracking-widest flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-ping" />
          Live Cognitive Graph Engine
        </div>
        <svg 
          width="100%" 
          height={totalHeight} 
          viewBox={`0 0 500 ${totalHeight}`} 
          className="mx-auto"
        >
          {/* Definitions for arrow markers and glows */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#1e293b" />
            </marker>
            <marker id="arrow-glow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#00f2fe" />
            </marker>
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Draw connecting edges */}
          {edges.map((edge, idx) => {
            const start = nodeCoords[edge.from];
            const end = nodeCoords[edge.to];
            if (!start || !end) return null;
            
            const isTargetActive = nodes.find(n => n.id === edge.to)?.status === 'active';
            
            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={isTargetActive ? '#00f2fe' : '#1e293b'}
                  strokeWidth={isTargetActive ? '2.5' : '1.5'}
                  strokeDasharray={isTargetActive ? '5,5' : 'none'}
                  className={isTargetActive ? 'animate-[dash_10s_linear_infinite]' : ''}
                  markerEnd={isTargetActive ? 'url(#arrow-glow)' : 'url(#arrow)'}
                />
              </g>
            );
          })}

          {/* Draw nodes */}
          {nodes.map((node) => {
            const coord = nodeCoords[node.id];
            if (!coord) return null;
            
            const isCompleted = node.status === 'completed';
            const isActive = node.status === 'active';
            
            let color = '#334155'; // default/pending
            let textColor = '#94a3b8';
            let strokeColor = '#1e293b';
            let glowFilter = '';

            if (isCompleted) {
              color = '#065f46';
              textColor = '#34d399';
              strokeColor = '#059669';
            } else if (isActive) {
              color = '#0891b2';
              textColor = '#22d3ee';
              strokeColor = '#00f2fe';
              glowFilter = 'url(#neon-glow)';
            }

            if (node.id === 'risk') {
              if (node.value === 'CRITICAL' || node.value === 'HIGH') {
                color = '#991b1b';
                textColor = '#f87171';
                strokeColor = '#dc2626';
              } else if (node.value === 'MEDIUM') {
                color = '#78350f';
                textColor = '#fbbf24';
                strokeColor = '#d97706';
              }
            }

            return (
              <g key={`node-${node.id}`} transform={`translate(${coord.x}, ${coord.y})`}>
                {node.type === 'input' || node.type === 'decision' ? (
                  <polygon
                    points="-85,-18 85,-18 75,18 -75,18"
                    fill={color}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    filter={glowFilter}
                    className={isActive ? 'animate-pulse' : ''}
                  />
                ) : (
                  <rect
                    x="-90"
                    y="-18"
                    width="180"
                    height="36"
                    rx="6"
                    fill={color}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    filter={glowFilter}
                    className={isActive ? 'animate-pulse' : ''}
                  />
                )}
                
                {/* Node Label Text */}
                <text
                  textAnchor="middle"
                  dy="4"
                  fill={textColor}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {node.label.length > 28 ? `${node.label.slice(0, 26)}...` : node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Live Steps Stream */}
      <div className="lg:col-span-2 space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title neon-text-cyan">Autonomous Cognitive Stream</h1>
            <p className="text-muted text-sm mt-1">Real-time reasoning logs and execution path streaming.</p>
          </div>
          <button className="btn btn-secondary border border-red-500/30 hover:border-red-500/80 text-red-400 text-xs" onClick={handleClear}>
            Clear Stream
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-red-400 text-xs flex items-center gap-2">
            <span className="h-2 w-2 bg-red-500 rounded-full animate-ping" />
            {error}
          </div>
        )}

        {/* Live Timeline Stats */}
        <div className="neon-card bg-slate-900/60">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Stream Progress</div>
            <div className="text-xs font-mono text-cyan-400">{getPercent()}% COMPLETE</div>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-cyan-400 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${getPercent()}%`, boxShadow: '0 0 6px var(--neon-cyan)' }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <div>
              <div className="text-sm font-bold font-mono text-slate-300">{progress.total}</div>
              <div className="text-[10px] text-muted uppercase">Phases</div>
            </div>
            <div>
              <div className="text-sm font-bold font-mono text-green-400">{progress.completed}</div>
              <div className="text-[10px] text-muted uppercase">Done</div>
            </div>
            <div>
              <div className="text-sm font-bold font-mono text-red-400">{progress.failed}</div>
              <div className="text-[10px] text-muted uppercase">Fails</div>
            </div>
            <div>
              <div className="text-sm font-bold font-mono text-yellow-400 flex justify-center items-center gap-1">
                {progress.active > 0 && <span className="h-1.5 w-1.5 bg-yellow-400 rounded-full animate-ping" />}
                {progress.active}
              </div>
              <div className="text-[10px] text-muted uppercase">Active</div>
            </div>
          </div>
        </div>

        {/* Steps Stream List */}
        {loading && steps.length === 0 ? (
          <div className="loading-row"><div className="spinner" />Connecting to SSE Stream...</div>
        ) : steps.length === 0 ? (
          <div className="empty-state neon-card">
            <div className="empty-icon text-3xl mb-2">⚡</div>
            <div className="font-semibold text-slate-300">Reasoning Stream Idle</div>
            <div className="text-xs text-muted mt-1">Start a CLI agent task or command fix to stream execution data.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step) => {
              const isActive = step.status === 'active';
              const isCompleted = step.status === 'completed';
              const isFailed = step.status === 'failed';
              
              let cardClass = "neon-card bg-slate-900/40 border-slate-800/80";
              if (isActive) cardClass = "neon-card bg-slate-900/80 border-cyan-500/40 shadow-[0_0_15px_rgba(0,242,254,0.05)]";
              if (isFailed) cardClass = "neon-card bg-slate-950 border-red-500/20";

              return (
                <div key={step.id} className={cardClass}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      {isActive && <span className="h-2.5 w-2.5 bg-cyan-400 rounded-full animate-ping" />}
                      {isCompleted && <span className="text-green-400 font-bold">✓</span>}
                      {isFailed && <span className="text-red-400 font-bold">✗</span>}
                      <span className={`font-mono text-sm font-bold ${isActive ? 'text-cyan-400' : isCompleted ? 'text-green-400' : 'text-red-400'}`}>
                        {step.phase}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {step.duration ? `${(step.duration / 1000).toFixed(2)}s` : 'streaming...'}
                    </div>
                  </div>

                  {step.details && Object.keys(step.details).length > 0 && (
                    <div className="mt-2 text-xs text-slate-400 bg-slate-950/80 p-2 rounded border border-slate-900 font-mono overflow-x-auto">
                      {JSON.stringify(step.details, null, 2)}
                    </div>
                  )}

                  {step.subSteps && step.subSteps.length > 0 && (
                    <div className="mt-3.5 pl-3.5 border-l border-slate-800 space-y-2">
                      {step.subSteps.map((sub) => (
                        <div key={sub.id} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300 flex items-center gap-2">
                            <span className={sub.status === 'active' ? 'h-1.5 w-1.5 bg-cyan-400 rounded-full animate-pulse' : 'text-slate-600'}>•</span>
                            {sub.label}
                          </span>
                          {sub.details?.path && (
                            <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">{sub.details.path}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {step.output && (
                    <div className="mt-3 text-xs bg-slate-950 p-2.5 rounded border border-slate-900 font-mono text-cyan-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {step.output}
                    </div>
                  )}

                  {step.error && (
                    <div className="mt-3 text-xs bg-red-950/20 p-2.5 rounded border border-red-900/30 font-mono text-red-400">
                      Error: {step.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Cognitive Graph & Sandbox */}
      <div className="space-y-6">
        
        {/* Task Planner Sandbox */}
        <div className="neon-card bg-slate-900/50">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">Task Planner Sandbox</div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Developer Goal / Objective</label>
              <textarea 
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 h-20"
                value={sandboxGoal}
                onChange={(e) => setSandboxGoal(e.target.value)}
                placeholder="Enter objective..."
              />
            </div>
            
            <button 
              className="w-full btn btn-primary text-xs py-2"
              onClick={triggerGoalPlanning}
              disabled={planningLoading}
            >
              {planningLoading ? 'Decomposing Goal...' : 'Analyze Goal & Build Graph'}
            </button>
            
            {planningError && (
              <div className="p-2 bg-red-950/30 border border-red-900/40 rounded text-red-400 text-xs font-mono">
                {planningError}
              </div>
            )}
          </div>

          {sandboxPlan && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3.5">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <div className="text-[9px] text-slate-500 uppercase">SLA RISK LEVEL</div>
                  <div className={`font-bold mt-1 ${
                    sandboxPlan.slaRisk === 'CRITICAL' || sandboxPlan.slaRisk === 'HIGH' 
                      ? 'text-red-400' 
                      : sandboxPlan.slaRisk === 'MEDIUM' 
                        ? 'text-yellow-400' 
                        : 'text-green-400'
                  }`}>
                    {sandboxPlan.slaRisk}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <div className="text-[9px] text-slate-500 uppercase">COMPLEXITY (1-10)</div>
                  <div className="font-bold text-cyan-400 mt-1">{sandboxPlan.complexity} / 10</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">Delegated Agents ({sandboxPlan.assignments?.length})</div>
                <div className="flex flex-wrap gap-1">
                  {sandboxPlan.assignments?.map(agentName => (
                    <span key={agentName} className="text-[9px] font-mono bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 px-2 py-0.5 rounded-full">
                      {agentName}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">Generated Subtasks Plan</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {sandboxPlan.subtasks?.map(sub => (
                    <div key={sub.id} className="flex justify-between items-center text-[11px] font-mono bg-slate-950/80 p-2 rounded border border-slate-900">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[9px] text-cyan-400 bg-cyan-950 px-1 rounded">{sub.agent.split('_')[0]}</span>
                        <span className="text-slate-300 truncate">{sub.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{sub.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Node Graph Component */}
        {renderDecisionGraphSvg()}

      </div>
    </div>
  );
}
