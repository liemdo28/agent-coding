// org-intelligence/health-map.js
// Visualize overloaded agents, unstable projects, high-risk systems,
// and dependency bottlenecks in a structured format.

import { queryEvents } from '../timeline/TimelineStore.js';
import { flowHealthScore } from './flow-analyzer.js';

/**
 * Detect overloaded agents (high backlog, many failures).
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function detectOverloadedAgents(workspaceRoot) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const tasks = queryEvents(workspaceRoot, { type: 'task_start', since, limit: 1000 });
  const resolved = queryEvents(workspaceRoot, { type: 'task_resolved', since, limit: 1000 });
  const qaFails = queryEvents(workspaceRoot, { type: 'qa_run', since, limit: 500 })
    .filter((e) => !e.passed);

  const agentTasks = {};
  for (const t of tasks) {
    const a = t.agentId ?? t.agent ?? 'default';
    agentTasks[a] = (agentTasks[a] ?? 0) + 1;
  }
  const agentResolved = {};
  for (const r of resolved) {
    const a = r.agentId ?? r.agent ?? 'default';
    agentResolved[a] = (agentResolved[a] ?? 0) + 1;
  }
  const agentFails = {};
  for (const f of qaFails) {
    const a = f.agentId ?? f.agent ?? 'default';
    agentFails[a] = (agentFails[a] ?? 0) + 1;
  }

  const agents = new Set([...Object.keys(agentTasks), ...Object.keys(agentResolved)]);
  const overloaded = [];

  for (const agent of agents) {
    const started  = agentTasks[agent] ?? 0;
    const res      = agentResolved[agent] ?? 0;
    const fails    = agentFails[agent] ?? 0;
    const backlog  = started - res;
    const failRate = started > 0 ? +(100 * fails / started).toFixed(1) : 0;

    const loadLevel =
      backlog > 10 ? 'critical' :
      backlog > 5  ? 'high' :
      backlog > 2  ? 'medium' :
      'low';

    if (loadLevel !== 'low') {
      overloaded.push({ agent: agent || 'default', started, resolved: res, backlog, fails, failRate, loadLevel });
    }
  }

  return overloaded.sort((a, b) => b.backlog - a.backlog);
}

/**
 * Detect unstable projects (many changes, regressions, rollbacks).
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function detectUnstableProjects(workspaceRoot) {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const fileChanges = queryEvents(workspaceRoot, { type: 'file_change', since, limit: 2000 });
  const regressions = queryEvents(workspaceRoot, { type: 'regression', since, limit: 500 });
  const rollbacks = queryEvents(workspaceRoot, { type: 'patch', since, limit: 500 })
    .filter((p) => p.action === 'rolled_back');

  const projectChanges = {};
  const projectRegressions = {};
  const projectRollbacks = {};

  for (const c of fileChanges) {
    const proj = c.project ?? c.projectId ?? 'default';
    projectChanges[proj] = (projectChanges[proj] ?? 0) + 1;
  }
  for (const r of regressions) {
    const proj = r.project ?? r.projectId ?? 'default';
    projectRegressions[proj] = (projectRegressions[proj] ?? 0) + 1;
  }
  for (const rb of rollbacks) {
    const proj = rb.project ?? rb.projectId ?? 'default';
    projectRollbacks[proj] = (projectRollbacks[proj] ?? 0) + 1;
  }

  const projects = new Set([
    ...Object.keys(projectChanges),
    ...Object.keys(projectRegressions),
    ...Object.keys(projectRollbacks),
  ]);

  const unstable = [];
  for (const proj of projects) {
    const changes     = projectChanges[proj]     ?? 0;
    const regress    = projectRegressions[proj] ?? 0;
    const rollbk     = projectRollbacks[proj]    ?? 0;

    const riskScore = changes * 0.2 + regress * 5 + rollbk * 5;
    const riskLevel =
      riskScore > 50 ? 'critical' :
      riskScore > 25 ? 'high' :
      riskScore > 10 ? 'medium' :
      'low';

    if (riskLevel !== 'low') {
      unstable.push({ project: proj, changes, regressions: regress, rollbacks: rollbk, riskScore: +riskScore.toFixed(1), riskLevel });
    }
  }

  return unstable.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Detect high-risk systems (failed QA, unresolved blockers, hot files).
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function detectHighRiskSystems(workspaceRoot) {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const qaFails = queryEvents(workspaceRoot, { type: 'qa_run', since, limit: 500 })
    .filter((e) => !e.passed);
  const blockers = queryEvents(workspaceRoot, { type: 'blocker', since, limit: 200 });
  const resolvedBlockers = queryEvents(workspaceRoot, { type: 'blocker_resolved', since, limit: 200 });
  const fileChanges = queryEvents(workspaceRoot, { type: 'file_change', since, limit: 1000 });

  const systemFails = {};
  for (const f of qaFails) {
    const sys = f.system ?? f.file?.split('/')[1] ?? f.feature ?? 'general';
    systemFails[sys] = (systemFails[sys] ?? 0) + 1;
  }

  const blockerBySystem = {};
  for (const b of blockers) {
    const sys = b.system ?? b.file?.split('/')[1] ?? 'general';
    if (!resolvedBlockers.some((r) => r.blockerId === b.blockerId)) {
      blockerBySystem[sys] = (blockerBySystem[sys] ?? 0) + 1;
    }
  }

  const fileFreq = {};
  for (const c of fileChanges) {
    if (c.file) {
      const topLevel = c.file.split('/').slice(0, 2).join('/');
      fileFreq[topLevel] = (fileFreq[topLevel] ?? 0) + 1;
    }
  }

  const allSystems = new Set([...Object.keys(systemFails), ...Object.keys(blockerBySystem), ...Object.keys(fileFreq)]);
  const risks = [];

  for (const sys of allSystems) {
    const fails    = systemFails[sys]       ?? 0;
    const blk      = blockerBySystem[sys]   ?? 0;
    const changes  = fileFreq[sys]          ?? 0;
    const riskScore = fails * 4 + blk * 8 + Math.min(changes, 20) * 0.5;
    const riskLevel =
      riskScore > 60 ? 'critical' :
      riskScore > 30 ? 'high' :
      riskScore > 10 ? 'medium' :
      'low';

    risks.push({ system: sys, qaFailures: fails, unresolvedBlockers: blk, changeFrequency: changes, riskScore: +riskScore.toFixed(1), riskLevel });
  }

  return risks.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Detect dependency bottlenecks (patches waiting, blocking deps, long-waiting work).
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function detectDependencyBottlenecks(workspaceRoot) {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const patches = queryEvents(workspaceRoot, { type: 'patch', since, limit: 500 });
  const blockers = queryEvents(workspaceRoot, { type: 'blocker', since, limit: 200 });
  const resolvedBlockers = queryEvents(workspaceRoot, { type: 'blocker_resolved', since, limit: 200 });

  const unresolved = blockers.filter((b) => !resolvedBlockers.some((r) => r.blockerId === b.blockerId));

  const blockingTasks = {};
  for (const b of unresolved) {
    const dep = b.blockedBy ?? b.dependency ?? null;
    if (dep) blockingTasks[dep] = (blockingTasks[dep] ?? 0) + 1;
  }

  const rolledBack = patches.filter((p) => p.action === 'rolled_back');
  const rollbackDeps = {};
  for (const rb of rolledBack) {
    const deps = rb.dependencies ?? rb.deps ?? [];
    for (const dep of deps) rollbackDeps[dep] = (rollbackDeps[dep] ?? 0) + 1;
  }

  const now = Date.now();
  const dayMs = 86400000;
  const longWaiting = patches.filter((p) => {
    if (p.action === 'applied' || p.action === 'rolled_back') return false;
    return (now - new Date(p.ts).getTime()) > dayMs;
  });

  const bottlenecks = [];

  for (const [dep, count] of Object.entries(blockingTasks)) {
    if (count > 0) {
      bottlenecks.push({
        type: 'blocking-dependency',
        dependency: dep,
        blockedTasks: count,
        severity: count > 3 ? 'critical' : count > 1 ? 'high' : 'medium',
      });
    }
  }

  for (const [dep, count] of Object.entries(rollbackDeps)) {
    if (count > 0) {
      bottlenecks.push({
        type: 'rollback-dependency',
        dependency: dep,
        rollbackCount: count,
        severity: count > 2 ? 'critical' : count > 1 ? 'high' : 'medium',
      });
    }
  }

  for (const p of longWaiting) {
    const ms = now - new Date(p.ts).getTime();
    bottlenecks.push({
      type: 'long-waiting-patch',
      patchId: p.patchId ?? p.id,
      waitingMs: ms,
      waitingHours: +(ms / 3600000).toFixed(1),
      files: Array.isArray(p.files) ? p.files : [],
      severity: ms > 3 * dayMs ? 'critical' : 'high',
    });
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return bottlenecks.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

// ─── Health map ───────────────────────────────────────────────────────────────

/**
 * Build a complete organizational health map.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function buildHealthMap(workspaceRoot) {
  const healthScore      = flowHealthScore(workspaceRoot);
  const overloadedAgents = detectOverloadedAgents(workspaceRoot);
  const unstableProjects = detectUnstableProjects(workspaceRoot);
  const highRiskSystems = detectHighRiskSystems(workspaceRoot);
  const depBottlenecks  = detectDependencyBottlenecks(workspaceRoot);

  const allRisks = [
    ...overloadedAgents.map((a) => a.loadLevel),
    ...unstableProjects.map((p) => p.riskLevel),
    ...highRiskSystems.map((s) => s.riskLevel),
    ...depBottlenecks.map((b) => b.severity),
  ];
  const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const worst = allRisks.sort((a, b) => (levelOrder[a] ?? 9) - (levelOrder[b] ?? 9))[0];

  return {
    ts: new Date().toISOString(),
    flowHealth: healthScore,
    overallRisk: worst ?? 'low',
    summary: {
      overloadedAgents:      overloadedAgents.length,
      unstableProjects:      unstableProjects.length,
      highRiskSystems:      highRiskSystems.length,
      dependencyBottlenecks: depBottlenecks.length,
    },
    overloadedAgents,
    unstableProjects,
    highRiskSystems,
    dependencyBottlenecks: depBottlenecks,
    tree: renderHealthTree({ healthScore, overloadedAgents, unstableProjects, highRiskSystems, depBottlenecks }),
  };
}

/**
 * Render the health map as an ASCII tree string.
 * @param {object} data
 * @returns {string}
 */
