// coding-db/CodingKnowledgeDB.js - SQLite-backed local knowledge database
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const SEED_RECIPES = [
  { error_pattern: 'Cannot find module', error_type: 'IMPORT_ERROR', error_category: 'dependency',
    fix_description: 'Run npm install. Check package.json for missing deps.',
    fix_snippet: 'npm install\n# or: npm install <missing-package>', language: 'javascript' },
  { error_pattern: 'vite: command not found', error_type: 'BUILD_ERROR', error_category: 'tooling',
    fix_description: 'Install Vite as a dev dependency.',
    fix_snippet: 'npm install --save-dev vite', language: 'javascript', framework: 'vite' },
  { error_pattern: 'ENOENT: no such file or directory', error_type: 'RUNTIME_ERROR', error_category: 'filesystem',
    fix_description: 'Check file path. File may be missing or moved.',
    fix_snippet: '// Verify the path exists before reading:\nimport { existsSync } from \'fs\';\nif (!existsSync(path)) throw new Error(`File not found: ${path}`);', language: 'javascript' },
  { error_pattern: "SyntaxError: Cannot use import statement", error_type: 'IMPORT_ERROR', error_category: 'esm',
    fix_description: "Add \"type\": \"module\" to package.json or rename to .mjs",
    fix_snippet: '// package.json:\n{"type": "module"}', language: 'javascript' },
  { error_pattern: 'Property does not exist on type', error_type: 'TYPE_ERROR', error_category: 'typescript',
    fix_description: 'Check TypeScript types. Add type assertion or fix interface.',
    fix_snippet: '// Option 1: type assertion\nconst val = (obj as MyType).property;\n// Option 2: fix interface\ninterface MyType { property: string; }', language: 'typescript' },
  { error_pattern: 'CORS error', error_type: 'RUNTIME_ERROR', error_category: 'network',
    fix_description: 'Add cors middleware to Express server.',
    fix_snippet: "import cors from 'cors';\napp.use(cors({ origin: 'http://localhost:3000' }));", language: 'javascript', framework: 'express' },
  { error_pattern: 'Address already in use', error_type: 'RUNTIME_ERROR', error_category: 'network',
    fix_description: 'Kill the process on the port.',
    fix_snippet: 'lsof -ti:<PORT> | xargs kill -9\n# or: npx kill-port <PORT>', language: 'shell' },
  { error_pattern: 'JavaScript heap out of memory', error_type: 'RUNTIME_ERROR', error_category: 'memory',
    fix_description: 'Increase Node.js heap size.',
    fix_snippet: 'NODE_OPTIONS="--max-old-space-size=4096" npm run build', language: 'javascript' },
  { error_pattern: 'Cannot read properties of undefined', error_type: 'RUNTIME_ERROR', error_category: 'null-check',
    fix_description: 'Add null check or optional chaining before access.',
    fix_snippet: '// Before: obj.prop\n// After:\nobj?.prop\n// or: if (obj) { obj.prop }', language: 'javascript' },
  { error_pattern: "Can't resolve", error_type: 'IMPORT_ERROR', error_category: 'dependency',
    fix_description: 'Check import path. Run npm install for the package.',
    fix_snippet: 'npm install <package-name>', language: 'javascript' },
  { error_pattern: 'TypeError: is not a function', error_type: 'TYPE_ERROR', error_category: 'runtime',
    fix_description: 'Check that the import is correct and the function exists.',
    fix_snippet: '// Verify import:\nimport { myFn } from \'./module.js\';\nconsole.log(typeof myFn); // should be "function"', language: 'javascript' },
  { error_pattern: 'EACCES permission denied', error_type: 'RUNTIME_ERROR', error_category: 'filesystem',
    fix_description: 'Check file permissions.',
    fix_snippet: 'chmod 644 <file>\n# or for directories:\nchmod 755 <dir>', language: 'shell' },
  { error_pattern: 'Failed to fetch', error_type: 'RUNTIME_ERROR', error_category: 'network',
    fix_description: 'Check API endpoint URL. Verify server is running.',
    fix_snippet: '// Check if server is running:\n// curl http://localhost:4001/health', language: 'javascript' },
  { error_pattern: 'Hydration failed', error_type: 'RUNTIME_ERROR', error_category: 'ssr',
    fix_description: 'Check for mismatched HTML between server and client rendering.',
    fix_snippet: '// Use dynamic import for client-only code:\nconst Component = dynamic(() => import(\'./Component\'), { ssr: false });', language: 'javascript', framework: 'next' },
  { error_pattern: 'TypeScript error', error_type: 'TYPE_ERROR', error_category: 'typescript',
    fix_description: 'Run TypeScript check to see all errors.',
    fix_snippet: 'npx tsc --noEmit', language: 'typescript' },
  { error_pattern: 'Jest cannot find module', error_type: 'TEST_FAILURE', error_category: 'testing',
    fix_description: 'Check moduleNameMapper in jest.config.js.',
    fix_snippet: '// jest.config.js:\nmoduleNameMapper: {\n  \'^@/(.*)$\': \'<rootDir>/src/$1\'\n}', language: 'javascript', framework: 'jest' },
  { error_pattern: 'ModuleNotFoundError', error_type: 'IMPORT_ERROR', error_category: 'python',
    fix_description: 'Install the missing Python module.',
    fix_snippet: 'pip install <module>\n# or with venv:\nsource venv/bin/activate && pip install <module>', language: 'python' },
  { error_pattern: 'IndentationError', error_type: 'BUILD_ERROR', error_category: 'python',
    fix_description: 'Fix Python indentation: use consistent spaces or tabs.',
    fix_snippet: '# Use 4 spaces for indentation:\ndef my_func():\n    return True', language: 'python' },
  { error_pattern: 'fetch is not defined', error_type: 'RUNTIME_ERROR', error_category: 'node',
    fix_description: 'Use node-fetch or upgrade to Node 18+ for native fetch.',
    fix_snippet: 'import fetch from \'node-fetch\';\n// or upgrade Node.js to v18+', language: 'javascript' },
  { error_pattern: 'DEPTH_ZERO_SELF_SIGNED_CERT', error_type: 'RUNTIME_ERROR', error_category: 'tls',
    fix_description: 'Disable TLS verification for local development only.',
    fix_snippet: 'NODE_TLS_REJECT_UNAUTHORIZED=0 node app.js\n# WARNING: never use in production', language: 'javascript' },
];

