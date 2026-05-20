// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function WorkspaceGraph() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    try {
      const res = await api.get('/indexer/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadProjects = async (q = '') => {
    try {
      setLoading(true);
      const res = await api.get(`/indexer/search?q=${q}`);
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
    loadStats();
    loadProjects('');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadProjects(query);
  };

  const triggerScan = async () => {
    try {
      setScanning(true);
      const res = await api.post('/indexer/scan');
      if (res.success) {
        alert('Scan triggered! Re-indexing in the background.');
        setTimeout(() => {
          loadStats();
          loadProjects(query);
          setScanning(false);
        }, 3000);
      }
    } catch (err) {
      alert('Failed to trigger scan: ' + err.message);
      setScanning(false);
    }
  };

  const getDuplicateCount = () => {
    return projects.filter(p => p.isDuplicate).length;
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title neon-text-cyan">Workspace Graph</h1>
          <p className="text-muted text-sm mt-1">Multi-repository dependency indexer and duplicate checkout analyzer.</p>
        </div>
        <button 
          className="btn btn-primary text-xs" 
          disabled={scanning} 
          onClick={triggerScan}
        >
          {scanning ? 'Scanning...' : 'Trigger Global Scan'}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="neon-card text-center">
            <div className="text-xl font-bold font-mono text-cyan-400">{stats.totalProjects}</div>
            <div className="text-xs text-muted">Indexed Paths</div>
          </div>
          <div className="neon-card text-center">
            <div className="text-xl font-bold font-mono text-green-400">{stats.totalRepos}</div>
            <div className="text-xs text-muted">Git Repositories</div>
          </div>
          <div className="neon-card text-center">
            <div className="text-xl font-bold font-mono text-red-400">{getDuplicateCount()}</div>
            <div className="text-xs text-muted">Redundant/Duplicates</div>
          </div>
          <div className="neon-card text-center">
            <div className="text-xs font-mono text-slate-300 mt-1">
              {stats.lastScanned ? new Date(stats.lastScanned).toLocaleDateString() : 'Never'}
            </div>
            <div className="text-xs text-muted mt-2">Last Index Scan</div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search repositories by name, descriptions, aliases..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 flex-1 focus:outline-none focus:border-cyan-500"
        />
        <button type="submit" className="btn btn-secondary text-xs">
          Search
        </button>
      </form>

      {error && <div className="card border-red-500/50 text-red-400 bg-red-950/20">{error}</div>}

      {/* Projects list */}
      {loading ? (
        <div className="loading-row"><div className="spinner" />Indexing workspace...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state neon-card">
          <div className="empty-icon text-3xl mb-2">📁</div>
          <div className="font-semibold text-slate-300">No Projects Found</div>
          <div className="text-xs text-muted mt-1">Try another search or trigger a global indexer scan above.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div 
              key={project.path} 
              className={`neon-card border ${project.isDuplicate ? 'border-red-500/30' : 'border-slate-800'} flex flex-col justify-between`}
            >
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="font-bold text-slate-200 truncate pr-2">
                    {project.name}
                  </div>
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                    project.type === 'git-repo' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/60'
                  }`}>
                    {project.type}
                  </span>
                </div>

                <div className="text-xs font-mono text-muted truncate mb-2">
                  {project.path}
                </div>

                {project.description && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {project.remoteUrl && (
                  <div className="text-[11px] text-slate-500 truncate mb-1">
                    <strong className="text-slate-400">Remote:</strong> {project.remoteUrl}
                  </div>
                )}

                {project.branch && (
                  <div className="text-[11px] text-slate-500 mb-1">
                    <strong className="text-slate-400">Branch:</strong> <span className="font-mono text-cyan-300">{project.branch}</span>
                  </div>
                )}
              </div>

              {project.isDuplicate && (
                <div className="mt-3 p-2 bg-red-950/20 rounded border border-red-900/40 text-[11px] text-red-400">
                  ⚠️ <strong>Redundant Checkout:</strong> This project name or git remote is already checked out at another path.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
