// reasoning/VerificationPlanner.js — build a verification checklist for a plan
/**
 * Generate a verification checklist for a given plan.
 * @param {{ steps: Array, complexity: string, files?: string[] }} plan
 * @returns {{ checks: Check[], requiredCount: number }}
 */
export function buildVerificationPlan(plan) {
  const checks = [];

  // Always required
  checks.push({ id: 'syntax',    description: 'No syntax errors in changed files',            required: true });
  checks.push({ id: 'lint',      description: 'Linter passes with zero new warnings',         required: true });
  checks.push({ id: 'tests',     description: 'All existing tests pass',                      required: true });

  // Based on complexity
  if (plan.complexity !== 'low') {
    checks.push({ id: 'new-tests', description: 'New tests cover the changed code paths',    required: true });
    checks.push({ id: 'edge-cases', description: 'Edge cases identified and tested',          required: plan.complexity === 'high' });
  }

  // Based on file types
  const files = plan.files ?? [];
  const hasApiFiles = files.some((f) => /api|server|route|endpoint/i.test(f));
  const hasDbFiles  = files.some((f) => /database|schema|migrat|model/i.test(f));
  const hasSecFiles = files.some((f) => /auth|security|crypto|password/i.test(f));

  if (hasApiFiles) {
    checks.push({ id: 'api-contract', description: 'API contracts unchanged (or versioned)',  required: true });
    checks.push({ id: 'api-test',     description: 'API integration test added/updated',      required: false });
  }

  if (hasDbFiles) {
    checks.push({ id: 'migration',    description: 'Migration script present and reversible', required: true });
    checks.push({ id: 'data-integrity', description: 'Existing data unaffected',              required: true });
  }

  if (hasSecFiles) {
    checks.push({ id: 'secrets',      description: 'No secrets in code or logs',              required: true });
    checks.push({ id: 'auth-test',    description: 'Auth paths tested with negative cases',   required: true });
  }

  // Final integration check
  if (plan.complexity === 'high') {
    checks.push({ id: 'integration', description: 'End-to-end integration test passes',       required: true });
    checks.push({ id: 'perf',        description: 'No measurable performance regression',     required: false });
  }

  const requiredCount = checks.filter((c) => c.required).length;
  return { checks, requiredCount, totalCount: checks.length };
}
