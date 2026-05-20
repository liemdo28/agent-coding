// org-intelligence/autonomous-optimizer.js
// AI-driven autonomous optimization of team allocation, worker distribution,
// scheduling, and bottleneck reduction based on flow metrics and live agent data.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildFlowSnapshot, flowTrend, flowHealthScore } from './flow-analyzer.js';
import { queryEvents } from '../timeline/TimelineStore.js';

const STORE_DIR = '.local-agent/org-intelligence';
const OPT_FILE = 'optimization-proposals.json';

function loadProposals(workspaceRoot) {
  const p = join(workspaceRoot, STORE_DIR, OPT_FILE);
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return []; }
}

function saveProposals(workspaceRoot, proposals) {
  mkdirSync(join(workspaceRoot, STORE_DIR), { recursive: true });
  writeFileSync(join(workspaceRoot, STORE_DIR, OPT_FILE), JSON.stringify(proposals.slice(-100), null, 2), 'utf8');
}

// ─── Data collection helpers ─────────────────────────────────────────────────

/**
 * Load recent agent load data from memory store.
 * @param {string} workspaceRoot
 * @returns {object}
 */
function agentLoadData(workspaceRoot) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const tasks = queryEvents(workspaceRoot, { type: 'task_start', since, limit: 1000 });
  const resolved = queryEvents(workspaceRoot, { type: 'task_resolved', since, limit: 1000 });
  const agentCounts = {};
  for (const t of tasks) {
    const a = t.agentId ?? t.agent ?? 'default';
    agentCounts[a] = (agentCounts[a] ?? 0) + 1;
  }
  const resolvedCounts = {};
  for (const r of resolved) {
    const a = r.agentId ?? r.agent ?? 'default';
    resolvedCounts[a] = (resolvedCounts[a] ?? 0) + 1;
  }
  return { agentCounts, resolvedCounts, totalTasks: tasks.length, totalResolved: resolved.length };
}

