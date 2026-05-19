import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../i18n/index.js';

const DIVISION_NAMES = {
  'rnd':                   'R&D',
  'manufacturing':         'Kỹ thuật sản xuất',
  'it-ai':                 'Công nghệ & AI',
  'finance':               'Tài chính',
  'marketing-sales':       'Marketing & Sales',
  'operations-logistics':  'Vận hành',
  'hr-culture':            'Nhân sự',
  'legal-compliance':      'Pháp chế',
};

const ALL_DIVISIONS = Object.keys(DIVISION_NAMES);

const PRIORITY_COLORS = {
  critical: '#f85149',
  high:     '#e3702d',
  medium:   '#d4a017',
  normal:   '#58a6ff',
  low:      '#8b949e',
};

const STATUS_COLORS = {
  'proposal-ready':  { bg: '#1a3a2a', text: '#3fb950', border: '#238636' },
  'review-required': { bg: '#3a2e00', text: '#e3b341', border: '#9e6a03' },
  'failed':          { bg: '#3a1a1a', text: '#f85149', border: '#da3633' },
  'unknown':         { bg: '#161b22', text: '#8b949e', border: '#30363d' },
};

function statusStyle(status) {
  return STATUS_COLORS[status] ?? STATUS_COLORS['unknown'];
}

function StatusBadge({ status }) {
  const s = statusStyle(status);
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {status ?? 'unknown'}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const color = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.normal;
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: color + '22',
      color: color,
      border: `1px solid ${color}55`,
      whiteSpace: 'nowrap',
    }}>
      {priority ?? 'normal'}
    </span>
  );
}

function RiskBadge({ risk }) {
  const colorMap = { low: '#3fb950', medium: '#e3b341', high: '#f85149', critical: '#f85149' };
  const color = colorMap[risk] ?? '#8b949e';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>{risk ?? '-'}</span>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function DivisionBarChart({ byDivision }) {
  const maxCount = Math.max(1, ...ALL_DIVISIONS.map(d => byDivision[d] ?? 0));
  const BAR_MAX_WIDTH = 260;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ALL_DIVISIONS.map((div) => {
        const count = byDivision[div] ?? 0;
        const barWidth = count === 0 ? 0 : Math.max(6, Math.round((count / maxCount) * BAR_MAX_WIDTH));
        // Color gradient: low=gray, medium=blue, high=green
        const intensity = count / maxCount;
        const r = Math.round(88  + (63  - 88)  * intensity);
        const g = Math.round(166 + (185 - 166) * intensity);
        const b = Math.round(255 + (80  - 255) * intensity);
        const barColor = count === 0 ? '#30363d' : `rgb(${r},${g},${b})`;

        return (
          <div key={div} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 130, fontSize: 12, color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}>
              {DIVISION_NAMES[div]}
            </div>
            <div style={{ width: BAR_MAX_WIDTH, background: '#21262d', borderRadius: 4, height: 18, flexShrink: 0 }}>
              <div style={{
                width: barWidth,
                height: '100%',
                background: barColor,
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: count > 0 ? 'var(--text)' : 'var(--text-muted)', minWidth: 20 }}>
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PriorityPills({ byPriority }) {
  const priorities = ['critical', 'high', 'medium', 'normal', 'low'];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {priorities.map((p) => {
        const count = byPriority[p] ?? 0;
        if (count === 0) return null;
        return (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PriorityBadge priority={p} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
          </div>
        );
      })}
      {Object.values(byPriority).every(v => v === 0) && (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
      )}
    </div>
  );
}

function ExpandedRow({ dispatch }) {
  const dev = dispatch.execution?.dev;
  const qa  = dispatch.execution?.qa;

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 16px 16px', background: '#0d1117' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 12 }}>
          {/* Dev summary */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              Dev Summary
            </div>
            {dev?.summary ? (
              <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{dev.summary}</p>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
            )}
            {dev?.suggestedCommands?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Suggested commands:</div>
                {dev.suggestedCommands.map((cmd, i) => (
                  <code key={i} style={{ display: 'block', fontSize: 11, color: '#58a6ff', background: '#161b22', padding: '2px 6px', borderRadius: 3, marginBottom: 2 }}>
                    {cmd}
                  </code>
                ))}
              </div>
            )}
          </div>

          {/* QA summary */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              QA Summary
            </div>
            {qa?.summary ? (
              <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, marginBottom: 8, lineHeight: 1.6 }}>{qa.summary}</p>
            ) : null}
            {qa?.auditChecklist?.length > 0 && (
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {qa.auditChecklist.map((item, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{item}</li>
                ))}
              </ul>
            )}
            {!qa?.summary && !qa?.auditChecklist?.length && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
            )}
          </div>
        </div>

        {/* Telegram summary */}
        {dispatch.telegramSummary && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              Telegram Summary
            </div>
            <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
              {dispatch.telegramSummary}
            </p>
          </div>
        )}
      </td>
    </tr>
  );
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return isoStr.slice(0, 16).replace('T', ' ');
  }
}

