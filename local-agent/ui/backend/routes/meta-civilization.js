// local-agent/ui/backend/routes/meta-civilization.js
import { Router } from 'express';
import { CivilizationStateEngine } from '../../../meta-civilization/CivilizationStateEngine.js';
import { CivilizationStabilityIndex } from '../../../meta-civilization/CivilizationStabilityIndex.js';

const router = Router();
const stateEngine = new CivilizationStateEngine();
const stabilityEngine = new CivilizationStabilityIndex();

// GET /api/meta-civilization/state
router.get('/state', (req, res) => {
  try {
    const result = stateEngine.getGlobalState();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/meta-civilization/stability
router.get('/stability', (req, res) => {
  try {
    const result = stabilityEngine.computeIndex();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
