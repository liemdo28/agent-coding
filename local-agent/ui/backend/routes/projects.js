// routes/projects.js — Multi-project registry endpoints
import { Router } from 'express';
import { listProjects } from '../../../orchestrator/ProjectRegistry.js';
import { checkHealthAll, generateHealthSummary } from '../../../orchestrator/ProjectHealthMonitor.js';

const router = Router();

// GET /projects
// Returns the full list of registered projects from the global registry.
// Responds gracefully if the global directory does not exist yet.
router.get('/projects', (_req, res) => {
  try {
    const projects = listProjects();
    res.json({ success: true, data: projects });
  } catch (err) {
    // Global dir may not exist — return an empty list rather than a 500
    res.json({ success: true, data: [] });
  }
});

// GET /projects/health
// Returns health status for every registered project plus a summary.
router.get('/projects/health', (_req, res) => {
  try {
    const projects     = listProjects();
    const withHealth   = checkHealthAll(projects);
    const summary      = generateHealthSummary(withHealth);
    res.json({ success: true, data: { projects: withHealth, summary } });
  } catch (err) {
    res.json({ success: true, data: { projects: [], summary: { total: 0, healthy: 0, warning: 0, fail: 0, unknown: 0, needsAttention: [] } } });
  }
});

export default router;
