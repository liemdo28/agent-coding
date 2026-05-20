// routes/digital-twin.js — local-only Digital Twin v3 data/API surface
import { Router } from 'express';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { readJsonSafe, writeJsonAtomic } from '../lib/runtime-json.js';
import { recordJsonWrite } from '../lib/runtime-metrics.js';

const router = Router();

const COMPANIES = [
  ['rnd', 'R&D'],
  ['manufacturing', 'Kỹ thuật sản xuất'],
  ['it-ai', 'Công nghệ & AI'],
  ['finance', 'Tài chính'],
  ['marketing-sales', 'Marketing & Sales'],
  ['operations-logistics', 'Vận hành'],
  ['hr-culture', 'Nhân sự'],
  ['legal-compliance', 'Pháp chế'],
];

const PRIORITY_WEIGHT = { critical: 1, high: 0.8, medium: 0.55, normal: 0.35, low: 0.18 };
let assignmentState = null;
let executionState = null;
let assignmentsFlushTimer = null;
let executionsFlushTimer = null;

function runtimeDir() {
  const dir = join(PROJECT_ROOT, '.local-agent', 'digital-twin');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(path, value) {
  try {
    writeJsonAtomic(path, value);
    recordJsonWrite(true);
  } catch (err) {
    recordJsonWrite(false);
    throw err;
  }
}

function assignmentsPath() {
  return join(runtimeDir(), 'task-assignments.json');
}

function executionsPath() {
  return join(runtimeDir(), 'executions.json');
}

function getAssignments() {
  if (assignmentState === null) assignmentState = readJsonSafe(assignmentsPath(), {});
  return assignmentState;
}

function getExecutions() {
  if (executionState === null) executionState = readJsonSafe(executionsPath(), []);
  return executionState;
}

function scheduleRuntimeFlush(kind) {
  const isAssignments = kind === 'assignments';
  const existing = isAssignments ? assignmentsFlushTimer : executionsFlushTimer;
  if (existing) return;

  const flush = () => {
    try {
      if (isAssignments) {
        assignmentsFlushTimer = null;
        writeJson(assignmentsPath(), getAssignments());
      } else {
        executionsFlushTimer = null;
        writeJson(executionsPath(), getExecutions());
      }
    } catch {
      recordJsonWrite(false);
    }
  };

  const timer = setTimeout(flush, 75);
  if (isAssignments) assignmentsFlushTimer = timer;
  else executionsFlushTimer = timer;
}

function flushRuntimeState() {
  if (assignmentsFlushTimer) {
    clearTimeout(assignmentsFlushTimer);
    assignmentsFlushTimer = null;
    writeJson(assignmentsPath(), getAssignments());
  }
  if (executionsFlushTimer) {
    clearTimeout(executionsFlushTimer);
    executionsFlushTimer = null;
    writeJson(executionsPath(), getExecutions());
  }
}

process.once('beforeExit', flushRuntimeState);
process.once('SIGTERM', () => {
  try { flushRuntimeState(); } finally { process.exit(0); }
});

function readDispatches(limit = 160) {
  const dir = join(PROJECT_ROOT, '.local-agent', 'command-center');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.startsWith('dispatch-') && file.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit)
    .flatMap((file) => {
      try { return [JSON.parse(readFileSync(join(dir, file), 'utf8'))]; }
      catch { return []; }
    });
}

function fallbackDispatches() {
  const now = new Date().toISOString();
  return COMPANIES.map(([id, name], index) => ({
    dispatchId: `demo-${id}`,
    task: {
      id: `task-${id}`,
      raw: index % 3 === 0 ? `Fix ${name} SLA flow` : index % 3 === 1 ? `Audit ${name} rollout` : `Plan ${name} batch`,
      type: index % 3 === 0 ? 'build_fix' : index % 3 === 1 ? 'audit' : 'plan',
      priority: index % 4 === 0 ? 'high' : index % 4 === 1 ? 'medium' : 'normal',
      createdAt: now,
    },
    company: { id, name: `Công ty ${name}`, division: name },
    execution: {
      dev: { status: 'proposal-ready', riskLevel: index % 4 === 0 ? 'medium' : 'low' },
      qa:  { status: index % 5 === 0 ? 'review-required' : 'provisionally-approved', riskLevel: index % 5 === 0 ? 'medium' : 'low' },
    },
  }));
}

