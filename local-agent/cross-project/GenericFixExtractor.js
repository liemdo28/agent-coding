/**
 * Phase 56 - Generic Fix Extractor
 * Extract reusable fix patterns
 */
const fs = require('fs');
const path = require('path');

class GenericFixExtractor {
  constructor() {
    this.fixes = [];
  }

  /**
   * Extract generic fix from source fix
   */
  extract(sourceFix, options = {}) {
    const { minConfidence = 0.5 } = options;

    const extracted = {
      id: this.generateId(),
      type: this.classifyFixType(sourceFix),
      genericSteps: this.extractGenericSteps(sourceFix),
      conditions: this.extractConditions(sourceFix),
      applicability: this.analyzeApplicability(sourceFix),
      confidence: this.calculateConfidence(sourceFix),
      framework: sourceFix.framework || [],
      technology: sourceFix.technology || [],
      abstractedAt: new Date().toISOString()
    };

    if (extracted.confidence >= minConfidence) {
      this.fixes.push(extracted);
    }

    return extracted;
  }

  /**
   * Classify fix type
   */
  classifyFixType(fix) {
    const content = JSON.stringify(fix).toLowerCase();

    if (content.includes('install') || content.includes('npm') || content.includes('yarn')) {
      return 'dependency';
    }
    if (content.includes('config') || content.includes('setting') || content.includes('.json')) {
      return 'configuration';
    }
    if (content.includes('test') || content.includes('mock') || content.includes('assert')) {
      return 'testing';
    }
    if (content.includes('restart') || content.includes('rebuild') || content.includes('clear')) {
      return 'runtime';
    }
    if (content.includes('permission') || content.includes('chmod') || content.includes('owner')) {
      return 'permission';
    }
    if (content.includes('path') || content.includes('env') || content.includes('variable')) {
      return 'environment';
    }
    if (content.includes('version') || content.includes('upgrade') || content.includes('update')) {
      return 'version';
    }

    return 'code';
  }

  /**
   * Extract generic steps
   */
  extractGenericSteps(fix) {
    const steps = [];
    const content = fix.content || fix.description || '';
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Extract action patterns
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        const step = this.generifyStep(trimmed.replace(/^[\d.]\s*[-*]\s*/, ''));
        if (step) steps.push(step);
      }

      // Extract code commands
      const cmdMatch = trimmed.match(/`(.*?)`/);
      if (cmdMatch) {
        const cmd = this.generifyCommand(cmdMatch[1]);
        if (cmd) steps.push({ type: 'command', content: cmd });
      }
    }

    return steps.slice(0, 10);
  }

  /**
   * Generify a step description
   */
  generifyStep(step) {
    const generic = step
      .replace(/['"][^'"]+['"]/g, "'<value>'")
      .replace(/\d+\.\d+\.\d+/g, '<version>')
      .replace(/[a-f0-9]{8,}/g, '<hash>')
      .replace(/localhost:\d+/g, 'localhost:<port>')
      .replace(/\/Users\/[^\/]+/g, '/Users/<user>');

    return {
      type: 'description',
      content: generic.slice(0, 150)
    };
  }

  /**
   * Generify a command
   */
  generifyCommand(cmd) {
    return cmd
      .replace(/\d+\.\d+\.\d+/g, '<version>')
      .replace(/--[a-z]+-[a-z]+-[a-z]+/g, match => match.replace(/[a-z]/g, 'x'))
      .replace(/[a-f0-9]{8,}/g, '<hash>');
  }

  /**
   * Extract conditions
   */
  extractConditions(fix) {
    const conditions = [];
    const content = JSON.stringify(fix).toLowerCase();

    if (content.includes('if') || content.includes('when') || content.includes('should')) {
      conditions.push('conditional');
    }
    if (content.includes('node') || content.includes('npm')) {
      conditions.push('requires-node');
    }
    if (content.includes('python') || content.includes('pip')) {
      conditions.push('requires-python');
    }
    if (content.includes('docker')) {
      conditions.push('requires-docker');
    }
    if (content.includes('admin') || content.includes('root') || content.includes('sudo')) {
      conditions.push('requires-elevation');
    }

    return conditions;
  }

  /**
   * Analyze applicability
   */
  analyzeApplicability(fix) {
    return {
      frameworks: fix.framework || [],
      technologies: fix.technology || [],
      languages: fix.language ? [fix.language] : [],
      platforms: fix.platform ? [fix.platform] : ['any']
    };
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(fix) {
    let confidence = 0.5;

    if (fix.steps?.length >= 3) confidence += 0.1;
    if (fix.framework?.length > 0) confidence += 0.1;
    if (fix.technology?.length > 0) confidence += 0.1;
    if (fix.description?.length > 50) confidence += 0.1;
    if (fix.successRate) confidence = fix.successRate;

    return Math.min(confidence, 1);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get all extracted fixes
   */
  getFixes() {
    return this.fixes;
  }

  /**
   * Search fixes
   */
  searchFixes(query) {
    const queryLower = query.toLowerCase();
    return this.fixes.filter(f =>
      f.type.includes(queryLower) ||
      f.genericSteps.some(s => s.content.toLowerCase().includes(queryLower)) ||
      f.framework.some(fw => fw.toLowerCase().includes(queryLower))
    );
  }
}

module.exports = { GenericFixExtractor };