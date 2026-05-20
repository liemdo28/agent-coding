// routes/reasoning.js — Express Router for AI Reasoning Engine API
import { Router } from 'express';
import { reasoningEngine } from '../../../ai-reasoning/ReasoningEngine.js';

const router = Router();

// GET /reasoning/steps
router.get('/reasoning/steps', (req, res) => {
  res.json({ success: true, data: reasoningEngine.getSteps(), progress: reasoningEngine.getProgress() });
});

// GET /reasoning/stream - SSE connection for live updates
router.get('/reasoning/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial data
  res.write(`data: ${JSON.stringify({ type: 'init', steps: reasoningEngine.getSteps(), progress: reasoningEngine.getProgress() })}\n\n`);

  // Subscribe to real-time events
  const unsubscribe = reasoningEngine.subscribe((event, data) => {
    res.write(`data: ${JSON.stringify({ type: event, data, progress: reasoningEngine.getProgress() })}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
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
