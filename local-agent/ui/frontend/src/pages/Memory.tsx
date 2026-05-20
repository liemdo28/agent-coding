// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Memory() {
  const [activeTab, setActiveTab] = useState('semantic');
  const [stats, setStats] = useState({ semanticCount: 0, taskCount: 0, promptCount: 0, fixCount: 0 });
  const [semantic, setSemantic] = useState({});
  const [tasks, setTasks] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Concept Form
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const sRes = await api.get('/memory/stats');
      if (sRes.success) setStats(sRes.data);

      const semRes = await api.get('/memory/semantic');
      if (semRes.success) setSemantic(semRes.data);

      const tRes = await api.get('/memory/tasks');
      if (tRes.success) setTasks(tRes.data);

      const pRes = await api.get('/memory/prompts');
      if (pRes.success) setPrompts(pRes.data);

      const fRes = await api.get('/memory/fixes');
      if (fRes.success) setFixes(fRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddConcept = async (e) => {
    e.preventDefault();
    if (!newKey || !newVal) return;
    try {
      setSubmitting(true);
      const res = await api.post('/memory/semantic', { key: newKey, value: newVal });
      if (res.success) {
        setNewKey('');
        setNewVal('');
        loadData();
      }
    } catch (err) {
      alert('Failed to save concept: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">AI Memory System</h1>
          <p className="text-muted text-sm mt-1">Unified semantic records, prompt caching, task executions, and code fixes history.</p>
        </div>
      </div>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold gap-4">
        <button 
          onClick={() => setActiveTab('semantic')} 
          className={`pb-2 border-b-2 transition-all px-2 ${activeTab === 'semantic' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Semantic Memory ({stats.semanticCount})
        </button>
        <button 
          onClick={() => setActiveTab('tasks')} 
          className={`pb-2 border-b-2 transition-all px-2 ${activeTab === 'tasks' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Task History ({stats.taskCount})
        </button>
        <button 
          onClick={() => setActiveTab('prompts')} 
          className={`pb-2 border-b-2 transition-all px-2 ${activeTab === 'prompts' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Prompt Cache ({stats.promptCount})
        </button>
        <button 
          onClick={() => setActiveTab('fixes')} 
          className={`pb-2 border-b-2 transition-all px-2 ${activeTab === 'fixes' ? 'border-cyan-400 text-cyan-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Fix Logs ({stats.fixCount})
        </button>
      </div>

      {loading ? (
        <div className="loading-row"><div className="spinner" />Retrieving memory index...</div>
      ) : (
        <div className="space-y-4">
          {/* SEMANTIC MEMORY */}
          {activeTab === 'semantic' && (
            <div className="space-y-6">
              {/* Form to store new */}
              <div className="neon-card">
                <h3 className="text-xs font-semibold uppercase text-slate-300 mb-3">Add Custom Semantic Guideline</h3>
                <form onSubmit={handleAddConcept} className="flex flex-col md:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Concept Key (e.g. bypassPolicyCheck)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-3 py-2 flex-1 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. false)"
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-3 py-2 flex-1 focus:outline-none focus:border-cyan-500"
                  />
                  <button type="submit" className="btn btn-primary text-xs" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Add Guideline'}
                  </button>
                </form>
              </div>

              {/* Semantic K/V list */}
              <div className="neon-card">
                <h3 className="text-xs font-semibold uppercase text-slate-300 mb-3">Guideline Dictionary</h3>
                {Object.keys(semantic).length === 0 ? (
                  <div className="text-muted italic text-xs">No concepts recorded. Use the form above to add custom instructions.</div>
                ) : (
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-2 font-semibold">Concept Key</th>
                          <th className="pb-2 font-semibold">Guideline Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {Object.entries(semantic).map(([k, v]) => (
                          <tr key={k}>
                            <td className="py-2.5 font-bold text-cyan-400 pr-4 break-all">{k}</td>
                            <td className="py-2.5 break-all">{String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TASK HISTORY */}
          {activeTab === 'tasks' && (
            <div className="neon-card">
              <h3 className="text-xs font-semibold uppercase text-slate-300 mb-3">Recent Agent Task Runs</h3>
              {tasks.length === 0 ? (
                <div className="text-muted italic text-xs">No task runs logged in memory yet.</div>
              ) : (
                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  {tasks.slice().reverse().map((t) => (
                    <div key={t.taskId} className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-900 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${t.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="font-mono font-bold text-slate-200">{t.task}</span>
                      </div>
                      <span className="text-muted text-[10px] font-mono">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROMPT CACHE */}
          {activeTab === 'prompts' && (
            <div className="neon-card">
              <h3 className="text-xs font-semibold uppercase text-slate-300 mb-3">Recorded Conversations</h3>
              {prompts.length === 0 ? (
                <div className="text-muted italic text-xs">No LLM requests tracked yet.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {prompts.slice().reverse().map((p, idx) => (
                    <div key={idx} className="bg-slate-950/70 p-3 rounded border border-slate-900/80 text-xs space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono text-muted">
                        <span>Cached Ask</span>
                        <span>{new Date(p.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-cyan-400 font-semibold font-mono bg-slate-900/40 p-2 rounded">
                        Q: {p.prompt}
                      </div>
                      <div className="text-slate-300 whitespace-pre-wrap pl-2 border-l border-cyan-500/20 max-h-32 overflow-y-auto">
                        {p.response}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FIX LOGS */}
          {activeTab === 'fixes' && (
            <div className="neon-card">
              <h3 className="text-xs font-semibold uppercase text-slate-300 mb-3">Attempted Code Fixes</h3>
              {fixes.length === 0 ? (
                <div className="text-muted italic text-xs">No fixes or edits logged in memory yet.</div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {fixes.slice().reverse().map((f) => (
                    <div key={f.patchId} className="bg-slate-950 p-3 rounded border border-slate-900 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-cyan-400">{f.patchId}</span>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                          f.status === 'applied' ? 'bg-green-950 text-green-400 border border-green-900/60' : 'bg-blue-950/40 text-blue-400 border border-blue-900/60'
                        }`}>
                          {f.status}
                        </span>
                      </div>
                      <div className="text-slate-300">{f.task}</div>
                      {f.filesChanged && f.filesChanged.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pt-1">
                          {f.filesChanged.map(file => (
                            <span key={file} className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              {file}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
