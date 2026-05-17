// local-agent/reasoning/RiskWeightedPlanner.js
// Phase 25: Risk-weighted planner — estimate and minimize patch risk

export class RiskWeightedPlanner {
  estimatePatchRisk(patch, context = {}) {
    const factors = this.analyzeRiskFactors(patch, context);
    const totalScore = this.calculateRiskScore(factors);
    const riskLevel = this.scoreToRiskLevel(totalScore);

    return {
      score: totalScore,
      level: riskLevel,
      factors,
      recommendation: this.getRecommendation(riskLevel, factors),
      warnings: this.getWarnings(factors),
    };
  }

  analyzeRiskFactors(patch, context = {}) {
    const factors = [];

    // Factor: Number of files changed
    const fileCount = patch.filesChanged?.length ?? 0;
    if (fileCount > 10) {
      factors.push({ name: 'HIGH_FILE_COUNT', weight: 0.15, value: fileCount, severity: 'HIGH' });
    } else if (fileCount > 5) {
      factors.push({ name: 'MEDIUM_FILE_COUNT', weight: 0.08, value: fileCount, severity: 'MEDIUM' });
    } else {
      factors.push({ name: 'LOW_FILE_COUNT', weight: 0.02, value: fileCount, severity: 'LOW' });
    }

    // Factor: Core vs peripheral files
    const coreFiles = ['main.js', 'index.js', 'server.js', 'app.js', 'root.js'];
    const hasCoreFiles = patch.filesChanged?.some(f => coreFiles.some(c => f.includes(c)));
    if (hasCoreFiles) {
      factors.push({ name: 'CORE_FILE_MODIFIED', weight: 0.2, value: true, severity: 'HIGH' });
    }

    // Factor: Database migrations
    const hasDBMigration = patch.filesChanged?.some(f => f.includes('migration') || f.includes('schema'));
    if (hasDBMigration) {
      factors.push({ name: 'DB_MIGRATION', weight: 0.25, value: true, severity: 'CRITICAL' });
    }

    // Factor: Auth/security changes
    const hasAuthChanges = patch.filesChanged?.some(f => f.includes('auth') || f.includes('security'));
    if (hasAuthChanges) {
      factors.push({ name: 'AUTH_CHANGE', weight: 0.2, value: true, severity: 'HIGH' });
    }

    // Factor: Test coverage
    const hasTests = patch.filesChanged?.some(f => f.includes('.test.') || f.includes('.spec.'));
    if (!hasTests) {
      factors.push({ name: 'NO_TEST_COVERAGE', weight: 0.1, value: true, severity: 'MEDIUM' });
    }

    // Factor: Third-party changes
    const thirdPartyPatterns = ['node_modules', 'package.json', 'vendor/', 'externals/'];
    const hasThirdParty = patch.filesChanged?.some(f => thirdPartyPatterns.some(p => f.includes(p)));
    if (hasThirdParty) {
      factors.push({ name: 'THIRD_PARTY_CHANGE', weight: 0.15, value: true, severity: 'MEDIUM' });
    }

    // Factor: API contract changes
    const apiPatterns = ['api', 'routes', 'endpoints', 'controller'];
    const hasAPIChanges = patch.filesChanged?.some(f => apiPatterns.some(p => f.includes(p)));
    if (hasAPIChanges) {
      factors.push({ name: 'API_CONTRACT_CHANGE', weight: 0.12, value: true, severity: 'MEDIUM' });
    }

    return factors;
  }

  calculateRiskScore(factors) {
    // Base score starts at 0 (no risk)
    let score = 0;

    // Sum weighted severity scores
    for (const factor of factors) {
      const severityScore = factor.severity === 'CRITICAL' ? 1.0 : factor.severity === 'HIGH' ? 0.7 : factor.severity === 'MEDIUM' ? 0.4 : 0.1;
      score += severityScore * factor.weight * 10;
    }

    return Math.min(10, score);
  }

  scoreToRiskLevel(score) {
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    if (score >= 2) return 'LOW';
    return 'MINIMAL';
  }

  getRecommendation(riskLevel, factors) {
    const recommendations = {
      CRITICAL: 'Do NOT apply without full backup and manual review. Consider breaking into smaller patches.',
      HIGH: 'Apply with extreme caution. Full backup required. Run comprehensive tests before and after.',
      MEDIUM: 'Apply with backup. Run targeted tests. Monitor closely after application.',
      LOW: 'Safe to apply with basic backup. Run normal test suite.',
      MINIMAL: 'Very safe. Apply with normal workflow.',
    };

    const severity = factors.some(f => f.severity === 'CRITICAL') ? 'CRITICAL' : riskLevel;
    return recommendations[severity] ?? recommendations.LOW;
  }

  getWarnings(factors) {
    return factors.map(f => ({
      type: f.name,
      warning: this.getWarningMessage(f),
      severity: f.severity,
    }));
  }

  getWarningMessage(factor) {
    const messages = {
      HIGH_FILE_COUNT: `Modifying ${factor.value} files increases blast radius`,
      MEDIUM_FILE_COUNT: `Modifying ${factor.value} files — moderate impact`,
      CORE_FILE_MODIFIED: 'Core application files being modified — high impact',
      DB_MIGRATION: 'Database migration detected — data loss possible if rollback fails',
      AUTH_CHANGE: 'Authentication/security changes — verify all access paths',
      NO_TEST_COVERAGE: 'No test files modified — regression risk increased',
      THIRD_PARTY_CHANGE: 'Third-party dependencies changing — verify compatibility',
      API_CONTRACT_CHANGE: 'API endpoints changing — verify client compatibility',
    };
    return messages[factor.name] ?? `Risk factor: ${factor.name}`;
  }

  planWithRiskConstraints(task, maxRiskLevel = 'HIGH') {
    const riskLevels = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const maxIndex = riskLevels.indexOf(maxRiskLevel);

    return {
      maxRiskLevel,
      allowed: maxIndex >= 2,
      message: maxIndex >= 2
        ? `Risk level ${maxRiskLevel} is within acceptable bounds`
        : `Risk level ${maxRiskLevel} exceeds recommended threshold`,
    };
  }
}

export default RiskWeightedPlanner;