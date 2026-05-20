// routes/memory.js — Express Router for Global Memory API
import { Router } from 'express';
import { globalMemory } from '../../../memory/GlobalMemoryManager.js';

const router = Router();

// GET /memory/stats
router.get('/memory/stats', (req, res) => {
  res.json({ success: true, data: globalMemory.getStats() });
});

// GET /memory/semantic
router.get('/memory/semantic', (req, res) => {
  res.json({ success: true, data: globalMemory.memory.semantic });
});

// POST /memory/semantic
router.post('/memory/semantic', (req, res) => {
  const { key, value } = req.body ?? {};
  if (!key || !value) {
    return res.status(400).json({ success: false, error: 'key and value are required' });
  }
  globalMemory.storeSemantic(key, value);
  res.json({ success: true, key, value });
});

// GET /memory/semantic/search
router.get('/memory/semantic/search', (req, res) => {
  const query = req.query.q || '';
  res.json({ success: true, data: globalMemory.searchSemantic(query) });
});

// GET /memory/tasks
router.get('/memory/tasks', (req, res) => {
  res.json({ success: true, data: globalMemory.memory.tasks });
});

// GET /memory/prompts
router.get('/memory/prompts', (req, res) => {
  res.json({ success: true, data: globalMemory.memory.prompts });
});

// GET /memory/fixes
router.get('/memory/fixes', (req, res) => {
  res.json({ success: true, data: globalMemory.memory.fixes });
});

export default router;
