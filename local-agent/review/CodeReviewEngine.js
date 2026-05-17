// local-agent/review/CodeReviewEngine.js
// Phase 24: Code review engine — automated code review and quality checks

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export class CodeReviewEngine {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.issues = [];
    this.metrics = {};
  }

  async reviewFiles(paths = []) {
    this.issues = [];
    this.metrics = {
      totalFiles: 0,
      totalLines: 0,
      issuesFound: 0,
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      byCategory: {},
    };

    for (const filePath of paths) {
      await this.reviewFile(filePath);
    }

    return {
      metrics: this.metrics,
      issues: this.issues,
      summary: this.generateSummary(),
    };
  }

  async reviewFile(filePath) {
    if (!existsSync(filePath)) return;
    
    const ext = extname(filePath);
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(ext)) return;

    try {
      const content = readFileSync(filePath, 'utf8');
      const stat = statSync(filePath);
      
      this.metrics.totalFiles++;
      this.metrics.totalLines += content.split('\n').length;

      this.checkComplexity(filePath, content);
      this.checkSecurityIssues(filePath, content);
      this.checkCodeSmells(filePath, content);
      this.checkBestPractices(filePath, content);
      this.checkPerformance(filePath, content);
    } catch (err) {
      this.addIssue(filePath, 'ERROR', 'HIGH', `Cannot read file: ${err.message}`);
    }
  }

  checkComplexity(filePath, content) {
    const lines = content.split('\n');
    const functions = content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{/g) || [];
    const cyclomaticComplexity = functions.length;

    if (cyclomaticComplexity > 20) {
      this.addIssue(filePath, 'COMPLEXITY', 'HIGH', `High cyclomatic complexity: ${cyclomaticComplexity} functions`);
    }

    // Check for long functions
    let functionStart = -1;
    let braceCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:async\s+)?function|const\s+\w+\s*=\s*(?:async\s+)?\(|=>\s*{/.test(line.trim())) {
        functionStart = i;
        braceCount = 0;
      }
      if (functionStart >= 0) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        if (braceCount === 0 && functionStart >= 0) {
          const functionLength = i - functionStart;
          if (functionLength > 100) {
            this.addIssue(filePath, 'LONG_FUNCTION', 'MEDIUM', `Function at line ${functionStart + 1} has ${functionLength} lines`);
          }
          functionStart = -1;
        }
      }
    }
  }

  checkSecurityIssues(filePath, content) {
    const securityPatterns = [
      { pattern: /eval\s*\(/, severity: 'CRITICAL', message: 'eval() usage detected - potential code injection' },
      { pattern: /innerHTML\s*=/, severity: 'HIGH', message: 'innerHTML assignment - potential XSS vulnerability' },
      { pattern: /dangerouslySetInnerHTML/, severity: 'MEDIUM', message: 'dangerouslySetInnerHTML usage - review for XSS' },
      { pattern: /password\s*=\s*['"][^'"]+['"]/, severity: 'CRITICAL', message: 'Hardcoded password detected' },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/i, severity: 'CRITICAL', message: 'Hardcoded API key detected' },
      { pattern: /secret\s*=\s*['"][^'"]+['"]/i, severity: 'HIGH', message: 'Hardcoded secret detected' },
      { pattern: /process\.env\.\w+\s*\.\s*includes/, severity: 'MEDIUM', message: 'Environment variable usage pattern issue' },
      { pattern: /SQL\s*\+\s*['"]/, severity: 'CRITICAL', message: 'Potential SQL injection vulnerability' },
    ];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, severity, message } of securityPatterns) {
        if (pattern.test(lines[i])) {
          this.addIssue(filePath, 'SECURITY', severity, `${message} at line ${i + 1}`);
        }
      }
    }
  }

  checkCodeSmells(filePath, content) {
    const smellPatterns = [
      { pattern: /console\.(log|debug|info)/g, severity: 'LOW', category: 'DEBUG_CODE', message: 'Console statement found' },
      { pattern: /TODO|FIXME|HACK|XXX/g, severity: 'LOW', category: 'TECHNICAL_DEBT', message: 'TODO/FIXME comment found' },
      { pattern: /\/\/\s*deprecated/gi, severity: 'MEDIUM', category: 'DEPRECATION', message: 'Deprecated code marker' },
      { pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*}/, severity: 'LOW', category: 'EMPTY_CATCH', message: 'Empty catch block' },
      { pattern: /new\s+Date\(\)\.getTime\(\)/, severity: 'LOW', category: 'INEFFICIENT', message: 'Use Date.now() instead' },
      { pattern: /var\s+\w+/g, severity: 'LOW', category: 'MODERN_JS', message: 'var keyword found - use const/let' },
    ];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, severity, category, message } of smellPatterns) {
        if (pattern.test(lines[i])) {
          this.addIssue(filePath, category, severity, `${message} at line ${i + 1}`);
        }
      }
    }
  }

  checkBestPractices(filePath, content) {
    const lines = content.split('\n');

    // Check for missing error handling
    if (/async\s+function|async\s*\(/.test(content) && !/try\s*{/.test(content)) {
      this.addIssue(filePath, 'ERROR_HANDLING', 'MEDIUM', 'Async function without try-catch');
    }

    // Check for missing type checks
    if (/typeof\s+\w+\s*===\s*['"]undefined['"]/.test(content)) {
      this.addIssue(filePath, 'TYPE_SAFETY', 'LOW', 'Consider using nullish coalescing or optional chaining');
    }

    // Check for magic numbers
    const magicNumberPattern = /(?<![.\w])(\d{3,})(?![.\w])/g;
    let match;
    while ((match = magicNumberPattern.exec(content)) !== null) {
      this.addIssue(filePath, 'MAGIC_NUMBER', 'LOW', `Magic number ${match[1]} at position ${match.index}`);
    }
  }

  checkPerformance(filePath, content) {
    // Check for inefficient patterns
    if (/for\s*\(\s*let\s+\w+\s*=\s*0;\s*\w+\s*<\s*\w+\.length;\s*\w+\+\+\s*\)/.test(content)) {
      this.addIssue(filePath, 'PERFORMANCE', 'LOW', 'Consider caching array length in loop');
    }

    if (/string\s*\+\s*['"]/.test(content)) {
      this.addIssue(filePath, 'PERFORMANCE', 'LOW', 'Consider using template literals instead of string concatenation');
    }

    // Check for repeated regex creation
    if (/\/[\^$].*\/[gimsuy]*\)/.test(content) && content.match(/\/.*\/[gimsuy]*\)/g)?.length > 5) {
      this.addIssue(filePath, 'PERFORMANCE', 'MEDIUM', 'Multiple regex patterns - consider pre-compiling');
    }
  }

  addIssue(filePath, category, severity, message) {
    this.issues.push({
      file: filePath,
      category,
      severity,
      message,
      timestamp: new Date().toISOString(),
    });

    this.metrics.issuesFound++;
    this.metrics.bySeverity[severity] = (this.metrics.bySeverity[severity] || 0) + 1;
    this.metrics.byCategory[category] = (this.metrics.byCategory[category] || 0) + 1;
  }

  generateSummary() {
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
    const highIssues = this.issues.filter(i => i.severity === 'HIGH');
    
    return {
      totalFiles: this.metrics.totalFiles,
      totalLines: this.metrics.totalLines,
      totalIssues: this.issues.length,
      criticalCount: criticalIssues.length,
      highCount: highIssues.length,
      score: this.calculateScore(),
      recommendations: this.generateRecommendations(),
    };
  }

  calculateScore() {
    const weights = { CRITICAL: 50, HIGH: 20, MEDIUM: 5, LOW: 1 };
    let penalty = 0;
    
    for (const issue of this.issues) {
      penalty += weights[issue.severity] || 1;
    }

    const baseScore = 100;
    const score = Math.max(0, baseScore - penalty);
    
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 50) return 'FAIR';
    return 'NEEDS_IMPROVEMENT';
  }

  generateRecommendations() {
    const recommendations = [];
    const categoryCounts = this.metrics.byCategory;

    if (categoryCounts.SECURITY) {
      recommendations.push('Address security issues immediately - these are critical');
    }
    if (categoryCounts.COMPLEXITY) {
      recommendations.push('Consider breaking down complex functions into smaller, more manageable pieces');
    }
    if (categoryCounts.ERROR_HANDLING) {
      recommendations.push('Add proper error handling for async operations');
    }
    if (categoryCounts.CODE_SMELL) {
      recommendations.push('Remove debug code and TODOs before release');
    }
    if (categoryCounts.PERFORMANCE) {
      recommendations.push('Optimize performance-critical code paths');
    }

    return recommendations;
  }

  async autoFix(filePath) {
    if (!existsSync(filePath)) return { success: false, error: 'File not found' };

    try {
      let content = readFileSync(filePath, 'utf8');
      const originalContent = content;

      // Auto-fix: Remove console.log statements (except error)
      content = content.replace(/console\.(log|debug|info)\s*\([^)]*\)\s*;?\s*(\n|$)/g, '');

      // Auto-fix: Replace var with let where appropriate
      content = content.replace(/\bvar\s+/g, 'let ');

      // Auto-fix: Use Date.now() instead of new Date().getTime()
      content = content.replace(/new\s+Date\(\)\.getTime\(\)/g, 'Date.now()');

      // Auto-fix: Replace string concatenation with template literals
      content = content.replace(/['"]\s*\+\s*(\w+)\s*\+\s*['"]/g, (match, varName) => {
        return `\$\{${varName}\}`;
      });

      const changes = content !== originalContent;
      if (changes) {
        const { writeFileSync } = require('fs');
        writeFileSync(filePath, content);
        return { success: true, filePath, changes: true };
      }

      return { success: true, filePath, changes: false, message: 'No auto-fixable issues found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export default CodeReviewEngine;