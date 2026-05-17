// coding-db/CodingDBManager.js - main entry point for local coding knowledge DB
import { openDb, searchRecipes, insertRecipe, recordOutcome, closeDb } from './CodingKnowledgeDB.js';
import { detectCodingDB, searchRemote, getStatus as getClientStatus } from './CodingDBClient.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ERROR_PATTERNS = [
  /Error:\s+(.+)/g,
  /TypeError:\s+(.+)/g,
  /SyntaxError:\s+(.+)/g,
  /ReferenceError:\s+(.+)/g,
  /ModuleNotFoundError:\s+(.+)/g,
  /ImportError:\s+(.+)/g,
  /ENOENT:\s+(.+)/g,
  /EACCES:\s+(.+)/g,
];

function extractErrors(logContent) {
  const errors = new Set();
  for (const pattern of ERROR_PATTERNS) {
    let m;
    const re = new RegExp(pattern.source, 'gm');
    while ((m = re.exec(logContent)) !== null) {
      errors.add(m[0].slice(0, 120));
    }
  }
  return [...errors].slice(0, 10);
}

export async function search(query, workspaceRoot) {
  const remote = await detectCodingDB();
  let results = [];
  let source = 'local';

  if (remote.available) {
    const remoteResults = await searchRemote(query, remote.url);
    if (remoteResults.length) {
      results = remoteResults;
      source = 'remote';
    }
  }

  if (!results.length) {
    const db = openDb(workspaceRoot);
    if (db) {
      results = searchRecipes(db, query, 5);
      closeDb(db);
      source = 'local';
    }
  }

  const warning = !remote.available && !results.length
    ? 'No local DB results. Run: local-agent coding-db sync-local'
    : undefined;

  return { results, source, warning };
}

export async function diagnose(logContent, workspaceRoot) {
  const errors = extractErrors(logContent);
  const diagResults = [];

  for (const errText of errors) {
    const { results } = await search(errText, workspaceRoot);
    diagResults.push({ errorText: errText, recipes: results.slice(0, 3) });
  }

  return {
    errors: diagResults,
    totalRecipes: diagResults.reduce((sum, d) => sum + d.recipes.length, 0),
  };
}

export function syncLocal(workspaceRoot) {
  const db = openDb(workspaceRoot);
  if (!db) return { synced: 0, updated: 0, total: 0 };

  let synced = 0, updated = 0;
  const memDir = join(workspaceRoot, '.local-agent', 'memory');

  const successPath = join(memDir, 'successful-fixes.json');
  if (existsSync(successPath)) {
    try {
      const fixes = JSON.parse(readFileSync(successPath, 'utf8'));
      for (const fix of fixes) {
        if (fix.errorType && fix.task) {
          insertRecipe(db, {
            error_pattern: fix.errorType,
            error_type: fix.errorType,
            fix_description: fix.task,
            fix_snippet: fix.diffSummary ?? null,
            source: 'history',
          });
          synced++;
        }
      }
    } catch { /* skip corrupt files */ }
  }

  const knownPath = join(memDir, 'known-issues.json');
  if (existsSync(knownPath)) {
    try {
      const issues = JSON.parse(readFileSync(knownPath, 'utf8'));
      for (const issue of issues) {
        if (issue.errorType && issue.suggestedFix) {
          insertRecipe(db, {
            error_pattern: issue.errorText ?? issue.errorType,
            error_type: issue.errorType,
            fix_description: issue.suggestedFix,
            source: 'memory',
          });
          updated++;
        }
      }
    } catch { /* skip */ }
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM recipes').get().c;
  closeDb(db);
  return { synced, updated, total };
}

export async function getStatus(workspaceRoot) {
  const clientStatus = await getClientStatus(workspaceRoot);
  const db = openDb(workspaceRoot);
  let recipeCount = 0;
  if (db) {
    recipeCount = db.prepare('SELECT COUNT(*) as c FROM recipes').get().c;
    closeDb(db);
  }
  return { ...clientStatus, recipeCount };
}

export function recordFix(recipeId, success, workspaceRoot) {
  const db = openDb(workspaceRoot);
  if (!db) return;
  recordOutcome(db, recipeId, success);
  closeDb(db);
}

export default { search, diagnose, syncLocal, getStatus, recordFix };
