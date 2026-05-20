// local-agent/ui/backend/routes/world-model.js
import { Router } from 'express';
import { SystemUnderstandingEngine } from '../../../world-model/SystemUnderstandingEngine.js';
import { CausalReasoningEngine } from '../../../world-model/CausalReasoningEngine.js';
import { OrganizationalGraph } from '../../../world-model/OrganizationalGraph.js';

const router = Router();
const systemUnderstanding = new SystemUnderstandingEngine();
const causalReasoning = new CausalReasoningEngine();
const orgGraph = new OrganizationalGraph();

// GET /api/world-model/system-understanding/:alias
router.get('/system-understanding/:alias', async (req, res) => {
  const { alias } = req.params;
  try {
    const result = await systemUnderstanding.understandSystem(alias);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/world-model/causal-reasoning
router.post('/causal-reasoning', async (req, res) => {
  const { event } = req.body;
  if (!event) {
    return res.status(400).json({ success: false, error: 'Event is required' });
  }
  try {
    const result = causalReasoning.reason(event);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/world-model/organizational-graph
router.get('/organizational-graph', async (req, res) => {
  try {
    const result = orgGraph.buildGraph();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
