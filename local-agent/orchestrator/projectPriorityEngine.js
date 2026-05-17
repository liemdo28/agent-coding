// orchestrator/projectPriorityEngine.js — scores and prioritizes projects
// Phase 12: weights: lastActive 30%, health 25%, pending patches 20%, QA failures 15%, deploy risk 10%

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';

/**
 * Score a project profile (0–100 composite).
 * @param {object} profile  — { name, lastActiveMs?, healthScore?, pendingPatches?, qaFailures?, deployRisk? }
 * @returns {number} 0–100
 */
export function scoreProject(profile) {
  const now = Date.now();

  // lastActive: 0–1 (1 = within last hour, 0 = 7+ days)
  const idleMs   = now - (profile.lastActiveMs ?? 0);
  const idleDays = idleMs / 86_400_000;
  const actScore = Math.max(0, 1 - idleDays / 7);

  // healthScore: already 0–1
  const health   = Math.min(1, Math.max(0, profile.healthScore ?? 0.5));

  // pendingPatches: 0–1 (5+ patches = max urgency)
  const patches  = Math.min(1, (profile.pendingPatches ?? 0) / 5);

  // qaFailures: 0–1 (10+ failures = max urgency)
  const qaFails  = Math.min(1, (profile.qaFailures ?? 0) / 10);

  // deployRisk: already 0–1
  const depRisk  = Math.min(1, Math.max(0, profile.deployRisk ?? 0));

  const raw = actScore * 0.30
    + health   * 0.25
    + patches  * 0.20
    + qaFails  * 0.15
    + depRisk  * 0.10;

  return Math.round(raw * 100);
}

/**
 * Rank an array of project profiles by priority score.
 * @param {object[]} profiles
 * @returns {object[]} sorted descending
 */
export function rankProjects(profiles) {
  return profiles
    .map(p => ({ ...p, priorityScore: scoreProject(p) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Scan workspace for projects and generate a priority report.
 * @param {string} workspaceRoot
 * @returns {{ projects: object[], generatedAt: string }}
 */
export function getPriorityReport(workspaceRoot) {
  const profiles = [];

  let entries;
  try { entries = readdirSync(workspaceRoot); } catch { entries = []; }

  for (const name of entries) {
    const dir = join(workspaceRoot, name);
    try {
      const st = statSync(dir);
      if (!st.isDirectory()) continue;
      if (['node_modules', '.git', '.local-agent'].includes(name)) continue;

      const pkgPath = join(dir, 'package.json');
      if (!existsSync(pkgPath)) continue;

      let pkg = {};
      try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { /* ignore */ }

      // Infer signals from file timestamps
      const lastActiveMs = st.mtimeMs;
      // Check for patches dir
      const patchDir = join(dir, '.local-agent', 'patches');
      let pendingPatches = 0;
      try {
        if (existsSync(patchDir)) {
          pendingPatches = readdirSync(patchDir).filter(f => f.endsWith('.json')).length;
        }
      } catch { /* ignore */ }

      profiles.push({
        name: pkg.name ?? name,
        dir,
        lastActiveMs,
        healthScore:    0.7,   // default — real health from ProjectHealthMonitor
        pendingPatches,
        qaFailures:    0,
        deployRisk:    0.3,
      });
    } catch { /* skip */ }
  }

  return {
    projects:    rankProjects(profiles),
    generatedAt: new Date().toISOString(),
  };
}