export function renderHealthTree(data) {
  const { healthScore, overloadedAgents, unstableProjects, highRiskSystems, depBottlenecks } = data;
  const lines = [];

  lines.push('+-- ORGANIZATIONAL HEALTH MAP --------------------------------------------');
  lines.push('| Flow Health: [' + healthScore.grade + '] ' + healthScore.score + '/100  (' + healthScore.snapshotTs + ')');

  if (overloadedAgents.length > 0) {
    lines.push('|');
    lines.push('+-- OVERLOADED AGENTS -----------------------------------------------------');
    for (const a of overloadedAgents.slice(0, 5)) {
      const icon = a.loadLevel === 'critical' ? '[CRIT]' : a.loadLevel === 'high' ? '[HIGH]' : '[MED] ';
      lines.push('|   ' + icon + ' ' + a.agent + ': backlog=' + a.backlog + ', failRate=' + a.failRate + '%');
    }
  }

  if (unstableProjects.length > 0) {
    lines.push('|');
    lines.push('+-- UNSTABLE PROJECTS ------------------------------------------------------');
    for (const p of unstableProjects.slice(0, 5)) {
      const icon = p.riskLevel === 'critical' ? '[CRIT]' : p.riskLevel === 'high' ? '[HIGH]' : '[MED] ';
      lines.push('|   ' + icon + ' ' + p.project + ': score=' + p.riskScore + ' (chg=' + p.changes + ', reg=' + p.regressions + ', rbk=' + p.rollbacks + ')');
    }
  }

  if (highRiskSystems.length > 0) {
    lines.push('|');
    lines.push('+-- HIGH-RISK SYSTEMS -----------------------------------------------------');
    for (const s of highRiskSystems.slice(0, 5)) {
      const icon = s.riskLevel === 'critical' ? '[CRIT]' : s.riskLevel === 'high' ? '[HIGH]' : '[MED] ';
      lines.push('|   ' + icon + ' ' + s.system + ': score=' + s.riskScore + ' (qaFail=' + s.qaFailures + ', blk=' + s.unresolvedBlockers + ', chgFreq=' + s.changeFrequency + ')');
    }
  }

  if (depBottlenecks.length > 0) {
    lines.push('|');
    lines.push('+-- DEPENDENCY BOTTLENECKS -----------------------------------------------');
    for (const b of depBottlenecks.slice(0, 5)) {
      const icon = b.severity === 'critical' ? '[CRIT]' : b.severity === 'high' ? '[HIGH]' : '[MED] ';
      const extra = b.type === 'long-waiting-patch'
        ? ' (' + b.waitingHours + 'h waiting)'
        : b.type === 'blocking-dependency'
        ? ' (blocks ' + b.blockedTasks + ' tasks)'
        : ' (' + b.rollbackCount + ' rollbacks)';
      lines.push('|   ' + icon + ' [' + b.type + '] ' + (b.dependency ?? b.patchId ?? 'unknown') + extra);
    }
  }

  if (overloadedAgents.length === 0 && unstableProjects.length === 0 && highRiskSystems.length === 0 && depBottlenecks.length === 0) {
    lines.push('|');
    lines.push('|   [OK] No critical issues detected. Org health is stable.');
  }

  lines.push('+------------------------------------------------------------------------');
  return lines.join('\n');
}

