// routes/cognition.js — Express Router for Cognitive Task Planner & Decision Graph
import { Router } from 'express';
import { cognitiveTaskPlanner } from '../../../ai-reasoning/CognitiveTaskPlanner.js';
import { logger } from '../../../core/logger.js';

const router = Router();

// Store active plan in memory to serve on decision-graph endpoint
let currentPlan = null;

// Populate initial mock plan if empty
const defaultGoal = 'Optimize performance leak & configure JWT session verification on rawwwebsite';
try {
  currentPlan = cognitiveTaskPlanner.plan(defaultGoal);
} catch (e) {
  logger.fileOnly('error', 'cognition: failed to initialize default plan', { error: e.message });
}

// POST /api/cognition/plan
router.post('/cognition/plan', (req, res) => {
  try {
    const { goal } = req.body ?? {};
    if (!goal || typeof goal !== 'string' || goal.trim() === '') {
      return res.status(400).json({ success: false, error: 'goal parameter is required' });
    }

    const plan = cognitiveTaskPlanner.plan(goal);
    currentPlan = plan;

    res.json({
      success: true,
      data: plan
    });
  } catch (err) {
    logger.fileOnly('error', 'cognition: POST /cognition/plan failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/cognition/decision-graph
router.get('/cognition/decision-graph', (req, res) => {
  try {
    if (!currentPlan) {
      return res.status(404).json({ success: false, error: 'No active cognitive plan found' });
    }
    res.json({
      success: true,
      data: currentPlan.decisionGraph
    });
  } catch (err) {
    logger.fileOnly('error', 'cognition: GET /cognition/decision-graph failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
