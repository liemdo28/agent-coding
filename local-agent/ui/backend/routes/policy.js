// routes/policy.js — policy check endpoints
import { Router } from 'express';
import { PROJECT_ROOT } from '../server.js';
import { loadConfig } from '../../../core/config.js';
import { runPolicyChecks } from '../../../core/policy.js';
import { logger } from '../../../core/logger.js';

const router = Router();

function doPolicyCheck() {
  const config = loadConfig(PROJECT_ROOT);
  return runPolicyChecks(PROJECT_ROOT, config);
}

// GET /policy/status
router.get('/policy/status', (req, res) => {
  try {
    const result = doPolicyCheck();
    logger.fileOnly('info', 'ui: GET /policy/status', { passed: result.passed });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /policy/status failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /policy/check — forces fresh check
router.post('/policy/check', (req, res) => {
  try {
    const result = doPolicyCheck();
    logger.fileOnly('info', 'ui: POST /policy/check', { passed: result.passed });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /policy/check failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
