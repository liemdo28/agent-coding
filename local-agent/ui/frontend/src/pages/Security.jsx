import React, { useState, useEffect } from 'react';
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
        {check.details?.length > 0 && (
          <ul style={{ listStyle: 'none', marginTop: 6 }}>
            {check.details.map((d, i) => (
              <li key={i} style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', padding: '2px 0' }}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function Security() {
  const [policy,   setPolicy]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [checking, setChecking] = useState(false);
  const [error,    setError]    = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/policy/status');
      if (r.success) setPolicy(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      const r = await api.post('/policy/check', {});
      if (r.success) setPolicy(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const result = policy?.result;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">Security</h1>
          {result && (
            <span className={`badge badge-${result === 'PASS' ? 'pass' : result === 'WARNING' ? 'warn' : 'fail'}`} style={{ fontSize: 14, padding: '4px 12px' }}>
              {result}
            </span>
          )}
        </div>
        <button className="btn btn-primary" onClick={handleCheck} disabled={checking}>
          {checking ? <><span className="spinner" />Checking...</> : 'Refresh Check'}
        </button>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}
      {loading && <div className="loading-row"><div className="spinner" />Running policy checks...</div>}

      {policy && (
        <>
          <div className="card-grid">
            <div className="card">
              <div className="card-title">Summary</div>
              <ul style={{ listStyle: 'none' }}>
                <li className="stat-row">
                  <span className="stat-label">Overall Result</span>
                  <span className={`badge badge-${result === 'PASS' ? 'pass' : result === 'WARNING' ? 'warn' : 'fail'}`}>{result}</span>
                </li>
                <li className="stat-row">
                  <span className="stat-label">Hard Failures</span>
                  <span className="stat-value" style={{ color: policy.failCount > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {policy.failCount}
                  </span>
                </li>
                <li className="stat-row">
                  <span className="stat-label">Warnings</span>
                  <span className="stat-value" style={{ color: policy.warnCount > 0 ? 'var(--yellow)' : 'var(--text)' }}>
                    {policy.warnCount}
                  </span>
                </li>
                <li className="stat-row">
                  <span className="stat-label">Total checks</span>
                  <span className="stat-value">{policy.checks?.length ?? 0}</span>
                </li>
              </ul>
            </div>

            <div className="card">
              <div className="card-title">Security Notes</div>
              <ul style={{ listStyle: 'none', fontSize: 12 }}>
                <li className="stat-row"><span style={{ color: 'var(--green)' }}>✓</span><span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>All traffic stays on localhost</span></li>
                <li className="stat-row"><span style={{ color: 'var(--green)' }}>✓</span><span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>No telemetry or cloud sync</span></li>
                <li className="stat-row"><span style={{ color: 'var(--green)' }}>✓</span><span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>LLM endpoint must be local only</span></li>
                <li className="stat-row"><span style={{ color: 'var(--green)' }}>✓</span><span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Patches require explicit approval</span></li>
                <li className="stat-row"><span style={{ color: 'var(--green)' }}>✓</span><span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Secret values never displayed in UI</span></li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Policy Checks ({policy.checks?.length ?? 0})</div>
            <ul className="check-list">
              {(policy.checks ?? []).map((c) => <CheckItem key={c.name} check={c} />)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
