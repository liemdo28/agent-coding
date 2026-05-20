import { Router } from 'express';
import { TaskQueueManager } from '../../../orchestration/TaskQueueManager.js';
import { logger } from '../../../core/logger.js';

const router = Router();
const queueManager = new TaskQueueManager();

// Pre-populate with some beautiful mock tasks if empty
if (queueManager.queue.length === 0) {
  queueManager.addTask('Optimize database indices for user audit logs', { level: 'HIGH', score: 8.2, factors: { urgency: 8, complexity: 5 } });
  queueManager.addTask('Implement JWT token rotation for security compliance', { level: 'CRITICAL', score: 9.5, factors: { urgency: 10, complexity: 6 } });
  queueManager.addTask('Resolve memory leak in file uploads stream', { level: 'HIGH', score: 8.8, factors: { urgency: 9, complexity: 7 } });
  queueManager.addTask('Update local project health UI components', { level: 'MEDIUM', score: 5.4, factors: { urgency: 5, complexity: 3 } });
}

// GET /api/queue
router.get('/queue', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        queue: queueManager.queue,
        history: queueManager.history
      }
    });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /queue failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/queue/add
router.post('/queue/add', (req, res) => {
  try {
    const { task, priority } = req.body;
    if (!task) {
      return res.status(400).json({ success: false, error: 'Task details are required' });
    }
    const added = queueManager.addTask(task, priority || {});
    res.json({ success: true, data: added });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /queue/add failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
