// routes/reports.js — list and view reports
import { Router } from 'express';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname, basename } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { logger } from '../../../core/logger.js';

const router = Router();

function safeResolve(...parts) {
  const abs = resolve(...parts);
  if (!abs.startsWith(PROJECT_ROOT + '/') && abs !== PROJECT_ROOT) return null;
  return abs;
}

function reportsDir() {
  return safeResolve(PROJECT_ROOT, '.local-agent', 'reports');
}

// GET /reports
router.get('/reports', (req, res) => {
  try {
    const dir = reportsDir();
    if (!dir || !existsSync(dir)) {
      return res.json({ success: true, data: [] });
    }

    const entries = readdirSync(dir)
      .filter((f) => f.endsWith('.json') || f.endsWith('.md'))
      .map((f) => {
        const abs = join(dir, f);
        const st = statSync(abs);
        const type = f.startsWith('qa-report')   ? 'qa'
                   : f.startsWith('scan-report')  ? 'scan'
                   : f.startsWith('patch-')        ? 'patch'
                   : 'other';
        return {
          filename:  f,
          type,
          size:      st.size,
          createdAt: st.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    logger.fileOnly('info', 'ui: GET /reports', { count: entries.length });
    res.json({ success: true, data: entries });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /reports failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /reports/:filename
router.get('/reports/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    // Only allow .json and .md files
    const ext = extname(filename).toLowerCase();
    if (ext !== '.json' && ext !== '.md') {
      return res.status(400).json({ success: false, error: 'Only .json and .md reports are accessible' });
    }

    const dir = reportsDir();
    if (!dir) return res.status(403).json({ success: false, error: 'Reports directory not accessible' });

    const filePath = safeResolve(join(dir, filename));
    if (!filePath || !existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const content = readFileSync(filePath, 'utf8');
    logger.fileOnly('info', 'ui: GET /reports/:filename', { filename });

    if (ext === '.json') {
      res.json({ success: true, data: JSON.parse(content) });
    } else {
      res.json({ success: true, data: content });
    }
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /reports/:filename failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
