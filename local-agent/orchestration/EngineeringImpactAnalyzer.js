/**
 * Phase 55 - Engineering Impact Analyzer
 * Analyze engineering impact of tasks
 */
const fs = require('fs');
const path = require('path');

class EngineeringImpactAnalyzer {
  constructor() {
    this.impactWeights = {
      filesChanged: 1.0,
      criticalPath: 2.0,
      publicAPI: 1.5,
      testCoverage: 0.5,
      documentation: 0.3
    };
  }

  /**
   * Analyze impact of a task
   */
  analyze(task, context = {}) {
    const impact = {
      overall: this.calculateOverallImpact(task, context),
      dimensions: this.analyzeDimensions(task, context),
      risk: this.analyzeRisk(task, context),
      effort: this.estimateEffort(task, context)
    };

    return impact;
  }

  /**
   * Calculate overall impact score
   */
  calculateOverallImpact(task, context) {
    const dimensions = this.analyzeDimensions(task, context);
    const weights = this.impactWeights;

    const score = (
      dimensions.codeImpact.score * 0.3 +
      dimensions.userImpact.score * 0.25 +
      dimensions.maintainabilityImpact.score * 0.2 +
      dimensions.performanceImpact.score * 0.15 +
      dimensions.securityImpact.score * 0.1
    );

    return {
      score: Math.min(Math.round(score * 10) / 10, 10),
      level: this.getImpactLevel(score)
    };
  }

  /**
   * Analyze all impact dimensions
   */
  analyzeDimensions(task, context) {
    return {
      codeImpact: this.analyzeCodeImpact(task, context),
      userImpact: this.analyzeUserImpact(task, context),
      maintainabilityImpact: this.analyzeMaintainabilityImpact(task, context),
      performanceImpact: this.analyzePerformanceImpact(task, context),
      securityImpact: this.analyzeSecurityImpact(task, context)
    };
  }

  /**
   * Analyze code impact
   */
  analyzeCodeImpact(task, context) {
    let score = 0;
    const factors = [];

    if (context.filesChanged?.length > 10) {
      score += 3;
      factors.push('Many files affected');
    } else if (context.filesChanged?.length > 5) {
      score += 2;
      factors.push('Several files affected');
    }

    if (context.coreFiles) {
      score += 3;
      factors.push('Core files modified');
    }

    if (task.toLowerCase().includes('refactor')) {
      score += 2;
      factors.push('Refactoring');
    }

    return { score: Math.min(score, 10), factors };
  }

  /**
   * Analyze user impact
   */
  analyzeUserImpact(task, context) {
    let score = 0;
    const factors = [];

    const userKeywords = ['ui', 'ux', 'user', 'customer', 'display', 'render', 'form'];
    if (userKeywords.some(k => task.toLowerCase().includes(k))) {
      score += 4;
      factors.push('Direct user-facing change');
    }

    if (context.publicAPI) {
      score += 3;
      factors.push('Public API modification');
    }

    return { score: Math.min(score, 10), factors };
  }

  /**
   * Analyze maintainability impact
   */
  analyzeMaintainabilityImpact(task, context) {
    let score = 0;
    const factors = [];

    const maintKeywords = ['refactor', 'cleanup', 'simplify', 'document', 'test'];
    if (maintKeywords.some(k => task.toLowerCase().includes(k))) {
      score += 3;
      factors.push('Improves maintainability');
    }

    if (context.addsTests) {
      score += 2;
      factors.push('Test coverage added');
    }

    return { score: Math.min(score, 10), factors };
  }

  /**
   * Analyze performance impact
   */
  analyzePerformanceImpact(task, context) {
    let score = 0;
    const factors = [];

    const perfKeywords = ['performance', 'speed', 'optimize', 'cache', 'memory', 'slow'];
    if (perfKeywords.some(k => task.toLowerCase().includes(k))) {
      score += 5;
      factors.push('Performance optimization');
    }

    return { score: Math.min(score, 10), factors };
  }

  /**
   * Analyze security impact
   */
  analyzeSecurityImpact(task, context) {
    let score = 0;
    const factors = [];

    const secKeywords = ['security', 'auth', 'permission', 'password', 'token', 'encrypt'];
    if (secKeywords.some(k => task.toLowerCase().includes(k))) {
      score += 5;
      factors.push('Security-related change');
    }

    return { score: Math.min(score, 10), factors };
  }

  /**
   * Analyze risk
   */
  analyzeRisk(task, context) {
    let level = 'LOW';
    let score = 0;

    if (context.criticalPath) {
      score += 3;
    }

    if (context.noTests) {
      score += 2;
    }

    if (context.rollsBack) {
      score -= 1;
    }

    if (score >= 4) level = 'HIGH';
    else if (score >= 2) level = 'MEDIUM';

    return { level, score: Math.max(0, score) };
  }

  /**
   * Estimate effort
   */
  estimateEffort(task, context) {
    let hours = 1;
    let level = 'SMALL';

    if (context.filesChanged?.length > 20) {
      hours = 40;
      level = 'LARGE';
    } else if (context.filesChanged?.length > 10) {
      hours = 16;
      level = 'MEDIUM';
    } else if (context.filesChanged?.length > 5) {
      hours = 8;
      level = 'SMALL';
    }

    return { hours, level };
  }

  /**
   * Get impact level from score
   */
  getImpactLevel(score) {
    if (score >= 7.5) return 'CRITICAL';
    if (score >= 5.5) return 'HIGH';
    if (score >= 3.5) return 'MEDIUM';
    if (score >= 1.5) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Generate impact report
   */
  generateReport(impacts) {
    return {
      summary: impacts.overall,
      breakdown: impacts.dimensions,
      risk: impacts.risk,
      effort: impacts.effort,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { EngineeringImpactAnalyzer };