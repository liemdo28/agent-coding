// routes/project.js — project status and scan endpoints
import { Router } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { isWorkspaceInitialized } from '../../../core/workspace.js';
import { loadConfig } from '../../../core/config.js';
import { scanProject } from '../../../scanner/scanner.js';
import { logger } from '../../../core/logger.js';

const router = Router();

// Safely resolve a path inside the project root; returns null if it escapes
function safeResolve(...parts) {
  const abs = resolve(...parts);
  if (!abs.startsWith(PROJECT_ROOT)) return null;
  return abs;
}

function stripSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  // Never surface hardcoded-secret snippet values in API responses
  if (Array.isArray(obj)) return obj.map(stripSecrets);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'snippet' || k === 'value' || k === 'token' || k === 'password') {
      result[k] = '[REDACTED]';
    } else {
      result[k] = stripSecrets(v);
    }
  }
  return result;
}

// GET /project/status
router.get('/project/status', async (req, res) => {
  try {
    const initialized = isWorkspaceInitialized(PROJECT_ROOT);
    const projectName = basename(PROJECT_ROOT);

    // Load project-map.json if present
    const mapPath = safeResolve(PROJECT_ROOT, '.local-agent', 'project-map.json');
    let projectMap = null;
    if (mapPath && existsSync(mapPath)) {
      try { projectMap = JSON.parse(readFileSync(mapPath, 'utf8')); } catch { /* ignore */ }
    }

    // Load latest QA report
    const reportsDir = safeResolve(PROJECT_ROOT, '.local-agent', 'reports');
    let latestQA = null;
    if (reportsDir && existsSync(reportsDir)) {
      const { readdirSync } = await import('fs');
      const qaFiles = readdirSync(reportsDir)
        .filter((f) => f.startsWith('qa-report-') && f.endsWith('.json'))
        .sort()
        .reverse();
      if (qaFiles.length > 0) {
        try {
          latestQA = JSON.parse(readFileSync(join(reportsDir, qaFiles[0]), 'utf8'));
        } catch { /* ignore */ }
      }
    }

    const data = {
      initialized,
      projectName,
      projectRoot: PROJECT_ROOT,
      framework:   projectMap?.frameworks?.[0] ?? null,
      language:    projectMap?.languages?.[0]  ?? null,
      pkgManager:  projectMap?.packageManager  ?? null,
      fileCount:   projectMap?.stats?.totalFiles ?? 0,
      todoCount:   projectMap?.todos?.length    ?? 0,
      secretCount: projectMap?.risks?.hardcodedSecrets?.length ?? 0,
      lastScan:    projectMap?.scannedAt        ?? null,
      qaScore:     latestQA?.qaScore?.total     ?? null,
    };

    logger.fileOnly('info', 'ui: GET /project/status', { initialized });
    res.json({ success: true, data });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /project/status failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /project/scan
router.post('/project/scan', async (req, res) => {
  try {
    const config = loadConfig(PROJECT_ROOT);
    logger.fileOnly('info', 'ui: POST /project/scan started');
    const projectMap = await scanProject(PROJECT_ROOT, config);
    logger.fileOnly('info', 'ui: POST /project/scan done', { files: projectMap.stats.totalFiles });
    res.json({ success: true, data: stripSecrets(projectMap) });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /project/scan failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
