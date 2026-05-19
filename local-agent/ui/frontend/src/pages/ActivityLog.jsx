import React, { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../i18n/index.js';

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTs(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

const STATUS_STYLES = {
  started:   { color: 'var(--blue)',       bg: 'rgba(88,166,255,0.1)' },
  completed: { color: 'var(--green)',      bg: 'rgba(63,185,80,0.1)' },
  failed:    { color: 'var(--red)',        bg: 'rgba(248,81,73,0.1)' },
  stopped:   { color: 'var(--yellow)',     bg: 'rgba(210,153,34,0.1)' },
  running:   { color: 'var(--blue)',       bg: 'rgba(88,166,255,0.1)' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? { color: 'var(--text-muted)', bg: 'transparent' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.color}44`,
      whiteSpace: 'nowrap',
    }}>
      {status === 'running' && <span className="spinner" style={{ width: 10, height: 10, marginRight: 4 }} />}
      {t(`activityLog.status.${status}`) !== `activityLog.status.${status}` ? t(`activityLog.status.${status}`) : status}
    </span>
  );
}

export default function ActivityLog() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]               = useState(today);
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]           = useState('');
  const [expandedId, setExpandedId]   = useState(null);
  const [jobLines, setJobLines]       = useState({}); // jobId -> lines[]
  const [hasRunning, setHasRunning]   = useState(false);
  const intervalRef = useRef(null);

  const fetchLog = useCallback(async () => {
    try {
      const resp = await fetch(`/api/activity-log?date=${date}`);
      const data = await resp.json();
      if (data.success) {
        setEntries(data.data ?? []);
        const running = (data.data ?? []).some((e) => e.status === 'started' || e.status === 'running');
        setHasRunning(running);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    fetchLog();
  }, [fetchLog]);

  // Auto-refresh every 10s if any job is running
  useEffect(() => {
    if (hasRunning) {
      intervalRef.current = setInterval(fetchLog, 10000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [hasRunning, fetchLog]);

  function handleExport() {
    window.open(`/api/activity-log/export?date=${date}`, '_blank');
  }

  async function handleRowClick(entry) {
    const key = entry.jobId;
    if (expandedId === key) {
      setExpandedId(null);
      return;
    }
    setExpandedId(key);

    // Try to fetch job stream if we don't have lines yet
    if (!jobLines[key] && entry.jobId) {
      try {
        const resp = await fetch(`/api/jobs`);
        const data = await resp.json();
        if (data.success) {
          const job = (data.data ?? []).find((j) => j.jobId === entry.jobId);
          // If job exists in memory store — fetch lines via /api/run/:jobId/stream
          if (job) {
            // Collect all SSE lines
            const linesArr = [];
            const es = new EventSource(`/api/run/${entry.jobId}/stream`);
            es.onmessage = (ev) => {
              try {
                const parsed = JSON.parse(ev.data);
                if (parsed.done) { es.close(); setJobLines((prev) => ({ ...prev, [key]: linesArr })); }
                else if (parsed.line !== undefined) linesArr.push(parsed.line);
              } catch { /* ignore */ }
            };
            es.onerror = () => {
              es.close();
              setJobLines((prev) => ({ ...prev, [key]: linesArr }));
            };
            // Timeout after 3s
            setTimeout(() => { es.close(); setJobLines((prev) => ({ ...prev, [key]: linesArr })); }, 3000);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Derive consolidated list: merge started+completed pairs
  const consolidated = React.useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!e.jobId) {
        map.set(e.ts + e.script, e);
      } else {
        const existing = map.get(e.jobId);
        if (!existing || e.status !== 'started') {
          map.set(e.jobId, { ...existing, ...e });
        } else if (!existing) {
          map.set(e.jobId, e);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [entries]);

  const filtered = consolidated.filter((e) => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (search && !(e.script ?? '').toLowerCase().includes(search.toLowerCase()) &&
        !(e.label ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('activityLog.title')}</h1>
        <button className="btn" onClick={handleExport}>
          {t('activityLog.export')} ↓
        </button>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('activityLog.filterDate')}:
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '5px 10px',
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('activityLog.filterStatus')}:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '5px 10px',
                fontSize: 12,
              }}
            >
              <option value="">All</option>
              <option value="started">Started</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('activityLog.filterAction')}:
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="kb:ingest, test, ..."
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '5px 10px',
                fontSize: 12,
                flex: 1,
              }}
            />
          </div>

          <button className="btn" style={{ fontSize: 12 }} onClick={fetchLog}>
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-row"><div className="spinner" />{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state">{t('activityLog.noLogs')}</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Timestamp</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Script</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Duration</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Exit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const key = entry.jobId ?? (entry.ts + entry.script);
                const isExpanded = expandedId === key;
                const lines = jobLines[key];
                return (
                  <React.Fragment key={key + i}>
                    <tr
                      onClick={() => handleRowClick({ ...entry, jobId: entry.jobId ?? key })}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(88,166,255,0.05)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                        {formatTs(entry.ts)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 500 }}>{entry.label || entry.script}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{entry.script}</div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                        {formatDuration(entry.durationMs)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                        {entry.exitCode !== null && entry.exitCode !== undefined ? (
                          <span style={{ color: entry.exitCode === 0 ? 'var(--green)' : 'var(--red)' }}>
                            {entry.exitCode}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} style={{ padding: '0 16px 16px' }}>
                          {lines && lines.length > 0 ? (
                            <div style={{
                              background: '#0d1117',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: '10px 12px',
                              fontFamily: 'monospace',
                              fontSize: 11,
                              lineHeight: 1.6,
                              maxHeight: 300,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              marginTop: 8,
                            }}>
                              {lines.map((l, li) => <div key={li}>{l}</div>)}
                            </div>
                          ) : (
                            <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                              {entry.jobId ? 'Output not available (job may have ended before this session).' : 'No output stored.'}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
