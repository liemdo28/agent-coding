/**
 * Phase 56 - Pattern Abstractor
 * Abstract patterns from cross-project learning
 */
const fs = require('fs');
const path = require('path');

class PatternAbstractor {
  constructor() {
    this.abstractPatterns = [];
  }

  /**
   * Abstract a pattern from source
   */
  abstract(source, options = {}) {
    const { type = 'general' } = options;
    
    const abstracted = {
      id: this.generateId(),
      type,
      pattern: this.extractPattern(source),
      normalizedError: this.normalizeError(source.error || source.message),
      fixRecipe: this.extractFixRecipe(source),
      framework: this.extractFramework(source),
      abstractedAt: new Date().toISOString(),
      sourceProject: source.projectId || 'unknown',
      sourceSafe: this.isSourceSafe(source)
    };

    if (abstracted.sourceSafe) {
      this.abstractPatterns.push(abstracted);
    }

    return abstracted;
  }

  /**
   * Extract pattern from source
   */
  extractPattern(source) {
    const code = source.code || source.snippet || '';
    
    // Remove specific values, keep structure
    const normalized = code
      .replace(/['"][a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"]/g, "'USER_EMAIL'")
      .replace(/\d{4,}/g, 'N')
      .replace(/[a-f0-9]{8,}/g, 'HASH')
      .replace(/localhost:\d+/g, 'localhost:PORT')
      .replace(/\/Users\/[^\/]+/g, '/Users/USER')
      .replace(/C:\\[^\\]+/g, 'C:\\PATH');
    
    return normalized.slice(0, 500);
  }

  /**
   * Normalize error message
   */
  normalizeError(error) {
    if (!error) return '';
    
    return error
      .replace(/\d+/g, 'N')
      .replace(/'[^']*'/g, "'X'")
      .replace(/"[^"]*"/g, '"X"')
      .replace(/\[[^\]]+\]/g, '[X]')
      .replace(/at [^\n]+/g, 'at ...')
      .trim()
      .slice(0, 200);
  }

  /**
   * Extract fix recipe
   */
  extractFixRecipe(source) {
    const fix = source.fix || source.solution || source.resolution || '';
    
    return {
      steps: this.extractSteps(fix),
      approach: this.classifyApproach(fix),
      keywords: this.extractKeywords(fix)
    };
  }

  /**
   * Extract fix steps
   */
  extractSteps(fix) {
    const steps = [];
    const lines = fix.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        steps.push(trimmed.replace(/^[\d.]\s*[-*]\s*/, '').slice(0, 100));
      }
    }
    
    return steps.slice(0, 5);
  }

  /**
   * Classify fix approach
   */
  classifyApproach(fix) {
    const fixLower = fix.toLowerCase();
    
    if (fixLower.includes('install') || fixLower.includes('npm')) return 'dependency';
    if (fixLower.includes('config') || fixLower.includes('setting')) return 'configuration';
    if (fixLower.includes('test') || fixLower.includes('mock')) return 'testing';
    if (fixLower.includes('restart') || fixLower.includes('rebuild')) return 'runtime';
    if (fixLower.includes('update') || fixLower.includes('upgrade')) return 'upgrade';
    
    return 'code-change';
  }

  /**
   * Extract keywords from fix
   */
  extractKeywords(fix) {
    const keywords = [];
    const techKeywords = [
      'webpack', 'vite', 'babel', 'typescript', 'eslint', 'prettier',
      'react', 'vue', 'angular', 'node', 'express', 'fastify',
      'npm', 'yarn', 'pnpm', 'docker', 'kubernetes',
      'redis', 'postgres', 'mysql', 'mongodb', 'sqlite'
    ];
    
    const fixLower = fix.toLowerCase();
    for (const kw of techKeywords) {
      if (fixLower.includes(kw)) {
        keywords.push(kw);
      }
    }
    
    return [...new Set(keywords)].slice(0, 5);
  }

  /**
   * Extract framework from source
   */
  extractFramework(source) {
    const frameworks = [
      'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
      'express', 'fastify', 'koa', 'nest',
      'vite', 'webpack', 'rollup',
      'typescript', 'javascript', 'python', 'rust', 'go'
    ];
    
    const content = JSON.stringify(source).toLowerCase();
    return frameworks.filter(fw => content.includes(fw)) || ['unknown'];
  }

  /**
   * Check if source is safe to abstract
   */
  isSourceSafe(source) {
    const content = JSON.stringify(source);
    const secretPatterns = [
      /password\s*[=:]\s*['"][^'"]+['"]/i,
      /secret\s*[=:]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/i,
      /token\s*[=:]\s*['"][^'"]+['"]/i,
      /-----BEGIN [A-Z]+ PRIVATE KEY-----/,
      /sk-[a-zA-Z0-9]{20,}/
    ];
    
    return !secretPatterns.some(p => p.test(content));
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get all abstracted patterns
   */
  getPatterns() {
    return this.abstractPatterns;
  }

  /**
   * Search patterns by error
   */
  searchPatterns(query) {
    const queryLower = query.toLowerCase();
    return this.abstractPatterns.filter(p => 
      p.normalizedError.toLowerCase().includes(queryLower) ||
      p.type.toLowerCase().includes(queryLower) ||
      p.framework.some(f => f.toLowerCase().includes(queryLower))
    );
  }
}

module.exports = { PatternAbstractor };