/**
 * Identify bottlenecks from timeline events.
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
function detectBottlenecks(workspaceRoot) {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const blockers = queryEvents(workspaceRoot, { type: 'blocker', since, limit: 200 });
  const slowTasks = queryEvents(workspaceRoot, { type: 'task_resolved', since, limit: 500 })
    .filter((t) => {
      const ms = t.cycleTimeMs ?? 0;
      return ms > 7200000; // > 2 hours
    });
  const fileChanges = queryEvents(workspaceRoot, { type: 'file_change', since, limit: 1000 });
  const fileFreq = {};
  for (const c of fileChanges) {
    if (c.file) fileFreq[c.file] = (fileFreq[c.file] ?? 0) + 1;
  }
  const hotFiles = Object.entries(fileFreq).sort(([, a], [, b]) => b - a).slice(0, 5);
  return {
    unresolvedBlockers: blockers.filter((b) => {
      const res = queryEvents(workspaceRoot, { type: 'blocker_resolved', since, limit: 100 });
      return !res.find((r) => r.blockerId === b.blockerId);
    }).length,
    slowTasks: slowTasks.length,
    hotFiles: hotFiles.map(([file, count]) => ({ file, changes: count })),
  };
}

// ─── Optimization engines ────────────────────────────────────────────────────

/**
 * Suggest better team/agent allocation based on load data.
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function teamAllocationAdvice(workspaceRoot) {
  const load = agentLoadData(workspaceRoot);
  const proposals = [];

  const agents = new Set([...Object.keys(load.agentCounts), ...Object.keys(load.resolvedCounts)]);
  const overloadThreshold = 5;
  const underloadThreshold = 1;

  for (const agent of agents) {
    const started = load.agentCounts[agent] ?? 0;
    const resolved = load.resolvedCounts[agent] ?? 0;
    const backlog = started - resolved;
    const agentKey = agent || 'default';

    if (backlog > overloadThreshold) {
      proposals.push({
        type: 'rebalance',
        priority: backlog > overloadThreshold * 2 ? 'high' : 'medium',
        agent: agentKey,
        finding: `Agent \"${agentKey}\" has ${backlog} unresolved tasks (${started} started, ${resolved} resolved)`,
        suggestion: `Redirect ${Math.ceil(backlog / 2)} new tasks away from \"${agentKey}\" to lighter agents. Consider splitting work or adding a second agent to this queue.`,
        metric: { backlog, started, resolved },
      });
    } else if (resolved > 0 && backlog === 0) {
      proposals.push({
        type: 'idle-capacity',
        priority: 'low',
        agent: agentKey,
        finding: `Agent \"${agentKey}\" has no backlog (${resolved} resolved recently, 0 pending)`,
        suggestion: `Increase task assignment to \"${agentKey}\" — there is capacity for ${Math.ceil(resolved * 0.5)} more concurrent tasks.`,
        metric: { backlog, started, resolved },
      });
    }
  }

  // Cross-agent load balancing check
  const total = load.totalTasks;
  const avg = total / Math.max(agents.size, 1);
  const skewed = Object.values(load.agentCounts).filter((c) => c > avg * 1.5);
  if (skewed.length > 0) {
    proposals.push({
      type: 'load-imbalance',
      priority: 'high',
      agent: 'all',
      finding: `Task distribution is uneven: ${total} tasks across ${agents.size} agents, avg ${avg.toFixed(1)}/agent.`,
      suggestion: `Re-balance by routing new tasks to agents with lower load. Use round-robin or weighted round-robin scheduling.`,
      metric: { totalAgents: agents.size, avgLoad: +avg.toFixed(2), overloadedCount: skewed.length },
    });
  }

  return proposals;
}

/**
 * Suggest worker distribution improvements.
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function workerDistributionAdvice(workspaceRoot) {
  const load = agentLoadData(workspaceRoot);
  const bottlenecks = detectBottlenecks(workspaceRoot);
  const proposals = [];

  // Check for project-level concentration
  const projectCounts = {};
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const tasks = queryEvents(workspaceRoot, { type: 'task_start', since, limit: 500 });
  for (const t of tasks) {
    const proj = t.project ?? t.projectId ?? 'default';
    projectCounts[proj] = (projectCounts[proj] ?? 0) + 1;
  }
  const projects = Object.entries(projectCounts).sort(([, a], [, b]) => b - a);
  for (const [project, count] of projects) {
    if (count > 20) {
      proposals.push({
        type: 'project-concentration',
        priority: count > 40 ? 'high' : 'medium',
        project,
        finding: `Project \"${project}\" has ${count} active tasks — high concentration risk.`,
        suggestion: `Increase parallelization within \"${project}\" by splitting work across multiple agents or feature branches.`,
        metric: { activeTasks: count },
      });
    }
  }

  // Blockers create bottlenecks
  if (bottlenecks.unresolvedBlockers > 0) {
    proposals.push({
      type: 'blocker-bottleneck',
      priority: 'high',
      finding: `${bottlenecks.unresolvedBlockers} unresolved blockers are stalling progress.`,
      suggestion: `Assign dedicated agents to unblock critical paths. Resolve blockers before starting new work.`,
      metric: { blockers: bottlenecks.unresolvedBlockers },
    });
  }

  // Hot files indicate areas needing focus
  if (bottlenecks.hotFiles.length > 0) {
    proposals.push({
      type: 'hot-file-focus',
      priority: 'medium',
      finding: `Files ${bottlenecks.hotFiles.map((f) => f.file).join(', ')} are changing frequently.`,
      suggestion: `Allocate a dedicated review agent to stabilize high-churn files. Consider adding tests or architectural review for these modules.`,
      metric: { hotFiles: bottlenecks.hotFiles },
    });
  }

  return proposals;
}

/**
 * Scheduling improvement suggestions based on flow trends.
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function schedulingAdvice(workspaceRoot) {
  const trend = flowTrend(workspaceRoot);
  const health = flowHealthScore(workspaceRoot);
  const proposals = [];

  // Slow cycle time
  if (trend.delivery?.cycleTimeDeltaMin !== null && trend.delivery.cycleTimeDeltaMin > 30) {
    proposals.push({
      type: 'cycle-time-spike',
      priority: 'high',
      finding: `Cycle time increased by ${trend.delivery.cycleTimeDeltaMin} minutes vs last period (current: ${trend.delivery.current} min).`,
      suggestion: `Investigate task queue depth. Consider reducing WIP limits, adding capacity, or breaking large tasks into smaller increments.`,
      metric: { deltaMin: trend.delivery.cycleTimeDeltaMin, currentMin: trend.delivery.current },
    });
  }

  // Declining QA pass rate
  if (trend.qa?.passRateDelta !== null && trend.qa.passRateDelta < -5) {
    proposals.push({
      type: 'qa-quality-decline',
      priority: 'high',
      finding: `QA pass rate dropped by ${Math.abs(trend.qa.passRateDelta)}% (current: ${trend.qa.current}%).`,
      suggestion: `Add pre-deploy QA checks. Review recent changes to hot files. Increase test coverage for affected modules.`,
      metric: { delta: trend.qa.passRateDelta, current: trend.qa.current },
    });
  }

  // Rollback rate increasing
  if (trend.rollbacks?.rollbackRateDelta !== null && trend.rollbacks.rollbackRateDelta > 1) {
    proposals.push({
      type: 'rollback-spike',
      priority: 'high',
      finding: `Rollback rate increased by ${trend.rollbacks.rollbackRateDelta}% (current: ${trend.rollbacks.current}%).`,
      suggestion: `Strengthen review process. Add staging environment testing. Reduce patch sizes and increase incremental delivery.`,
      metric: { delta: trend.rollbacks.rollbackRateDelta, current: trend.rollbacks.current },
    });
  }

  // Unresolved blockers growing
  if (trend.blockers?.unresolvedDelta !== null && trend.blockers.unresolvedDelta > 0) {
    proposals.push({
      type: 'blocker-accumulation',
      priority: 'high',
      finding: `${trend.blockers.unresolvedDelta} new unresolved blockers appeared.`,
      suggestion: `Immediately assign owners to all open blockers. Use a daily blocker review cadence.`,
      metric: { delta: trend.blockers.unresolvedDelta, current: trend.blockers.current },
    });
  }

  // Health grade recommendations
  if (health.grade === 'F' || health.grade === 'D') {
    proposals.push({
      type: 'flow-health-critical',
      priority: 'critical',
      finding: `Flow health score is ${health.score} (Grade: ${health.grade}). Multiple metrics are underperforming.`,
      suggestion: `Initiate a flow review. Reduce WIP to minimum. Pause non-critical work. Focus all agents on clearing blockers and stabilizing QA.`,
      metric: { score: health.score, grade: health.grade },
    });
  }

  // General scheduling improvements
  if (health.grade !== 'F' && health.grade !== 'D') {
    proposals.push({
      type: 'scheduling-optimization',
      priority: 'low',
      finding: `Flow health is Grade ${health.grade} (${health.score}/100). Room for optimization.`,
      suggestion: `Implement time-boxed sprints. Reduce task handoffs. Increase automation in testing and deployment.`,
      metric: { score: health.score, grade: health.grade },
    });
  }

  return proposals;
}

/**
 * Bottleneck reduction recommendations.
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function bottleneckReductionAdvice(workspaceRoot) {
  const bottlenecks = detectBottlenecks(workspaceRoot);
  const proposals = [];

  if (bottlenecks.unresolvedBlockers > 0) {
    proposals.push({
      type: 'unblock-critical-path',
      priority: 'critical',
      category: 'bottleneck-reduction',
      finding: `${bottlenecks.unresolvedBlockers} blockers are blocking the critical path.`,
      actions: [
        'Identify the root-cause of each blocker (infra, dependency, decision, external).',
        'Assign one owner per blocker with a 4-hour SLA.',
        'Escalate blockers older than 24 hours to team lead.',
        'Consider feature flags or workarounds to unblock dependent work.',
      ],
    });
  }

  if (bottlenecks.slowTasks > 0) {
    proposals.push({
      type: 'slow-task-decomposition',
      priority: 'medium',
      category: 'bottleneck-reduction',
      finding: `${bottlenecks.slowTasks} tasks took longer than 2 hours to complete.`,
      actions: [
        'Break tasks exceeding 4 hours into subtasks with separate tracking.',
        'Implement time-boxing (max 2-hour work increments).',
        'Add mid-point check-ins for long-running tasks.',
        'Identify if slow tasks are waiting on external dependencies.',
      ],
    });
  }

  if (bottlenecks.hotFiles.length > 0) {
    proposals.push({
      type: 'hot-file-stabilization',
      priority: 'medium',
      category: 'bottleneck-reduction',
      finding: `${bottlenecks.hotFiles.length} files are changing too frequently.`,
      actions: [
        'Audit whether changes are due to design instability or normal feature work.',
        'Add or expand unit tests targeting these files.',
        'Consider architectural refactoring to reduce coupling.',
        'Assign a stability owner to each high-churn module.',
      ],
      metrics: bottlenecks.hotFiles,
    });
  }

  return proposals;
}

// ─── Master optimizer ────────────────────────────────────────────────────────

/**
 * Run all optimization analysis and return consolidated proposals.
 * @param {string} workspaceRoot
 * @returns {object}
 */
