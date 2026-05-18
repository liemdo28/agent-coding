// reasoning/MultiStrategyPlanner.js — generate multiple strategies for a task
/**
 * Generate alternative strategies for solving a task.
 * Fully local — heuristic rule-based generation.
 *
 * @param {string} taskDescription
 * @param {{ complexity?: string, files?: string[] }} opts
 * @returns {{ strategies: Strategy[], recommended: string }}
 */
export function generateStrategies(taskDescription, opts = {}) {
  const desc       = taskDescription.toLowerCase();
  const strategies = [];

  // Always include a conservative baseline
  strategies.push({
    id:          'conservative',
    name:        'Conservative (minimal change)',
    description: 'Make the smallest possible change to achieve the goal. Lowest risk, easiest to review.',
    risk:        'low',
    effort:      'low',
    tradeoffs:   ['May not address root cause', 'Could need follow-up'],
    recommended: false,
  });

  // Balanced strategy
  strategies.push({
    id:          'balanced',
    name:        'Balanced (targeted fix)',
    description: 'Fix root cause with proper design, add tests, keep scope limited.',
    risk:        'medium',
    effort:      'medium',
    tradeoffs:   ['More work than minimal', 'Better long-term outcome'],
    recommended: true,
  });

  // Comprehensive strategy for complex tasks
  if (opts.complexity === 'high' || /refactor|architect|migrat/.test(desc)) {
    strategies.push({
      id:          'comprehensive',
      name:        'Comprehensive (full redesign)',
      description: 'Full redesign to address technical debt, improve structure, future-proof.',
      risk:        'high',
      effort:      'high',
      tradeoffs:   ['Significant effort', 'Requires extensive testing', 'Best long-term value'],
      recommended: false,
    });
  }

  // Incremental strategy for large codebases
  if ((opts.files?.length ?? 0) > 10 || /large|monorepo|multipl/.test(desc)) {
    strategies.push({
      id:          'incremental',
      name:        'Incremental (phased)',
      description: 'Break into phases, ship each independently. Keeps main stable at all times.',
      risk:        'low',
      effort:      'medium',
      tradeoffs:   ['Longer total timeline', 'Easier to review', 'Reduces risk per change'],
      recommended: false,
    });
  }

  const recommended = strategies.find((s) => s.recommended)?.id ?? 'balanced';
  return { strategies, recommended, count: strategies.length };
}