function normalizeControls(input = {}) {
  return {
    priorityWeight: Math.min(100, Math.max(0, Number(input.priorityWeight ?? 62))),
    workerAllocation: Math.min(512, Math.max(16, Number(input.workerAllocation ?? 192))),
    batchFactor: Math.min(100, Math.max(10, Number(input.batchFactor ?? 48))),
  };
}

function riskBand(score) {
  if (score >= 0.78) return 'danger';
  if (score >= 0.58) return 'alert';
  if (score >= 0.34) return 'warn';
  return 'safe';
}

function taskRisk(dispatch, controls) {
  const priority = dispatch.task?.priority ?? 'normal';
  const qaStatus = dispatch.execution?.qa?.status ?? 'unknown';
  const devStatus = dispatch.execution?.dev?.status ?? 'unknown';
  const base = PRIORITY_WEIGHT[priority] ?? PRIORITY_WEIGHT.normal;
  const qa = qaStatus === 'review-required' || qaStatus === 'QA_FAIL' ? 0.24 : 0;
  const dev = devStatus === 'failed' || devStatus === 'DEV_FAILED' ? 0.18 : 0;
  const slider = controls.priorityWeight / 100 * 0.18;
  return Math.min(1, base + qa + dev + slider);
}

function buildTwinData(rawControls = {}) {
  const controls = normalizeControls(rawControls);
  const dispatches = readDispatches();
  const source = dispatches.length > 0 ? dispatches : fallbackDispatches();
  const assignments = getAssignments();
  const executions = getExecutions();

  const tasks = source.map((d, index) => {
    const assignedCompany = assignments[d.task?.id] ?? d.company?.id ?? COMPANIES[index % COMPANIES.length][0];
    const riskScore = taskRisk(d, controls);
    const batch = `B${(index % 8) + 1}`;
    return {
      id: d.task?.id ?? d.dispatchId,
      dispatchId: d.dispatchId,
      title: d.task?.raw ?? d.dispatchId,
      type: d.task?.type ?? 'plan',
      priority: d.task?.priority ?? 'normal',
      companyId: assignedCompany,
      batch,
      qaStatus: d.execution?.qa?.status ?? 'unknown',
      devStatus: d.execution?.dev?.status ?? 'unknown',
      rollback: /fail|required/i.test(`${d.execution?.qa?.status ?? ''} ${d.execution?.dev?.status ?? ''}`),
      riskScore,
      riskBand: riskBand(riskScore),
      createdAt: d.task?.createdAt,
    };
  });

  const companies = COMPANIES.map(([id, name], index) => {
    const owned = tasks.filter((task) => task.companyId === id);
    const highPriorityTasks = owned.filter((task) => ['critical', 'high'].includes(task.priority)).length;
    const qaIssues = owned.filter((task) => /required|fail/i.test(task.qaStatus)).length;
    const rollbackCount = owned.filter((task) => task.rollback).length;
    const avgRisk = owned.length
      ? owned.reduce((sum, task) => sum + task.riskScore, 0) / owned.length
      : Math.min(0.3, 0.08 + index * 0.018 + controls.priorityWeight / 1000);
    const workerPool = Math.max(4, Math.round((controls.workerAllocation / COMPANIES.length) * (1 + avgRisk)));
    return {
      id,
      name,
      currentBatch: `B${(index % 8) + 1}`,
      activeTasks: owned.length,
      highPriorityTasks,
      qaFailRate: owned.length ? qaIssues / owned.length : 0,
      rollbackCount,
      workerPool,
      predictedRisk: Number(avgRisk.toFixed(2)),
      riskBand: riskBand(avgRisk),
    };
  });

  const batches = Array.from({ length: 8 }, (_, index) => {
    const id = `B${index + 1}`;
    const batchTasks = tasks.filter((task) => task.batch === id);
    const highPriorityTasks = batchTasks.filter((task) => ['critical', 'high'].includes(task.priority)).length;
    const qaFails = batchTasks.filter((task) => /required|fail/i.test(task.qaStatus)).length;
    const risk = batchTasks.length
      ? batchTasks.reduce((sum, task) => sum + task.riskScore, 0) / batchTasks.length
      : (index + 1) / 24;
    return {
      id,
      progress: Math.min(100, Math.round(28 + controls.batchFactor * 0.45 + index * 4)),
      highPriorityTasks,
      qaFailRate: batchTasks.length ? qaFails / batchTasks.length : 0,
      workerAllocation: Math.round(controls.workerAllocation / 8 + index * 2),
      taskCount: batchTasks.length,
      predictedRisk: Number(risk.toFixed(2)),
      riskBand: riskBand(risk),
    };
  });

  const projects = [
    { id: 'agent-ui', name: 'Agent UI', status: 'active', companyId: 'it-ai', tasks: tasks.filter((t) => t.companyId === 'it-ai').length },
    { id: 'sandbox', name: 'Sandbox Patch Runtime', status: 'sandboxed', companyId: 'operations-logistics', tasks: tasks.filter((t) => t.type === 'build_fix').length },
    { id: 'qa-risk', name: 'QA Risk Monitor', status: 'watching', companyId: 'legal-compliance', tasks: tasks.filter((t) => /required|fail/i.test(t.qaStatus)).length },
  ];

  const alerts = [
    ...companies.filter((c) => c.predictedRisk >= 0.58).map((c) => ({ type: 'sla', severity: c.riskBand, message: `${c.name}: SLA risk ${Math.round(c.predictedRisk * 100)}%` })),
    ...batches.filter((b) => b.predictedRisk >= 0.58).map((b) => ({ type: 'batch', severity: b.riskBand, message: `${b.id}: batch risk ${Math.round(b.predictedRisk * 100)}%` })),
  ];

  return {
    updatedAt: new Date().toISOString(),
    controls,
    summary: {
      totalProjects: projects.length,
      activeTasks: tasks.length,
      totalWorkers: companies.reduce((sum, c) => sum + c.workerPool, 0),
      systemHealth: alerts.some((a) => a.severity === 'danger') ? 'FAIL' : alerts.length ? 'WARN' : 'PASS',
      qaWarnings: tasks.filter((t) => /required|fail/i.test(t.qaStatus)).length,
      rollbacks: tasks.filter((t) => t.rollback).length,
    },
    companies,
    batches,
    tasks,
    projects,
    executions: executions.slice(-30).reverse(),
    alerts,
  };
}