/**
 * Export health map as structured JSON (for UI consumption).
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function exportHealthMapJSON(workspaceRoot) {
  return buildHealthMap(workspaceRoot);
}

/**
 * Export health map as markdown table.
 * @param {string} workspaceRoot
 * @returns {string}
 */
export function exportHealthMapMarkdown(workspaceRoot) {
  const map = buildHealthMap(workspaceRoot);
  const lines = [];

  lines.push('# Organizational Health Map');
  lines.push('Generated: ' + map.ts);
  lines.push('');
  lines.push('## Flow Health: **' + map.flowHealth.grade + '** (' + map.flowHealth.score + '/100)');
  lines.push('');

  if (map.overloadedAgents.length > 0) {
    lines.push('## Overloaded Agents');
    lines.push('| Agent | Backlog | Fail Rate | Load Level |');
    lines.push('|-------|---------|-----------|------------|');
    for (const a of map.overloadedAgents) {
      lines.push('| ' + a.agent + ' | ' + a.backlog + ' | ' + a.failRate + '% | ' + a.loadLevel + ' |');
    }
    lines.push('');
  }

  if (map.unstableProjects.length > 0) {
    lines.push('## Unstable Projects');
    lines.push('| Project | Changes | Regressions | Rollbacks | Risk Score | Risk Level |');
    lines.push('|---------|---------|-------------|-----------|------------|------------|');
    for (const p of map.unstableProjects) {
      lines.push('| ' + p.project + ' | ' + p.changes + ' | ' + p.regressions + ' | ' + p.rollbacks + ' | ' + p.riskScore + ' | ' + p.riskLevel + ' |');
    }
    lines.push('');
  }

  if (map.highRiskSystems.length > 0) {
    lines.push('## High-Risk Systems');
    lines.push('| System | QA Failures | Unresolved Blockers | Change Frequency | Risk Score |');
    lines.push('|--------|-------------|---------------------|------------------|------------|');
    for (const s of map.highRiskSystems) {
      lines.push('| ' + s.system + ' | ' + s.qaFailures + ' | ' + s.unresolvedBlockers + ' | ' + s.changeFrequency + ' | ' + s.riskScore + ' |');
    }
    lines.push('');
  }

  if (map.dependencyBottlenecks.length > 0) {
    lines.push('## Dependency Bottlenecks');
    lines.push('| Type | Target | Severity | Details |');
    lines.push('|------|--------|----------|---------|');
    for (const b of map.dependencyBottlenecks) {
      const detail = b.type === 'long-waiting-patch'
        ? b.waitingHours + 'h waiting'
        : b.type === 'blocking-dependency'
        ? 'blocks ' + b.blockedTasks + ' tasks'
        : b.rollbackCount + ' rollbacks';
      lines.push('| ' + b.type + ' | ' + (b.dependency ?? b.patchId ?? 'unknown') + ' | ' + b.severity + ' | ' + detail + ' |');
    }
    lines.push('');
  }

  return lines.join('\n');
}
