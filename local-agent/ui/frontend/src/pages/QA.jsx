import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

function ScoreBar({ label, value, maxValue = 100, color }) {
  const pct = Math.min(100, Math.round(((value ?? 0) / maxValue) * 100));
  const barColor = color ?? (pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)');
  return (
    <div className="score-bar-row">
      <div className="score-bar-label">{label}</div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="score-bar-value" style={{ color: barColor }}>{value ?? 0}</div>
    </div>
  );
}

function PassFail({ label, passed }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className={`badge badge-${passed ? 'pass' : 'fail'}`}>{passed ? 'PASS' : 'FAIL'}</span>
    </div>
  );
}

export default function QA() {
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [running,  setRunning]  = useState(false);
  const [error,    setError]    = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/qa/status');
      if (r.success) setReport(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRun = async (deep = false) => {
    setRunning(true);
    setError(null);
    try {
      const r = await api.post('/qa/run', { deep, autoFix: false });
      if (r.success) setReport(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const score = report?.qaScore;
  const scoreTotal = score?.total ?? report?.qaScore;
  const scoreGrade = score?.grade;
  const buildOk = report?.buildResult?.success;
  const testOk  = report?.testResult?.success;
  const errors  = [
    ...(report?.buildResult?.errors ?? []),
    ...(report?.testResult?.errors ?? []),
  ];

  const breakdown = score?.breakdown;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">QA</h1>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => handleRun(false)} disabled={running}>
            {running ? <><span className="spinner" />Running...</> : 'Run QA'}
          </button>
          <button className="btn" onClick={() => handleRun(true)} disabled={running}>
            Run Deep QA
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}

      {loading && <div className="loading-row"><div className="spinner" />Loading QA status...</div>}

      {!loading && !report && !error && (
        <div className="empty-state">
          <div className="empty-icon">✔️</div>
          <div>No QA report found.</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Run QA to generate a report.</div>
        </div>
      )}

      {report && (
        <>
          <div className="card-grid">
            {/* Score card */}
            <div className="card">
              <div className="card-title">Overall Score</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                <span
                  className="score-big"
                  style={{ color: (scoreTotal ?? 0) >= 80 ? 'var(--green)' : (scoreTotal ?? 0) >= 60 ? 'var(--yellow)' : 'var(--red)' }}
                >
                  {scoreTotal ?? '—'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>/100</span>
                {scoreGrade && (
                  <span className="score-grade" style={{ color: 'var(--blue)' }}>{scoreGrade}</span>
                )}
              </div>
              {breakdown && (
                <>
                  {Object.entries(breakdown).map(([key, val]) => (
                    <ScoreBar key={key} label={key} value={val} maxValue={30} />
                  ))}
                </>
              )}
            </div>

            {/* Build / test card */}
            <div className="card">
              <div className="card-title">Results</div>
              <ul style={{ listStyle: 'none' }}>
                {buildOk !== undefined && <li><PassFail label="Build" passed={buildOk} /></li>}
                {testOk  !== undefined && <li><PassFail label="Tests"  passed={testOk} /></li>}
              </ul>
              <hr className="divider" />
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}
              </div>
              {report.regression && (
                <div style={{ marginTop: 10, fontSize: 12, color: report.regression.isRegression ? 'var(--red)' : 'var(--green)' }}>
                  {report.regression.isRegression ? 'Regression detected' : 'No regression detected'}
                </div>
              )}
            </div>
          </div>

          {errors.length > 0 && (
            <div className="card">
              <div className="card-title">Errors ({errors.length})</div>
              <ul className="error-list">
                {errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="error-item">
                    {typeof e === 'string' ? e : (e.message ?? e.text ?? JSON.stringify(e))}
                  </li>
                ))}
                {errors.length > 20 && (
                  <li className="error-item" style={{ color: 'var(--text-muted)' }}>
                    ... and {errors.length - 20} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
