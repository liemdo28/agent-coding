/**
 * Phase 54 - Engineering Context Compression Engine
 * Core context compressor for reducing context overload
 */
const fs = require('fs');
const path = require('path');

class ContextCompressor {
  constructor() {
    this.compressionStats = {
      totalCompressions: 0,
      bytesIn: 0,
      bytesOut: 0
    };
  }

  /**
   * Compress full context to summary
   */
  compress(fullContext, options = {}) {
    const {
      targetRatio = 0.1,  // Target 10% of original size
      preservePatterns = [],
      maxTokens = 8000
    } = options;

    this.compressionStats.totalCompressions++;
    const originalSize = typeof fullContext === 'string' 
      ? fullContext.length 
      : JSON.stringify(fullContext).length;
    
    this.compressionStats.bytesIn += originalSize;

    const compressed = {
      summary: this.extractSummary(fullContext),
      keyPatterns: this.extractKeyPatterns(fullContext),
      compressedAt: new Date().toISOString(),
      originalSize,
      compressionRatio: targetRatio
    };

    const outputSize = JSON.stringify(compressed).length;
    this.compressionStats.bytesOut += outputSize;

    return compressed;
  }

  /**
   * Extract summary from any context type
   */
  extractSummary(context) {
    if (!context) return { summary: 'Empty context', version: '1.0' };
    
    if (typeof context === 'string') {
      return this.compressTextContext(context);
    }
    
    if (context.files) {
      return this.compressFileContext(context);
    }
    
    if (context.logs) {
      return this.compressLogContext(context);
    }

    return this.compressObjectContext(context);
  }

  /**
   * Compress text-based context
   */
  compressTextContext(text) {
    const lines = text.split('\n');
    const important = this.filterImportantLines(lines);
    
    return {
      type: 'text',
      lineCount: lines.length,
      compressedLineCount: important.length,
      ratio: (important.length / Math.max(lines.length, 1)).toFixed(2),
      content: important.join('\n'),
      keyTerms: this.extractKeyTerms(text)
    };
  }

  /**
   * Compress file-based context
   */
  compressFileContext(context) {
    return {
      type: 'files',
      fileCount: context.files?.length || 0,
      files: context.files?.slice(0, 50).map(f => ({
        path: f.path || f.relPath,
        size: f.size,
        tokens: f.tokens,
        relevance: f.relevance || 0.5
      })),
      totalTokens: context.totalTokens || 0,
      truncated: (context.files?.length || 0) > 50
    };
  }

  /**
   * Compress log-based context
   */
  compressLogContext(context) {
    const logs = context.logs || [];
    const grouped = this.groupLogPatterns(logs);
    
    return {
      type: 'logs',
      totalEntries: logs.length,
      patterns: grouped,
      errorCount: logs.filter(l => l.level === 'ERROR').length,
      warningCount: logs.filter(l => l.level === 'WARN').length,
      summary: this.generateLogSummary(grouped)
    };
  }

  /**
   * Compress generic object context
   */
  compressObjectContext(context) {
    const keys = Object.keys(context);
    const summary = {};
    
    for (const key of keys.slice(0, 20)) {
      const value = context[key];
      if (typeof value === 'object') {
        summary[key] = `[${Array.isArray(value) ? 'array' : 'object'}: ${JSON.stringify(value).length} bytes]`;
      } else {
        summary[key] = String(value).slice(0, 100);
      }
    }

    return {
      type: 'object',
      keysIncluded: keys.length,
      keysShown: Math.min(keys.length, 20),
      summary
    };
  }

  /**
   * Filter important lines (errors, warnings, key actions)
   */
  filterImportantLines(lines) {
    const important = [];
    const patterns = [
      /ERROR|FAIL|FATAL/i,
      /WARNING|WARN/i,
      /exception|undefined|null/i,
      /function|class|const|import|export/i,
      /TODO|FIXME|HACK/i,
      /===|---|\+\+\+/,
      /^[0-9]+ errors?/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isImportant = patterns.some(p => p.test(line));
      const isNearError = lines.slice(Math.max(0, i - 5), i + 3)
        .some(l => /ERROR|FAIL/i.test(l));

      if (isImportant || isNearError) {
        important.push(line);
      }
    }

    return important;
  }

  /**
   * Extract key terms from text
   */
  extractKeyTerms(text) {
    const words = text.toLowerCase().split(/\W+/);
    const freq = {};
    
    for (const word of words) {
      if (word.length > 3) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));
  }

  /**
   * Extract key patterns from context
   */
  extractKeyPatterns(context) {
    const patterns = [];
    
    // Error patterns
    const text = typeof context === 'string' ? context : JSON.stringify(context);
    const errorMatches = text.match(/[A-Z_]+_(ERROR|FAIL|EXCEPTION):[^\n]*/g) || [];
    patterns.push(...errorMatches.map(m => ({ type: 'error', pattern: m })));

    // File patterns
    const fileMatches = text.match(/\/[\w\-\/\.]+\.[\w]+/g) || [];
    const uniqueFiles = [...new Set(fileMatches)].slice(0, 30);
    patterns.push(...uniqueFiles.map(f => ({ type: 'file', pattern: f })));

    return patterns;
  }

  /**
   * Group log patterns for compression
   */
  groupLogPatterns(logs) {
    const groups = {};
    
    for (const log of logs) {
      const key = this.getLogPatternKey(log);
      if (!groups[key]) {
        groups[key] = { pattern: key, count: 0, examples: [] };
      }
      groups[key].count++;
      if (groups[key].examples.length < 3) {
        groups[key].examples.push(log.message || log.msg || String(log));
      }
    }

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }

  /**
   * Get pattern key for log grouping
   */
  getLogPatternKey(log) {
    const msg = log.message || log.msg || '';
    const normalized = msg
      .replace(/\d+/g, 'N')
      .replace(/'[^']*'/g, "'X'")
      .replace(/"[^"]*"/g, '"X"')
      .replace(/\[ERROR\]|\[WARN\]|\[INFO\]/gi, '');
    return normalized.trim().slice(0, 80);
  }

  /**
   * Generate log summary
   */
  generateLogSummary(grouped) {
    const top = grouped.slice(0, 5);
    return top.map(g => `${g.pattern}: ${g.count}x`).join(' | ');
  }

  /**
   * Get compression statistics
   */
  getStats() {
    const { totalCompressions, bytesIn, bytesOut } = this.compressionStats;
    return {
      ...this.compressionStats,
      overallRatio: bytesIn > 0 ? (bytesOut / bytesIn).toFixed(3) : 0
    };
  }
}

module.exports = { ContextCompressor };