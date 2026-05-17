// orchestrator/MultiProjectScanner.js — Lightweight scan aggregation across projects
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { updateProject } from './ProjectRegistry.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJSON(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ── Per-project lightweight scan ──────────────────────────────────────────────

/**
 * Perform a lightweight "scan" of a single project:
 *   - Verifies the workspace root exists on disk
 *   - Reads project-map.json  (.local-agent/project-map.json) if present
 *   - Reads scan-report.json  (.local-agent/scan-report.json) if present
 *   - Updates the registry entry with a lastScan timestamp (set to now)
 *
 * Does NOT run the full scanner — that would be far too slow for a batch
 * operation across many projects.
 *
 * Returns { projectId, name, root, scanData, error? }
 */
async function scanOne(project) {
  const { projectId, name, root } = project;

  if (!existsSync(root)) {
    return {
      projectId,
      name,
      root,
      scanData: null,
      error: `Workspace root does not exist: ${root}`,
    };
  }

  try {
    const projectMap  = readJSON(join(root, '.local-agent', 'project-map.json'));
    const scanReport  = readJSON(join(root, '.local-agent', 'scan-report.json'));

    const scanData = { projectMap, scanReport };

    // Update the registry so lastScan reflects "we checked now"
    try {
      updateProject(projectId, { lastScan: new Date().toISOString() });
    } catch { /* registry may not exist yet — continue */ }

    return { projectId, name, root, scanData };
  } catch (err) {
    return { projectId, name, root, scanData: null, error: err.message };
  }
}

// ── Batch scan ────────────────────────────────────────────────────────────────

/**
 * Run a lightweight scan across all supplied projects.
 *
 * @param {Array}  projects — array of project registry entries
 * @param {Object} options  — currently unused; reserved for future filters
 * @returns {Promise<Array>} array of { projectId, name, root, scanData, error? }
 */
export async function scanAll(projects, options = {}) {
  const results = [];
  for (const project of projects) {
    // Run sequentially to avoid hammering the filesystem
    // eslint-disable-next-line no-await-in-loop
    results.push(await scanOne(project));
  }
  return results;
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregate scan results into a high-level stats object.
 *
 * @param {Array} scanResults — output of scanAll()
 * @returns {{ totalProjects, totalFiles, totalSecrets, totalTodos, frameworks: {} }}
 */
export function getAggregatedStats(scanResults) {
  const stats = {
    totalProjects: scanResults.length,
    totalFiles:    0,
    totalSecrets:  0,
    totalTodos:    0,
    frameworks:    {},
  };

  for (const result of scanResults) {
    if (!result.scanData) continue;

    const { projectMap, scanReport } = result.scanData;

    // Prefer project-map.json for stats (it's written by the full scanner)
    const source = projectMap ?? scanReport;
    if (!source) continue;

    stats.totalFiles   += source.stats?.totalFiles ?? 0;
    stats.totalSecrets += source.risks?.hardcodedSecrets?.length ?? 0;
    stats.totalTodos   += source.todos?.length ?? 0;

    const frameworkList = source.frameworks ?? [];
    for (const fw of frameworkList) {
      if (fw) {
        stats.frameworks[fw] = (stats.frameworks[fw] ?? 0) + 1;
      }
    }
  }

  return stats;
}
