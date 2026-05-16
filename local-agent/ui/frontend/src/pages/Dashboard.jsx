import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

function CheckItem({ check }) {
  const passed = check.passed;
  const cls = passed === true ? 'check-pass'
            : passed === false && check.severity === 'FAIL' ? 'check-fail'
            : passed === false && check.severity === 'WARN' ? 'check-warn'
            : 'check-info';
  const icon = passed === true ? '✓'
             : passed === false && check.severity === 'FAIL' ? '✗'
             : passed === false && check.severity === 'WARN' ? '⚠'
             : 'i';
  return (
    <li className={`check-item ${cls}`}>
      <span className="check-icon">{icon}</span>
      <div>
        <div className="check-name">{check.name}</div>
        <div className="check-msg">{check.message}</div>
      </div>
    </li>
  );
}

export default function Dashboard() {
  const [projectStatus, setProjectStatus] = useState(null);
  const [policyStatus,  setPolicyStatus]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [scanning,      setScanning]      = useState(false);
  const [runningQA,     setRunningQA]     = useState(false);
  const [error,         setError]         = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ps, pol] = await Promise.all([
        api.get('/project/status'),
        api.get('/policy/status'),
      ]);
      if (ps.success)  setProjectStatus(ps.data);
      if (pol.success) setPolicyStatus(pol.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.post('/project/scan', {});
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleQA = async () => {
    setRunningQA(true);
    try {
      await api.post('/qa/run', { deep: false, autoFix: false });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningQA(false);
    }
  };

  const handlePolicyCheck = async () => {
    try {
      const res = await api.post('/policy/check', {});
      if (res.success) setPolicyStatus(res.data);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
      <div className="loading-row"><div className="spinner" /> Loading project data...</div>
    </div>
  );

  const p = projectStatus;
  const pol = policyStatus;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
            {scanning ? <><span className="spinner" />Scanning...</> : 'Scan Project'}
          </button>
          <button className="btn btn-success" onClick={handleQA} disabled={runningQA}>
            {runningQA ? <><span className="spinner" />Running QA...</> : 'Run QA'}
          </button>
          <button className="btn" onClick={handlePolicyCheck}>
            Policy Check
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
          <span style={{ color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      <div className="card-grid">
        {/* Project Info Card */}
        <div className="card">
          <div className="card-title">Project Info</div>
          {p ? (
            <ul style={{ listStyle: 'none' }}>
              <li className="stat-row"><span className="stat-label">Name</span><span className="stat-value">{p.projectName}</span></li>
              <li className="stat-row"><span className="stat-label">Root</span><span className="stat-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>{p.projectRoot}</span></li>
              <li className="stat-row"><span className="stat-label">Framework</span><span className="stat-value">{p.framework ?? '—'}</span></li>
              <li className="stat-row"><span className="stat-label">Language</span><span className="stat-value">{p.language ?? '—'}</span></li>
              <li className="stat-row"><span className="stat-label">Pkg Manager</span><span className="stat-value">{p.pkgManager ?? '—'}</span></li>
              <li className="stat-row"><span className="stat-label">Files</span><span className="stat-value">{p.fileCount}</span></li>
              <li className="stat-row"><span className="stat-label">TODOs</span><span className="stat-value">{p.todoCount}</span></li>
              <li className="stat-row">
                <span className="stat-label">Secrets detected</span>
                <span className="stat-value" style={{ color: p.secretCount > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {p.secretCount}
                </span>
              </li>
              <li className="stat-row"><span className="stat-label">Last scan</span><span className="stat-value" style={{ fontSize: 11 }}>{p.lastScan ? new Date(p.lastScan).toLocaleString() : 'Never'}</span></li>
              {p.qaScore !== null && (
                <li className="stat-row"><span className="stat-label">QA Score</span><span className="stat-value" style={{ color: p.qaScore >= 80 ? 'var(--green)' : p.qaScore >= 60 ? 'var(--yellow)' : 'var(--red)' }}>{p.qaScore}/100</span></li>
              )}
            </ul>
          ) : <div className="empty-state"><div>No project data yet.</div><div>Run a scan to get started.</div></div>}
        </div>

        {/* Policy Status Card */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Policy Status</span>
            {pol && (
              <span className={`badge badge-${pol.result === 'PASS' ? 'pass' : pol.result === 'WARNING' ? 'warn' : 'fail'}`}>
                {pol.result}
              </span>
            )}
          </div>
          {pol ? (
            <ul className="check-list">
              {pol.checks.map((c) => <CheckItem key={c.name} check={c} />)}
            </ul>
          ) : <div className="loading-row"><div className="spinner" />Loading policy...</div>}
        </div>
      </div>
    </div>
  );
}
