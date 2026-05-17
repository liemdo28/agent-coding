// local-agent/reasoning/TaskDecomposer.js
// Phase 25: Task decomposition — break large tasks into manageable steps

export class TaskDecomposer {
  decompose(task) {
    const steps = [];
    const taskLower = task.toLowerCase();

    // Detect task category and decompose accordingly
    if (this.isAuthTask(taskLower)) {
      steps.push(...this.decomposeAuth(task));
    } else if (this.isDatabaseTask(taskLower)) {
      steps.push(...this.decomposeDatabase(task));
    } else if (this.isPerformanceTask(taskLower)) {
      steps.push(...this.decomposePerformance(task));
    } else if (this.isSecurityTask(taskLower)) {
      steps.push(...this.decomposeSecurity(task));
    } else if (this.isRefactorTask(taskLower)) {
      steps.push(...this.decomposeRefactor(task));
    } else {
      steps.push(...this.decomposeGeneric(task));
    }

    return {
      task,
      steps,
      estimatedRisk: this.estimateRisk(steps),
      estimatedTime: this.estimateTime(steps),
      canParallelize: this.canParallelize(steps),
    };
  }

  isAuthTask(task) {
    return /auth|login|password|token|jwt|session|permission|role|access/.test(task);
  }

  isDatabaseTask(task) {
    return /database|db|sql|migration|query|index|schema/.test(task);
  }

  isPerformanceTask(task) {
    return /performance|slow|speed|memory|optimize|cache|load/.test(task);
  }

  isSecurityTask(task) {
    return /security|secret|api.?key|credential|vulnerability|injection|xss|csrf/.test(task);
  }

  isRefactorTask(task) {
    return /refactor|restructure|cleanup|extract|rename|abstract/.test(task);
  }

  decomposeAuth(task) {
    return [
      { phase: 'ANALYZE', description: 'Analyze current auth implementation', risk: 'LOW', duration: 'short' },
      { phase: 'IDENTIFY', description: 'Identify all auth-related files and endpoints', risk: 'LOW', duration: 'short' },
      { phase: 'AUDIT', description: 'Audit for security vulnerabilities', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'PLAN', description: 'Plan changes with minimal breaking impact', risk: 'MEDIUM', duration: 'short' },
      { phase: 'PATCH', description: 'Apply auth fix with backup', risk: 'HIGH', duration: 'medium' },
      { phase: 'QA', description: 'Run tests and verify auth flow', risk: 'MEDIUM', duration: 'medium' },
    ];
  }

  decomposeDatabase(task) {
    return [
      { phase: 'ANALYZE', description: 'Analyze database schema and current state', risk: 'LOW', duration: 'short' },
      { phase: 'BACKUP', description: 'Create database backup before changes', risk: 'HIGH', duration: 'short' },
      { phase: 'PLAN', description: 'Plan migration with rollback strategy', risk: 'HIGH', duration: 'medium' },
      { phase: 'TEST_MIGRATION', description: 'Test migration in isolation', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'APPLY', description: 'Apply migration with monitoring', risk: 'HIGH', duration: 'short' },
      { phase: 'VERIFY', description: 'Verify data integrity after migration', risk: 'MEDIUM', duration: 'medium' },
    ];
  }

  decomposePerformance(task) {
    return [
      { phase: 'BENCHMARK', description: 'Establish performance baseline', risk: 'LOW', duration: 'short' },
      { phase: 'PROFILE', description: 'Identify performance bottlenecks', risk: 'LOW', duration: 'medium' },
      { phase: 'OPTIMIZE', description: 'Optimize identified bottlenecks', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'VERIFY', description: 'Verify performance improvement', risk: 'LOW', duration: 'short' },
      { phase: 'REGRESSION', description: 'Check for regressions in other areas', risk: 'MEDIUM', duration: 'medium' },
    ];
  }

  decomposeSecurity(task) {
    return [
      { phase: 'SCAN', description: 'Scan for security issues', risk: 'LOW', duration: 'short' },
      { phase: 'ASSESS', description: 'Assess vulnerability severity', risk: 'LOW', duration: 'short' },
      { phase: 'PLAN_FIX', description: 'Plan fix with minimal side effects', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'APPLY_FIX', description: 'Apply security fix', risk: 'HIGH', duration: 'short' },
      { phase: 'VERIFY', description: 'Verify fix addresses vulnerability', risk: 'MEDIUM', duration: 'short' },
    ];
  }

  decomposeRefactor(task) {
    return [
      { phase: 'MAP', description: 'Map current code structure', risk: 'LOW', duration: 'medium' },
      { phase: 'DEPENDENCY', description: 'Identify dependencies and impacts', risk: 'LOW', duration: 'medium' },
      { phase: 'PLAN', description: 'Plan refactor with backward compatibility', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'EXTRACT', description: 'Extract and refactor incrementally', risk: 'MEDIUM', duration: 'long' },
      { phase: 'WIRE', description: 'Wire up refactored components', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'TEST', description: 'Run full test suite', risk: 'LOW', duration: 'medium' },
    ];
  }

  decomposeGeneric(task) {
    return [
      { phase: 'ANALYZE', description: 'Analyze task requirements', risk: 'LOW', duration: 'short' },
      { phase: 'PLAN', description: 'Plan implementation approach', risk: 'LOW', duration: 'short' },
      { phase: 'IMPLEMENT', description: 'Implement the fix', risk: 'MEDIUM', duration: 'medium' },
      { phase: 'TEST', description: 'Test the changes', risk: 'LOW', duration: 'short' },
    ];
  }

  estimateRisk(steps) {
    const riskWeights = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    const maxRisk = Math.max(...steps.map(s => riskWeights[s.risk] ?? 1));
    if (maxRisk === 3) return 'HIGH';
    if (maxRisk === 2) return 'MEDIUM';
    return 'LOW';
  }

  estimateTime(steps) {
    const timeWeights = { short: 1, medium: 2, long: 3 };
    const total = steps.reduce((sum, s) => sum + (timeWeights[s.duration] ?? 1), 0);
    if (total >= 12) return 'LONG';
    if (total >= 6) return 'MEDIUM';
    return 'SHORT';
  }

  canParallelize(steps) {
    // Only adjacent ANALYZE/IDENTIFY phases can parallelize
    const earlySteps = steps.filter(s => ['ANALYZE', 'IDENTIFY', 'SCAN', 'BENCHMARK'].includes(s.phase));
    return earlySteps.length > 1;
  }
}

export default TaskDecomposer;