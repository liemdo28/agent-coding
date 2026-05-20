// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';

const RISK_COLOR = { safe: 'var(--green)', warn: 'var(--yellow)', alert: 'var(--orange)', danger: 'var(--red)' };

function riskColor(band) { return RISK_COLOR[band] ?? 'var(--text-muted)'; }

function RiskPill({ band, score }) {
  return (
    <span className="dt-risk-pill bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold" style={{ color: riskColor(band) }}>
      {Math.round((score ?? 0) * 100)}%
    </span>
  );
}

function ProgressBar({ value, max = 100 }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-slate-950 border border-slate-900 h-2 rounded-full overflow-hidden mt-1.5">
      <div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

const TABS = ['Overview', 'Companies', 'Batches', 'Tasks', 'Alerts'];

export default function DigitalTwin() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState('Overview');
  const [controls, setControls] = useState({ priorityWeight: 62, workerAllocation: 192, batchFactor: 48 });
  const [tickerLogs, setTickerLogs] = useState([]);
  const debounceRef = useRef(null);

  // Generate continuous log events in background
  useEffect(() => {
    const logPool = [
      '[Worker-04] Executing unit test suite validation',
      '[Worker-12] Building project dependency graph',
      '[Worker-19] Running security vulnerability CVE audit',
      '[Worker-08] Compiling TypeScript AST representations',
      '[Worker-15] Deploying sandboxed environment replica',
      '[Orchestrator] Recalculating task priorities and weights',
      '[Dev_AI] Synthesizing patch suggestions',
      '[QA_AI] Testing regression suite for rawwebsite',
      '[Infra_AI] Syncing server system constraints',
      '[Security_AI] Checking access credentials exposure'
    ];

    const interval = setInterval(() => {
      const randomLog = logPool[Math.floor(Math.random() * logPool.length)];
      const timestamp = new Date().toLocaleTimeString();
      setTickerLogs(prev => [`[${timestamp}] ${randomLog}`, ...prev.slice(0, 15)]);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async (ctrl) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        priorityWeight:   String(ctrl.priorityWeight),
        workerAllocation: String(ctrl.workerAllocation),
        batchFactor:      String(ctrl.batchFactor),
      });
      const res = await fetch(`/api/analytics?${qs}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(controls); }, []);

  const handleControl = (key, value) => {
    const next = { ...controls, [key]: Number(value) };
    setControls(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(next), 400);
  };

  const summary = data?.summary ?? {};
  const companies = data?.companies ?? [];
  const batches   = data?.batches   ?? [];
  const tasks     = data?.tasks     ?? [];
  const alerts    = data?.alerts    ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">Digital Twin HUD</h1>
          <p className="text-muted text-sm mt-1">Corp Simulation & Interactive Autonomous Worker Replica.</p>
        </div>
        <div className="flex items-center gap-2">
          {summary.systemHealth && (
            <span className={`badge ${
              summary.systemHealth === 'PASS' ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-red-950 text-red-400 border border-red-800'
            }`}>
              {summary.systemHealth}
            </span>
          )}
          <span className="badge bg-slate-900 border border-slate-800 text-cyan-400 text-xs px-2 py-0.5 rounded font-mono">
            SANDBOXED
          </span>
          <button className="btn btn-secondary text-xs" onClick={() => fetchData(controls)} disabled={loading}>
            {loading ? 'Refreshing...' : '↺ Force Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/50 text-red-300 p-3 rounded">⚠ {error}</div>
      )}

      {/* Control sliders */}
      <div className="neon-card">
        <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-3">Simulation Parameter Matrix</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>Priority Weight</span>
              <span className="text-cyan-400 font-bold">{controls.priorityWeight}%</span>
            </div>
            <input type="range" min="0" max="100" value={controls.priorityWeight}
              onChange={(e) => handleControl('priorityWeight', e.target.value)} 
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>Worker Allocation</span>
              <span className="text-green-400 font-bold">{controls.workerAllocation} Workers</span>
            </div>
            <input type="range" min="16" max="512" value={controls.workerAllocation}
              onChange={(e) => handleControl('workerAllocation', e.target.value)} 
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>Batch Factor</span>
              <span className="text-purple-400 font-bold">{controls.batchFactor}% Scale</span>
            </div>
            <input type="range" min="10" max="100" value={controls.batchFactor}
              onChange={(e) => handleControl('batchFactor', e.target.value)} 
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neon-card text-center border-l-4 border-l-cyan-500">
          <div className="text-xl font-bold font-mono text-cyan-400">{summary.activeTasks ?? 0}</div>
          <div className="text-xs text-muted">Active Simulation Tasks</div>
        </div>
        <div className={`neon-card text-center border-l-4 ${summary.qaWarnings > 0 ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
          <div className="text-xl font-bold font-mono text-yellow-400">{summary.qaWarnings ?? 0}</div>
          <div className="text-xs text-muted">QA Alerts & Failures</div>
        </div>
        <div className="neon-card text-center border-l-4 border-l-purple-500">
          <div className="text-xl font-bold font-mono text-purple-400">{summary.totalWorkers ?? 0}</div>
          <div className="text-xs text-muted">Active Simulated Workers</div>
        </div>
        <div className="neon-card text-center border-l-4 border-l-red-500">
          <div className="text-xl font-bold font-mono text-red-400">{alerts.length}</div>
          <div className="text-xs text-muted">Violations Pending</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-850 gap-2">
        {TABS.map((t) => (
          <button 
            key={t} 
            className={`px-4 py-2 text-xs font-mono font-bold tracking-wider border-b-2 transition-all ${
              tab === t ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Animated node maps */}
          <div className="lg:col-span-2 space-y-6">
            <div className="neon-card">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-4">
                Specialized AI Division Node Map & Worker Flows
              </h3>

              {/* Animated Canvas / Diagram area */}
              <div className="relative border border-slate-800 bg-slate-950 p-6 rounded-lg min-h-[300px] flex items-center justify-center overflow-hidden">
                
                {/* SVG Flowing connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <linearGradient id="flow-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#58a6ff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#3fb950" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  
                  {/* Flow lines between nodes */}
                  <path d="M 120 150 L 320 80" stroke="url(#flow-cyan)" strokeWidth="1.5" fill="none" />
                  <path d="M 320 80 L 520 150" stroke="url(#flow-cyan)" strokeWidth="1.5" fill="none" />
                  <path d="M 120 150 L 320 220" stroke="url(#flow-cyan)" strokeWidth="1.5" fill="none" />
                  <path d="M 320 220 L 520 150" stroke="url(#flow-cyan)" strokeWidth="1.5" fill="none" />

                  {/* Flowing dots (Worker animations) */}
                  <circle r="4" fill="#58a6ff">
                    <animateMotion dur="4s" repeatCount="indefinite" path="M 120 150 L 320 80" />
                  </circle>
                  <circle r="4" fill="#3fb950">
                    <animateMotion dur="5s" repeatCount="indefinite" path="M 320 80 L 520 150" />
                  </circle>
                  <circle r="4" fill="#ffb454">
                    <animateMotion dur="6s" repeatCount="indefinite" path="M 120 150 L 320 220" />
                  </circle>
                  <circle r="4" fill="#bc8cff">
                    <animateMotion dur="4.5s" repeatCount="indefinite" path="M 320 220 L 520 150" />
                  </circle>
                </svg>

                {/* Nodes representation */}
                <div className="flex justify-between w-full z-10 px-4">
                  <div className="flex flex-col gap-12">
                    {/* Dev Node */}
                    <div className="bg-slate-900 border border-blue-500/40 p-3 rounded-lg text-center w-28 shadow-lg shadow-blue-500/5">
                      <span className="text-xs font-bold text-blue-400 font-mono">Dev_AI</span>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">Status: Idle</div>
                    </div>
                    {/* Infra Node */}
                    <div className="bg-slate-900 border border-orange-500/40 p-3 rounded-lg text-center w-28 shadow-lg shadow-orange-500/5">
                      <span className="text-xs font-bold text-orange-400 font-mono">Infra_AI</span>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">Status: Idle</div>
                    </div>
                  </div>

                  {/* Center QA Node */}
                  <div className="bg-slate-900 border border-green-500/50 p-4 rounded-lg text-center w-36 self-center shadow-lg shadow-green-500/5">
                    <span className="text-sm font-bold text-green-400 font-mono">QA_AI Specialist</span>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">Validating fixes</div>
                  </div>

                  <div className="flex flex-col gap-12">
                    {/* Security Node */}
                    <div className="bg-slate-900 border border-red-500/40 p-3 rounded-lg text-center w-28 shadow-lg shadow-red-500/5">
                      <span className="text-xs font-bold text-red-400 font-mono">Security_AI</span>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">Status: Secure</div>
                    </div>
                    {/* Marketing Node */}
                    <div className="bg-slate-900 border border-purple-500/40 p-3 rounded-lg text-center w-28 shadow-lg shadow-purple-500/5">
                      <span className="text-xs font-bold text-purple-400 font-mono">Marketing_AI</span>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">Status: Active</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event ticker logs */}
            <div className="neon-card">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2">
                Realtime Worker activity stream
              </h3>
              <div className="bg-slate-950 border border-slate-900 font-mono text-[10px] p-4 rounded-lg max-h-[160px] overflow-y-auto space-y-1.5 text-slate-400">
                {tickerLogs.length === 0 ? (
                  <div className="text-slate-600">Waiting for simulated event ticker logs...</div>
                ) : (
                  tickerLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-cyan-600">●</span>
                      <span>{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="neon-card">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-3">Simulation batches</h3>
              <div className="space-y-3">
                {batches.slice(0, 3).map((b) => (
                  <div key={b.id} className="border border-slate-800/80 bg-slate-900/10 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <strong className="text-xs text-slate-300 font-mono">{b.id}</strong>
                      <span className="text-[10px] font-mono text-cyan-400">{b.progress}%</span>
                    </div>
                    <ProgressBar value={b.progress} />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="neon-card">
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2">Packet Network Simulation</h3>
              <div className="border border-slate-900 bg-slate-950 p-4 rounded-lg flex items-center justify-center overflow-hidden min-h-[100px] relative">
                {/* CSS Waves */}
                <div className="absolute inset-0 flex items-center justify-around opacity-40">
                  <div className="w-1.5 h-12 bg-cyan-500 rounded animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1.5 h-16 bg-cyan-500 rounded animate-bounce" style={{ animationDelay: '0.3s' }} />
                  <div className="w-1.5 h-8 bg-cyan-500 rounded animate-bounce" style={{ animationDelay: '0.5s' }} />
                  <div className="w-1.5 h-14 bg-cyan-500 rounded animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-10 bg-cyan-500 rounded animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs font-mono text-cyan-400 z-10 font-bold bg-slate-950/80 px-2 py-1 rounded">
                  TRANSMITTING PACKETS...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Companies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((co) => (
            <div key={co.id} className="neon-card">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-200">{co.name}</h3>
                  <span className="text-xs text-muted">Active simulation batch {co.currentBatch}</span>
                </div>
                <RiskPill band={co.riskBand} score={co.predictedRisk} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 mt-3 pt-3 border-t border-slate-900">
                <div>Active Tasks: <strong className="text-slate-200">{co.activeTasks}</strong></div>
                <div>Workers Pool: <strong className="text-slate-200">{co.workerPool}</strong></div>
                <div>QA Failure Rate: <strong className="text-slate-200">{Math.round(co.qaFailRate * 100)}%</strong></div>
                <div>Rollback Rate: <strong className="text-slate-200">{co.rollbackCount}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Batches' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {batches.map((b) => (
            <div key={b.id} className="neon-card">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-200 font-mono">{b.id}</span>
                <RiskPill band={b.riskBand} score={b.predictedRisk} />
              </div>
              <ProgressBar value={b.progress} />
              <div className="text-[11px] font-mono text-slate-500 mt-3 space-y-1">
                <div className="flex justify-between"><span>Tasks in batch:</span><span className="text-slate-300">{b.taskCount}</span></div>
                <div className="flex justify-between"><span>Workers Allocated:</span><span className="text-slate-300">{b.workerAllocation}</span></div>
                <div className="flex justify-between"><span>QA Fail rate:</span><span className="text-yellow-500">{Math.round(b.qaFailRate * 100)}%</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Tasks' && (
        <div className="neon-card">
          <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-3">Simulation Task Queue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Task Title</th>
                  <th className="py-2">Priority</th>
                  <th className="py-2">Risk</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {tasks.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-2 truncate max-w-[250px]">{t.title}</td>
                    <td className="py-2">{t.priority}</td>
                    <td className="py-2"><RiskPill band={t.riskBand} score={t.riskScore} /></td>
                    <td className="py-2 text-cyan-400">{t.qaStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center text-xs text-muted py-12">No active alerts triggered in simulation.</div>
          ) : (
            alerts.map((a, i) => (
              <div key={i} className="p-3 bg-red-950/20 border border-red-500/35 rounded-lg flex gap-3 items-center">
                <span className="text-xl">🔴</span>
                <div>
                  <div className="font-bold text-xs text-red-400 font-mono uppercase">{a.type}</div>
                  <div className="text-xs text-slate-300 mt-0.5">{a.message}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