export function getDbPath(workspaceRoot) {
  return join(workspaceRoot, '.local-agent', 'coding-knowledge.db');
}

export function openDb(workspaceRoot) {
  const dbPath = getDbPath(workspaceRoot);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    return null; // better-sqlite3 not available
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const isNew = !existsSync(dbPath) || db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='recipes'").get().c === 0;

  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_pattern TEXT NOT NULL,
      error_type TEXT,
      error_category TEXT,
      fix_description TEXT NOT NULL,
      fix_snippet TEXT,
      language TEXT,
      framework TEXT,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      source TEXT DEFAULT 'local',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS diagnostics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_hash TEXT UNIQUE,
      log_summary TEXT,
      error_types TEXT,
      suggested_recipes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed on first creation
  const count = db.prepare('SELECT COUNT(*) as c FROM recipes').get().c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO recipes (error_pattern, error_type, error_category, fix_description, fix_snippet, language, framework, source, created_at, updated_at)
      VALUES (@error_pattern, @error_type, @error_category, @fix_description, @fix_snippet, @language, @framework, 'seed', @now, @now)
    `);
    const insertMany = db.transaction((recipes) => {
      const now = new Date().toISOString();
      for (const r of recipes) insert.run({ error_pattern: r.error_pattern, error_type: r.error_type ?? null,
        error_category: r.error_category ?? null, fix_description: r.fix_description,
        fix_snippet: r.fix_snippet ?? null, language: r.language ?? null, framework: r.framework ?? null, now });
    });
    insertMany(SEED_RECIPES);
  }

  return db;
}

export function insertRecipe(db, recipe) {
  if (!db) return null;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO recipes (error_pattern, error_type, error_category, fix_description, fix_snippet, language, framework, source, created_at, updated_at)
    VALUES (@error_pattern, @error_type, @error_category, @fix_description, @fix_snippet, @language, @framework, @source, @now, @now)
  `);
  return stmt.run({ ...recipe, source: recipe.source ?? 'local', now }).lastInsertRowid;
}

export function searchRecipes(db, query, limit = 5) {
  if (!db) return [];
  try {
    // Simple LIKE search (FTS5 requires extra setup)
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const conditions = terms.map(() => '(LOWER(error_pattern) LIKE ? OR LOWER(fix_description) LIKE ?)').join(' OR ');
    const params = terms.flatMap((t) => [`%${t}%`, `%${t}%`]);
    const rows = db.prepare(`SELECT * FROM recipes WHERE ${conditions} ORDER BY success_count DESC LIMIT ?`).all(...params, limit);
    return rows;
  } catch {
    return db.prepare('SELECT * FROM recipes ORDER BY success_count DESC LIMIT ?').all(limit);
  }
}

export function recordOutcome(db, recipeId, success) {
  if (!db) return;
  const col = success ? 'success_count' : 'failure_count';
  db.prepare(`UPDATE recipes SET ${col} = ${col} + 1, updated_at = ? WHERE id = ?`).run(new Date().toISOString(), recipeId);
}

export function closeDb(db) {
  if (db) db.close();
}
