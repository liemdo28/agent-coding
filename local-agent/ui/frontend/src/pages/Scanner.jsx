import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Scanner() {
  const [status,   setStatus]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState(null);

  const load = async () => {
    try {
      const r = await api.get('/project/status');
      if (r.success) setStatus(r.data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      await api.post('/project/scan', {});
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Scanner</h1>
        <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
          {scanning ? <><span className="spinner" />Scanning...</> : 'Run Scan'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
          <span style={{ color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {!status && !error && (
        <div className="loading-row"><div className="spinner" />Loading...</div>
      )}

      {status && (
        <>
          <div className="card-grid">
            <div className="card">
              <div className="card-title">Overview</div>
              <ul style={{ listStyle: 'none' }}>
                <li className="stat-row"><span className="stat-label">Project</span><span className="stat-value">{status.projectName}</span></li>
                <li className="stat-row"><span className="stat-label">Files</span><span className="stat-value">{status.fileCount}</span></li>
                <li className="stat-row"><span className="stat-label">Framework</span><span className="stat-value">{status.framework ?? '—'}</span></li>
                <li className="stat-row"><span className="stat-label">Language</span><span className="stat-value">{status.language ?? '—'}</span></li>
                <li className="stat-row"><span className="stat-label">Pkg Manager</span><span className="stat-value">{status.pkgManager ?? '—'}</span></li>
                <li className="stat-row"><span className="stat-label">Last Scan</span><span className="stat-value" style={{ fontSize: 11 }}>{status.lastScan ? new Date(status.lastScan).toLocaleString() : 'Never'}</span></li>
              </ul>
            </div>

            <div className="card">
              <div className="card-title">Risk Summary</div>
              <ul style={{ listStyle: 'none' }}>
                <li className="stat-row">
                  <span className="stat-label">Secrets detected</span>
                  <span className="stat-value" style={{ color: status.secretCount > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {status.secretCount}
                  </span>
                </li>
                <li className="stat-row">
                  <span className="stat-label">Open TODOs</span>
                  <span className="stat-value" style={{ color: status.todoCount > 10 ? 'var(--yellow)' : 'var(--text)' }}>
                    {status.todoCount}
                  </span>
                </li>
                <li className="stat-row">
                  <span className="stat-label">QA Score</span>
                  <span className="stat-value" style={{ color: status.qaScore !== null ? (status.qaScore >= 80 ? 'var(--green)' : status.qaScore >= 60 ? 'var(--yellow)' : 'var(--red)') : 'var(--text-muted)' }}>
                    {status.qaScore !== null ? `${status.qaScore}/100` : 'Not run'}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {status.lastScan && (
            <div className="card">
              <div className="card-title">Scan Status</div>
              <div style={{ color: 'var(--green)', fontSize: 13 }}>
                Last scan completed: {new Date(status.lastScan).toLocaleString()}
              </div>
              {status.secretCount > 0 && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 6, color: 'var(--red)', fontSize: 13 }}>
                  {status.secretCount} possible hardcoded secret(s) detected — review the Patches or Security page.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
