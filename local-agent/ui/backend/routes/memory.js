// routes/memory.js — memory file list and clear
import { Router } from 'express';
import { existsSync, readdirSync, statSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { logger } from '../../../core/logger.js';

const router = Router();

function safeResolve(...parts) {
  const abs = resolve(...parts);
  if (!abs.startsWith(PROJECT_ROOT + '/') && abs !== PROJECT_ROOT) return null;
  return abs;
}

const memoryDir = () => safeResolve(PROJECT_ROOT, '.local-agent', 'memory');

// GET /memory
router.get('/memory', (req, res) => {
  try {
    const dir = memoryDir();
    if (!dir || !existsSync(dir)) {
      return res.json({ success: true, data: [] });
    }

    const files = readdirSync(dir)
      .filter((f) => !f.startsWith('.'))
      .map((f) => {
        const abs = join(dir, f);
        const st = statSync(abs);
        return {
          filename:  f,
          size:      st.size,
          createdAt: st.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    logger.fileOnly('info', 'ui: GET /memory', { count: files.length });
    res.json({ success: true, data: files });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /memory failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /memory — clear all memory files
router.delete('/memory', (req, res) => {
  try {
    const dir = memoryDir();
    if (!dir || !existsSync(dir)) {
      return res.json({ success: true, data: { cleared: 0 } });
    }

    const files = readdirSync(dir).filter((f) => !f.startsWith('.'));
    let cleared = 0;
    for (const f of files) {
      const abs = safeResolve(join(dir, f));
      if (!abs) continue;
      try {
        rmSync(abs, { force: true });
        cleared++;
      } catch { /* skip files that fail */ }
    }

    logger.fileOnly('info', 'ui: DELETE /memory', { cleared });
    res.json({ success: true, data: { cleared } });
  } catch (err) {
    logger.fileOnly('error', 'ui: DELETE /memory failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
