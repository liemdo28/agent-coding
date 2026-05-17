// routes/deploy.js — Express Router for deployment operations
// Phase 19: history, risk analysis, record deployment, readiness check

import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { logger } from '../../../core/logger.js';

const router = Router();

function localAgentDir() { return join(PROJECT_ROOT, '.local-agent'); }
function deployLogFile()  { return join(localAgentDir(), 'deployments.json'); }

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

function loadDeployments() {
  const f = deployLogFile();
  if (!existsSync(f)) return [];
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return []; }
}

function saveDeployments(list) {
  const dir = localAgentDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Keep last 500
  const trimmed = list.length > 500 ? list.slice(-500) : list;
  writeFileSync(deployLogFile(), JSON.stringify(trimmed, null, 2), 'utf8');
}

// GET /deploy/history — deployment history
router.get('/deploy/history', (req, res) => {
  try {
    const { limit = 50, projectId, env } = req.query;
    let deployments = loadDeployments();

    if (projectId) deployments = deployments.filter(d => d.projectId === projectId);
    if (env)       deployments = deployments.filter(d => d.environment === env);

    const sorted = deployments
      .sort((a, b) => new Date(b.startedAt ?? 0) - new Date(a.startedAt ?? 0))
      .slice(0, parseInt(limit, 10));

    logger.fileOnly('info', 'ui: GET /deploy/history', { count: sorted.length });
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /deploy/risk/:projectId — risk analysis for a project
router.get('/deploy/risk/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId || projectId.includes('..')) {
      return res.status(400).json({ success: false, error: 'Invalid projectId' });
    }

    const deployments = loadDeployments().filter(d => d.projectId === projectId);
    const recent      = deployments.slice(-10);
    const rollbacks   = recent.filter(d => !d.success || d.rollbackReason).length;
    const rollbackRate = recent.length > 0 ? rollbacks / recent.length : 0;

    const score  = Math.min(100, Math.round(rollbackRate * 60 + 20));
    const risk   = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

    const analysis = {
      projectId,
      score,
      risk,
      rollbackRate:   +rollbackRate.toFixed(3),
      recentDeployments: recent.length,
      warnings:       rollbackRate > 0.3 ? ['High rollback frequency'] : [],
      recommendations: rollbackRate > 0.2 ? ['Review recent patches before next deploy'] : [],
    };

    logger.fileOnly('info', 'ui: GET /deploy/risk/:projectId', { projectId, risk });
    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /deploy/record — record a deployment event
router.post('/deploy/record', (req, res) => {
  try {
    const deploy = req.body ?? {};
    if (!deploy.projectId) {
      return res.status(400).json({ success: false, error: 'projectId is required' });
    }

    const record = {
      id:           deploy.id ?? genId(),
      projectId:    deploy.projectId,
      environment:  deploy.environment ?? 'development',
      status:       deploy.status ?? 'started',
      success:      deploy.success ?? false,
      startedAt:    deploy.startedAt ?? new Date().toISOString(),
      completedAt:  deploy.completedAt ?? null,
      durationMs:   deploy.durationMs ?? null,
      rollbackReason: deploy.rollbackReason ?? null,
      commitHash:   deploy.commitHash ?? null,
      deployer:     deploy.deployer ?? null,
      metadata:     deploy.metadata ?? {},
    };

    const deployments = loadDeployments();
    deployments.push(record);
    saveDeployments(deployments);

    logger.fileOnly('info', 'ui: POST /deploy/record', { id: record.id, projectId: record.projectId });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /deploy/readiness/:projectId — release readiness check
router.get('/deploy/readiness/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId || projectId.includes('..')) {
      return res.status(400).json({ success: false, error: 'Invalid projectId' });
    }

    // Lightweight readiness check based on deploy history
    const deployments = loadDeployments().filter(d => d.projectId === projectId);
    const last        = deployments[deployments.length - 1] ?? null;
    const recent5     = deployments.slice(-5);
    const failedRecent = recent5.filter(d => !d.success).length;

    const checks = [
      { name: 'No recent failures',   pass: failedRecent === 0, message: `${failedRecent} failed in last 5 deploys` },
      { name: 'Has deployment history', pass: deployments.length > 0, message: deployments.length > 0 ? `${deployments.length} total` : 'No history' },
    ];

    const passed = checks.filter(c => c.pass).length;
    const score  = Math.round((passed / checks.length) * 100);
    const ready  = failedRecent === 0;

    logger.fileOnly('info', 'ui: GET /deploy/readiness/:projectId', { projectId, ready });
    res.json({ success: true, data: { projectId, ready, score, checks, lastDeploy: last?.startedAt ?? null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
