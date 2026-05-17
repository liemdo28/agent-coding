// memory/MemoryRetriever.js - high-level read interface for memory context

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { findMatchingPatterns, getKnownPatterns, getPatternsByType } from './FailurePatternStore.js';
import { getSuccessfulFixes, getFailedFixes } from './FixHistoryStore.js';
import { getApprovalRate } from './ApprovalHistoryStore.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function memoryDir(workspaceRoot) {
  return join(workspaceRoot, '.local-agent', 'memory');
}

function loadJSON(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadArray(filePath) {
  const val = loadJSON(filePath, []);
  return Array.isArray(val) ? val : [];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Gather context relevant to attempting a fix for a given task and error type.
 *
 * @param {string} task         - human-readable description of the task
 * @param {string} errorType    - error category string
 * @param {string} workspaceRoot
 * @returns {{
 *   knownPatterns: object[],
 *   previousFixes: { successful: object[], failed: object[] },
 *   approvalRate: { approved: number, rejected: number, rate: number }
 * }}
 */
export function getContextForFix(task, errorType, workspaceRoot) {
  const knownPatterns = errorType
    ? getPatternsByType(errorType, workspaceRoot)
    : getKnownPatterns(workspaceRoot);

  const successful = getSuccessfulFixes(workspaceRoot).filter(
    (r) => !errorType || (r.errorType ?? '').toLowerCase() === (errorType ?? '').toLowerCase()
  );

  const failed = getFailedFixes(workspaceRoot).filter(
    (r) => !errorType || (r.errorType ?? '').toLowerCase() === (errorType ?? '').toLowerCase()
  );

  const approvalRate = getApprovalRate(workspaceRoot);

  return {
    knownPatterns,
    previousFixes: { successful, failed },
    approvalRate,
  };
}

/**
 * Gather context useful for answering a general question about the project.
 *
 * @param {string} question
 * @param {string} workspaceRoot
 * @returns {{
 *   projectProfile: object,
 *   recentQA: object[],
 *   commandHistory: object[]
 * }}
 */
export function getContextForAsk(question, workspaceRoot) {
  const dir = memoryDir(workspaceRoot);
  const projectProfile = loadJSON(join(dir, 'project-profile.json'), {});
  const allQA = loadArray(join(dir, 'qa-history.json'));
  const allCommands = loadArray(join(dir, 'command-history.json'));

  // Return the 10 most recent QA entries and last 20 commands for context
  const recentQA = allQA.slice(-10);
  const commandHistory = allCommands.slice(-20);

  return { projectProfile, recentQA, commandHistory };
}

/**
 * Find known error patterns that resemble the given error text.
 * Delegates to FailurePatternStore.findMatchingPatterns.
 *
 * @param {string} errorText
 * @param {string} workspaceRoot
 * @returns {object[]} up to 3 pattern records
 */
export function getSimilarErrors(errorText, workspaceRoot) {
  return findMatchingPatterns(errorText, workspaceRoot);
}

/**
 * Return successful fixes recorded for a specific error type.
 *
 * @param {string} errorType
 * @param {string} workspaceRoot
 * @returns {object[]}
 */
export function getRecommendedFixes(errorType, workspaceRoot) {
  const all = getSuccessfulFixes(workspaceRoot);
  if (!errorType) return all;
  const lower = errorType.toLowerCase();
  return all.filter((r) => (r.errorType ?? '').toLowerCase() === lower);
}
