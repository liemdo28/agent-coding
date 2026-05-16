// routes/patches.js — patch list, apply, reject, rollback endpoints
import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, basename } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { logger } from '../../../core/logger.js';
import { applyFilePatch, rollbackFile } from '../../../debug/SafeFixExecutor.js';

const router = Router();

const patchesDir = () => join(PROJECT_ROOT, '.local-agent', 'patches');
const backupsDir = () => join(PROJECT_ROOT, '.local-agent', 'backups');

// Guard: path must stay within project root
function safeResolve(...parts) {
  const abs = resolve(...parts);
  if (!abs.startsWith(PROJECT_ROOT + '/') && abs !== PROJECT_ROOT) return null;
  return abs;
}

function readPatch(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    // Try JSON first (structured patch)
    try {
      const p = JSON.parse(raw);
      return p;
    } catch {
      // Plain unified diff file — synthesize a minimal object
      const name = basename(filePath, '.patch');
      const parts = name.split('.');
      return {
        id:        name,
        task:      `Patch: ${parts[0]}`,
        status:    'pending',
        riskLevel: 'medium',
        patchText: raw,
        filesChanged: [parts[0] ?? 'unknown'],
        createdAt: new Date(parseInt(parts[1] ?? Date.now())).toISOString(),
      };
    }
  } catch {
    return null;
  }
}

function getPatchFiles() {
  const dir = patchesDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') || f.endsWith('.patch'))
    .map((f) => join(dir, f));
}

// GET /patches
router.get('/patches', (req, res) => {
  try {
    const files = getPatchFiles();
    const patches = files
      .map(readPatch)
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));

    logger.fileOnly('info', 'ui: GET /patches', { count: patches.length });
    res.json({ success: true, data: patches });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /patches failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /patches/:id
router.get('/patches/:id', (req, res) => {
  try {
    const { id } = req.params;
    // Prevent path traversal
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid patch id' });
    }

    const dir = patchesDir();
    const candidates = [`${id}.json`, `${id}.patch`, id].map((f) => join(dir, f));
    let patch = null;
    for (const c of candidates) {
      const safe = safeResolve(c);
      if (safe && existsSync(safe)) {
        patch = readPatch(safe);
        break;
      }
    }

    if (!patch) return res.status(404).json({ success: false, error: 'Patch not found' });

    logger.fileOnly('info', 'ui: GET /patches/:id', { id });
    res.json({ success: true, data: patch });
  } catch (err) {
    logger.fileOnly('error', 'ui: GET /patches/:id failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /patches/:id/apply  — EXPLICIT button click required (never auto-applied)
router.post('/patches/:id/apply', (req, res) => {
  try {
    const { id } = req.params;
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid patch id' });
    }

    const dir = patchesDir();
    const candidates = [`${id}.json`, `${id}.patch`, id].map((f) => join(dir, f));
    let patch = null;
    let patchFilePath = null;
    for (const c of candidates) {
      const safe = safeResolve(c);
      if (safe && existsSync(safe)) {
        patch = readPatch(safe);
        patchFilePath = safe;
        break;
      }
    }

    if (!patch) return res.status(404).json({ success: false, error: 'Patch not found' });
    if (patch.status === 'applied') {
      return res.status(400).json({ success: false, error: 'Patch already applied' });
    }

    // Apply each file in the patch
    const results = [];
    const fileChanges = patch.filesChanged ?? [patch.filePath].filter(Boolean);
    const patchText   = patch.patchText ?? patch.diff ?? '';

    if (!patchText) {
      return res.status(400).json({ success: false, error: 'No patch content to apply' });
    }

    const result = applyFilePatch(
      fileChanges[0] ?? 'unknown',
      patchText,
      PROJECT_ROOT,
      backupsDir()
    );
    results.push(result);

    if (result.success) {
      // Update patch status
      patch.status = 'applied';
      patch.appliedAt = new Date().toISOString();
      if (patchFilePath && patchFilePath.endsWith('.json')) {
        writeFileSync(patchFilePath, JSON.stringify(patch, null, 2), 'utf8');
      }
    }

    logger.fileOnly('info', 'ui: POST /patches/:id/apply', { id, success: result.success });
    res.json({ success: result.success, data: { id, results } });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /patches/:id/apply failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /patches/:id/reject
router.post('/patches/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid patch id' });
    }

    const dir = patchesDir();
    let patchFilePath = null;
    let patch = null;
    for (const suffix of ['.json', '.patch', '']) {
      const candidate = safeResolve(join(dir, id + suffix));
      if (candidate && existsSync(candidate)) {
        patchFilePath = candidate;
        patch = readPatch(candidate);
        break;
      }
    }

    if (!patch) return res.status(404).json({ success: false, error: 'Patch not found' });

    patch.status     = 'rejected';
    patch.rejectedAt = new Date().toISOString();

    if (patchFilePath && patchFilePath.endsWith('.json')) {
      writeFileSync(patchFilePath, JSON.stringify(patch, null, 2), 'utf8');
    }

    logger.fileOnly('info', 'ui: POST /patches/:id/reject', { id });
    res.json({ success: true, data: { id, status: 'rejected' } });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /patches/:id/reject failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /patches/:id/rollback
router.post('/patches/:id/rollback', (req, res) => {
  try {
    const { id } = req.params;
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid patch id' });
    }

    const dir = patchesDir();
    let patchFilePath = null;
    let patch = null;
    for (const suffix of ['.json', '']) {
      const candidate = safeResolve(join(dir, id + suffix));
      if (candidate && existsSync(candidate)) {
        patchFilePath = candidate;
        patch = readPatch(candidate);
        break;
      }
    }

    if (!patch) return res.status(404).json({ success: false, error: 'Patch not found' });
    if (patch.status !== 'applied') {
      return res.status(400).json({ success: false, error: 'Patch is not in applied state' });
    }

    // Find backup path from patch record
    const backupPath = patch.backupPath ?? patch.results?.[0]?.backupPath;
    if (!backupPath) {
      return res.status(400).json({ success: false, error: 'No backup path recorded for this patch' });
    }

    const targetFile = patch.filesChanged?.[0] ?? patch.filePath;
    const targetAbs  = safeResolve(PROJECT_ROOT, targetFile);
    if (!targetAbs) {
      return res.status(400).json({ success: false, error: 'Invalid target file path' });
    }

    const result = rollbackFile(backupPath, targetAbs, PROJECT_ROOT);

    if (result.success) {
      patch.status      = 'rolled_back';
      patch.rolledBackAt = new Date().toISOString();
      if (patchFilePath && patchFilePath.endsWith('.json')) {
        writeFileSync(patchFilePath, JSON.stringify(patch, null, 2), 'utf8');
      }
    }

    logger.fileOnly('info', 'ui: POST /patches/:id/rollback', { id, success: result.success });
    res.json({ success: result.success, data: result });
  } catch (err) {
    logger.fileOnly('error', 'ui: POST /patches/:id/rollback failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
