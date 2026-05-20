// local-agent/dna/GeneIngester.js
// Phase 106 — Engineering DNA
// Bulk-ingests patterns from experiment results and cross-project learning
// into the PatternLibrary.

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Read experiment-patterns.jsonl and ingest each validated pattern into the library.
 *
 * @param {string}         experimentPatternsPath  path to experiment-patterns.jsonl
 * @param {PatternLibrary} library
 * @returns {{ ingested: number, skipped: number }}
 */
export async function ingestFromExperiments(experimentPatternsPath, library) {
  if (!existsSync(experimentPatternsPath)) {
    return { ingested: 0, skipped: 0 };
  }

  const lines = readFileSync(experimentPatternsPath, 'utf8')
    .split('\n').filter(Boolean);

  let ingested = 0, skipped = 0;

  for (const line of lines) {
    try {
      const exp = JSON.parse(line);
      // Normalize experiment result into a gene pattern.
      const pattern = {
        category:    _categoryFromVariable(exp.variable ?? ''),
        description: exp.conclusion ?? exp.hypothesis ?? 'Experiment-derived pattern',
        variable:    exp.variable,
        metric:      exp.metric,
        effect_size: exp.effect_size,
        control_filter:   exp.control_filter,
        treatment_filter: exp.treatment_filter,
        source_experiment: exp.id,
      };

      const { isNew } = library.ingest('experiment', pattern, {
        sourceRef:     exp.id,
        applicability: { min_effect_size: 0.1 },
      });

      if (isNew) ingested++; else skipped++;
    } catch {
      skipped++;
    }
  }

  return { ingested, skipped };
}

/**
 * Ingest patterns from cross-project learning if the module exists.
 * Gracefully no-ops if CrossProjectLearning is unavailable.
 *
 * @param {string}         workspaceRoot
 * @param {PatternLibrary} library
 * @returns {{ ingested: number, skipped: number }}
 */
export async function ingestFromCrossProject(workspaceRoot, library) {
  const cplPath = resolve(ROOT, 'local-agent', 'cross-project', 'CrossProjectLearning.js');
  if (!existsSync(cplPath)) {
    return { ingested: 0, skipped: 0 };
  }

  try {
    const { CrossProjectLearning } = await import(cplPath);
    const cpl      = new CrossProjectLearning({ workspaceRoot });
    const patterns = await cpl.getLearnedPatterns?.() ?? [];

    let ingested = 0, skipped = 0;
    for (const p of patterns) {
      const { isNew } = library.ingest('cross_project', p, { sourceRef: workspaceRoot });
      if (isNew) ingested++; else skipped++;
    }
    return { ingested, skipped };
  } catch {
    return { ingested: 0, skipped: 0 };
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _categoryFromVariable(variable) {
  if (variable.includes('skill'))   return 'worker_config';
  if (variable.includes('queue'))   return 'queue_strategy';
  if (variable.includes('test'))    return 'test_pattern';
  return 'fix_recipe';
}
