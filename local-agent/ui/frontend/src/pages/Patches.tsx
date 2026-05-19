// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

function RiskBadge({ risk }) {
  if (!risk) return null;
  const normalized = String(risk).toLowerCase();
  const cls = normalized === 'high' || parseFloat(risk) >= 0.7 ? 'badge-high-risk'
            : normalized === 'low'  || parseFloat(risk) <= 0.3 ? 'badge-low-risk'
            : 'badge-med-risk';
  return <span className={`badge ${cls}`}>{normalized === 'high' || parseFloat(risk) >= 0.7 ? 'HIGH RISK' : normalized === 'low' || parseFloat(risk) <= 0.3 ? 'LOW RISK' : 'MED RISK'}</span>;
}

function StatusBadge({ status }) {
  const cls = status === 'applied' ? 'badge-applied'
            : status === 'rejected' || status === 'rolled_back' ? 'badge-rejected'
            : 'badge-pending';
  return <span className={`badge ${cls}`}>{status ?? 'pending'}</span>;
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="confirm-dialog">
        <div className="confirm-title">Confirm Action</div>
        <div className="confirm-msg">{message}</div>
        <div className="btn-group">
          <button className="btn btn-danger" onClick={onConfirm}>Confirm</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PatchCard({ patch, onRefresh }) {
  const [expanded,   setExpanded]   = useState(false);
  const [confirm,    setConfirm]    = useState(null); // { action, label }
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const isHighRisk = (patch.riskLevel ?? patch.risk ?? 0) >= 0.7
                  || String(patch.riskLevel).toLowerCase() === 'high';

  const handleAction = async (action) => {
    setConfirm(null);
    setLoading(true);
    setError(null);
    try {
      await api.post(`/patches/${patch.id}/${action}`, {});
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`patch-card${isHighRisk ? ' high-risk' : ''}`}>
      {confirm && (
        <ConfirmDialog
          message={`Are you sure you want to ${confirm.label} this patch? ${isHighRisk ? 'WARNING: This is a high-risk patch.' : ''}`}
          onConfirm={() => handleAction(confirm.action)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {isHighRisk && (
        <div className="patch-risk-banner">
          HIGH RISK — This patch touches security-sensitive files. Review carefully before applying.
        </div>
      )}

      <div className="patch-header" onClick={() => setExpanded((e) => !e)}>
        <span className="patch-id">#{patch.id?.slice(0, 10)}</span>
        <span className="patch-task">{patch.task ?? 'Untitled patch'}</span>
        <RiskBadge risk={patch.riskLevel ?? patch.risk} />
        <StatusBadge status={patch.status} />
        <span className="patch-meta">{patch.filesChanged?.length ?? 0} file(s)</span>
        <span className="patch-meta">{patch.createdAt ? new Date(patch.createdAt).toLocaleDateString() : ''}</span>
        <span style={{ color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="patch-body">
          {error && <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

          {patch.filesChanged?.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Files: {patch.filesChanged.join(', ')}
            </div>
          )}

          {(patch.patchText || patch.diff) && (
            <div className="patch-diff">
              {patch.patchText ?? patch.diff}
            </div>
          )}

          <div className="btn-group">
            {patch.status !== 'applied' && patch.status !== 'rejected' && (
              <button
                className="btn btn-success"
                disabled={loading}
                onClick={() => setConfirm({ action: 'apply', label: 'apply' })}
              >
                {loading ? <><span className="spinner" />Applying...</> : 'Apply'}
              </button>
            )}
            {patch.status === 'applied' && (
              <button
                className="btn btn-warn"
                disabled={loading}
                onClick={() => setConfirm({ action: 'rollback', label: 'rollback' })}
              >
                {loading ? <><span className="spinner" />Rolling back...</> : 'Rollback'}
              </button>
            )}
            {patch.status === 'pending' && (
              <button
                className="btn btn-danger"
                disabled={loading}
                onClick={() => setConfirm({ action: 'reject', label: 'reject' })}
              >
                Reject
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Patches() {
  const [patches, setPatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/patches');
      if (r.success) setPatches(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patches</h1>
        <button className="btn" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <div className="card" style={{ padding: '14px 16px', marginBottom: 16, background: 'rgba(88,166,255,0.06)', borderColor: 'rgba(88,166,255,0.2)' }}>
        <span style={{ fontSize: 12, color: 'var(--blue)' }}>
          Patches require explicit confirmation before being applied. Auto-apply is disabled.
        </span>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}

      {loading && <div className="loading-row"><div className="spinner" />Loading patches...</div>}

      {!loading && patches.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🩹</div>
          <div>No patches found.</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Patches are generated by the auto-debug loop.</div>
        </div>
      )}

      {patches.map((p) => (
        <PatchCard key={p.id} patch={p} onRefresh={load} />
      ))}
    </div>
  );
}
