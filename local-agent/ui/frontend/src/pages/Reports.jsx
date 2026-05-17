import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

function TypeBadge({ type }) {
  const map = { qa: 'badge-pass', scan: 'badge-sandbox', patch: 'badge-med-risk', other: 'badge-pending' };
  return <span className={`badge ${map[type] ?? 'badge-pending'}`}>{type}</span>;
}

function Modal({ title, content, onClose }) {
  const isStr = typeof content === 'string';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title">{title}</div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="modal-content">
          {isStr ? content : JSON.stringify(content, null, 2)}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [modal,   setModal]   = useState(null); // { title, content }

  useEffect(() => {
    setLoading(true);
    api.get('/reports')
      .then((r) => { if (r.success) setReports(r.data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const openReport = async (filename) => {
    try {
      const r = await api.get(`/reports/${encodeURIComponent(filename)}`);
      if (r.success) setModal({ title: filename, content: r.data });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {modal && <Modal title={modal.title} content={modal.content} onClose={() => setModal(null)} />}

      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}
      {loading && <div className="loading-row"><div className="spinner" />Loading reports...</div>}

      {!loading && reports.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div>No reports yet.</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Run a scan or QA pass to generate reports.</div>
        </div>
      )}

      {reports.length > 0 && (
        <div className="card">
          <div className="card-title">All Reports ({reports.length})</div>
          {reports.map((r) => (
            <div key={r.filename} className="report-item" onClick={() => openReport(r.filename)}>
              <TypeBadge type={r.type} />
              <span className="report-name">{r.filename}</span>
              <span className="report-size">{(r.size / 1024).toFixed(1)} KB</span>
              <span className="report-date">{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
