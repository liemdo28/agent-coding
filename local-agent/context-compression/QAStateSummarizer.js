/**
 * Phase 54 - QA State Summarizer
 * Summarize QA state for quick context
 */
const fs = require('fs');
const path = require('path');

class QAStateSummarizer {
  constructor() {
    this.maxTestResults = 50;
  }

  /**
   * Summarize QA state
   */
  summarize(qaState, options = {}) {
    const { maxTests = 30 } = options;

    const summary = {
      overall: this.extractOverallState(qaState),
      build: this.summarizeBuild(qaState.buildResult),
      tests: this.summarizeTests(qaState.testResults, maxTests),
      regressions: this.summarizeRegressions(qaState.regressions),
      coverage: this.extractCoverage(qaState.coverage),
      score: qaState.qaScore || qaState.score,
      summarizedAt: new Date().toISOString()
    };

    return summary;
  }

  /**
   * Extract overall state
   */
  extractOverallState(qaState) {
    const score = qaState.qaScore?.total || qaState.score?.total || 0;
    const grade = qaState.qaScore?.grade || qaState.score?.grade || 'UNKNOWN';

    let status = 'healthy';
    if (grade === 'FAIL') status = 'failing';
    else if (grade === 'WARNING') status = 'warning';
    else if (score > 80) status = 'healthy';

    return {
      status,
      score,
      grade,
      lastRun: qaState.generatedAt || qaState.timestamp
    };
  }

  /**
   * Summarize build results
   */
  summarizeBuild(buildResult) {
    if (!buildResult) {
      return { status: 'not_run', success: null };
    }

    return {
      status: buildResult.success ? 'pass' : 'fail',
      success: buildResult.success,
      duration: buildResult.durationMs,
      errorCount: buildResult.errors?.length || 0,
      warnings: buildResult.warnings?.length || 0
    };
  }

  /**
   * Summarize test results
   */
  summarizeTests(testResults, maxTests) {
    const tests = Array.isArray(testResults) ? testResults : [];
    const summary = tests.slice(0, maxTests).map(t => ({
      name: t.name || t.testName,
      status: t.status || (t.passed ? 'pass' : 'fail'),
      duration: t.duration || t.durationMs,
      type: t.type || 'unit'
    }));

    return {
      total: tests.length,
      passed: tests.filter(t => t.passed || t.status === 'pass').length,
      failed: tests.filter(t => !t.passed || t.status === 'fail').length,
      tests: summary,
      truncated: tests.length > maxTests
    };
  }

  /**
   * Summarize regressions
   */
  summarizeRegressions(regressions) {
    const regs = Array.isArray(regressions) ? regressions : [];
    return {
      count: regs.length,
      critical: regs.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH').length,
      items: regs.slice(0, 10).map(r => ({
        description: r.message || r.description || r.summary,
        severity: r.severity,
        introducedAt: r.introducedAt || r.since
      }))
    };
  }

  /**
   * Extract coverage information
   */
  extractCoverage(coverage) {
    if (!coverage) return { available: false };

    return {
      available: true,
      lines: coverage.lines?.percent || coverage.linePercent || 0,
      branches: coverage.branches?.percent || coverage.branchPercent || 0,
      functions: coverage.functions?.percent || coverage.functionPercent || 0
    };
  }

  /**
   * Generate text summary
   */
  generateTextSummary(qaState) {
    const overall = this.extractOverallState(qaState);
    const build = this.summarizeBuild(qaState.buildResult);
    const tests = this.summarizeTests(qaState.testResults);

    return [
      `QA State: ${overall.status}`,
      `Score: ${overall.score}/100 (${overall.grade})`,
      `Build: ${build.status}`,
      `Tests: ${tests.passed}/${tests.total} passed`
    ].join(' | ');
  }
}

module.exports = { QAStateSummarizer };