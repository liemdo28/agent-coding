import React, { useState, useEffect, useRef } from 'react';
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

      {/* ── Allowed Paths panel — always visible ─────────────────────────── */}
      <AllowedPathsPanel />
    </div>
  );
}

// ── AllowedPaths management component ────────────────────────────────────────

function AllowedPathsPanel() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [newPath, setNewPath] = useState('');
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirm, setConfirm] = useState(false); // show warning before adding
  const inputRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.get('/allowed-paths')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAddClick = () => {
    setError(null);
    setSuccess(null);
    const p = newPath.trim();
    if (!p) return;
    setConfirm(true); // Show warning first
  };

  const handleConfirmAdd = () => {
    setConfirm(false);
    setAdding(true);
    setError(null);
    api.post('/allowed-paths', { path: newPath.trim() })
      .then(() => {
        setNewPath('');
        setSuccess('Đã thêm thư mục thành công.');
        load();
      })
      .catch((err) => setError(err.message))
      .finally(() => setAdding(false));
  };

  // api.delete doesn't pass a body; use raw fetch for DELETE with body
  const deleteWithBody = (path) => {
    fetch('/api/allowed-paths', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path }),
    })
      .then((r) => r.json())
      .then(() => { setSuccess(`Đã xóa: ${path}`); load(); })
      .catch((err) => setError(err.message));
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>
        Phạm vi truy cập của Agent
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        Agent luôn được đọc thư mục project hiện tại.
        Thêm thư mục bên dưới để cho phép Agent truy cập các project khác.
        <strong style={{ color: 'var(--yellow)' }}> Chỉ thêm thư mục bạn tin tưởng.</strong>
      </p>

      {/* Project root — always allowed */}
      {data && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Thư mục gốc (mặc định)
          </div>
          <div className="allowed-path-row allowed-path-root">
            <span className="allowed-path-icon">🔒</span>
            <span className="allowed-path-text">{data.projectRoot}</span>
            <span className="badge badge-pass" style={{ fontSize: 10 }}>Luôn được phép</span>
          </div>
          {data.rootProjects?.projects?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 28 }}>
              {data.rootProjects.projects.length} project con được phát hiện
            </div>
          )}
        </div>
      )}

      {/* Extra allowed paths */}
      {data && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Thư mục thêm ({data.allowedPaths?.length ?? 0})
          </div>
          {(data.allowedPaths ?? []).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
              Chưa có thư mục nào — Agent chỉ đọc được project hiện tại.
            </div>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {data.allowedPaths.map((entry) => (
                <li key={entry.path} className="allowed-path-row">
                  <span className="allowed-path-icon">{entry.exists ? '📁' : '⚠️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="allowed-path-text">{entry.path}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {entry.exists
                        ? `${entry.projectCount} project`
                        : 'Thư mục không tồn tại'}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ color: 'var(--red)', borderColor: 'rgba(248,81,73,0.3)', padding: '3px 10px', fontSize: 12 }}
                    onClick={() => deleteWithBody(entry.path)}
                  >
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add path form */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          style={{ flex: 1, minWidth: 200, minHeight: 'unset', height: 36, padding: '6px 12px', borderRadius: 'var(--radius)', maxHeight: 'unset' }}
          placeholder="/Users/tên/Projects/du-an-khac"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddClick(); }}
          disabled={adding}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAddClick}
          disabled={adding || !newPath.trim()}
        >
          {adding ? '...' : '+ Thêm thư mục'}
        </button>
      </div>

      {/* Confirmation warning */}
      {confirm && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.35)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontWeight: 600, color: 'var(--yellow)', marginBottom: 6, fontSize: 13 }}>
            ⚠️ Xác nhận cấp quyền truy cập
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
            Mi sẽ đọc được <strong>toàn bộ nội dung</strong> thư mục:
            <br /><code style={{ fontFamily: 'monospace', color: 'var(--yellow)' }}>{newPath.trim()}</code>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Chỉ thêm thư mục bạn tin tưởng. Bạn tự chịu trách nhiệm về nội dung mà Agent được đọc.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" style={{ background: 'var(--yellow)', color: '#000', borderColor: 'var(--yellow)' }} onClick={handleConfirmAdd}>
              Đồng ý, thêm vào
            </button>
            <button className="btn btn-sm" onClick={() => setConfirm(false)}>Hủy</button>
          </div>
        </div>
      )}

      {error   && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)'   }}>{error}</div>}
      {success && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)' }}>{success}</div>}
    </div>
  );
}
