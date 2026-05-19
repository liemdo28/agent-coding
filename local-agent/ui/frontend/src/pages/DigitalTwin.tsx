// @ts-nocheck
// pages/DigitalTwin.tsx
// Digital Twin v3 — connects to /api/analytics, uses existing .dt-* CSS
import React, { useState, useEffect, useCallback, useRef } from 'react';

const RISK_COLOR = { safe: 'var(--green)', warn: 'var(--yellow)', alert: 'var(--orange)', danger: 'var(--red)' };
const RISK_CSS   = { safe: '--color-green', warn: '--color-yellow', alert: '--color-orange', danger: '--color-red' };

function riskColor(band) { return RISK_COLOR[band] ?? 'var(--text-muted)'; }

function RiskPill({ band, score }) {
  return (
    <span className="dt-risk-pill" style={{ '--risk': riskColor(band) }}>
      {Math.round((score ?? 0) * 100)}%
    </span>
  );
}

function ProgressBar({ value, max = 100 }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="dt-progress">
      <span style={{ width: `${pct}%` }} />
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
  const debounceRef = useRef(null);

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

  const systemBadge =
    summary.systemHealth === 'PASS' ? 'badge-pass' :
    summary.systemHealth === 'WARN' ? 'badge-warn' : 'badge-fail';

  return (
    <div className="dt-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Digital Twin</h1>
          <div className="dt-subtitle">Corp simulation — offline, sandboxed</div>
        </div>
        <div className="flex items-center gap-2">
          {summary.systemHealth && <span className={`badge ${systemBadge}`}>{summary.systemHealth}</span>}
          <span className="badge badge-sandbox">SANDBOXED</span>
          <button className="btn btn-sm" onClick={() => fetchData(controls)} disabled={loading}>
            {loading ? <><span className="spinner" />Loading…</> : '↺ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="dt-alert dt-alert-danger mb-3">⚠ {error}</div>
      )}

      {/* Control sliders */}
      <div className="card mb-4">
        <div className="card-title">Simulation Controls</div>
        <div className="dt-controls">
          <label>
            <span>Priority Weight</span>
            <input type="range" min="0" max="100" value={controls.priorityWeight}
              onChange={(e) => handleControl('priorityWeight', e.target.value)} />
            <strong>{controls.priorityWeight}%</strong>
          </label>
          <label>
            <span>Worker Allocation</span>
            <input type="range" min="16" max="512" value={controls.workerAllocation}
              onChange={(e) => handleControl('workerAllocation', e.target.value)} />
            <strong>{controls.workerAllocation}</strong>
          </label>
          <label>
            <span>Batch Factor</span>
            <input type="range" min="10" max="100" value={controls.batchFactor}
              onChange={(e) => handleControl('batchFactor', e.target.value)} />
            <strong>{controls.batchFactor}%</strong>
          </label>
          <div />
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="dt-stats mb-4">
        <div className="dt-stat dt-stat-blue">
          <div className="dt-stat-value">{summary.activeTasks ?? 0}</div>
          <div className="dt-stat-label">Active Tasks</div>
          <div className="dt-stat-detail">{summary.totalProjects ?? 0} projects</div>
        </div>
        <div className={`dt-stat ${summary.qaWarnings > 0 ? 'dt-stat-yellow' : 'dt-stat-green'}`}>
          <div className="dt-stat-value">{summary.qaWarnings ?? 0}</div>
          <div className="dt-stat-label">QA Warnings</div>
          <div className="dt-stat-detail">{summary.rollbacks ?? 0} rollbacks</div>
        </div>
        <div className="dt-stat dt-stat-purple">
          <div className="dt-stat-value">{summary.totalWorkers ?? 0}</div>
          <div className="dt-stat-label">Workers</div>
          <div className="dt-stat-detail">{companies.length} divisions</div>
        </div>
        <div className={`dt-stat ${alerts.length > 0 ? 'dt-stat-red' : 'dt-stat-green'}`}>
          <div className="dt-stat-value">{alerts.length}</div>
          <div className="dt-stat-label">Active Alerts</div>
          <div className="dt-stat-detail">
            {alerts.filter((a) => a.severity === 'danger').length} critical
          </div>
        </div>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.slice(0, 3).map((a, i) => (
            <div key={i} className={`dt-alert ${a.severity === 'danger' ? 'dt-alert-danger' : 'dt-alert-info'}`}>
              {a.severity === 'danger' ? '🔴' : '⚠'} {a.message}
            </div>
          ))}
          {alerts.length > 3 && (
            <div className="text-[12px] text-muted text-right">+{alerts.length - 3} more alerts</div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="dt-tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Alerts' && alerts.length > 0 && (
              <span className="ml-1 badge badge-fail" style={{ fontSize: 10 }}>{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="dt-twin">
          <div className="dt-twin-grid">
            {/* Company map */}
            <div className="dt-layer">
              <div className="dt-layer-title">Division Risk Map</div>
              <div className="dt-company-map">
                {companies.map((co) => {
                  const risk = riskColor(co.riskBand);
                  return (
                    <div key={co.id} className="dt-node"
                      style={{ '--risk': risk, '--riskScore': co.predictedRisk }}>
                      <div className="dt-node-name">{co.name}</div>
                      <div className="dt-node-meta">
                        {co.activeTasks} tasks · {co.workerPool} workers
                      </div>
                      <div className="dt-node-risk">{Math.round(co.predictedRisk * 100)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Batch overview */}
            <div className="dt-layer">
              <div className="dt-layer-title">Batch Progress</div>
              <div className="dt-batch-grid">
                {batches.slice(0, 4).map((b) => (
                  <div key={b.id} className="dt-batch-card"
                    style={{ '--risk': riskColor(b.riskBand) }}>
                    <div className="dt-batch-head">
                      <strong style={{ fontSize: 13 }}>{b.id}</strong>
                      <RiskPill band={b.riskBand} score={b.predictedRisk} />
                    </div>
                    <ProgressBar value={b.progress} />
                    <div className="dt-batch-metrics">
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{b.taskCount}</div><div>tasks</div></div>
                      <div><div style={{ fontSize: 13, fontWeight: 700, color: b.qaFailRate > 0 ? 'var(--yellow)' : 'var(--green)' }}>{Math.round(b.qaFailRate * 100)}%</div><div>QA fail</div></div>
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{b.workerAllocation}</div><div>workers</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Companies' && (
        <div className="dt-company-list">
          {companies.map((co) => (
            <div key={co.id} className="dt-company-card">
              <div className="dt-company-card-head">
                <div>
                  <h3>{co.name}</h3>
                  <span>{co.activeTasks} tasks · Batch {co.currentBatch}</span>
                </div>
                <RiskPill band={co.riskBand} score={co.predictedRisk} />
              </div>
              <div className="dt-card-grid">
                <span>Workers <strong>{co.workerPool}</strong></span>
                <span>High-priority <strong>{co.highPriorityTasks}</strong></span>
                <span>QA issues <strong style={{ color: co.qaFailRate > 0.2 ? 'var(--yellow)' : 'var(--text)' }}>{Math.round(co.qaFailRate * 100)}%</strong></span>
                <span>Rollbacks <strong style={{ color: co.rollbackCount > 0 ? 'var(--red)' : 'var(--text)' }}>{co.rollbackCount}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Batches' && (
        <div className="dt-batch-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          {batches.map((b) => (
            <div key={b.id} className="dt-batch-card" style={{ '--risk': riskColor(b.riskBand) }}>
              <div className="dt-batch-head">
                <strong style={{ fontSize: 15 }}>{b.id}</strong>
                <RiskPill band={b.riskBand} score={b.predictedRisk} />
              </div>
              <ProgressBar value={b.progress} />
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div className="stat-row"><span className="stat-label">Tasks</span><span className="stat-value">{b.taskCount}</span></div>
                <div className="stat-row"><span className="stat-label">Progress</span><span className="stat-value">{b.progress}%</span></div>
                <div className="stat-row"><span className="stat-label">QA Fail Rate</span>
                  <span className="stat-value" style={{ color: b.qaFailRate > 0.2 ? 'var(--yellow)' : 'var(--green)' }}>
                    {Math.round(b.qaFailRate * 100)}%
                  </span>
                </div>
                <div className="stat-row"><span className="stat-label">Workers</span><span className="stat-value">{b.workerAllocation}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Tasks' && (
        <div>
          <div className="dt-toolbar">
            <span className="text-[12px] text-muted">{tasks.length} tasks total</span>
          </div>
          <div className="dt-table">
            {tasks.slice(0, 40).map((task) => (
              <div key={task.id} className="dt-task-row">
                <div>
                  <strong title={task.title}>{task.title.slice(0, 60)}{task.title.length > 60 ? '…' : ''}</strong>
                  <span>{task.type} · {task.companyId} · {task.batch}</span>
                </div>
                <span className={`dt-priority dt-priority-${task.priority}`}>{task.priority}</span>
                <RiskPill band={task.riskBand} score={task.riskScore} />
                <span className="badge badge-pending" style={{ fontSize: 11 }}>{task.qaStatus.replace(/-/g, ' ')}</span>
              </div>
            ))}
            {tasks.length > 40 && (
              <div className="text-[12px] text-muted text-center py-2">+{tasks.length - 40} more tasks</div>
            )}
          </div>
        </div>
      )}

      {tab === 'Alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div>No active alerts</div>
          ) : alerts.map((a, i) => (
            <div key={i} className={`dt-alert ${a.severity === 'danger' ? 'dt-alert-danger' : 'dt-alert-info'}`}
              style={{ padding: '12px 16px', borderRadius: 'var(--radius)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {a.severity === 'danger' ? '🔴' : a.severity === 'alert' ? '🟠' : '⚠'} {a.type.toUpperCase()}
              </div>
              <div style={{ fontSize: 13 }}>{a.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="dt-footer">
        Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}
