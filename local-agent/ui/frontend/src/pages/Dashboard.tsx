// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import { t } from '../i18n/index.js';

function formatUptime(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function formatTs(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

const STATUS_LABEL = {
  started:   { label: () => t('activityLog.status.started'),   color: 'var(--blue)'   },
  completed: { label: () => t('activityLog.status.completed'), color: 'var(--green)'  },
  failed:    { label: () => t('activityLog.status.failed'),    color: 'var(--red)'    },
  stopped:   { label: () => t('activityLog.status.stopped'),   color: 'var(--yellow)' },
};

function CheckItem({ check }) {
  const cls =
    check.passed === true                                   ? 'text-green'
    : check.passed === false && check.severity === 'FAIL'  ? 'text-red'
    : check.passed === false && check.severity === 'WARN'  ? 'text-yellow'
    : 'text-blue';
  const icon =
    check.passed === true                                   ? '✓'
    : check.passed === false && check.severity === 'FAIL'  ? '✗'
    : check.passed === false && check.severity === 'WARN'  ? '⚠'
    : 'i';
  return (
    <li className="flex items-start gap-2.5 py-2.5 border-b border-border/50 text-[13px] last:border-0">
      <span className={`flex-shrink-0 mt-0.5 font-bold ${cls}`}>{icon}</span>
      <div>
        <div className="font-medium text-text">{check.name}</div>
        <div className="text-[12px] text-muted mt-0.5">{check.message}</div>
      </div>
    </li>
  );
}

function StatCard({ label, value, sub, valueColor = 'text-blue' }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="card-title">{label}</div>
      <div className={`text-4xl font-bold leading-none ${valueColor}`}>{value}</div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <li className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </li>
  );
}

export default function Dashboard() {
  const [projectStatus,      setProjectStatus]      = useState(null);
  const [policyStatus,       setPolicyStatus]        = useState(null);
  const [registeredProjects, setRegisteredProjects]  = useState(null);
  const [loading,            setLoading]             = useState(true);
  const [scanning,           setScanning]            = useState(false);
  const [runningQA,          setRunningQA]           = useState(false);
  const [error,              setError]               = useState(null);
  const [healthData,         setHealthData]          = useState(null);
  const [recentActivity,     setRecentActivity]      = useState([]);

  const loadHealth = useCallback(async () => {
    try {
      const h = await fetch('/api/health').then((r) => r.json());
      if (h.success) setHealthData(h.data);
    } catch { /* ignore */ }
    try {
      const al = await fetch('/api/activity-log').then((r) => r.json());
      if (al.success) {
        setRecentActivity(
          al.data.filter((e) => e.status === 'completed' || e.status === 'failed').slice(-5).reverse()
        );
      }
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ps, pol] = await Promise.all([api.get('/project/status'), api.get('/policy/status')]);
      if (ps.success)  setProjectStatus(ps.data);
      if (pol.success) setPolicyStatus(pol.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    try {
      const reg = await api.get('/projects');
      if (reg.success) setRegisteredProjects(reg.data);
    } catch { setRegisteredProjects([]); }
  }, []);

  useEffect(() => {
    loadData(); loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, [loadData, loadHealth]);

  const handleScan = async () => {
    setScanning(true);
    try { await api.post('/project/scan', {}); await loadData(); }
    catch (err) { setError(err.message); }
    finally { setScanning(false); }
  };

  const handleQA = async () => {
    setRunningQA(true);
    try { await api.post('/qa/run', { deep: false, autoFix: false }); await loadData(); }
    catch (err) { setError(err.message); }
    finally { setRunningQA(false); }
  };

  const handlePolicyCheck = async () => {
    try {
      const res = await api.post('/policy/check', {});
      if (res.success) setPolicyStatus(res.data);
    } catch (err) { setError(err.message); }
  };

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
      <div className="loading-row"><div className="spinner" /> Loading project data...</div>
    </div>
  );

  const p   = projectStatus;
  const pol = policyStatus;
  const polBadge = pol?.result === 'PASS' ? 'badge-pass' : pol?.result === 'WARNING' ? 'badge-warn' : 'badge-fail';

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
            {scanning ? <><span className="spinner" />Scanning…</> : 'Scan Project'}
          </button>
          <button className="btn btn-success" onClick={handleQA} disabled={runningQA}>
            {runningQA ? <><span className="spinner" />Running QA…</> : 'Run QA'}
          </button>
          <button className="btn" onClick={handlePolicyCheck}>Policy Check</button>
        </div>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: 'var(--red)' }}>
          <span className="text-red">{error}</span>
        </div>
      )}

      {/* Health stat cards */}
      {healthData && (
        <div className="card-grid">
          <StatCard label={t('dashboard.kbDocs')} value={(healthData.kb?.docs ?? 0).toLocaleString()}
            sub={`${(healthData.kb?.chunks ?? 0).toLocaleString()} ${t('dashboard.kbChunks')}`} valueColor="text-blue" />
          <StatCard label={t('dashboard.testsPassing')} value={healthData.tests?.pass ?? 0} valueColor="text-green"
            sub={(healthData.tests?.fail ?? 0) > 0
              ? <span className="text-red">{healthData.tests.fail} {t('dashboard.testsFailing')}</span>
              : <span className="text-green">{t('dashboard.allGood')}</span>} />
          <StatCard label={t('dashboard.systemHealth')}
            value={(healthData.tests?.fail ?? 0) > 0 ? '🔴' : '🟢'} valueColor="text-text"
            sub={`${t('dashboard.uptime')}: ${formatUptime(healthData.system?.uptime ?? 0)}  ·  ${t('dashboard.memoryUsed')}: ${healthData.system?.memMB ?? 0} MB`} />
          <StatCard label="AI (Local LLM)" value={healthData.llm?.available ? '🟢' : '🔴'} valueColor="text-text"
            sub={healthData.llm?.available
              ? <span className="text-green">AI đang chạy</span>
              : <span className="text-red">AI chưa chạy</span>} />
        </div>
      )}

      {/* Quick actions */}
      <div className="card mb-4">
        <div className="card-title">{t('dashboard.quickActions')}</div>
        <div className="btn-group">
          <button className="btn" onClick={() => window.location.href = '/command-center'}>⚡ {t('nav.commandCenter')}</button>
          <button className="btn" onClick={() => window.location.href = '/activity-log'}>📓 {t('nav.activityLog')}</button>
        </div>
      </div>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="card mb-4">
          <div className="card-title">{t('dashboard.recentActivity')}</div>
          <ul className="list-none">
            {recentActivity.map((entry, i) => {
              const st = STATUS_LABEL[entry.status] ?? { label: () => entry.status, color: 'var(--text-muted)' };
              return (
                <li key={i} className="stat-row">
                  <span className="font-mono text-[12px] text-muted">{entry.label || entry.script}</span>
                  <span className="flex items-center gap-3 text-[12px]">
                    <span style={{ color: st.color }}>{st.label()}</span>
                    <span className="text-muted">{formatTs(entry.ts)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Project info + Policy */}
      <div className="card-grid">
        <div className="card">
          <div className="card-title">Project Info</div>
          {p ? (
            <ul className="list-none">
              <StatRow label="Name"        value={p.projectName} />
              <StatRow label="Root"        value={<span className="font-mono text-[11px] break-all">{p.projectRoot}</span>} />
              <StatRow label="Framework"   value={p.framework ?? '—'} />
              <StatRow label="Language"    value={p.language ?? '—'} />
              <StatRow label="Pkg Manager" value={p.pkgManager ?? '—'} />
              <StatRow label="Files"       value={p.fileCount} />
              <StatRow label="TODOs"       value={p.todoCount} />
              <StatRow label="Secrets"     value={
                <span style={{ color: p.secretCount > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{p.secretCount}</span>
              } />
              <StatRow label="Last scan"   value={<span className="text-[11px]">{p.lastScan ? new Date(p.lastScan).toLocaleString() : 'Never'}</span>} />
              {p.qaScore != null && (
                <StatRow label="QA Score"  value={
                  <span style={{ color: p.qaScore >= 80 ? 'var(--green)' : p.qaScore >= 60 ? 'var(--yellow)' : 'var(--red)', fontWeight: 600 }}>
                    {p.qaScore}/100
                  </span>
                } />
              )}
            </ul>
          ) : (
            <div className="empty-state"><div>No project data yet.</div><div>Run a scan to get started.</div></div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="card-title" style={{ margin: 0 }}>Policy Status</span>
            {pol && <span className={`badge ${polBadge}`}>{pol.result}</span>}
          </div>
          {pol ? (
            <ul className="list-none">
              {pol.checks.map((c) => <CheckItem key={c.name} check={c} />)}
            </ul>
          ) : (
            <div className="loading-row"><div className="spinner" />Loading policy…</div>
          )}
        </div>
      </div>

      {/* Registered Projects */}
      <div className="mt-8">
        <div className="page-header mb-3">
          <h2 className="page-title" style={{ fontSize: 18 }}>
            Registered Projects
            <span style={{ fontSize: 12, fontWeight: 'normal', marginLeft: 10, opacity: 0.6 }}>(managed via CLI)</span>
          </h2>
        </div>
        {registeredProjects === null ? (
          <div className="loading-row"><div className="spinner" />Loading projects…</div>
        ) : registeredProjects.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div>No other projects registered.</div>
              <div className="mt-1.5 font-mono text-[12px] opacity-70">Use: local-agent projects add &lt;path&gt;</div>
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {registeredProjects.map((proj) => (
              <div key={proj.projectId} className="card">
                <div className="flex items-center justify-between mb-4">
                  <span className="card-title truncate mr-2" style={{ margin: 0 }}>{proj.name}</span>
                  <span className={`badge flex-shrink-0 ${proj.status === 'healthy' ? 'badge-pass' : proj.status === 'warning' ? 'badge-warn' : proj.status === 'fail' ? 'badge-fail' : 'badge-pending'}`}>
                    {proj.status ?? 'unknown'}
                  </span>
                </div>
                <ul className="list-none">
                  <StatRow label="Root"      value={<span className="font-mono text-[11px] break-all">{proj.root}</span>} />
                  {proj.framework && <StatRow label="Framework" value={proj.framework} />}
                  {proj.language  && <StatRow label="Language"  value={proj.language} />}
                  <StatRow label="Last scan" value={<span className="text-[11px]">{proj.lastScan ? new Date(proj.lastScan).toLocaleString() : 'Never'}</span>} />
                  <StatRow label="Last QA"   value={<span className="text-[11px]">{proj.lastQA ? new Date(proj.lastQA).toLocaleString() : 'Never'}</span>} />
                  {(proj.lastScore ?? 0) > 0 && (
                    <StatRow label="Score" value={
                      <span style={{ color: proj.lastScore >= 80 ? 'var(--green)' : proj.lastScore >= 60 ? 'var(--yellow)' : 'var(--red)', fontWeight: 600 }}>
                        {proj.lastScore}/100
                      </span>
                    } />
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
