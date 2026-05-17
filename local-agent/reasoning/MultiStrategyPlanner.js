// local-agent/reasoning/MultiStrategyPlanner.js
// Phase 25: Multi-strategy planner — generate and compare multiple fix strategies

export class MultiStrategyPlanner {
  planStrategies(task, context = {}) {
    const strategies = [];

    // Strategy A: Conservative (safe, slower, lower risk)
    strategies.push(this.createConservativeStrategy(task, context));

    // Strategy B: Aggressive (faster, higher risk)
    strategies.push(this.createAggressiveStrategy(task, context));

    // Strategy C: Incremental (step-by-step, medium risk)
    strategies.push(this.createIncrementalStrategy(task, context));

    // Strategy D: Minimal (only essential changes, lowest risk)
    strategies.push(this.createMinimalStrategy(task, context));

    // Score and rank strategies
    const ranked = this.rankStrategies(strategies);

    return {
      task,
      strategies: ranked,
      recommended: ranked[0],
      alternatives: ranked.slice(1),
    };
  }

  createConservativeStrategy(task, context = {}) {
    return {
      name: 'Conservative',
      description: 'Maximum safety: full backup, comprehensive testing, gradual rollout',
      approach: 'PROACTIVE_SAFETY',
      risk: 'LOW',
      speed: 'SLOW',
      steps: [
        { action: 'FULL_BACKUP', description: 'Create complete project backup', risk: 'LOW' },
        { action: 'CONTEXT_SCAN', description: 'Deep scan of all related files', risk: 'LOW' },
        { action: 'QA_BASELINE', description: 'Run QA baseline before changes', risk: 'LOW' },
        { action: 'MINIMAL_PATCH', description: 'Apply smallest possible patch', risk: 'LOW' },
        { action: 'STEP_TEST', description: 'Test after each individual change', risk: 'LOW' },
        { action: 'REGRESSION_FULL', description: 'Full regression test suite', risk: 'LOW' },
        { action: 'QA_VERIFY', description: 'Run QA verification', risk: 'LOW' },
      ],
      pros: ['Maximum safety', 'Full rollback possible at any step', 'No regression risk'],
      cons: ['Slowest approach', 'Overkill for simple fixes'],
      score: { safety: 10, speed: 2, completeness: 8 },
    };
  }

  createAggressiveStrategy(task, context = {}) {
    return {
      name: 'Aggressive',
      description: 'Fastest resolution, assumes test coverage is good',
      approach: 'FAST_RESOLUTION',
      risk: 'HIGH',
      speed: 'FAST',
      steps: [
        { action: 'QUICK_SCAN', description: 'Quick targeted scan of affected files', risk: 'LOW' },
        { action: 'FAST_PATCH', description: 'Apply comprehensive patch in one go', risk: 'HIGH' },
        { action: 'BUILD_TEST', description: 'Run build and key tests', risk: 'MEDIUM' },
        { action: 'MANUAL_VERIFY', description: 'Manual spot-check of changes', risk: 'MEDIUM' },
      ],
      pros: ['Fastest', 'Single patch, no incremental overhead'],
      cons: ['High regression risk', 'Harder to debug if issues arise', 'No granular rollback'],
      score: { safety: 3, speed: 9, completeness: 7 },
    };
  }

  createIncrementalStrategy(task, context = {}) {
    return {
      name: 'Incremental',
      description: 'Balanced approach: small patches, verify between each',
      approach: 'STEPWISE_IMPROVEMENT',
      risk: 'MEDIUM',
      speed: 'MEDIUM',
      steps: [
        { action: 'BACKUP', description: 'Create backup before starting', risk: 'LOW' },
        { action: 'SCAN', description: 'Scan affected files', risk: 'LOW' },
        { action: 'PATCH_PARTIAL', description: 'Apply partial patch (phase 1)', risk: 'MEDIUM' },
        { action: 'TEST_PARTIAL', description: 'Run tests for phase 1 changes', risk: 'LOW' },
        { action: 'PATCH_PARTIAL_2', description: 'Apply partial patch (phase 2)', risk: 'MEDIUM' },
        { action: 'TEST_PARTIAL_2', description: 'Run tests for phase 2 changes', risk: 'LOW' },
        { action: 'QA_FINAL', description: 'Final QA verification', risk: 'LOW' },
      ],
      pros: ['Balanced risk/reward', 'Easy to identify which change caused issues', 'Good rollback granularity'],
      cons: ['More steps means more time', 'Some redundant testing'],
      score: { safety: 7, speed: 6, completeness: 9 },
    };
  }

  createMinimalStrategy(task, context = {}) {
    return {
      name: 'Minimal',
      description: 'Only essential changes, minimal blast radius',
      approach: 'MINIMAL_BLAST_RADIUS',
      risk: 'LOW',
      speed: 'MEDIUM',
      steps: [
        { action: 'TARGET_SCAN', description: 'Identify exact change locations', risk: 'LOW' },
        { action: 'MINIMAL_PATCH', description: 'Apply only essential changes', risk: 'LOW' },
        { action: 'TARGETED_TEST', description: 'Run targeted tests only', risk: 'LOW' },
        { action: 'SPOT_CHECK', description: 'Manual spot-check', risk: 'LOW' },
      ],
      pros: ['Lowest risk', 'Minimal impact surface', 'Fast if change is truly minimal'],
      cons: ['May not fully address root cause', 'Risk of missing related issues'],
      score: { safety: 8, speed: 7, completeness: 5 },
    };
  }

  rankStrategies(strategies) {
    // Weighted ranking: safety (40%), speed (20%), completeness (40%)
    const weighted = strategies.map(s => ({
      ...s,
      weightedScore: (s.score.safety * 0.4) + (s.score.speed * 0.2) + (s.score.completeness * 0.4),
    }));

    return weighted.sort((a, b) => b.weightedScore - a.weightedScore);
  }

  explainSelection(recommendedStrategy, alternatives) {
    const lines = [];
    lines.push(`Selected: **${recommendedStrategy.name}** (score: ${recommendedStrategy.weightedScore.toFixed(1)}/10)`);
    lines.push(`Approach: ${recommendedStrategy.approach}`);
    lines.push(`Risk: ${recommendedStrategy.risk} | Speed: ${recommendedStrategy.speed}`);
    lines.push('');
    lines.push('Why this strategy:');
    recommendedStrategy.pros.forEach(p => lines.push(`  + ${p}`));
    lines.push('');
    if (recommendedStrategy.cons.length > 0) {
      lines.push('Trade-offs:');
      recommendedStrategy.cons.forEach(c => lines.push(`  - ${c}`));
      lines.push('');
    }
    lines.push(`Steps: ${recommendedStrategy.steps.length}`);
    recommendedStrategy.steps.forEach((step, i) => {
      lines.push(`  ${i + 1}. [${step.risk}] ${step.action}: ${step.description}`);
    });

    if (alternatives.length > 0) {
      lines.push('');
      lines.push('Alternative strategies:');
      alternatives.forEach((alt, i) => {
        lines.push(`  ${i + 1}. ${alt.name} (${alt.weightedScore.toFixed(1)}/10) — ${alt.description}`);
      });
    }

    return lines.join('\n');
  }
}

export default MultiStrategyPlanner;