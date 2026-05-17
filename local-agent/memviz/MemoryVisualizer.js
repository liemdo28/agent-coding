// memviz/MemoryVisualizer.js — visualize engineering memory patterns (ASCII charts)
import { queryEvents } from '../timeline/TimelineStore.js';

const BAR_WIDTH = 20;

/**
 * Render an ASCII bar chart.
 * @param {Array<{ label: string, value: number }>} data
 * @param {{ maxWidth?: number, color?: Function }} opts
 * @returns {string}
 */
export function barChart(data, { maxWidth = BAR_WIDTH } = {}) {
  if (!data.length) return '  (no data)';
  const maxVal = Math.max(...data.map((d) => d.value));
  const lines  = data.map(({ label, value }) => {
    const barLen = maxVal > 0 ? Math.round((value / maxVal) * maxWidth) : 0;
    const bar    = '█'.repeat(barLen).padEnd(maxWidth);
    return `  ${label.padEnd(30).slice(0, 30)} ${bar} ${value}`;
  });
  return lines.join('\n');
}

/**
 * Get most-changed (unstable) files from timeline.
 * @param {string} workspaceRoot
 * @param {{ topN?: number }} opts
 * @returns {object}
 */
export function unstableModules(workspaceRoot, { topN = 10 } = {}) {
  const events    = queryEvents(workspaceRoot, { type: 'file_change', limit: 3000 });
  const fileCounts = {};
  for (const e of events) fileCounts[e.file] = (fileCounts[e.file] ?? 0) + 1;
  const sorted = Object.entries(fileCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([file, count]) => ({ label: file, value: count }));
  return { data: sorted, chart: barChart(sorted) };
}

/**
 * Build QA trend chart (pass rate by day).
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {object}
 */
export function qaTrendChart(workspaceRoot, { days = 14 } = {}) {
  const since  = new Date(Date.now() - days * 86400_000).toISOString();
  const events = queryEvents(workspaceRoot, { type: 'qa_run', since, limit: 1000 });

  const byDay = {};
  for (const e of events) {
    const day = e.ts.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, passed: 0 };
    byDay[day].total++;
    if (e.passed) byDay[day].passed++;
  }

  const data = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { total, passed }]) => ({
      label,
      value: total > 0 ? Math.round(passed / total * 100) : 0,
    }));

  return { data, chart: barChart(data) };
}

/**
 * Show patch chain outcomes — successful vs failed chains.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function patchChainSummary(workspaceRoot) {
  const events   = queryEvents(workspaceRoot, { type: 'patch', limit: 500 });
  const applied  = events.filter((e) => e.action === 'applied').length;
  const rolled   = events.filter((e) => e.action === 'rolled_back').length;
  const rejected = events.filter((e) => e.action === 'rejected').length;

  const data = [
    { label: 'Applied',      value: applied },
    { label: 'Rolled back',  value: rolled  },
    { label: 'Rejected',     value: rejected },
  ];
  return { applied, rolled, rejected, successRate: applied > 0 ? +((applied - rolled) / applied * 100).toFixed(1) : null, data, chart: barChart(data) };
}

/**
 * Memory trends: recurring bugs by type.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function bugTrends(workspaceRoot) {
  const events    = queryEvents(workspaceRoot, { type: 'regression', limit: 1000 });
  const typeCounts = {};
  for (const e of events) {
    const t = e.severity ?? e.category ?? 'unknown';
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const data = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
  return { data, chart: barChart(data), total: events.length };
}
