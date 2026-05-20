// local-agent/ui/backend/routes/meta-reality.js
import { Router } from 'express';
import { MetaRealityGraph } from '../../../meta-reality/MetaRealityGraph.js';
import { RealityStabilityEngine } from '../../../meta-reality/RealityStabilityEngine.js';

const router = Router();
const graphEngine = new MetaRealityGraph();
const stabilityEngine = new RealityStabilityEngine();

// GET /api/meta-reality/graph
router.get('/graph', (req, res) => {
  try {
    const result = graphEngine.buildGraph();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/meta-reality/stability
router.get('/stability', (req, res) => {
  try {
    const result = stabilityEngine.computePhysics();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
