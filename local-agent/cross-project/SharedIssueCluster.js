/**
 * Phase 56 - Shared Issue Cluster
 * Cluster similar issues across projects
 */
const fs = require('fs');
const path = require('path');

class SharedIssueCluster {
  constructor() {
    this.clusters = [];
    this.similarityThreshold = 0.7;
  }

  /**
   * Cluster issues by similarity
   */
  cluster(issues, options = {}) {
    const { threshold = 0.7 } = options;
    this.similarityThreshold = threshold;

    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < issues.length; i++) {
      if (assigned.has(i)) continue;

      const cluster = {
        id: this.generateId(),
        canonical: issues[i],
        issues: [issues[i]],
        projectCount: 1,
        projects: [issues[i].projectId || 'unknown'],
        firstSeen: issues[i].createdAt || new Date().toISOString(),
        lastSeen: issues[i].updatedAt || issues[i].createdAt || new Date().toISOString()
      };

      assigned.add(i);

      for (let j = i + 1; j < issues.length; j++) {
        if (assigned.has(j)) continue;

        const similarity = this.calculateSimilarity(issues[i], issues[j]);
        if (similarity >= this.similarityThreshold) {
          cluster.issues.push(issues[j]);
          assigned.add(j);

          const projId = issues[j].projectId || 'unknown';
          if (!cluster.projects.includes(projId)) {
            cluster.projects.push(projId);
            cluster.projectCount++;
          }

          const updated = issues[j].updatedAt || issues[j].createdAt;
          if (updated > cluster.lastSeen) {
            cluster.lastSeen = updated;
          }
        }
      }

      clusters.push(cluster);
    }

    this.clusters = clusters;
    return clusters;
  }

  /**
   * Calculate similarity between two issues
   */
  calculateSimilarity(a, b) {
    let score = 0;
    let maxScore = 0;

    // Error type similarity
    if (a.errorType && b.errorType) {
      maxScore += 3;
      if (a.errorType === b.errorType) score += 3;
      else if (this.normalizeText(a.errorType) === this.normalizeText(b.errorType)) score += 2;
    }

    // Error message similarity
    if (a.message && b.message) {
      maxScore += 4;
      score += this.jaccardSimilarity(
        this.tokenize(a.message),
        this.tokenize(b.message)
      ) * 4;
    }

    // Framework similarity
    if (a.framework && b.framework) {
      maxScore += 2;
      if (Array.isArray(a.framework) && Array.isArray(b.framework)) {
        const overlap = a.framework.filter(f => b.framework.includes(f)).length;
        score += overlap / Math.max(a.framework.length, b.framework.length) * 2;
      } else if (a.framework === b.framework) {
        score += 2;
      }
    }

    // Stack trace similarity
    if (a.stack && b.stack) {
      maxScore += 3;
      const aFrames = this.extractStackFrames(a.stack);
      const bFrames = this.extractStackFrames(b.stack);
      score += this.jaccardSimilarity(aFrames, bFrames) * 3;
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Normalize text for comparison
   */
  normalizeText(text) {
    return text.toLowerCase()
      .replace(/[0-9]+/g, 'N')
      .replace(/'[^']*'/g, "'X'")
      .replace(/"[^"]*"/g, '"X"')
      .trim();
  }

  /**
   * Tokenize text
   */
  tokenize(text) {
    return this.normalizeText(text)
      .split(/\W+/)
      .filter(t => t.length > 2);
  }

  /**
   * Jaccard similarity
   */
  jaccardSimilarity(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extract stack frames
   */
  extractStackFrames(stack) {
    return stack.split('\n')
      .map(line => {
        const match = line.match(/at\\s+(.+?)\\s+\\(/);
        return match ? match[1] : '';
      })
      .filter(f => f.length > 0);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get clusters affecting multiple projects
   */
  getCrossProjectClusters() {
    return this.clusters.filter(c => c.projectCount > 1);
  }

  /**
   * Get frequent issues
   */
  getFrequentIssues(minCount = 2) {
    return this.clusters
      .filter(c => c.issues.length >= minCount)
      .sort((a, b) => b.issues.length - a.issues.length);
  }

  /**
   * Generate cluster report
   */
  generateReport() {
    const crossProject = this.getCrossProjectClusters();
    const frequent = this.getFrequentIssues();

    return {
      totalClusters: this.clusters.length,
      crossProjectClusters: crossProject.length,
      frequentIssues: frequent.length,
      averageClusterSize: this.clusters.reduce((sum, c) => sum + c.issues.length, 0) / Math.max(this.clusters.length, 1),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { SharedIssueCluster };