export function runAutonomousOptimization(workspaceRoot) {
  const allocation = teamAllocationAdvice(workspaceRoot);
  const worker    = workerDistributionAdvice(workspaceRoot);
  const schedule  = schedulingAdvice(workspaceRoot);
  const reduce   = bottleneckReductionAdvice(workspaceRoot);
  const health   = flowHealthScore(workspaceRoot);

  const all = [...allocation, ...worker, ...schedule, ...reduce];

  // Deduplicate by type+agent/project key
  const seen = new Set();
  const unique = all.filter((p) => {
    const key = `${p.type}:${p.agent ?? p.project ?? 'all'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  unique.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  const result = {
    ts: new Date().toISOString(),
    healthScore: health,
    proposals: unique,
    summary: {
      total: unique.length,
      critical: unique.filter((p) => p.priority === 'critical').length,
      high:     unique.filter((p) => p.priority === 'high').length,
      medium:   unique.filter((p) => p.priority === 'medium').length,
      low:      unique.filter((p) => p.priority === 'low').length,
    },
    categories: {
      teamAllocation: allocation,
      workerDistribution: worker,
      scheduling: schedule,
      bottleneckReduction: reduce,
    },
  };

  // Persist
  const existing = loadProposals(workspaceRoot);
  saveProposals(workspaceRoot, [...existing, result]);

  return result;
}

/**
 * Retrieve past optimization reports.
 * @param {string} workspaceRoot
 * @param {{ limit?: number }} opts
 * @returns {object[]}
 */
export function getOptimizationHistory(workspaceRoot, { limit = 20 } = {}) {
  return loadProposals(workspaceRoot).slice(-limit);
}