router.get('/analytics', (req, res) => {
  res.json(buildTwinData(req.query));
});

router.get('/simulation', (req, res) => {
  res.json(buildTwinData(req.query));
});

router.post('/simulation', (req, res) => {
  const data = buildTwinData(req.body ?? {});
  writeJson(join(runtimeDir(), 'simulation_report.json'), data);
  res.json(data);
});

router.get('/task', (req, res) => {
  const data = buildTwinData(req.query);
  res.json({ tasks: data.tasks, projects: data.projects, companies: data.companies });
});

router.post('/task', (req, res) => {
  const { taskId, companyId } = req.body ?? {};
  if (!taskId || !companyId) return res.status(400).json({ success: false, error: 'taskId and companyId are required' });
  getAssignments()[taskId] = companyId;
  scheduleRuntimeFlush('assignments');
  res.json({ success: true, taskId, companyId });
});

router.get('/execution', (_req, res) => {
  res.json({ executions: getExecutions().slice(-50).reverse() });
});

router.post('/execution', (req, res) => {
  const { taskId, action = 'sandbox-build-fix', companyId = 'it-ai' } = req.body ?? {};
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required' });
  const event = {
    id: `exec-${Date.now().toString(36)}`,
    taskId,
    companyId,
    action,
    status: 'queued-offline',
    sandboxed: true,
    createdAt: new Date().toISOString(),
  };
  const executions = getExecutions();
  executions.push(event);
  if (executions.length > 5000) executions.splice(0, executions.length - 5000);
  scheduleRuntimeFlush('executions');
  res.json({ success: true, execution: event });
});

export default router;
