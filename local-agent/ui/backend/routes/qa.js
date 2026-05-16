// routes/qa.js — QA run and status endpoints
import { Router } from 'express';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { logger } from '../../../core/logger.js';
import { runQA } from '../../../qa/QAEngine.js';

const router = Router();

function safeResolve(...parts) {
  const abs = resolve(...parts);
  if (!abs.startsWith(PROJECT_ROOT + '/') && abs !== PROJECT_ROOT) return null;
  return abs;
}

function latestQAReport() {
  const reportsDir = safeResolve(PROJECT_ROOT, '.local-agent', 'reports');
  if (!reportsDir || !existsSync(reportsDir)) return null;
  const files = readdirSync(reportsDir)
    .filter((f) => f.startsWith('qa-report-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  try {
    return JSON.parse(readFileSync(join(reportsDir, files[0]), 'utf8'));
  } catch {
    return null;
  }
}

// GET /qa/status
router.get('/qa/status', (req, res) => {
  try {
    const report = latestQAReport();
    if (!report) {
      return res.json({ success: true, data: null, message: 'No QA report found — run QA first' });
    }
    logger.fileOnly('info', 'ui: GET /qa/status');
    res.json({ success: true, data: report });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /qa/status failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /qa/run
router.post('/qa/run', async (req, res) => {
  try {
    const { deep = false, autoFix = false } = req.body ?? {};
    logger.fileOnly('info', 'ui: POST /qa/run', { deep, autoFix });

    const result = await runQA(PROJECT_ROOT, {
      deep,
      autoFix,
      onProgress: (p) => logger.fileOnly('info', 'qa:progress', p),
    });

    logger.fileOnly('info', 'ui: POST /qa/run done', { score: result.qaScore?.total });
    res.json({ success: true, data: result.report });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /qa/run failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
