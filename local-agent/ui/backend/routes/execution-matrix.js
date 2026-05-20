// local-agent/ui/backend/routes/execution-matrix.js
import { Router } from 'express';
import { GlobalTaskMatrix } from '../../../execution-matrix/GlobalTaskMatrix.js';
import { ExecutionCascadeEngine } from '../../../execution-matrix/ExecutionCascadeEngine.js';
import { ExecutionPressureMap } from '../../../execution-matrix/ExecutionPressureMap.js';

const router = Router();
const taskMatrix = new GlobalTaskMatrix();
const cascadeEngine = new ExecutionCascadeEngine();
const pressureMap = new ExecutionPressureMap();

// GET /api/execution-matrix/tasks
router.get('/tasks', (req, res) => {
  try {
    const result = taskMatrix.buildMatrix();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/execution-matrix/cascade-predict
router.post('/cascade-predict', (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId required' });
  try {
    const matrix = taskMatrix.buildMatrix();
    const result = cascadeEngine.predictCascade(taskId, matrix);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/execution-matrix/pressure
router.get('/pressure', (req, res) => {
  try {
    const result = pressureMap.getPressure();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
