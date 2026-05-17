/**
 * Phase 55 - Priority Engine
 * System self-prioritizes engineering work
 */
const fs = require('fs');
const path = require('path');

class PriorityEngine {
  constructor() {
    this.riskWeights = {
      regression: 3.0,
      security: 3.0,
      unstable: 2.5,
      failedQA: 2.0,
      runtimeImpact: 2.0,
      architecture: 1.5,
      recentFailure: 1.5
    };
  }

  /**
   * Calculate priority score for a task
   */
  calculatePriority(task, context = {}) {
    const factors = this.analyzeTaskFactors(task, context);
    const score = this.computeWeightedScore(factors);
    
    return {
      score,
      level: this.getPriorityLevel(score),
      factors,
      reasoning: this.generateReasoning(factors, score)
    };
  }

  /**
   * Analyze all priority factors for a task
   */
  analyzeTaskFactors(task, context = {}) {
    const factors = {
      regressionRisk: this.assessRegressionRisk(task, context),
      securityRisk: this.assessSecurityRisk(task, context),
      moduleStability: this.assessModuleStability(task, context),
      qaStatus: this.assessQAStatus(task, context),
      runtimeImpact: this.assessRuntimeImpact(task, context),
      architectureImportance: this.assessArchitectureImportance(task, context),
      recentFailure: this.assessRecentFailure(task, context)
    };

    return factors;
  }

  /**
   * Assess regression risk
   */
  assessRegressionRisk(task, context) {
    let score = 0;
    const keywords = ['test', 'regression', 'fix', 'patch', 'change', 'update'];
    const hasRisk = keywords.some(k => task.toLowerCase().includes(k));
    
    if (hasRisk) score += this.riskWeights.regression;
    if (context.filesChanged?.length > 5) score += 1;
    if (context.sharedFiles) score += 1;
    
    return {
      score: Math.min(score, 10),
      factors: ['modifies core files', 'shared dependencies', 'test coverage']
    };
  }

  /**
   * Assess security risk
   */
  assessSecurityRisk(task, context) {
    let score = 0;
    const secKeywords = ['security', 'auth', 'permission', 'password', 'secret', 'token', 'injection'];
    const hasSecurity = secKeywords.some(k => task.toLowerCase().includes(k));
    
    if (hasSecurity) score += this.riskWeights.security;
    if (context.handlesSecrets) score += 2;
    
    return {
      score: Math.min(score, 10),
      factors: ['handles authentication', 'processes user input']
    };
  }

  /**
   * Assess module stability
   */
  assessModuleStability(task, context) {
    let score = 0;
    const unstableModules = context.unstableModules || [];
    const affectedModules = this.extractModules(task);
    
    for (const mod of affectedModules) {
      if (unstableModules.includes(mod)) score += this.riskWeights.unstable;
    }
    
    return {
      score: Math.min(score, 10),
      factors: affectedModules.length > 0 ? ['target modules identified'] : []
    };
  }

  /**
   * Assess QA status
   */
  assessQAStatus(task, context) {
    let score = 0;
    const qaHistory = context.qaHistory || [];
    const recentFails = qaHistory.filter(q => q.status === 'fail');
    
    if (recentFails.length > 0) score += this.riskWeights.failedQA;
    if (task.toLowerCase().includes('test')) score += 1;
    
    return {
      score: Math.min(score, 10),
      factors: [`${recentFails.length} recent QA failures`]
    };
  }

  /**
   * Assess runtime impact
   */
  assessRuntimeImpact(task, context) {
    let score = 0;
    const runtimeKeywords = ['performance', 'memory', 'leak', 'crash', 'timeout', 'slow'];
    const hasRuntime = runtimeKeywords.some(k => task.toLowerCase().includes(k));
    
    if (hasRuntime) score += this.riskWeights.runtimeImpact;
    if (context.runtimeCritical) score += 2;
    
    return {
      score: Math.min(score, 10),
      factors: ['runtime critical path']
    };
  }

  /**
   * Assess architecture importance
   */
  assessArchitectureImportance(task, context) {
    let score = 0;
    const archKeywords = ['architecture', 'core', 'api', 'service', 'infrastructure'];
    const hasArch = archKeywords.some(k => task.toLowerCase().includes(k));
    
    if (hasArch) score += this.riskWeights.architecture;
    if (context.coreModules?.includes(this.extractPrimaryModule(task))) score += 1;
    
    return {
      score: Math.min(score, 10),
      factors: ['core module modification']
    };
  }

  /**
   * Assess recent failure correlation
   */
  assessRecentFailure(task, context) {
    let score = 0;
    const failures = context.recentFailures || [];
    const taskWords = task.toLowerCase().split(/\s+/);
    
    for (const failure of failures.slice(0, 5)) {
      const failureWords = failure.toLowerCase().split(/\s+/);
      const overlap = taskWords.filter(w => failureWords.includes(w)).length;
      if (overlap > 2) score += this.riskWeights.recentFailure;
    }
    
    return {
      score: Math.min(score, 10),
      factors: score > 0 ? ['related to recent failures'] : []
    };
  }

  /**
   * Compute weighted score from factors
   */
  computeWeightedScore(factors) {
    let total = 0;
    const weights = this.riskWeights;
    
    total += factors.regressionRisk.score * 0.25;
    total += factors.securityRisk.score * 0.25;
    total += factors.moduleStability.score * 0.15;
    total += factors.qaStatus.score * 0.15;
    total += factors.runtimeImpact.score * 0.1;
    total += factors.architectureImportance.score * 0.05;
    total += factors.recentFailure.score * 0.05;
    
    return Math.min(Math.round(total * 10) / 10, 10);
  }

  /**
   * Get priority level from score
   */
  getPriorityLevel(score) {
    if (score >= 7.5) return 'CRITICAL';
    if (score >= 5.5) return 'HIGH';
    if (score >= 3.5) return 'MEDIUM';
    if (score >= 1.5) return 'LOW';
    return 'TRIVIAL';
  }

  /**
   * Generate priority reasoning
   */
  generateReasoning(factors, score) {
    const reasons = [];
    
    if (factors.regressionRisk.score > 2) reasons.push('high regression risk');
    if (factors.securityRisk.score > 2) reasons.push('security concerns');
    if (factors.moduleStability.score > 2) reasons.push('unstable modules affected');
    if (factors.qaStatus.score > 2) reasons.push('related to QA failures');
    if (factors.runtimeImpact.score > 2) reasons.push('runtime impact');
    
    return reasons.length > 0 ? reasons.join(', ') : 'routine maintenance';
  }

  /**
   * Extract modules from task description
   */
  extractModules(task) {
    const modulePattern = /[A-Z][a-zA-Z]+(?:Controller|Service|Model|Component|Module)/g;
    return task.match(modulePattern) || [];
  }

  /**
   * Extract primary module
   */
  extractPrimaryModule(task) {
    const modules = this.extractModules(task);
    return modules[0] || 'unknown';
  }

  /**
   * Prioritize a list of tasks
   */
  prioritizeTasks(tasks, context = {}) {
    const prioritized = tasks.map(task => ({
      task,
      priority: this.calculatePriority(task, context)
    }));

    return prioritized.sort((a, b) => b.priority.score - a.priority.score);
  }
}

module.exports = { PriorityEngine };