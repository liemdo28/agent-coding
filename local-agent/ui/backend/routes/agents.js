// routes/agents.js — Express Router for Live Agents Monitor API
import { Router } from 'express';
import { agentMonitor } from '../../../live-agents/LiveAgentMonitor.js';

const router = Router();

// GET /agents/status
router.get('/agents/status', (req, res) => {
  res.json({
    success: true,
    data: agentMonitor.getAllAgents(),
    stats: agentMonitor.getStats()
  });
});

// POST /agents/:id/status
router.post('/agents/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, task, progress, logMessage, logLevel } = req.body ?? {};

  const agent = agentMonitor.getAgent(id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }

  if (status) {
    agentMonitor.setStatus(id, status, task || null);
  }
  if (typeof progress === 'number') {
    agentMonitor.updateProgress(id, progress);
  }
  if (logMessage) {
    agentMonitor.log(id, logMessage, logLevel || 'info');
  }

  res.json({ success: true, data: agentMonitor.getAgent(id) });
});

// GET /agents/logs
router.get('/agents/logs', (req, res) => {
  const allLogs = [];
  for (const agent of agentMonitor.getAllAgents()) {
    for (const log of agent.logs) {
      allLogs.push({
        agentId: agent.id,
        agentName: agent.name,
        ...log
      });
    }
  }
  // Sort chronologically, latest first
  allLogs.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ success: true, data: allLogs.slice(0, 100) });
});

export default router;
