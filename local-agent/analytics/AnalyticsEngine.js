// analytics/AnalyticsEngine.js — generate local engineering metrics from timeline events
import { queryEvents } from '../timeline/TimelineStore.js';

/**
 * Compute QA trend over time (pass rate per day).
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ trend: object[], currentPassRate: number|null }}
 */
export function qaAnalytics(workspaceRoot, { days = 14 } = {}) {
  const since  = new Date(Date.now() - days * 86400_000).toISOString();
  const events = queryEvents(workspaceRoot, { type: 'qa_run', since, limit: 1000 });

  // Group by day
  const byDay = {};
  for (const e of events) {
    const day = e.ts.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, passed: 0 };
    byDay[day].total++;
    if (e.passed) byDay[day].passed++;
  }

  const trend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, passed }]) => ({
      date,
      total,
      passed,
      passRate: +(passed / total * 100).toFixed(1),
    }));

  const last7 = events.slice(-20);
  const currentPassRate = last7.length
    ? +(last7.filter((e) => e.passed).length / last7.length * 100).toFixed(1) : null;

  return { trend, currentPassRate, totalRuns: events.length };
}

/**
 * Regression frequency analysis.
 * @param {string} workspaceRoot
 * @param {{ days?: number }} opts
 * @returns {{ perDay: object[], hotFiles: object[], totalRegressions: number }}
 */
export function regressionAnalytics(workspaceRoot, { days = 30 } = {}) {
  const since  = new Date(Date.now() - days * 86400_000).toISOString();
  const events = queryEvents(workspaceRoot, { type: 'regression', since, limit: 1000 });

  // Per day
  const byDay = {};
  const fileCounts = {};
  for (const e of events) {
    const day = e.ts.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
    if (e.file) fileCounts[e.file] = (fileCounts[e.file] ?? 0) + 1;
  }

  const perDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const hotFiles = Object.entries(fileCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  return { perDay, hotFiles, totalRegressions: events.length };
}

/**
 * Overall engineering health summary.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function fullAnalytics(workspaceRoot) {
  const qa          = qaAnalytics(workspaceRoot);
  const regressions = regressionAnalytics(workspaceRoot);
  const patches     = queryEvents(workspaceRoot, { type: 'patch', limit: 500 });
  const applied     = patches.filter((p) => p.action === 'applied').length;
  const rolledBack  = patches.filter((p) => p.action === 'rolled_back').length;
  const fixSuccessRate = applied > 0 ? +((applied - rolledBack) / applied * 100).toFixed(1) : null;

  // Unstable modules: files with most changes
  const fileChanges  = queryEvents(workspaceRoot, { type: 'file_change', limit: 2000 });
  const fileCounts   = {};
  for (const e of fileChanges) fileCounts[e.file] = (fileCounts[e.file] ?? 0) + 1;
  const unstable = Object.entries(fileCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([file, changes]) => ({ file, changes }));

  return {
    qa:         { passRate: qa.currentPassRate, trend: qa.trend.slice(-7) },
    regressions: { total: regressions.totalRegressions, hotFiles: regressions.hotFiles.slice(0, 5) },
    patches:    { applied, rolledBack, fixSuccessRate },
    unstableModules: unstable,
  };
}
