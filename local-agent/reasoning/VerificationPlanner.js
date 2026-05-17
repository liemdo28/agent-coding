// local-agent/reasoning/VerificationPlanner.js
// Phase 25: Verification planner — plan verification steps for fixes

export class VerificationPlanner {
  planVerification(patch, context = {}) {
    const steps = [];

    steps.push(...this.getPreApplyChecks(patch, context));
    steps.push(...this.getPostApplyChecks(patch, context));

    return {
      steps,
      criticalPath: steps.filter(s => s.critical),
      optionalSteps: steps.filter(s => !s.critical),
      estimatedDuration: this.estimateDuration(steps),
    };
  }

  getPreApplyChecks(patch, context = {}) {
    const checks = [];

    checks.push({
      id: 'PRE_BACKUP',
      name: 'Create backup',
      description: 'Ensure full project backup exists before applying patch',
      critical: true,
      risk: 'LOW',
      action: 'Verify backup exists or create one',
    });

    checks.push({
      id: 'PRE_LINT',
      name: 'Run linter',
      description: 'Verify code passes linting before changes',
      critical: false,
      risk: 'LOW',
      action: 'local-agent build --lint',
    });

    checks.push({
      id: 'PRE_BUILD',
      name: 'Verify build passes',
      description: 'Confirm project builds successfully before applying patch',
      critical: true,
      risk: 'LOW',
      action: 'local-agent build',
    });

    checks.push({
      id: 'PRE_TEST',
      name: 'Run test baseline',
      description: 'Run existing tests to establish baseline',
      critical: patch.riskLevel !== 'LOW',
      risk: 'MEDIUM',
      action: 'local-agent test',
    });

    if (this.involvesDatabase(patch)) {
      checks.push({
        id: 'PRE_DB_BACKUP',
        name: 'Backup database',
        description: 'Create database backup before migration or schema changes',
        critical: true,
        risk: 'HIGH',
        action: 'Export current database state',
      });
    }

    if (this.involvesAuth(patch)) {
      checks.push({
        id: 'PRE_AUTH_SCAN',
        name: 'Security review',
        description: 'Review auth changes for security implications',
        critical: true,
        risk: 'HIGH',
        action: 'Manual security review of auth code',
      });
    }

    return checks;
  }

  getPostApplyChecks(patch, context = {}) {
    const checks = [];

    checks.push({
      id: 'POST_BUILD',
      name: 'Verify build passes',
      description: 'Confirm project builds after applying patch',
      critical: true,
      risk: 'LOW',
      action: 'local-agent build',
    });

    checks.push({
      id: 'POST_TEST',
      name: 'Run tests',
      description: 'Run full test suite after patch',
      critical: true,
      risk: 'LOW',
      action: 'local-agent test',
    });

    checks.push({
      id: 'POST_REGRESSION',
      name: 'Regression check',
      description: 'Check for regressions in previously passing tests',
      critical: true,
      risk: 'MEDIUM',
      action: 'local-agent qa --no-build',
    });

    if (this.involvesDatabase(patch)) {
      checks.push({
        id: 'POST_DB_INTEGRITY',
        name: 'Verify database integrity',
        description: 'Check database schema and data integrity',
        critical: true,
        risk: 'HIGH',
        action: 'Run DB integrity checks',
      });
    }

    checks.push({
      id: 'POST_QA',
      name: 'Full QA verification',
      description: 'Run full QA suite for comprehensive verification',
      critical: false,
      risk: 'LOW',
      action: 'local-agent qa',
    });

    checks.push({
      id: 'POST_SMOKE',
      name: 'Smoke test',
      description: 'Quick manual smoke test of core functionality',
      critical: false,
      risk: 'LOW',
      action: 'Manual verification of key features',
    });

    return checks;
  }

  involvesDatabase(patch) {
    const patterns = ['migration', 'schema', 'model', 'db', 'database', 'sql', 'query'];
    return patch.filesChanged?.some(f => patterns.some(p => f.includes(p)));
  }

  involvesAuth(patch) {
    const patterns = ['auth', 'login', 'password', 'token', 'session', 'permission', 'role', 'access'];
    return patch.filesChanged?.some(f => patterns.some(p => f.includes(p)));
  }

  estimateDuration(steps) {
    const durationMap = { LOW: 30, MEDIUM: 120, HIGH: 300 };
    const criticalDuration = steps.filter(s => s.critical).reduce((sum, s) => sum + (durationMap[s.risk] ?? 60), 0);
    const optionalDuration = steps.filter(s => !s.critical).reduce((sum, s) => sum + (durationMap[s.risk] ?? 60), 0);

    return {
      critical: criticalDuration,
      optional: optionalDuration,
      total: criticalDuration + optionalDuration,
      formatted: this.formatDuration(criticalDuration + optionalDuration),
    };
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }

  generateVerificationReport(verificationResult) {
    const lines = [];
    lines.push('# Verification Plan');
    lines.push('');
    lines.push(`## Critical Path (${verificationResult.criticalPath.length} steps)`);
    lines.push('');
    for (const step of verificationResult.criticalPath) {
      const icon = step.risk === 'HIGH' ? '[HIGH RISK]' : step.risk === 'MEDIUM' ? '[MEDIUM]' : '[OK]';
      lines.push(`- ${icon} **${step.name}**: ${step.description}`);
      lines.push(`  Action: \`${step.action}\``);
    }
    lines.push('');
    if (verificationResult.optionalSteps.length > 0) {
      lines.push(`## Optional Checks (${verificationResult.optionalSteps.length} steps)`);
      lines.push('');
      for (const step of verificationResult.optionalSteps) {
        lines.push(`- [ ] **${step.name}**: ${step.description}`);
        lines.push(`  Action: \`${step.action}\``);
      }
      lines.push('');
    }
    lines.push(`## Estimated Duration`);
    lines.push('');
    lines.push(`- Critical: ${this.formatDuration(verificationResult.estimatedDuration.critical)}`);
    lines.push(`- Optional: ${this.formatDuration(verificationResult.estimatedDuration.optional)}`);
    lines.push(`- **Total: ${this.formatDuration(verificationResult.estimatedDuration.total)}**`);
    return lines.join('\n');
  }
}

export default VerificationPlanner;