/**
 * Phase 56 - Cross Project Learning
 * Learn patterns across multiple projects
 */
const fs = require('fs');
const path = require('path');

class CrossProjectLearning {
  constructor() {
    this.learnedPatterns = [];
    this.projectPatterns = new Map();
  }

  /**
   * Learn from a project
   */
  learn(projectId, patterns, options = {}) {
    const { updateExisting = true } = options;

    const learned = patterns.map(p => ({
      ...p,
      projectId,
      learnedAt: new Date().toISOString(),
      successCount: p.successCount || 0,
      failureCount: p.failureCount || 0
    }));

    if (!this.projectPatterns.has(projectId)) {
      this.projectPatterns.set(projectId, []);
    }

    if (updateExisting) {
      this.mergePatterns(projectId, learned);
    } else {
      this.projectPatterns.get(projectId).push(...learned);
    }

    this.updateGlobalPatterns();

    return {
      projectId,
      patternsLearned: learned.length,
      totalGlobal: this.learnedPatterns.length
    };
  }

  /**
   * Merge new patterns with existing
   */
  mergePatterns(projectId, newPatterns) {
    const existing = this.projectPatterns.get(projectId) || [];

    for (const newP of newPatterns) {
      const existingIdx = existing.findIndex(
        e => this.patternsMatch(e, newP)
      );

      if (existingIdx >= 0) {
        existing[existingIdx] = this.mergePattern(
          existing[existingIdx],
          newP
        );
      } else {
        existing.push(newP);
      }
    }

    this.projectPatterns.set(projectId, existing);
  }

  /**
   * Check if patterns match
   */
  patternsMatch(a, b) {
    if (a.normalizedError && b.normalizedError) {
      return a.normalizedError === b.normalizedError;
    }
    if (a.type && b.type) {
      return a.type === b.type;
    }
    return false;
  }

  /**
   * Merge two pattern records
   */
  mergePattern(existing, newP) {
    return {
      ...existing,
      successCount: (existing.successCount || 0) + (newP.successCount || 0),
      failureCount: (existing.failureCount || 0) + (newP.failureCount || 0),
      lastUsed: newP.learnedAt,
      sources: [
        ...(existing.sources || [existing.projectId]),
        newP.projectId
      ]
    };
  }

  /**
   * Update global pattern knowledge
   */
  updateGlobalPatterns() {
    const globalMap = new Map();

    for (const [projectId, patterns] of this.projectPatterns) {
      for (const p of patterns) {
        const key = p.normalizedError || p.type || p.pattern;
        if (!globalMap.has(key)) {
          globalMap.set(key, { ...p, projects: [projectId] });
        } else {
          const existing = globalMap.get(key);
          existing.successCount += p.successCount || 0;
          existing.failureCount += p.failureCount || 0;
          if (!existing.projects.includes(projectId)) {
            existing.projects.push(projectId);
          }
        }
      }
    }

    this.learnedPatterns = Array.from(globalMap.values());
  }

  /**
   * Get patterns applicable to a project
   */
  getApplicablePatterns(projectId) {
    const projectPatterns = this.projectPatterns.get(projectId) || [];

    return this.learnedPatterns.filter(p => {
      if (p.projects.includes(projectId)) {
        return true;
      }

      const projectSimilar = projectPatterns.find(
        pp => this.patternsMatch(pp, p)
      );
      return !projectSimilar;
    });
  }

  /**
   * Get cross-project patterns
   */
  getCrossProjectPatterns() {
    return this.learnedPatterns.filter(
      p => (p.projects?.length || 0) > 1
    );
  }

  /**
   * Audit pattern sharing
   */
  auditSharing() {
    const total = this.learnedPatterns.length;
    const crossProject = this.getCrossProjectPatterns();
    const projectCount = this.projectPatterns.size;

    return {
      totalPatterns: total,
      crossProjectPatterns: crossProject.length,
      projects: projectCount,
      sharedRate: projectCount > 0 ? crossProject.length / total : 0,
      auditedAt: new Date().toISOString()
    };
  }

  /**
   * Export patterns (sanitized)
   */
  exportPatterns(options = {}) {
    const { includePrivate = false } = options;

    if (includePrivate) {
      return this.learnedPatterns;
    }

    return this.learnedPatterns.map(p => ({
      ...p,
      sources: undefined,
      projects: [`${p.projects?.length || 0} projects`]
    }));
  }

  /**
   * Import patterns
   */
  importPatterns(patterns, options = {}) {
    const { projectId = 'imported' } = options;

    return this.learn(projectId, patterns, options);
  }
}

module.exports = { CrossProjectLearning };