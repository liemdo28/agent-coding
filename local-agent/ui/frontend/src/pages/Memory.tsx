// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function Memory() {
  const [files,    setFiles]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error,    setError]    = useState(null);
  const [confirm,  setConfirm]  = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/memory');
      if (r.success) setFiles(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    setConfirm(false);
    setClearing(true);
    setError(null);
    try {
      const r = await api.delete('/memory');
      if (r.success) {
        setFiles([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      {confirm && (
        <div className="modal-overlay">
          <div className="confirm-dialog">
            <div className="confirm-title">Clear All Memory?</div>
            <div className="confirm-msg">This will permanently delete all memory files. This cannot be undone.</div>
            <div className="btn-group">
              <button className="btn btn-danger" onClick={handleClear}>Clear All</button>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Memory</h1>
        <button
          className="btn btn-danger"
          onClick={() => setConfirm(true)}
          disabled={clearing || files.length === 0}
        >
          {clearing ? <><span className="spinner" />Clearing...</> : 'Clear Memory'}
        </button>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}
      {loading && <div className="loading-row"><div className="spinner" />Loading memory files...</div>}

      {!loading && files.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">🧠</div>
          <div>No memory files found.</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Memory files are created by the agent during operation.</div>
        </div>
      )}

      {files.length > 0 && (
        <div className="card">
          <div className="card-title">Memory Files ({files.length})</div>
          {files.map((f) => (
            <div key={f.filename} className="stat-row">
              <span className="stat-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{f.filename}</span>
              <span className="stat-label" style={{ fontSize: 11 }}>
                {(f.size / 1024).toFixed(1)} KB — {new Date(f.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
