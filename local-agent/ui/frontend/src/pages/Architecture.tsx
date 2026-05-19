// @ts-nocheck
import React from 'react';

const BOX_STYLE = {
  background: 'var(--card-bg, rgba(255,255,255,0.04))',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius, 8px)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const BOX_TITLE_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: 4,
};

const BULLET_STYLE = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const ITEM_STYLE = {
  fontSize: 13,
  color: 'var(--text)',
  paddingLeft: 14,
  position: 'relative',
};

function Box({ title, accent, items }) {
  return (
    <div style={{ ...BOX_STYLE, borderTop: `3px solid ${accent}` }}>
      <div style={{ ...BOX_TITLE_STYLE, color: accent }}>{title}</div>
      <ul style={BULLET_STYLE}>
        {items.map((item, i) => (
          <li key={i} style={ITEM_STYLE}>
            <span style={{ position: 'absolute', left: 0, color: accent }}>›</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowArrow() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      color: 'var(--text-muted)',
      fontSize: 18,
      margin: '0 6px',
    }}>→</span>
  );
}

function FlowNode({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 14px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: `${color}18`,
      border: `1px solid ${color}66`,
      color: color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default function Architecture() {
  const ROW_STYLE = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
    marginBottom: 16,
  };

  const SECTION_LABEL_STYLE = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    marginBottom: 6,
    marginTop: 4,
    paddingLeft: 2,
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Kiến trúc hệ thống</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Local AI Engineering OS — sơ đồ tổng quan kiến trúc hệ thống
          </p>
        </div>
      </div>

      {/* Row labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 4 }}>
        <div style={SECTION_LABEL_STYLE}>Đầu vào</div>
        <div style={SECTION_LABEL_STYLE}>Lõi hệ thống</div>
        <div style={SECTION_LABEL_STYLE}>Đầu ra</div>
      </div>

      {/* Row 1 */}
      <div style={ROW_STYLE}>
        <Box
          title="Đầu vào (Inputs)"
          accent="var(--blue, #58a6ff)"
          items={[
            'CLI (terminal commands)',
            'Dashboard UI (React)',
            'API calls (REST)',
            'npm scripts',
          ]}
        />
        <Box
          title="Lõi hệ thống (Core Engine)"
          accent="var(--green, #3fb950)"
          items={[
            'local-agent (Node.js)',
            '├─ Scanner',
            '├─ QA Engine',
            '├─ Security Auditor',
            '└─ Patch Engine',
          ]}
        />
        <Box
          title="Đầu ra (Outputs)"
          accent="var(--purple, #bc8cff)"
          items={[
            'Dashboard (React SPA)',
            'Reports (JSON/HTML)',
            'Activity Logs',
            'Accounting DB',
          ]}
        />
      </div>

      {/* Row 2 labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 4, marginTop: 8 }}>
        <div style={SECTION_LABEL_STYLE}>Lưu trữ</div>
        <div style={SECTION_LABEL_STYLE}>Knowledge Base</div>
        <div style={SECTION_LABEL_STYLE}>Chính sách Offline</div>
      </div>

      {/* Row 2 */}
      <div style={ROW_STYLE}>
        <Box
          title="Lưu trữ (Storage)"
          accent="var(--yellow, #d2953a)"
          items={[
            'SQLite DBs (local)',
            'local files & configs',
            'logs/ directory',
            '.local-agent/ state',
          ]}
        />
        <Box
          title="Knowledge Base"
          accent="var(--blue, #58a6ff)"
          items={[
            'knowledge.db (SQLite)',
            'FTS5 full-text search',
            'TF-IDF ranking',
            '1,491+ tài liệu',
          ]}
        />
        <Box
          title="Chính sách Offline"
          accent="var(--red, #f85149)"
          items={[
            'OfflineGuard.js',
            'localhost only',
            'Không CDN / cloud',
            'Sandboxed execution',
          ]}
        />
      </div>

      {/* Data flow section */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Luồng dữ liệu</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          padding: '8px 0',
        }}>
          <FlowNode label="Người dùng" color="var(--blue, #58a6ff)" />
          <FlowArrow />
          <FlowNode label="Dashboard UI" color="var(--purple, #bc8cff)" />
          <FlowArrow />
          <FlowNode label="Backend API :4001" color="var(--green, #3fb950)" />
          <FlowArrow />
          <FlowNode label="npm scripts" color="var(--yellow, #d2953a)" />
          <FlowArrow />
          <FlowNode label="File system" color="var(--text-muted, #8b949e)" />
          <FlowArrow />
          <FlowNode label="Logs / DB" color="var(--yellow, #d2953a)" />
          <FlowArrow />
          <FlowNode label="Dashboard" color="var(--purple, #bc8cff)" />
        </div>
      </div>

      {/* Tech stack summary */}
      <div className="card-grid" style={{ marginTop: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="card-title">Frontend</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--text)' }}>
            <li className="stat-row"><span className="stat-label">Framework</span><span className="stat-value">React 18</span></li>
            <li className="stat-row"><span className="stat-label">Router</span><span className="stat-value">react-router-dom v6</span></li>
            <li className="stat-row"><span className="stat-label">Build</span><span className="stat-value">Vite</span></li>
            <li className="stat-row"><span className="stat-label">I18n</span><span className="stat-value">vi / en</span></li>
          </ul>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="card-title">Backend</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--text)' }}>
            <li className="stat-row"><span className="stat-label">Runtime</span><span className="stat-value">Node.js (ESM)</span></li>
            <li className="stat-row"><span className="stat-label">Server</span><span className="stat-value">Express.js</span></li>
            <li className="stat-row"><span className="stat-label">Port</span><span className="stat-value">127.0.0.1:4001</span></li>
            <li className="stat-row"><span className="stat-label">SSE</span><span className="stat-value">Job streaming</span></li>
          </ul>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="card-title">Data</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--text)' }}>
            <li className="stat-row"><span className="stat-label">KB DB</span><span className="stat-value">SQLite + FTS5</span></li>
            <li className="stat-row"><span className="stat-label">Activity</span><span className="stat-value">NDJSON logs</span></li>
            <li className="stat-row"><span className="stat-label">Accounting</span><span className="stat-value">SQLite ledger</span></li>
            <li className="stat-row"><span className="stat-label">Memory</span><span className="stat-value">JSON + vector</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
