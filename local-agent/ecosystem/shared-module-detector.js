/**
 * Phase 21 - Shared Module Detector
 * Detects duplicated systems across projects and suggests shared packages,
 * monorepo extraction, and internal SDKs.
 *
 * Reference: deploymentTracker.js (SQLite-backed), KnowledgeGraph.js (store facade)
 */

import { createRequire } from 'module';
import { readdirSync, statSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'ecosystem-shared-modules.db');
const DUPLICATION_THRESHOLD = 0.7;
const IGNORE_PATHS = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv'];
const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.java', '.go', '.cs'];

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export function openSharedModulesDB(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      path       TEXT UNIQUE,
      scanned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS modules (
      id             TEXT PRIMARY KEY,
      project_id     TEXT,
      relative_path  TEXT,
      extension      TEXT,
      signature      TEXT,
      content_hash   TEXT,
      size_kb        REAL,
      lines          INTEGER,
      scanned_at     TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS duplicate_groups (
      id         TEXT PRIMARY KEY,
      type       TEXT,
      score      REAL,
      category   TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mod_project ON modules(project_id);
    CREATE INDEX IF NOT EXISTS idx_mod_hash   ON modules(content_hash);
  `);

  return db;
}

// ---------------------------------------------------------------------------
// Core Detection API
// ---------------------------------------------------------------------------

/**
 * Detect duplicated systems across multiple project directories.
 * @param {string[]} projectPaths
 * @param {object}   options
 * @param {number}   [options.minDuplicationScore=0.5]
 * @param {number}   [options.maxFileSizeKB=500]
 * @param {boolean}  [options.persistToDB=true]
 * @returns {object} Detection results
 */
export function detectSharedModules(projectPaths, options = {}) {
  const { minDuplicationScore = 0.5, maxFileSizeKB = 500, persistToDB = true } = options;

  const db = persistToDB ? openSharedModulesDB() : null;
  const projectModules = new Map();

  for (const projectPath of projectPaths) {
    if (!existsSync(projectPath)) {
      console.warn(`[shared-module-detector] Skipping missing path: ${projectPath}`);
      continue;
    }
    const modules = extractModules(projectPath, IGNORE_PATHS, maxFileSizeKB);
    projectModules.set(projectPath, modules);
    if (db) persistProject(db, projectPath, modules);
  }

  const duplicates = findDuplicates(projectModules, minDuplicationScore);
  const categorized = categorizeDuplications(duplicates);
  const recommendations = generateRecommendations(categorized);

  if (db) { persistDuplicates(db, duplicates, categorized); db.close(); }

  return {
    projects: Array.from(projectModules.keys()),
    totalProjects: projectModules.size,
    duplicateGroups: duplicates.length,
    categories: categorized,
    recommendations,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Analyze a single project for internal duplications (same filename, mirrored structure).
 * @param {string} projectPath
 * @returns {object}
 */
export function analyzeProjectDuplication(projectPath) {
  if (!existsSync(projectPath)) throw new Error(`Project path does not exist: ${projectPath}`);

  const modules = extractModules(projectPath, IGNORE_PATHS, 500);
  const duplicates = [];

  // Same filename across different subdirectories
  const byName = new Map();
  for (const mod of modules) {
    const name = basename(mod.path);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(mod);
  }
  for (const [name, mods] of byName) {
    if (mods.length > 1) {
      duplicates.push({
        type: 'same_filename',
        name,
        locations: mods.map(m => ({ path: m.relativePath, lines: m.lines, sizeKB: m.sizeKB })),
      });
    }
  }

  // Mirrored structure
  const byRelative = new Map();
  for (const mod of modules) {
    const rel = mod.relativePath.replace(/\\/g, '/');
    const key = rel.split('/').slice(-2).join('/');
    if (!byRelative.has(key)) byRelative.set(key, []);
    byRelative.get(key).push(mod);
  }
  for (const [key, mods] of byRelative) {
    if (mods.length < 2) continue;
    const sim = signatureSimilarity(mods[0].signature, mods[1].signature);
    if (sim >= DUPLICATION_THRESHOLD) {
      duplicates.push({
        type: 'mirrored_structure',
        structure: key,
        locations: mods.map(m => ({ path: m.relativePath, lines: m.lines, similarity: parseFloat(sim.toFixed(2)) })),
      });
    }
  }

  const totalDuplicateLines = duplicates.reduce((sum, d) => {
    if (d.type === 'same_filename') {
      const maxLines = Math.max(...d.locations.map(l => l.lines));
      return sum + maxLines * (d.locations.length - 1);
    }
    return sum;
  }, 0);

  return {
    projectPath,
    totalModules: modules.length,
    duplicateGroups: duplicates.length,
    totalDuplicateLines,
    duplicates,
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Module Extraction
// ---------------------------------------------------------------------------

function extractModules(projectPath, ignorePaths, maxFileSizeKB) {
  const modules = [];

  function walk(dir, relativePath = '') {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || ignorePaths.some(p => entry.name === p)) continue;
        const fullPath = join(dir, entry.name);
        const relPath = join(relativePath, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile() && SOURCE_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
          try {
            const sizeKB = statSync(fullPath).size / 1024;
            if (sizeKB > maxFileSizeKB) continue;
            const content = readFileSync(fullPath, 'utf8');
            modules.push({
              path: fullPath,
              relativePath: relPath,
              extension: extname(entry.name).toLowerCase(),
              signature: computeSignature(content),
              contentHash: computeHash(content),
              sizeKB,
              lines: content.split('\n').length,
            });
          } catch { /* skip unreadable */ }
        }
      }
    } catch { /* skip inaccessible */ }
  }

  walk(projectPath);
  return modules;
}

function computeSignature(content) {
  return content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'[^']*'/g, "'X'")
    .replace(/"[^"]*"/g, '"X"')
    .replace(/`[^`]*`/g, '`X`')
    .replace(/#.*$/gm, '')
    .replace(/\b\d+\b/g, 'N')
    .replace(/\b[a-f0-9]{8,}\b/g, 'HASH')
    .replace(/localhost:\d+/g, 'localhost:PORT')
    .replace(/\/[Uu]sers\/[^\/]+/g, '/Users/USER')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

function computeHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Duplicate Finding
// ---------------------------------------------------------------------------

function findDuplicates(projectModules, minScore) {
  const groups = [];
  const matched = new Set();

  const allModules = [];
  for (const [projectPath, mods] of projectModules) {
    for (const mod of mods) allModules.push({ ...mod, projectPath });
  }

  // Exact hash match
  const byHash = new Map();
  for (const mod of allModules) {
    if (!byHash.has(mod.contentHash)) byHash.set(mod.contentHash, []);
    byHash.get(mod.contentHash).push(mod);
  }
  for (const [hash, mods] of byHash) {
    if (mods.length < 2) continue;
    groups.push({ type: 'exact', score: 1.0, modules: serializeModules(mods) });
    mods.forEach(m => matched.add(`${m.projectPath}::${m.relativePath}`));
  }

  // Fuzzy signature match per extension
  const byExt = new Map();
  for (const mod of allModules) {
    if (matched.has(`${mod.projectPath}::${mod.relativePath}`)) continue;
    if (!byExt.has(mod.extension)) byExt.set(mod.extension, []);
    byExt.get(mod.extension).push(mod);
  }
  for (const [ext, mods] of byExt) {
    for (let i = 0; i < mods.length; i++) {
      if (matched.has(`${mods[i].projectPath}::${mods[i].relativePath}`)) continue;
      let group = [mods[i]];
      let bestScore = 0;
      for (let j = i + 1; j < mods.length; j++) {
        if (matched.has(`${mods[j].projectPath}::${mods[j].relativePath}`)) continue;
        const score = signatureSimilarity(mods[i].signature, mods[j].signature);
        if (score >= minScore) {
          group.push(mods[j]);
          bestScore = Math.max(bestScore, score);
          matched.add(`${mods[j].projectPath}::${mods[j].relativePath}`);
        }
      }
      if (group.length > 1) {
        groups.push({ type: 'similar', score: parseFloat(bestScore.toFixed(2)), modules: serializeModules(group) });
        matched.add(`${mods[i].projectPath}::${mods[i].relativePath}`);
      }
    }
  }

  return groups;
}

function serializeModules(mods) {
  return mods.map(m => ({ projectPath: m.projectPath, relativePath: m.relativePath, lines: m.lines, sizeKB: m.sizeKB }));
}

function signatureSimilarity(a, b) {
  if (a === b) return 1.0;
  const aWords = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const bWords = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  return intersection / Math.max(aWords.size, bWords.size);
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

function categorizeDuplications(duplicateGroups) {
  const categories = {
    auth:      { label: 'Authentication & Authorization', groups: [], totalLines: 0 },
    api:       { label: 'API / HTTP Clients', groups: [], totalLines: 0 },
    ui:        { label: 'UI Components', groups: [], totalLines: 0 },
    database:  { label: 'Database / ORM', groups: [], totalLines: 0 },
    websocket: { label: 'WebSocket / Real-time', groups: [], totalLines: 0 },
    logging:   { label: 'Logging / Monitoring', groups: [], totalLines: 0 },
    security:  { label: 'Security Utilities', groups: [], totalLines: 0 },
    config:    { label: 'Configuration', groups: [], totalLines: 0 },
    utils:     { label: 'Utilities / Helpers', groups: [], totalLines: 0 },
    other:     { label: 'Other', groups: [], totalLines: 0 },
  };

  const systemPatterns = {
    auth:      [/\bauth\b/i, /credential/i, /token/i, /jwt/i, /session/i, /login/i, /password/i, /bcrypt/i, /oauth/i, /passport/i],
    api:       [/\bapi\b/i, /http/i, /fetch\b/i, /axios/i, /request/i, /rest/i, /endpoint/i, /client/i],
    ui:        [/\bui\b/i, /component/i, /button/i, /modal/i, /form/i, /input/i, /dashboard/i, /layout/i, /react\b/i, /vue\b/i, /angular\b/i],
    database:  [/\bdb\b/i, /\bsql\b/i, /query/i, /model/i, /schema/i, /migration/i, /knex/i, /prisma/i, /sequelize/i],
    websocket: [/\bws\b/i, /socket/i, /realtime/i, /event/i, /subscribe/i],
    logging:   [/\blog\b/i, /logger/i, /monitor/i, /metrics/i, /sentry/i, /datadog/i],
    security:  [/\bcsrf\b/i, /cors\b/i, /xss\b/i, /sanitize/i, /escape/i, /rate.?limit/i],
    config:    [/config/i, /settings/i, /\.env/i, /dotenv/i, /secret/i],
    utils:     [/\butil/i, /helper/i, /format/i, /date/i, /validate/i, /parse/i],
  };

  for (const group of duplicateGroups) {
    const firstPath = (group.modules[0]?.relativePath ?? '').toLowerCase();
    let matched = false;
    for (const [cat, patterns] of Object.entries(systemPatterns)) {
      if (patterns.some(p => p.test(firstPath))) {
        const lines = group.modules.reduce((sum, m) => sum + m.lines, 0);
        categories[cat].groups.push({ ...group, category: cat });
        categories[cat].totalLines += lines;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const lines = group.modules.reduce((sum, m) => sum + m.lines, 0);
      categories.other.groups.push({ ...group, category: 'other' });
      categories.other.totalLines += lines;
    }
  }

  for (const cat of Object.values(categories)) {
    cat.savingsLines = cat.groups.reduce((sum, g) => {
      const maxLines = Math.max(...g.modules.map(m => m.lines));
      return sum + maxLines * (g.modules.length - 1);
    }, 0);
    cat.savingsPercent = cat.totalLines > 0
      ? parseFloat(((cat.savingsLines / cat.totalLines) * 100).toFixed(1))
      : 0;
  }

  return categories;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function generateRecommendations(categorized) {
  const recommendations = [];

  for (const [cat, data] of Object.entries(categorized)) {
    if (data.groups.length === 0) continue;

    const projects = new Set(data.groups.flatMap(g => g.modules.map(m => m.projectPath)));
    const topGroup = data.groups.sort((a, b) => b.score - a.score)[0];

    if (data.savingsPercent >= 60 && projects.size >= 2) {
      recommendations.push({
        id: `rec_${cat}_${Date.now()}`,
        priority: 'high',
        category: cat,
        label: `Extract shared ${data.label} package`,
        rationale: `${data.groups.length} duplicated groups across ${projects.size} projects — potential ${data.savingsLines} lines saved (${data.savingsPercent}%)`,
        action: 'extract_shared_package',
        suggestion: {
          packageName: `@internal/${cat}-${data.label.toLowerCase().replace(/\s+/g, '-')}`,
          exportPaths: topGroup.modules.map(m => m.relativePath),
          projects: Array.from(projects),
          migrationPlan: `Replace ${data.groups.length} local implementations with shared package. Update import paths, run tests.`,
        },
      });
    } else if (data.savingsPercent >= 30 && projects.size >= 2) {
      recommendations.push({
        id: `rec_${cat}_${Date.now()}`,
        priority: 'medium',
        category: cat,
        label: `Consolidate ${data.label}`,
        rationale: `${projects.size} projects duplicate ${data.label.toLowerCase()} — consolidate into common module`,
        action: 'consolidate_modules',
        suggestion: {
          approach: 'pick_best_implementation',
          keepPath: topGroup.modules[0]?.relativePath,
          removePaths: topGroup.modules.slice(1).map(m => m.relativePath),
          projects: Array.from(projects),
        },
      });
    } else {
      recommendations.push({
        id: `rec_${cat}_${Date.now()}`,
        priority: 'low',
        category: cat,
        label: `Audit ${data.label} duplication`,
        rationale: `${data.groups.length} groups with low overlap — verify if sharing makes sense`,
        action: 'audit_and_decide',
        suggestion: { groups: data.groups.length, projects: Array.from(projects) },
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => order[a.priority] - order[b.priority]);

  return recommendations;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function persistProject(db, projectPath, modules) {
  try {
    const projectId = computeHash(projectPath).slice(0, 16);
    const now = new Date().toISOString();
    db.prepare(`INSERT OR REPLACE INTO projects (id, path, scanned_at) VALUES (?, ?, ?)`).run(projectId, projectPath, now);
    db.prepare(`DELETE FROM modules WHERE project_id = ?`).run(projectId);
    const insert = db.prepare(`INSERT INTO modules (id, project_id, relative_path, extension, signature, content_hash, size_kb, lines, scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const mod of modules) {
      const modId = `${projectId}_${computeHash(mod.path).slice(0, 8)}`;
      insert.run(modId, projectId, mod.relativePath, mod.extension, mod.signature, mod.contentHash, mod.sizeKB, mod.lines, now);
    }
  } catch (err) {
    console.warn('[shared-module-detector] persistProject error:', err.message);
  }
}

function persistDuplicates(db, duplicates, categorized) {
  try {
    for (const group of duplicates) {
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let category = 'other';
      for (const [cat, data] of Object.entries(categorized)) {
        if (data.groups.some(g => g.modules === group.modules)) { category = cat; break; }
      }
      db.prepare(`INSERT INTO duplicate_groups (id, type, score, category, created_at) VALUES (?, ?, ?, ?, ?)`).run(groupId, group.type, group.score, category, new Date().toISOString());
    }
  } catch (err) {
    console.warn('[shared-module-detector] persistDuplicates error:', err.message);
  }
}

export default { detectSharedModules, analyzeProjectDuplication, openSharedModulesDB };
