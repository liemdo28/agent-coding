// Config.js — workspace config and paths
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const DB_DIR = '.marketing-db';
const CONFIG_FILE = '.marketing-db/config.json';

const DEFAULTS = {
  version: '1.0.0',
  dbPath: '.marketing-db/marketing.db',
  logPath: '.marketing-db/logs',
  reportsPath: 'reports',
  seedDataPath: 'seed-data',
  offlineMode: true,
  defaultBrand: null,
};

export function getWorkspaceRoot() {
  return resolve(process.cwd());
}

export function loadConfig(workspaceRoot) {
  const p = join(workspaceRoot, CONFIG_FILE);
  if (!existsSync(p)) return { ...DEFAULTS };
  try { return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}

export function saveConfig(workspaceRoot, config) {
  const dir = join(workspaceRoot, DB_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(workspaceRoot, CONFIG_FILE), JSON.stringify({ ...DEFAULTS, ...config }, null, 2));
}

export function initWorkspace(workspaceRoot) {
  const dirs = [
    DB_DIR,
    `${DB_DIR}/logs`,
    'reports/audit',
    'seed-data',
  ];
  for (const d of dirs) mkdirSync(join(workspaceRoot, d), { recursive: true });
  if (!existsSync(join(workspaceRoot, CONFIG_FILE))) {
    saveConfig(workspaceRoot, DEFAULTS);
  }
}

export function getDbPath(workspaceRoot) {
  return join(workspaceRoot, DEFAULTS.dbPath);
}

export { DEFAULTS };
