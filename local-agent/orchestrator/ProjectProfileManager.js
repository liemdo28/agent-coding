// orchestrator/ProjectProfileManager.js — Reads per-project .local-agent/ data
import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { updateProject } from './ProjectRegistry.js';

// ── Local file readers ────────────────────────────────────────────────────────

/**
 * Load the project-profile.json from a project's own .local-agent/memory/ dir.
 * Returns {} if the file does not exist or cannot be parsed.
 */
export function loadLocalProfile(workspaceRoot) {
  const profilePath = join(workspaceRoot, '.local-agent', 'memory', 'project-profile.json');
  if (!existsSync(profilePath)) return {};
  try {
    const raw = readFileSync(profilePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Load .local-agent/scan-report.json from a project workspace.
 * Returns null if missing or unreadable.
 */
export function loadScanReport(workspaceRoot) {
  const reportPath = join(workspaceRoot, '.local-agent', 'scan-report.json');
  if (!existsSync(reportPath)) return null;
  try {
    const raw = readFileSync(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Load the most recent QA report from .local-agent/reports/qa-report-*.json.
 * Reports are sorted by filename (which includes a timestamp), newest first.
 * Returns null if no reports exist.
 */
export function loadLatestQAReport(workspaceRoot) {
  const reportsDir = join(workspaceRoot, '.local-agent', 'reports');
  if (!existsSync(reportsDir)) return null;
  try {
    const files = readdirSync(reportsDir)
      .filter((f) => f.startsWith('qa-report-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    const raw = readFileSync(join(reportsDir, files[0]), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregate data from local .local-agent/ files and return a summary object.
 *
 * Returns:
 *   { framework, language, fileCount, todoCount, secretCount,
 *     qaScore, qaGrade, lastScan, lastQA, patchCount }
 */
export function getProjectSummary(workspaceRoot) {
  const localProfile = loadLocalProfile(workspaceRoot);
  const scanReport   = loadScanReport(workspaceRoot);
  const qaReport     = loadLatestQAReport(workspaceRoot);

  // --- framework / language ---
  const framework = localProfile.framework
    ?? scanReport?.frameworks?.[0]
    ?? null;
  const language = localProfile.language
    ?? scanReport?.languages?.[0]
    ?? null;

  // --- scan stats ---
  const fileCount   = scanReport?.stats?.totalFiles ?? 0;
  const todoCount   = scanReport?.todos?.length    ?? 0;
  const secretCount = scanReport?.risks?.hardcodedSecrets?.length ?? 0;
  const lastScan    = scanReport?.scannedAt ?? null;

  // --- QA stats ---
  const qaScore = qaReport?.qaScore?.total ?? null;
  const qaGrade = qaReport?.grade          ?? null;
  const lastQA  = qaReport?.generatedAt    ?? null;

  // --- patches ---
  let patchCount = 0;
  try {
    const patchDir = join(workspaceRoot, '.local-agent', 'patches');
    if (existsSync(patchDir)) {
      patchCount = readdirSync(patchDir).filter((f) => f.endsWith('.json')).length;
    }
  } catch {
    patchCount = 0;
  }

  return { framework, language, fileCount, todoCount, secretCount, qaScore, qaGrade, lastScan, lastQA, patchCount };
}

// ── Registry sync ─────────────────────────────────────────────────────────────

/**
 * Read local profile data for a project and persist the relevant fields
 * back into the global registry.
 */
export function updateRegistryFromLocal(projectId, workspaceRoot) {
  const scanReport = loadScanReport(workspaceRoot);
  const qaReport   = loadLatestQAReport(workspaceRoot);
  const localProfile = loadLocalProfile(workspaceRoot);

  const framework = localProfile.framework ?? scanReport?.frameworks?.[0] ?? null;
  const language  = localProfile.language  ?? scanReport?.languages?.[0]  ?? null;
  const lastScan  = scanReport?.scannedAt  ?? null;
  const lastQA    = qaReport?.generatedAt  ?? null;
  const lastScore = qaReport?.qaScore?.total ?? 0;

  updateProject(projectId, { framework, language, lastScan, lastQA, lastScore });
}
