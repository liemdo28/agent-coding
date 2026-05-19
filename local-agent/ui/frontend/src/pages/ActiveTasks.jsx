// pages/ActiveTasks.jsx
// Live view of all jobs (running, recent, failed) from the runner.
// Data source: GET /api/jobs  (live poll every 3s)

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';

const STATUS_META = {
  running:   { icon: '🔄', color: 'var(--blue)',   label: 'Đang chạy' },
  completed: { icon: '✅', color: 'var(--green)',  label: 'Hoàn thành' },
  failed:    { icon: '❌', color: 'var(--red)',    label: 'Thất bại' },
  stopped:   { icon: '⏹', color: 'var(--text-muted)', label: 'Đã dừng' },
  rejected:  { icon: '🚫', color: 'var(--red)',    label: 'Từ chối' },
};

const PRIORITY_MAP = {
  'corp:simulate':       'Critical',
  'corp:status':         'High',
  'qa:full':             'High',
  'audit:security':      'High',
  'scan:deep':           'Medium',
  'build:marketing-db':  'Medium',
};

function getPriority(script) {
  return PRIORITY_MAP[script] ?? 'Normal';
}

const PRIORITY_COLOR = {
  Critical: 'var(--red)',
  High:     'var(--yellow)',
  Medium:   'var(--blue)',
  Normal:   'var(--text-muted)',
};

function elapsed(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end   = endedAt ? new Date(endedAt).getTime() : Date.now();
  const secs  = Math.round((end - start) / 1000);
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ${secs%60}s`;
  return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
}

export default function ActiveTasks() {
  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');  // all | running | completed | failed
  const [selected,   setSelected]   = useState(null);   // selected jobId for output view
  const [output,     setOutput]     = useState([]);
  const [loadingOut, setLoadingOut] = useState(false);
  const pollRef = useRef(null);
  const bottomRef = useRef(null);

  const loadJobs = () => {
    api.get('/jobs')
      .then(({ jobs: list }) => { setJobs(list ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  // When a job is selected, stream / fetch its output
  useEffect(() => {
    if (!selected) { setOutput([]); return; }
    setLoadingOut(true);
    setOutput([]);

    const job = jobs.find((j) => j.jobId === selected);
    if (!job) { setLoadingOut(false); return; }

    // Use SSE stream for running jobs, poll lines otherwise
    if (job.status === 'running') {
      const ctrl = new AbortController();
      fetch(`/api/run/${selected}/stream`, { signal: ctrl.signal })
        .then(async (res) => {
          if (!res.ok) { setLoadingOut(false); return; }
          const reader  = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const d = JSON.parse(line.slice(5).trim());
                  if (d.line) setOutput((p) => [...p, d.line]);
                  if (d.done) { setLoadingOut(false); break; }
                } catch { /* skip */ }
              }
            }
          }
          setLoadingOut(false);
        })
        .catch(() => setLoadingOut(false));
      return () => ctrl.abort();
    } else {
      // Completed/failed — fetch cached lines from jobs list
      const lines = job.lines ?? [];
      setOutput(lines);
      setLoadingOut(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const filtered = jobs.filter((j) => filter === 'all' || j.status === filter);
  const running  = jobs.filter((j) => j.status === 'running').length;

  const stopJob = (jobId) => {
    fetch(`/api/run/${jobId}/stop`, { method: 'POST' });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          Active Tasks
          {running > 0 && (
            <span className="badge badge-warn" style={{ marginLeft: 10, fontSize: 11, verticalAlign: 'middle' }}>
              {running} đang chạy
            </span>
          )}
        </h1>
        <button className="btn btn-sm" onClick={loadJobs}>↻ Làm mới</button>
      </div>

      {/* Summary cards */}
      <div className="card-grid" style={{ marginBottom: 16 }}>
        {[
          { label: 'Đang chạy',    count: jobs.filter(j=>j.status==='running').length,   color: 'var(--blue)'  },
          { label: 'Hoàn thành',   count: jobs.filter(j=>j.status==='completed').length, color: 'var(--green)' },
          { label: 'Thất bại',     count: jobs.filter(j=>j.status==='failed').length,    color: 'var(--red)'   },
          { label: 'Tổng (50 gần nhất)', count: jobs.length,                             color: 'var(--text)'  },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', cursor: 'pointer' }}
            onClick={() => setFilter(s.label === 'Tổng (50 gần nhất)' ? 'all' : s.label === 'Đang chạy' ? 'running' : s.label === 'Hoàn thành' ? 'completed' : 'failed')}
          >
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['all','running','completed','failed'].map((f) => (
          <button
            key={f}
            className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`}
            onClick={() => setFilter(f)}
          >
            {{ all: 'Tất cả', running: '🔄 Đang chạy', completed: '✅ Hoàn thành', failed: '❌ Thất bại' }[f]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, minHeight: 400 }}>
        {/* Job list */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }}>
          {loading && <div className="loading-row"><div className="spinner" /> Đang tải...</div>}
          {!loading && filtered.length === 0 && (
            <div className="empty-state"><div className="empty-icon">📋</div>Không có task nào</div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Script</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Priority</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Trạng thái</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Thời gian</th>
                    <th style={{ padding: '8px 4px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => {
                    const sm   = STATUS_META[job.status] ?? STATUS_META.stopped;
                    const prio = getPriority(job.script);
                    const isActive = selected === job.jobId;
                    return (
                      <tr
                        key={job.jobId}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isActive ? 'rgba(88,166,255,0.06)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onClick={() => setSelected(isActive ? null : job.jobId)}
                      >
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontFamily: 'monospace', color: 'var(--text)', fontSize: 12 }}>
                            {job.script}
                          </div>
                          {job.label && job.label !== job.script && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{job.label}</div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ color: PRIORITY_COLOR[prio], fontSize: 12, fontWeight: 500 }}>{prio}</span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ color: sm.color }}>{sm.icon} {sm.label}</span>
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                          {job.startedAt ? elapsed(job.startedAt, job.endedAt) : '—'}
                        </td>
                        <td style={{ padding: '9px 8px' }}>
                          {job.status === 'running' && (
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--red)', borderColor: 'rgba(248,81,73,0.3)', padding: '2px 8px', fontSize: 11 }}
                              onClick={(e) => { e.stopPropagation(); stopJob(job.jobId); }}
                            >
                              Stop
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Output panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ height: '100%', padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{selected ? `Output: ${jobs.find(j=>j.jobId===selected)?.script ?? selected}` : 'Chọn một task để xem output'}</span>
              {selected && <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setSelected(null)}>✕</button>}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.55, color: 'var(--text)' }}>
              {loadingOut && <div className="loading-row"><div className="spinner" /> Đang tải output...</div>}
              {!selected && !loadingOut && <div style={{ color: 'var(--text-muted)', marginTop: 20, textAlign: 'center' }}>↑ Click vào một task để xem log output</div>}
              {output.map((line, i) => (
                <div key={i} style={{
                  color: line.includes('ERROR') || line.includes('✗') ? 'var(--red)'
                       : line.includes('✓') || line.includes('OK') ? 'var(--green)'
                       : line.includes('WARN') ? 'var(--yellow)'
                       : 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {line}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
