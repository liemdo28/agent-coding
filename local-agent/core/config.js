// core/config.js - config loader with offline enforcement
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = join(__dirname, '../config/default.json');

export function loadConfig(workspaceDir = process.cwd()) {
  const defaults = JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

  const projectConfigPath = join(workspaceDir, '.local-agent', 'config.json');
  let projectConfig = {};
  if (existsSync(projectConfigPath)) {
    try {
      projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
    } catch {
      // ignore parse errors — default config will be used
    }
  }

  const merged = deepMerge(defaults, projectConfig);

  // ENFORCE offline and no-telemetry — these cannot be overridden
  merged.offline = true;
  merged.telemetry = false;
  merged.cloudSync = false;
  if (merged.llm) merged.llm.offlineOnly = true;

  return merged;
}

export function saveConfig(workspaceDir, config) {
  const dir = join(workspaceDir, '.local-agent');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Strip enforced fields before saving (they are always re-applied on load)
  const toSave = { ...config };
  delete toSave.offline;
  delete toSave.telemetry;
  delete toSave.cloudSync;

  writeFileSync(join(dir, 'config.json'), JSON.stringify(toSave, null, 2));
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