export default function CorporateDashboard() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [expandedRow, setExpandedRow] = useState(null); // dispatchId

  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch('/api/corp-dispatches');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Derived summary stats
  const summary = data?.summary ?? { total: 0, byDivision: {}, byPriority: {}, byDevStatus: {}, byQAStatus: {} };
  const dispatches = data?.dispatches ?? [];

  const divisionsActive = Object.values(summary.byDivision).filter(v => v > 0).length;
  const highPriority = (summary.byPriority?.critical ?? 0) + (summary.byPriority?.high ?? 0);
  const qaIssues = summary.byQAStatus?.['review-required'] ?? 0;

  const toggleRow = (id) => setExpandedRow(prev => prev === id ? null : id);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏢 {t('nav.corporate')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Theo dõi và quản lý các dispatch điều phối doanh nghiệp
          </p>
        </div>
        <button
          className="btn"
          onClick={fetchData}
          style={{ fontSize: 12, padding: '4px 12px' }}
          disabled={loading}
        >
          {loading ? t('common.loading') : t('common.refresh')}
        </button>
      </div>

      {error && (
        <div style={{ background: '#3a1a1a', border: '1px solid #da3633', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: '#f85149', fontSize: 13 }}>
          Lỗi tải dữ liệu: {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard label="Tổng dispatch" value={summary.total} color="#58a6ff" />
        <SummaryCard label="Phòng ban hoạt động" value={divisionsActive} color="#3fb950" />
        <SummaryCard label="Ưu tiên cao" value={highPriority} color="#e3702d" />
        <SummaryCard label="QA cần xem xét" value={qaIssues} color="#e3b341" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Division bar chart */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Phân bổ theo phòng ban</div>
          <DivisionBarChart byDivision={summary.byDivision} />
        </div>

        {/* Priority distribution */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Phân bổ theo độ ưu tiên</div>
          <PriorityPills byPriority={summary.byPriority} />

          <div style={{ marginTop: 20 }}>
            <div className="card-title" style={{ marginBottom: 12, fontSize: 13 }}>Trạng thái Dev</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(summary.byDevStatus ?? {}).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StatusBadge status={status} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                </div>
              ))}
              {Object.keys(summary.byDevStatus ?? {}).length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 12, fontSize: 13 }}>Trạng thái QA</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(summary.byQAStatus ?? {}).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StatusBadge status={status} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                </div>
              ))}
              {Object.keys(summary.byQAStatus ?? {}).length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="card-title" style={{ margin: 0 }}>Danh sách Dispatch</div>
        </div>

        {dispatches.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Chưa có dispatch nào.</div>
            <div style={{ fontSize: 13 }}>
              Dùng <strong>Giao task cho Corporate Agent</strong> trong Trung tâm lệnh.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: '#161b22' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Thời gian</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Task</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Phòng ban</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Loại</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Dev</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>QA</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => {
                  const isExpanded = expandedRow === d.dispatchId;
                  const divId = d.company?.id ?? 'unknown';
                  return (
                    <React.Fragment key={d.dispatchId}>
                      <tr
                        onClick={() => toggleRow(d.dispatchId)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: isExpanded ? '#161b22' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = '#0d1117'; }}
                        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                          {formatTime(d.task?.createdAt)}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text)', maxWidth: 240 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: isExpanded ? '#58a6ff' : 'var(--text-muted)', fontSize: 10 }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.task?.raw ?? d.dispatchId}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text)' }}>
                            {DIVISION_NAMES[divId] ?? divId}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {d.task?.type ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <StatusBadge status={d.execution?.dev?.status} />
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <StatusBadge status={d.execution?.qa?.status} />
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <RiskBadge risk={d.execution?.dev?.riskLevel} />
                          </div>
                        </td>
                      </tr>
                      {isExpanded && <ExpandedRow dispatch={d} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
        Tự động làm mới mỗi 15 giây · {summary.total} dispatch · {new Date().toLocaleTimeString('vi-VN')}
      </div>
    </div>
  );
}
