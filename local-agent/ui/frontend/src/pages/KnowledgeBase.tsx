// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function KnowledgeBase() {
  const [projects, setProjects] = useState([]);
  const [expandedPath, setExpandedPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/indexer/search?q=');
      if (res.success) {
        setProjects(res.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const toggleExpand = (path) => {
    if (expandedPath === path) {
      setExpandedPath(null);
    } else {
      setExpandedPath(path);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-green">AI Knowledge Base</h1>
          <p className="text-muted text-sm mt-1">Explore repository documentations, dependency matrices, and structural architecture tags.</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Filter knowledge bases..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 w-full focus:outline-none focus:border-green-500"
      />

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {loading ? (
        <div className="loading-row"><div className="spinner" />Building knowledge trees...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state neon-card">
          <div className="empty-icon text-3xl mb-2">📚</div>
          <div className="font-semibold text-slate-300">No Knowledge Base Registered</div>
          <div className="text-xs text-muted mt-1">Try another filter or scan your machine.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((p) => {
            const isExpanded = expandedPath === p.path;
            return (
              <div 
                key={p.path} 
                className={`neon-card border transition-all duration-200 ${
                  isExpanded ? 'border-green-500/40 bg-slate-900/30' : 'border-slate-800'
                }`}
              >
                {/* Header Row */}
                <div 
                  className="flex justify-between items-center cursor-pointer select-none"
                  onClick={() => toggleExpand(p.path)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{p.name}</span>
                      {p.isDuplicate && (
                        <span className="text-[9px] bg-red-950 text-red-400 border border-red-900/60 px-1.5 rounded uppercase font-bold">
                          Dup
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted font-mono truncate mt-0.5">{p.path}</div>
                  </div>
                  <div className="text-xs font-mono text-green-400 ml-4 flex items-center gap-2">
                    {isExpanded ? '[-]' : '[+]'}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 border-t border-slate-800/80 pt-4 space-y-4 text-xs">
                    {/* Readme Headers */}
                    <div>
                      <h3 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span>📝</span> README Header Structure
                      </h3>
                      {p.readmeHeaders && p.readmeHeaders.length > 0 ? (
                        <div className="bg-slate-950/80 p-3 rounded border border-slate-900 font-mono text-slate-400 space-y-1">
                          {p.readmeHeaders.map((h, i) => (
                            <div key={i} className="truncate">
                              {h}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted italic pl-5">No README headers parsed.</div>
                      )}
                    </div>

                    {/* Metadata summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-slate-300 mb-1">Architecture Type</h4>
                        <div className="text-muted font-mono bg-slate-900 p-2 rounded border border-slate-800/60">
                          {p.type === 'git-repo' ? 'Git VCS codebase' : 'Node module / path'}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-300 mb-1">Language Details</h4>
                        <div className="text-muted font-mono bg-slate-900 p-2 rounded border border-slate-800/60 truncate">
                          {p.languages && Object.keys(p.languages).length > 0
                            ? Object.entries(p.languages)
                                .map(([l, cnt]) => `${l} (${cnt} files)`)
                                .join(', ')
                            : 'Generic / Node'}
                        </div>
                      </div>
                    </div>

                    {/* Dependencies */}
                    <div>
                      <h3 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <span>📦</span> Dependencies Map ({Object.keys(p.dependencies || {}).length})
                      </h3>
                      {p.dependencies && Object.keys(p.dependencies).length > 0 ? (
                        <div className="bg-slate-950/80 p-3 rounded border border-slate-900 max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 font-mono text-slate-400">
                            {Object.entries(p.dependencies).map(([dep, ver]) => (
                              <div key={dep} className="flex justify-between border-b border-slate-900/50 py-0.5">
                                <span className="text-slate-300 truncate mr-2">{dep}</span>
                                <span className="text-green-400/80">{ver}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted italic pl-5">No package dependencies found.</div>
                      )}
                    </div>
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
