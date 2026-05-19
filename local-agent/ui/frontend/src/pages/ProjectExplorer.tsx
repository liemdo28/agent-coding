// @ts-nocheck
// pages/ProjectExplorer.jsx
// Shows all projects discovered across PROJECT_ROOT + allowedPaths.
// Data source: GET /api/allowed-paths/projects

import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

const BADGE_COLORS = {
  '.git':           { bg: 'rgba(88,166,255,0.12)', color: 'var(--blue)',   label: 'git' },
  'package.json':   { bg: 'rgba(63,185,80,0.12)',  color: 'var(--green)',  label: 'node' },
  'pyproject.toml': { bg: 'rgba(210,153,34,0.12)', color: 'var(--yellow)', label: 'python' },
  'Cargo.toml':     { bg: 'rgba(248,81,73,0.12)',  color: 'var(--red)',    label: 'rust' },
  'go.mod':         { bg: 'rgba(0,230,255,0.12)',  color: '#00e6ff',       label: 'go' },
};

function typeBadge(project) {
  // Guess type from name/path heuristics — markers aren't returned by API
  const name = project.name.toLowerCase();
  if (name.includes('python') || name.includes('py'))  return BADGE_COLORS['pyproject.toml'];
  if (name.includes('rust')   || name.includes('rs'))  return BADGE_COLORS['Cargo.toml'];
  if (name.includes('go-'))                            return BADGE_COLORS['go.mod'];
  return BADGE_COLORS['package.json']; // default: node
}

export default function ProjectExplorer() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [rootFilter, setRootFilter] = useState('all');

  const load = () => {
    setLoading(true);
    setError(null);
    api.get('/allowed-paths/projects')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const projects = data?.projects ?? [];
  const roots    = [...new Set(projects.map((p) => p.root))];

  const filtered = projects.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.path.toLowerCase().includes(search.toLowerCase());
    const matchRoot   = rootFilter === 'all' || p.root === rootFilter;
    return matchSearch && matchRoot;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Project Explorer</h1>
        <button className="btn btn-sm" onClick={load} disabled={loading}>
          {loading ? <><span className="spinner" /> Đang quét...</> : '↻ Làm mới'}
        </button>
      </div>

      {/* Summary strip */}
      {data && (
        <div className="card-grid" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div className="stat-label">Tổng project</div>
            <div className="stat-value" style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)' }}>
              {data.total}
            </div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div className="stat-label">Thư mục được quét</div>
            <div className="stat-value" style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
              {data.scannedRoots?.length ?? 0}
            </div>
          </div>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div className="stat-label">Hiển thị</div>
            <div className="stat-value" style={{ fontSize: 28, fontWeight: 700 }}>
              {filtered.length}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="chat-input"
          style={{ flex: 1, minWidth: 200, height: 34, padding: '6px 12px', maxHeight: 'unset', minHeight: 'unset', borderRadius: 'var(--radius)' }}
          placeholder="Tìm project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="chat-input"
          style={{ width: 'auto', height: 34, padding: '4px 10px', maxHeight: 'unset', minHeight: 'unset', borderRadius: 'var(--radius)' }}
          value={rootFilter}
          onChange={(e) => setRootFilter(e.target.value)}
        >
          <option value="all">Tất cả thư mục</option>
          {roots.map((r) => <option key={r} value={r}>{r.split('/').slice(-2).join('/')}</option>)}
        </select>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 12 }}>
          {error} — Hãy thêm thư mục vào Allowed Paths trong trang Security.
        </div>
      )}

      {loading && <div className="loading-row"><div className="spinner" /> Đang quét projects...</div>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <div>
            {search ? `Không tìm thấy project nào khớp "${search}"` : 'Chưa có project nào'}
          </div>
          {!search && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Thêm thư mục trong trang <strong>Security → Phạm vi truy cập</strong>
            </div>
          )}
        </div>
      )}

      {/* Project grid */}
      {!loading && filtered.length > 0 && (
        <div className="project-grid">
          {filtered.map((project) => {
            const badge  = typeBadge(project);
            const rootShort = project.root.split('/').slice(-2).join('/');
            return (
              <div key={project.path} className="project-card">
                <div className="project-card-top">
                  <div className="project-name">{project.name}</div>
                  <span
                    className="badge"
                    style={{ background: badge.bg, color: badge.color, borderColor: badge.color + '55', fontSize: 10 }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="project-path" title={project.path}>
                  {project.path}
                </div>
                <div className="project-root-tag">
                  📁 {rootShort}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
