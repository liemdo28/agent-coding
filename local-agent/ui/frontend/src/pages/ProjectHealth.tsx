// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export default function ProjectHealth() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);

  const fetchHealth = async () => {
    try {
      const res = await api.get('/project/health');
      if (res.success) {
        setHealthData(res.data);
      } else {
        setError(res.error || 'Failed to retrieve project health data.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !healthData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="spinner mb-4" />
        <p className="text-muted text-sm font-mono">Analyzing codebase health telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border border-red-500/20 bg-red-950/10 text-red-400 p-4">
        <h3 className="font-bold mb-1">Health Engine Error</h3>
        <p className="text-xs font-mono">{error}</p>
      </div>
    );
  }

  const { summary, trend, alerts } = healthData;

  // Render SVG Radial Progress Gauge
  const renderGauge = (value, colorClass, strokeColor) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="6"
            fill="transparent"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={strokeColor}
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className={`absolute text-base font-bold font-mono ${colorClass}`}>
          {value}%
        </span>
      </div>
    );
  };

  // SVG Chart Dimensions & Computations
  const chartWidth = 700;
  const chartHeight = 220;
  const padding = 35;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const pointsBuild = [];
  const pointsTest = [];
  const pointsActivity = [];

  if (trend && trend.length > 0) {
    trend.forEach((t, index) => {
      const x = padding + (index / (trend.length - 1)) * graphWidth;
      const yBuild = chartHeight - padding - (t.build / 100) * graphHeight;
      const yTest = chartHeight - padding - (t.test / 100) * graphHeight;
      const yActivity = chartHeight - padding - (t.activity / 100) * graphHeight;

      pointsBuild.push(`${x},${yBuild}`);
      pointsTest.push(`${x},${yTest}`);
      pointsActivity.push(`${x},${yActivity}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title neon-text-cyan">Project Health Telemetry</h1>
          <p className="text-muted text-sm mt-1">Real-time health auditing, test stability tracking, and dependency risk graphs.</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchHealth(); }}
          className="btn btn-secondary text-xs py-1 px-3"
        >
          🔄 Refresh Metrics
        </button>
      </div>

      {/* Metric Cards Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Build Health */}
        <div className="neon-card flex flex-col items-center justify-center p-4 text-center">
          <span className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Build Stability</span>
          {renderGauge(summary.buildHealth, 'neon-text-green', 'var(--neon-green)')}
          <span className="text-[11px] text-muted mt-2">Zero compiling faults</span>
        </div>

        {/* Card 2: Test Suite Health */}
        <div className="neon-card flex flex-col items-center justify-center p-4 text-center">
          <span className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Unit Tests PASS</span>
          {renderGauge(summary.testHealth, 'neon-text-cyan', 'var(--neon-cyan)')}
          <span className="text-[11px] text-muted mt-2">All specs executing green</span>
        </div>

        {/* Card 3: Activity Score */}
        <div className="neon-card flex flex-col items-center justify-center p-4 text-center">
          <span className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Activity Intensity</span>
          {renderGauge(summary.activityScore, 'neon-text-pink', 'var(--neon-pink)')}
          <span className="text-[11px] text-muted mt-2">Frequent git revisions</span>
        </div>

        {/* Card 4: AI Readiness */}
        <div className="neon-card flex flex-col items-center justify-center p-4 text-center">
          <span className="text-xs text-muted font-bold uppercase tracking-wider mb-2">AI Agent Readiness</span>
          {renderGauge(summary.aiReadiness, 'neon-text-purple', 'var(--neon-purple)')}
          <span className="text-[11px] text-muted mt-2">Highly documented context</span>
        </div>

        {/* Card 5: Dependency Risk */}
        <div className="neon-card flex flex-col items-center justify-center p-4 text-center">
          <span className="text-xs text-muted font-bold uppercase tracking-wider mb-1">Dependency Risk</span>
          <div className="my-3">
            <span className={`text-2xl font-bold font-mono ${
              summary.dependencyRisk === 'High' ? 'text-red-500' :
              summary.dependencyRisk === 'Medium' ? 'text-yellow-500' : 'neon-text-green'
            }`}>
              {summary.dependencyRisk}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full ${summary.dependencyRisk === 'High' ? 'bg-red-500' : summary.dependencyRisk === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`} 
              style={{ width: `${summary.dependencyRiskScore}%` }}
            />
          </div>
          <span className="text-[10px] text-muted mt-2">Package Score: {summary.dependencyRiskScore}/100</span>
        </div>
      </div>

      {/* Trend line and Activity Heatmap Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Trend Chart Card */}
        <div className="neon-card lg:col-span-2 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            📈 Historical Health Trends (30-day tracking)
          </h3>
          <div className="relative w-full overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto min-w-[600px] text-slate-600 font-mono text-[9px]">
              {/* Background Grid Lines */}
              {[25, 50, 75, 100].map((val) => {
                const y = chartHeight - padding - (val / 100) * graphHeight;
                return (
                  <g key={val}>
                    <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} className="stroke-slate-800/80" strokeDasharray="3 3" />
                    <text x={padding - 10} y={y + 3} textAnchor="end" className="fill-slate-500">{val}%</text>
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {trend && trend.length > 0 && [0, 7, 14, 21, 29].map((idx) => {
                const item = trend[idx];
                if (!item) return null;
                const x = padding + (idx / (trend.length - 1)) * graphWidth;
                return (
                  <text key={idx} x={x} y={chartHeight - 10} textAnchor="middle" className="fill-slate-500">
                    {item.date.slice(5)}
                  </text>
                );
              })}

              {/* Trend Lines */}
              {trend && trend.length > 0 && (
                <>
                  {/* Build Health - Green */}
                  <polyline
                    fill="none"
                    stroke="var(--neon-green)"
                    strokeWidth="2.5"
                    points={pointsBuild.join(' ')}
                    className="opacity-90"
                  />
                  {/* Test Health - Cyan */}
                  <polyline
                    fill="none"
                    stroke="var(--neon-cyan)"
                    strokeWidth="2.5"
                    points={pointsTest.join(' ')}
                    className="opacity-90"
                  />
                  {/* Activity - Pink */}
                  <polyline
                    fill="none"
                    stroke="var(--neon-pink)"
                    strokeWidth="1.5"
                    points={pointsActivity.join(' ')}
                    className="opacity-70"
                    strokeDasharray="4 2"
                  />
                </>
              )}
            </svg>
          </div>
          
          {/* Chart Legend */}
          <div className="flex gap-4 mt-2 justify-center text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Build Stability</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">Test Success Rate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="text-slate-400">Activity Score</span>
            </div>
          </div>
        </div>

        {/* Calendar Heatmap Card */}
        <div className="neon-card p-4 flex flex-col">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            📅 Commit & CI Contribution Activity
          </h3>
          <div className="flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-6 gap-2.5 mx-auto max-w-[240px]">
              {trend && trend.map((t, idx) => {
                // Color levels: 0 (light-slate), 1, 2, 3, 4 (bright-green)
                let colorClass = "bg-slate-800/40 hover:scale-110 hover:border-slate-400 transition-all border border-slate-900";
                const act = t.activity;
                if (act > 90) colorClass = "bg-emerald-500 border border-emerald-400 shadow-[0_0_4px_var(--neon-green)]";
                else if (act > 75) colorClass = "bg-emerald-600 border border-emerald-700";
                else if (act > 60) colorClass = "bg-emerald-800 border border-emerald-900";
                else if (act > 0) colorClass = "bg-emerald-950/80 border border-emerald-950";

                return (
                  <div
                    key={idx}
                    className={`w-8 h-8 rounded-sm cursor-pointer ${colorClass}`}
                    title={`${t.date} Activity: ${t.activity}%`}
                    onMouseEnter={() => setHoveredDay(t)}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                );
              })}
            </div>

            {/* Hover Tooltip display */}
            <div className="mt-4 h-8 text-center font-mono text-[11px] text-muted">
              {hoveredDay ? (
                <div>
                  <span className="text-slate-300">{hoveredDay.date}</span>: {' '}
                  <span className="text-emerald-400 font-bold">Activity {hoveredDay.activity}%</span>, {' '}
                  <span className="text-cyan-400">Build {hoveredDay.build}%</span>
                </div>
              ) : (
                "Hover over grid box to inspect details"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Warnings & Suggestions bottom row */}
      <div className="neon-card p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          🚨 Codebase Recommendations & Warnings
        </h3>
        {alerts && alerts.length === 0 ? (
          <div className="text-xs text-muted font-mono py-2 text-center">
            ✓ No critical risks or recommendations active. Repository health is in peak state.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts && alerts.map((alert, idx) => {
              let alertBorder = "border-l-4 border-l-cyan-400 bg-slate-900/40";
              let alertIcon = "ℹ️";
              let severityTitle = "Info";

              if (alert.severity === 'warning') {
                alertBorder = "border-l-4 border-l-yellow-500 bg-yellow-950/10";
                alertIcon = "⚠️";
                severityTitle = "Warning";
              } else if (alert.severity === 'error') {
                alertBorder = "border-l-4 border-l-rose-500 bg-rose-950/10";
                alertIcon = "🚨";
                severityTitle = "Critical";
              }

              return (
                <div key={idx} className={`p-3 rounded-r-md text-xs flex items-start gap-3 justify-between ${alertBorder}`}>
                  <div className="flex gap-2">
                    <span className="text-base">{alertIcon}</span>
                    <div>
                      <strong className="text-slate-300 font-mono">[{severityTitle}]</strong>{' '}
                      <span className="text-slate-400">{alert.message}</span>
                    </div>
                  </div>
                  {alert.severity === 'warning' && (
                    <button 
                      onClick={() => alert('Recommendation dispatched. Run `/fix` command in Command Center tab.')}
                      className="btn btn-secondary font-mono text-[10px] py-0.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    >
                      🚀 Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
