// routes/reasoning.js — Express Router for AI Reasoning Engine API
import { Router } from 'express';
import { reasoningEngine } from '../../../ai-reasoning/ReasoningEngine.js';

const router = Router();

// GET /reasoning/steps
router.get('/reasoning/steps', (req, res) => {
  res.json({ success: true, data: reasoningEngine.getSteps(), progress: reasoningEngine.getProgress() });
});

// GET /reasoning/timeline
router.get('/reasoning/timeline', (req, res) => {
  res.json({ success: true, data: reasoningEngine.toTimeline() });
});

// POST /reasoning/clear
router.post('/reasoning/clear', (req, res) => {
  reasoningEngine.clear();
  res.json({ success: true, message: 'Reasoning history cleared' });
});

export default router;
