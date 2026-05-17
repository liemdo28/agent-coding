// routes/commandcenter.js — Express Router for Command Center API
// Phase 19: health, risks, recommendations, emergency rollback, deployments, deploy-block

import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { logger } from '../../../core/logger.js';

const router = Router();

function localAgentDir() { return join(PROJECT_ROOT, '.local-agent'); }
function deployBlockFile() { return join(localAgentDir(), 'deploy-blocks.json'); }

function loadDeployBlocks() {
  const f = deployBlockFile();
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return {}; }
}

function saveDeployBlocks(blocks) {
  const dir = localAgentDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(deployBlockFile(), JSON.stringify(blocks, null, 2), 'utf8');
}

// GET /commandcenter/health — system health summary
router.get('/commandcenter/health', (req, res) => {
  try {
    const health = {
      status:       'operational',
      timestamp:    new Date().toISOString(),
      memoryStats:  { note: 'Connect engineeringMemory for live stats' },
      activeSessions: 0,
      qaStatus:     'unknown',
      uptime:       process.uptime(),
      nodeVersion:  process.version,
    };
    logger.fileOnly('info', 'ui: GET /commandcenter/health', {});
    res.json({ success: true, data: health });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /commandcenter/risks — top risks across all projects
router.get('/commandcenter/risks', (req, res) => {
  try {
    // Aggregate risks from local-agent state files
    const risks = [];
    const sessionsFile = join(localAgentDir(), 'sessions.json');
    if (existsSync(sessionsFile)) {
      const sessions = Object.values(JSON.parse(readFileSync(sessionsFile, 'utf8')));
      for (const s of sessions) {
        if (s.status === 'active') {
          risks.push({ type: 'ACTIVE_SESSION', projectId: s.projectId, sessionId: s.sessionId, severity: 'info' });
        }
      }
    }

    const blocks = loadDeployBlocks();
    for (const [projectId, block] of Object.entries(blocks)) {
      if (block.blocked) {
        risks.push({ type: 'DEPLOY_BLOCKED', projectId, reason: block.reason, severity: 'high' });
      }
    }

    logger.fileOnly('info', 'ui: GET /commandcenter/risks', { count: risks.length });
    res.json({ success: true, data: risks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /commandcenter/recommendations — AI recommendations from memory + root cause
router.get('/commandcenter/recommendations', (req, res) => {
  try {
    // Placeholder recommendations (real impl would query engineeringMemory + rootcause)
    const recommendations = [
      { id: '1', type: 'MEMORY', message: 'Run memory compression to reduce DB size', priority: 'low' },
      { id: '2', type: 'QA',     message: 'Schedule autonomous QA run for high-churn projects', priority: 'medium' },
    ];
    logger.fileOnly('info', 'ui: GET /commandcenter/recommendations', {});
    res.json({ success: true, data: recommendations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /commandcenter/emergency-rollback
router.post('/commandcenter/emergency-rollback', (req, res) => {
  try {
    const { projectId, patchId, reason } = req.body ?? {};
    if (!projectId || !patchId) {
      return res.status(400).json({ success: false, error: 'projectId and patchId are required' });
    }

    // Log the rollback event
    const rollbackLog = join(localAgentDir(), 'emergency-rollbacks.json');
    let log = [];
    if (existsSync(rollbackLog)) {
      try { log = JSON.parse(readFileSync(rollbackLog, 'utf8')); } catch { /* start fresh */ }
    }
    log.push({ projectId, patchId, reason: reason ?? 'emergency', triggeredAt: new Date().toISOString() });
    if (!existsSync(localAgentDir())) mkdirSync(localAgentDir(), { recursive: true });
    writeFileSync(rollbackLog, JSON.stringify(log, null, 2), 'utf8');

    logger.fileOnly('warn', 'ui: POST /commandcenter/emergency-rollback', { projectId, patchId, reason });
    res.json({ success: true, data: { projectId, patchId, status: 'rollback_logged', message: 'Rollback logged. Apply via RollbackManager.' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /commandcenter/deployments — recent deployments
router.get('/commandcenter/deployments', (req, res) => {
  try {
    // Return from deploy log file if available
    const deployLog = join(localAgentDir(), 'deployments.json');
    const deployments = existsSync(deployLog)
      ? JSON.parse(readFileSync(deployLog, 'utf8'))
      : [];
    const sorted = Array.isArray(deployments)
      ? deployments.sort((a, b) => new Date(b.startedAt ?? 0) - new Date(a.startedAt ?? 0)).slice(0, 20)
      : [];
    logger.fileOnly('info', 'ui: GET /commandcenter/deployments', { count: sorted.length });
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /commandcenter/deploy-block/:projectId — block deployments for a project
router.post('/commandcenter/deploy-block/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const { reason = 'manually blocked' } = req.body ?? {};

    if (!projectId || projectId.includes('..')) {
      return res.status(400).json({ success: false, error: 'Invalid projectId' });
    }

    const blocks = loadDeployBlocks();
    blocks[projectId] = { blocked: true, reason, blockedAt: new Date().toISOString() };
    saveDeployBlocks(blocks);

    logger.fileOnly('warn', 'ui: POST /commandcenter/deploy-block', { projectId, reason });
    res.json({ success: true, data: { projectId, blocked: true, reason } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
