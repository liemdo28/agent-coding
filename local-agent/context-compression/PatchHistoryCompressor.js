/**
 * Phase 54 - Patch History Compressor
 * Summarize patch history for quick context
 */
const fs = require('fs');
const path = require('path');

class PatchHistoryCompressor {
  constructor() {
    this.maxPatches = 100;
  }

  /**
   * Compress patch history
   */
  compress(patches, options = {}) {
    const { maxPatches = 50, includeDiffs = false } = options;

    const sorted = this.sortByImportance(patches);
    const compressed = sorted.slice(0, maxPatches).map(p => this.compressPatch(p, { includeDiffs }));

    return {
      patches: compressed,
      stats: this.generateStats(patches),
      summary: this.generateSummary(patches),
      total: patches.length,
      compressed: compressed.length
    };
  }

  /**
   * Sort patches by importance
   */
  sortByImportance(patches) {
    return [...patches].sort((a, b) => {
      const scoreA = this.getPatchScore(a);
      const scoreB = this.getPatchScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate patch importance score
   */
  getPatchScore(patch) {
    let score = 0;
    if (patch.status === 'applied') score += 10;
    if (patch.status === 'rolled_back') score -= 5;
    if (patch.riskLevel === 'high') score += 5;
    if (patch.filesChanged?.length) score += patch.filesChanged.length * 0.5;
    return score;
  }

  /**
   * Compress a single patch
   */
  compressPatch(patch, options = {}) {
    const { includeDiffs = false } = options;

    const compressed = {
      id: patch.patchId || patch.id,
      task: patch.task?.slice(0, 100),
      status: patch.status,
      riskLevel: patch.riskLevel,
      filesCount: patch.filesChanged?.length || 0,
      files: patch.filesChanged?.slice(0, 10),
      createdAt: patch.createdAt,
      appliedAt: patch.appliedAt
    };

    if (includeDiffs && patch.diffs) {
      compressed.diffCount = patch.diffs.length;
    }

    return compressed;
  }

  /**
   * Generate statistics
   */
  generateStats(patches) {
    const stats = {
      total: patches.length,
      applied: 0,
      proposed: 0,
      rejected: 0,
      rolledBack: 0,
      byRisk: { high: 0, medium: 0, low: 0 },
      totalFilesChanged: 0
    };

    for (const p of patches) {
      if (p.status === 'applied') stats.applied++;
      if (p.status === 'proposed') stats.proposed++;
      if (p.status === 'rejected') stats.rejected++;
      if (p.status === 'rolled_back') stats.rolledBack++;
      if (p.riskLevel === 'high') stats.byRisk.high++;
      if (p.riskLevel === 'medium') stats.byRisk.medium++;
      if (p.riskLevel === 'low') stats.byRisk.low++;
      stats.totalFilesChanged += p.filesChanged?.length || 0;
    }

    return stats;
  }

  /**
   * Generate text summary
   */
  generateSummary(patches) {
    const stats = this.generateStats(patches);
    return [
      `Total patches: ${stats.total}`,
      `Applied: ${stats.applied}, Proposed: ${stats.proposed}, Rolled back: ${stats.rolledBack}`,
      `Risk: ${stats.byRisk.high} high, ${stats.byRisk.medium} medium, ${stats.byRisk.low} low`,
      `Files changed: ${stats.totalFilesChanged}`
    ].join(' | ');
  }
}

module.exports = { PatchHistoryCompressor };