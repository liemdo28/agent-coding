// memory/ProjectMemoryManager.js - main entry point for the Local Memory + Learning Engine

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';

import { sanitize, sanitizeAll } from './MemorySanitizer.js';
import { getContextForFix, getContextForAsk, getSimilarErrors, getRecommendedFixes } from './MemoryRetriever.js';
import { getKnownPatterns } from './FailurePatternStore.js';
import { getSuccessfulFixes, getFailedFixes } from './FixHistoryStore.js';
import { getHistory as getApprovalHistory } from './ApprovalHistoryStore.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 200;
const MEMORY_SUBDIR = join('.local-agent', 'memory');

// ── Internal helpers ─────────────────────────────────────────────────────────

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadJSON(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    return raw;
  } catch {
    return fallback;
  }
}

function loadArray(filePath) {
  const val = loadJSON(filePath, []);
  return Array.isArray(val) ? val : [];
}

function saveJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function saveArray(filePath, arr) {
  const trimmed = arr.length > MAX_ENTRIES ? arr.slice(arr.length - MAX_ENTRIES) : arr;
  saveJSON(filePath, trimmed);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the absolute path to the memory directory for a workspace.
 *
 * @param {string} workspaceRoot
 * @returns {string}
 */
function getMemoryDir(workspaceRoot) {
  return join(workspaceRoot, MEMORY_SUBDIR);
}

/**
 * Ensure the memory directory exists, creating it (and parents) if needed.
 *
 * @param {string} workspaceRoot
 */
function ensureMemoryDir(workspaceRoot) {
  const dir = getMemoryDir(workspaceRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load the project profile from disk.
 * Returns `{}` if the file does not exist or is invalid.
 *
 * @param {string} workspaceRoot
 * @returns {object}
 */
function loadProjectProfile(workspaceRoot) {
  const filePath = join(getMemoryDir(workspaceRoot), 'project-profile.json');
  const val = loadJSON(filePath, {});
  return val !== null && typeof val === 'object' && !Array.isArray(val) ? val : {};
}

/**
 * Sanitize and write the project profile.
 *
 * @param {object} profileData
 * @param {string} workspaceRoot
 */
function saveProjectProfile(profileData, workspaceRoot) {
  ensureMemoryDir(workspaceRoot);
  const filePath = join(getMemoryDir(workspaceRoot), 'project-profile.json');
  const clean = sanitize(profileData);
  saveJSON(filePath, clean);
}

/**
 * Update the project profile from scanner output.
 * Merges scanner-provided fields into the existing profile.
 *
 * Expected scanData shape (from scanner.js scanProject output):
 *   { frameworks, languages, packageManager, commands, filesScanned, projectName, ... }
 *
 * @param {object} scanData
 * @param {string} workspaceRoot
 */
function updateFromScan(scanData, workspaceRoot) {
  const existing = loadProjectProfile(workspaceRoot);

  // Extract the primary framework (first entry) and primary language
  const frameworks = scanData.frameworks ?? [];
  const languages = scanData.languages ?? [];
  const commands = scanData.commands ?? {};

  const updated = {
    ...existing,
    framework: frameworks[0] ?? existing.framework ?? null,
    frameworks,
    language: languages[0] ?? existing.language ?? null,
    languages,
    pkgManager: scanData.packageManager ?? existing.pkgManager ?? null,
    buildCommand: commands.build ?? existing.buildCommand ?? null,
    testCommand: commands.test ?? existing.testCommand ?? null,
    lintCommand: commands.lint ?? existing.lintCommand ?? null,
    fileCount: scanData.filesScanned ?? existing.fileCount ?? 0,
    projectName: scanData.projectName ?? existing.projectName ?? null,
    lastScan: new Date().toISOString(),
  };

  saveProjectProfile(updated, workspaceRoot);
}

/**
 * Append a QA run result to qa-history.json and update profile.lastQA.
 *
 * Expected qaData shape (from QAEngine.runQA output):
 *   { qaScore, buildResult, testResult, report, ... }
 *
 * @param {object} qaData
 * @param {string} workspaceRoot
 */
function updateFromQA(qaData, workspaceRoot) {
  ensureMemoryDir(workspaceRoot);
  const filePath = join(getMemoryDir(workspaceRoot), 'qa-history.json');
  const entries = loadArray(filePath);

  const report = qaData.report ?? {};
  const record = sanitize({
    id: generateId(),
    total: qaData.qaScore ?? report.qaScore ?? 0,
    grade: report.result ?? null,
    buildSuccess: !!(qaData.buildResult?.success ?? qaData.buildResult?.exitCode === 0 ?? false),
    testSuccess: !!(qaData.testResult?.success ?? qaData.testResult?.exitCode === 0 ?? false),
    secretCount: report.risks?.hardcodedSecrets?.length ?? 0,
    createdAt: new Date().toISOString(),
  });

  entries.push(record);
  saveArray(filePath, entries);

  // Also update lastQA on the project profile
  const profile = loadProjectProfile(workspaceRoot);
  profile.lastQA = record.createdAt;
  saveProjectProfile(profile, workspaceRoot);
}

/**
 * Append a command execution record to command-history.json.
 *
 * @param {string} command  - the command name/binary
 * @param {string[]} args   - argument list
 * @param {number} exitCode
 * @param {number} duration - milliseconds
 * @param {string} workspaceRoot
 */
function recordCommandRun(command, args, exitCode, duration, workspaceRoot) {
  ensureMemoryDir(workspaceRoot);
  const filePath = join(getMemoryDir(workspaceRoot), 'command-history.json');
  const entries = loadArray(filePath);

  const record = sanitize({
    id: generateId(),
    command: command ?? '',
    args: Array.isArray(args) ? args : [],
    exitCode: exitCode ?? 0,
    duration: duration ?? 0,
    createdAt: new Date().toISOString(),
  });

  entries.push(record);
  saveArray(filePath, entries);
}

/**
 * Get rich context for the orchestrator to use when working on a task.
 * Delegates to MemoryRetriever.
 *
 * @param {string} task
 * @param {string} errorType
 * @param {string} workspaceRoot
 * @returns {object}
 */
function getContextForTask(task, errorType, workspaceRoot) {
  return getContextForFix(task, errorType, workspaceRoot);
}

/**
 * Return a summary of what memory has been collected for a workspace.
 *
 * @param {string} workspaceRoot
 * @returns {{
 *   initialized: boolean,
 *   profileExists: boolean,
 *   knownIssues: number,
 *   successfulFixes: number,
 *   failedFixes: number,
 *   approvals: number,
 *   qaHistory: number,
 *   lastScan: string|null,
 *   lastQA: string|null
 * }}
 */
function getStatus(workspaceRoot) {
  const dir = getMemoryDir(workspaceRoot);
  const initialized = existsSync(dir);

  if (!initialized) {
    return {
      initialized: false,
      profileExists: false,
      knownIssues: 0,
      successfulFixes: 0,
      failedFixes: 0,
      approvals: 0,
      qaHistory: 0,
      lastScan: null,
      lastQA: null,
    };
  }

  const profile = loadProjectProfile(workspaceRoot);
  const profileExists = existsSync(join(dir, 'project-profile.json'));
  const knownIssues = getKnownPatterns(workspaceRoot).length;
  const successfulFixes = getSuccessfulFixes(workspaceRoot).length;
  const failedFixes = getFailedFixes(workspaceRoot).length;
  const approvals = getApprovalHistory(workspaceRoot).length;
  const qaHistory = loadArray(join(dir, 'qa-history.json')).length;

  return {
    initialized: true,
    profileExists,
    knownIssues,
    successfulFixes,
    failedFixes,
    approvals,
    qaHistory,
    lastScan: profile.lastScan ?? null,
    lastQA: profile.lastQA ?? null,
  };
}

/**
 * Delete all JSON files in the memory directory.
 * The directory itself is preserved.
 *
 * @param {string} workspaceRoot
 */
function clearAll(workspaceRoot) {
  const dir = getMemoryDir(workspaceRoot);
  if (!existsSync(dir)) return;

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    try {
      unlinkSync(join(dir, name));
    } catch {
      // best-effort
    }
  }
}

/**
 * Export all memory files as a single sanitized JSON object to outputPath.
 *
 * @param {string} workspaceRoot
 * @param {string} outputPath - absolute path to write the export file
 */
function exportMemory(workspaceRoot, outputPath) {
  const dir = getMemoryDir(workspaceRoot);

  const MEMORY_FILES = [
    'project-profile.json',
    'known-issues.json',
    'successful-fixes.json',
    'failed-fixes.json',
    'approval-history.json',
    'qa-history.json',
    'command-history.json',
  ];

  const bundle = {};
  for (const name of MEMORY_FILES) {
    const filePath = join(dir, name);
    const key = name.replace('.json', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    bundle[key] = loadJSON(filePath, name === 'project-profile.json' ? {} : []);
  }

  // Also include any extra .json files that may have been added
  if (existsSync(dir)) {
    let allFiles;
    try {
      allFiles = readdirSync(dir);
    } catch {
      allFiles = [];
    }
    for (const name of allFiles) {
      if (!name.endsWith('.json')) continue;
      if (MEMORY_FILES.includes(name)) continue;
      const key = name.replace('.json', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      bundle[key] = loadJSON(join(dir, name), {});
    }
  }

  const clean = sanitize(bundle);
  writeFileSync(outputPath, JSON.stringify(clean, null, 2), 'utf8');
}

/**
 * Import memory from a previously exported JSON file.
 * Each top-level key maps back to its source file name.
 * Existing files in the memory directory are overwritten.
 *
 * @param {string} workspaceRoot
 * @param {string} inputPath - absolute path to the export file
 */
function importMemory(workspaceRoot, inputPath) {
  const bundle = loadJSON(inputPath, null);
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error(`importMemory: invalid bundle at ${inputPath}`);
  }

  ensureMemoryDir(workspaceRoot);
  const dir = getMemoryDir(workspaceRoot);

  // camelCase key → kebab-case filename mapping
  function toFileName(key) {
    // e.g. "projectProfile" → "project-profile.json"
    return key.replace(/([A-Z])/g, '-$1').toLowerCase() + '.json';
  }

  for (const [key, value] of Object.entries(bundle)) {
    const fileName = toFileName(key);
    const filePath = join(dir, fileName);
    const clean = sanitize(value);
    saveJSON(filePath, clean);
  }
}

/**
 * Run MemorySanitizer on every JSON file in the memory directory.
 *
 * @param {string} workspaceRoot
 */
function sanitizeMemory(workspaceRoot) {
  sanitizeAll(workspaceRoot);
}

// ── Default export (object with all functions) ───────────────────────────────

export default {
  getMemoryDir,
  ensureMemoryDir,
  loadProjectProfile,
  saveProjectProfile,
  updateFromScan,
  updateFromQA,
  recordCommandRun,
  getContextForTask,
  getStatus,
  clearAll,
  exportMemory,
  importMemory,
  sanitizeMemory,
  // Re-export retriever helpers for convenience
  getContextForAsk,
  getSimilarErrors,
  getRecommendedFixes,
};
