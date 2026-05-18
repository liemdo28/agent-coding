// reasoning/TaskDecomposer.js — break a high-level task into ordered sub-tasks
/**
 * Decompose a task description into a list of discrete steps.
 * Fully local — no LLM call; uses heuristic keyword matching + template library.
 *
 * @param {string} taskDescription
 * @param {{ files?: string[], context?: string }} opts
 * @returns {{ steps: Array<Step>, complexity: 'low'|'medium'|'high', confidence: number }}
 */
export function decompose(taskDescription, opts = {}) {
  const desc  = taskDescription.toLowerCase();
  const steps = [];
  let complexity = 'low';

  // Detect task category
  if (/refactor|restructur|reorganiz/.test(desc)) {
    complexity = 'high';
    steps.push(...TEMPLATES.refactor);
  } else if (/bug|fix|error|crash|fail/.test(desc)) {
    complexity = 'medium';
    steps.push(...TEMPLATES.bugfix);
  } else if (/add|implement|creat|build|new feature/.test(desc)) {
    complexity = /integrat|migrat|architect/.test(desc) ? 'high' : 'medium';
    steps.push(...TEMPLATES.feature);
  } else if (/test|spec|coverage/.test(desc)) {
    complexity = 'low';
    steps.push(...TEMPLATES.testing);
  } else if (/doc|comment|readme/.test(desc)) {
    complexity = 'low';
    steps.push(...TEMPLATES.docs);
  } else if (/optim|perf|speed|slow/.test(desc)) {
    complexity = 'medium';
    steps.push(...TEMPLATES.optimization);
  } else if (/secur|auth|permission|vulnerab/.test(desc)) {
    complexity = 'high';
    steps.push(...TEMPLATES.security);
  } else {
    steps.push(...TEMPLATES.generic);
  }

  // Adjust for file count
  if ((opts.files?.length ?? 0) > 20) complexity = 'high';

  // Confidence: heuristic quality estimate
  const confidence = complexity === 'low' ? 0.85 : complexity === 'medium' ? 0.75 : 0.65;

  return {
    steps: steps.map((s, i) => ({ seq: i + 1, ...s })),
    complexity,
    confidence,
    taskDescription,
  };
}

const TEMPLATES = {
  bugfix: [
    { phase: 'understand',  description: 'Reproduce and understand the bug' },
    { phase: 'locate',      description: 'Locate root cause in source files' },
    { phase: 'plan',        description: 'Design minimal fix' },
    { phase: 'implement',   description: 'Apply fix' },
    { phase: 'test',        description: 'Write regression test' },
    { phase: 'verify',      description: 'Confirm fix, no regressions' },
  ],
  feature: [
    { phase: 'scope',       description: 'Define feature scope and acceptance criteria' },
    { phase: 'design',      description: 'Design API / data model' },
    { phase: 'implement',   description: 'Implement core logic' },
    { phase: 'integrate',   description: 'Wire into existing code paths' },
    { phase: 'test',        description: 'Write unit + integration tests' },
    { phase: 'document',    description: 'Update docs / changelog' },
  ],
  refactor: [
    { phase: 'audit',       description: 'Audit current code structure' },
    { phase: 'plan',        description: 'Define target structure' },
    { phase: 'safety',      description: 'Add tests to protect existing behaviour' },
    { phase: 'move',        description: 'Move / rename in small safe steps' },
    { phase: 'update-refs', description: 'Update all import references' },
    { phase: 'verify',      description: 'Full test suite, no breakage' },
  ],
  testing: [
    { phase: 'audit',       description: 'Identify untested paths' },
    { phase: 'plan',        description: 'Plan test cases' },
    { phase: 'write',       description: 'Write tests' },
    { phase: 'run',         description: 'Run and achieve target coverage' },
  ],
  docs: [
    { phase: 'audit',       description: 'Identify missing / outdated docs' },
    { phase: 'write',       description: 'Write / update documentation' },
    { phase: 'review',      description: 'Self-review for accuracy' },
  ],
  optimization: [
    { phase: 'measure',     description: 'Benchmark current performance' },
    { phase: 'profile',     description: 'Identify hotspots' },
    { phase: 'optimize',    description: 'Apply targeted optimizations' },
    { phase: 'verify',      description: 'Benchmark again, confirm improvement' },
  ],
  security: [
    { phase: 'threat-model', description: 'Define threat model' },
    { phase: 'audit',        description: 'Audit current code for vulnerabilities' },
    { phase: 'fix',          description: 'Fix identified issues' },
    { phase: 'harden',       description: 'Add defensive layers' },
    { phase: 'test',         description: 'Security regression tests' },
  ],
  generic: [
    { phase: 'understand',  description: 'Understand the task fully' },
    { phase: 'plan',        description: 'Plan approach' },
    { phase: 'implement',   description: 'Implement' },
    { phase: 'verify',      description: 'Verify correctness' },
  ],
};
