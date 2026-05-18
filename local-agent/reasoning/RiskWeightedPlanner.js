// reasoning/RiskWeightedPlanner.js — score a plan's risk based on file history + scope
/**
 * Score a plan's risk.
 * @param {{ files: string[], stepCount: number, complexity: string }} plan
 * @param {object} projectMap — from .local-agent/project-map.json
 * @returns {{ riskScore: number, level: 'low'|'medium'|'high'|'critical', factors: string[] }}
 */
export function scoreRisk(plan, projectMap = {}) {
  let score   = 0;
  const factors = [];

  // Complexity weight
  const complexityWeight = { low: 0, medium: 20, high: 40 };
  score += complexityWeight[plan.complexity] ?? 20;
  if (plan.complexity !== 'low') factors.push(`Complexity: ${plan.complexity}`);

  // Step count
  if (plan.stepCount > 6) { score += 15; factors.push(`Many steps: ${plan.stepCount}`); }
  else if (plan.stepCount > 3) { score += 5; }

  // File scope
  const fileCount = plan.files?.length ?? 0;
  if (fileCount > 20) { score += 25; factors.push(`Wide scope: ${fileCount} files`); }
  else if (fileCount > 5) { score += 10; factors.push(`Multiple files: ${fileCount}`); }

  // Critical file detection
  const criticalPatterns = [/auth|security|crypto|password/i, /database|schema|migrat/i, /config|env|secret/i];
  const criticalFiles = (plan.files ?? []).filter((f) => criticalPatterns.some((p) => p.test(f)));
  if (criticalFiles.length > 0) {
    score += 20;
    factors.push(`Critical files touched: ${criticalFiles.slice(0, 3).join(', ')}`);
  }

  // Entry point detection
  const entryPatterns = [/index\.(js|ts)$/, /main\.(js|ts)$/, /app\.(js|ts)$/, /server\.(js|ts)$/];
  const entryFiles = (plan.files ?? []).filter((f) => entryPatterns.some((p) => p.test(f)));
  if (entryFiles.length > 0) { score += 10; factors.push('Entry point modified'); }

  const level =
    score >= 70 ? 'critical' :
    score >= 45 ? 'high'     :
    score >= 20 ? 'medium'   : 'low';

  return { riskScore: Math.min(score, 100), level, factors };
}
