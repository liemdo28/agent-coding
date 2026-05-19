// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';

function formatDuration(ms) {
  if (!ms || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/* ── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color, sub }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="card-title" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

/* ── Bar chart — horizontal, pure SVG ─────────────────────────────────────── */
function BarChart({ data }) {
  if (!data || data.length === 0) return null;

  const CHART_W = 600;
  const ROW_H = 34;
  const LABEL_W = 160;
  const BAR_MAX_W = 300;
  const COUNT_W = 40;
  const PADDING = 8;

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const chartH = data.length * ROW_H + PADDING * 2;

  function barColor(successRate) {
    if (successRate > 0.8) return 'var(--green, #3fb950)';
    if (successRate >= 0.5) return 'var(--yellow, #d2953a)';
    return 'var(--red, #f85149)';
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${CHART_W} ${chartH}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {data.map((d, i) => {
        const y = PADDING + i * ROW_H;
        const barW = Math.max(2, (d.count / maxCount) * BAR_MAX_W);
        const color = barColor(d.successRate);
        const pct = Math.round(d.successRate * 100);

        return (
          <g key={d.script}>
            {/* Label */}
            <text
              x={LABEL_W - 8}
              y={y + ROW_H / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--text-muted, #8b949e)"
              fontFamily="monospace"
            >
              {d.label && d.label !== d.script ? d.label.slice(0, 22) : d.script.slice(0, 22)}
            </text>

            {/* Bar background */}
            <rect
              x={LABEL_W}
              y={y + 6}
              width={BAR_MAX_W}
              height={ROW_H - 12}
              rx={3}
              fill="rgba(255,255,255,0.04)"
            />

            {/* Bar fill */}
            <rect
              x={LABEL_W}
              y={y + 6}
              width={barW}
              height={ROW_H - 12}
              rx={3}
              fill={color}
              fillOpacity={0.7}
            />

            {/* Count */}
            <text
              x={LABEL_W + BAR_MAX_W + 8}
              y={y + ROW_H / 2 + 4}
              fontSize={11}
              fill="var(--text, #e6edf3)"
              fontWeight={600}
            >
              {d.count}
            </text>

            {/* Success rate */}
            <text
              x={LABEL_W + BAR_MAX_W + COUNT_W + 4}
              y={y + ROW_H / 2 + 4}
              fontSize={10}
              fill={color}
            >
              {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Line chart — runs per day, pure SVG ────────────────────────────────────── */
function LineChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  if (!data || data.length === 0) return null;

  const CHART_W = 700;
  const CHART_H = 200;
  const PAD_L = 44;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 40;
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  const maxY = Math.max(...data.map(d => d.total), 1);
  const n = data.length;

  function xOf(i) {
    return PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  }
  function yOf(v) {
    return PAD_T + plotH - (v / maxY) * plotH;
  }

  const completedPts = data.map((d, i) => `${xOf(i)},${yOf(d.completed)}`).join(' ');
  const failedPts    = data.map((d, i) => `${xOf(i)},${yOf(d.failed)}`).join(' ');

  // Y axis ticks
  const yTicks = [0, Math.round(maxY / 2), maxY];

  // X axis: show at most 8 labels spread out
  const step = Math.max(1, Math.floor(n / 8));
  const xLabels = data.filter((_, i) => i % step === 0 || i === n - 1);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ overflow: 'visible', display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {yTicks.map(v => (
          <g key={v}>
            <line
              x1={PAD_L} y1={yOf(v)}
              x2={CHART_W - PAD_R} y2={yOf(v)}
              stroke="var(--border, #30363d)"
              strokeDasharray="4,4"
            />
            <text
              x={PAD_L - 6} y={yOf(v) + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-muted, #8b949e)"
            >{v}</text>
          </g>
        ))}

        {/* X axis labels */}
        {xLabels.map((d, li) => {
          const i = data.indexOf(d);
          return (
            <text
              key={d.date}
              x={xOf(i)}
              y={CHART_H - PAD_B + 18}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-muted, #8b949e)"
              transform={`rotate(-30, ${xOf(i)}, ${CHART_H - PAD_B + 18})`}
            >
              {d.date.slice(5)} {/* MM-DD */}
            </text>
          );
        })}

        {/* Completed line */}
        {n > 1 && (
          <polyline
            points={completedPts}
            fill="none"
            stroke="var(--green, #3fb950)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Failed line */}
        {n > 1 && (
          <polyline
            points={failedPts}
            fill="none"
            stroke="var(--red, #f85149)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dots + hover areas */}
        {data.map((d, i) => (
          <g key={d.date}>
            {/* Completed dot */}
            <circle
              cx={xOf(i)} cy={yOf(d.completed)}
              r={4}
              fill="var(--green, #3fb950)"
              stroke="var(--bg, #0d1117)"
              strokeWidth={2}
            />
            {/* Failed dot */}
            <circle
              cx={xOf(i)} cy={yOf(d.failed)}
              r={4}
              fill="var(--red, #f85149)"
              stroke="var(--bg, #0d1117)"
              strokeWidth={2}
            />
            {/* Invisible hover area */}
            <rect
              x={xOf(i) - 14}
              y={PAD_T}
              width={28}
              height={plotH}
              fill="transparent"
              onMouseEnter={(e) => {
                const rect = svgRef.current?.getBoundingClientRect();
                setTooltip({
                  x: e.clientX - (rect?.left ?? 0),
                  y: e.clientY - (rect?.top ?? 0),
                  data: d,
                });
              }}
            />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--green, #3fb950)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, background: 'var(--green, #3fb950)', display: 'inline-block', borderRadius: 2 }} />
          Hoàn thành
        </span>
        <span style={{ fontSize: 11, color: 'var(--red, #f85149)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 3, background: 'var(--red, #f85149)', display: 'inline-block', borderRadius: 2 }} />
          Thất bại
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 12,
          top: tooltip.y - 50,
          background: 'var(--card-bg, rgba(22,27,34,0.97))',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.data.date}</div>
          <div style={{ color: 'var(--green, #3fb950)' }}>Hoàn thành: {tooltip.data.completed}</div>
          <div style={{ color: 'var(--red, #f85149)' }}>Thất bại: {tooltip.data.failed}</div>
          <div style={{ color: 'var(--text-muted)' }}>Tổng: {tooltip.data.total}</div>
        </div>
      )}
    </div>
  );
}

/* ── Main KPI page ─────────────────────────────────────────────────────────── */
export default function KPICharts() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/kpi-stats');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const isEmpty = stats && stats.byDay.length === 0 && stats.byScript.length === 0;

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Thống kê KPI</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Phân tích toàn bộ lịch sử chạy lệnh
          </p>
        </div>
        <button className="btn" onClick={fetchStats} disabled={loading}>
          {loading ? <><span className="spinner" />Đang tải...</> : 'Làm mới'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
          <span style={{ color: 'var(--red)' }}>Lỗi: {error}</span>
        </div>
      )}

      {loading && (
        <div className="loading-row"><div className="spinner" />Đang tải thống kê...</div>
      )}

      {!loading && isEmpty && (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có dữ liệu</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Chạy một vài lệnh từ Trung tâm lệnh để xem thống kê.
            </div>
          </div>
        </div>
      )}

      {!loading && stats && !isEmpty && (
        <>
          {/* ── Summary stat cards ────────────────────────────────────────── */}
          <div className="card-grid" style={{ marginBottom: 20 }}>
            <StatCard
              label="Tổng lần chạy"
              value={stats.totalRuns.toLocaleString()}
              color="var(--blue, #58a6ff)"
            />
            <StatCard
              label="Thành công"
              value={stats.totalCompleted.toLocaleString()}
              color="var(--green, #3fb950)"
              sub={stats.totalRuns > 0 ? `${Math.round(stats.totalCompleted / stats.totalRuns * 100)}% tỷ lệ` : undefined}
            />
            <StatCard
              label="Thất bại"
              value={stats.totalFailed.toLocaleString()}
              color={stats.totalFailed > 0 ? 'var(--red, #f85149)' : 'var(--text-muted)'}
              sub={stats.totalRuns > 0 ? `${Math.round(stats.totalFailed / stats.totalRuns * 100)}% tỷ lệ` : undefined}
            />
            <StatCard
              label="Thời gian TB"
              value={formatDuration(stats.avgDurationMs)}
              color="var(--yellow, #d2953a)"
            />
          </div>

          {/* ── Line chart: runs per day ──────────────────────────────────── */}
          {stats.byDay.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>
                Lịch sử lần chạy theo ngày
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                  (tất cả {stats.byDay.length} ngày)
                </span>
              </div>
              <LineChart data={stats.byDay} />
            </div>
          )}

          {/* ── Bar chart: top scripts ───────────────────────────────────── */}
          {stats.byScript.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>
                Lệnh sử dụng nhiều nhất
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                  (màu: xanh ≥80% · vàng 50–80% · đỏ &lt;50% tỷ lệ thành công)
                </span>
              </div>
              <BarChart data={stats.byScript.slice(0, 10)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
