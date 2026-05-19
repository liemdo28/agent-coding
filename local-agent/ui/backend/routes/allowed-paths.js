// routes/allowed-paths.js — manage config.allowedPaths via REST
// Reads / writes <PROJECT_ROOT>/.local-agent/config.json (user config layer)
// Never touches default.json — only the user-override layer.

import { Router }                                       from 'express';
import { existsSync, mkdirSync, readdirSync, statSync,
         readFileSync, writeFileSync }                  from 'fs';
import { join, resolve, basename }                      from 'path';
import { PROJECT_ROOT }                                 from '../server.js';
import { validateAllowedPath }                          from '../../../core/policy.js';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────

const USER_CONFIG_PATH = () => join(PROJECT_ROOT, '.local-agent', 'config.json');

function readUserConfig() {
  const p = USER_CONFIG_PATH();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

function writeUserConfig(cfg) {
  const dir = join(PROJECT_ROOT, '.local-agent');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(USER_CONFIG_PATH(), JSON.stringify(cfg, null, 2), 'utf8');
}

function getAllowedPaths() {
  return (readUserConfig().allowedPaths ?? []).map((p) => resolve(p));
}

/**
 * Scan a directory for project roots (markers: .git, package.json, pyproject.toml).
 * Depth limited to avoid scanning deep trees.
 */
function scanProjects(dirPath, maxDepth = 2) {
  const MARKERS = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
  const results = [];

  function scan(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const sub = join(dir, entry.name);
      const hasMarker = MARKERS.some((m) => existsSync(join(sub, m)));
      if (hasMarker) {
        results.push({ name: basename(sub), path: sub });
      } else {
        scan(sub, depth + 1);
      }
    }
  }

  scan(dirPath, 0);
  return results;
}

// ── GET /api/allowed-paths ────────────────────────────────────────────────────

router.get('/allowed-paths', (_req, res) => {
  const paths = getAllowedPaths();

  // For each path, include project count
  const entries = paths.map((p) => {
    let exists = false;
    let projects = [];
    try {
      statSync(p);
      exists   = true;
      projects = scanProjects(p);
    } catch { /* path might not exist */ }
    return { path: p, exists, projectCount: projects.length, projects };
  });

  // Also count projects in PROJECT_ROOT itself
  const rootProjects = scanProjects(PROJECT_ROOT);

  res.json({
    projectRoot: PROJECT_ROOT,
    allowedPaths: entries,
    rootProjects: { path: PROJECT_ROOT, projects: rootProjects },
    totalPaths: entries.length,
  });
});

// ── POST /api/allowed-paths — add a path ─────────────────────────────────────

router.post('/allowed-paths', (req, res) => {
  const rawPath = req.body?.path;
  if (!rawPath || typeof rawPath !== 'string') {
    return res.status(400).json({ error: 'Missing field: path' });
  }

  // Validate
  const validation = validateAllowedPath(rawPath);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.reason });
  }
  const absPath = validation.abs;

  // Prevent duplicate
  const current = getAllowedPaths();
  if (current.includes(absPath)) {
    return res.status(409).json({ error: `Đường dẫn đã có trong danh sách: ${absPath}` });
  }

  // Prevent adding the PROJECT_ROOT itself (it's always allowed already)
  if (absPath === resolve(PROJECT_ROOT)) {
    return res.status(409).json({ error: 'PROJECT_ROOT luôn được phép — không cần thêm.' });
  }

  const cfg = readUserConfig();
  cfg.allowedPaths = [...(cfg.allowedPaths ?? []), absPath];
  writeUserConfig(cfg);

  res.json({ ok: true, path: absPath, allowedPaths: cfg.allowedPaths });
});

// ── DELETE /api/allowed-paths — remove a path ────────────────────────────────

router.delete('/allowed-paths', (req, res) => {
  const rawPath = req.body?.path;
  if (!rawPath) return res.status(400).json({ error: 'Missing field: path' });

  const absPath = resolve(rawPath);
  const cfg = readUserConfig();
  const before = (cfg.allowedPaths ?? []).map((p) => resolve(p));
  const after  = before.filter((p) => p !== absPath);

  if (before.length === after.length) {
    return res.status(404).json({ error: 'Đường dẫn không có trong danh sách' });
  }

  cfg.allowedPaths = after;
  writeUserConfig(cfg);
  res.json({ ok: true, removed: absPath, allowedPaths: after });
});

// ── GET /api/allowed-paths/projects — list all projects across allowed paths ──

router.get('/allowed-paths/projects', (_req, res) => {
  const paths = [PROJECT_ROOT, ...getAllowedPaths()];
  const allProjects = [];

  for (const p of paths) {
    const projects = scanProjects(p);
    allProjects.push(...projects.map((proj) => ({ ...proj, root: p })));
  }

  // Deduplicate by path
  const seen = new Set();
  const unique = allProjects.filter((p) => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });

  res.json({
    total:    unique.length,
    projects: unique,
    scannedRoots: paths,
  });
});

export default router;
