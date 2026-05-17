// local-agent/review/CodeQualityChecker.js
// Phase 24: Code quality checker — verify code quality standards

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

export class CodeQualityChecker {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.rules = this.loadDefaultRules();
    this.results = [];
  }

  loadDefaultRules() {
    return {
      maxLineLength: 120,
      maxFunctionLength: 100,
      maxCyclomaticComplexity: 10,
      allowedFileExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
      forbiddenPatterns: [
        { pattern: /eval\s*\(/, message: 'eval() is forbidden' },
        { pattern: /innerHTML\s*=/, message: 'Direct innerHTML assignment is forbidden' },
        { pattern: /document\.write/, message: 'document.write() is forbidden' },
        { pattern: /with\s*\(/, message: 'with statement is forbidden' },
      ],
      requiredPatterns: [
        { pattern: /export\s+(?:default\s+)?(?:class|function|const)/, message: 'Files should have exports' },
      ],
      namingConventions: {
        classes: /^[A-Z][a-zA-Z0-9]*$/,
        functions: /^[a-z][a-zA-Z0-9]*$/,
        constants: /^[A-Z][A-Z0-9_]*$/,
        files: /^[a-z][a-z0-9-]*(\.[a-z]+)?$/,
      },
    };
  }

  async checkQuality(targetPath) {
    this.results = [];
    const files = this.findFiles(targetPath);

    for (const file of files) {
      await this.checkFile(file);
    }

    return {
      filesChecked: files.length,
      issues: this.results,
      summary: this.generateSummary(),
      passed: this.results.filter(r => r.severity === 'ERROR').length === 0,
    };
  }

  findFiles(dir) {
    const files = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!this.shouldIgnore(entry.name)) {
            files.push(...this.findFiles(fullPath));
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (this.rules.allowedFileExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      // ignore
    }
    return files;
  }

  shouldIgnore(name) {
    const ignored = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage', '.local-agent'];
    return ignored.includes(name) || name.startsWith('.');
  }

  async checkFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Check line length
      this.checkLineLength(filePath, lines);

      // Check function length
      this.checkFunctionLength(filePath, lines);

      // Check forbidden patterns
      this.checkForbiddenPatterns(filePath, content);

      // Check naming conventions
      this.checkNamingConventions(filePath);

      // Check complexity
      this.checkComplexity(filePath, content);

      // Check for TODO/FIXME
      this.checkTechnicalDebt(filePath, content);

    } catch (err) {
      this.results.push({
        file: filePath,
        line: 0,
        severity: 'ERROR',
        category: 'FILE_IO',
        message: `Cannot read file: ${err.message}`,
      });
    }
  }

  checkLineLength(filePath, lines) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > this.rules.maxLineLength) {
        this.results.push({
          file: filePath,
          line: i + 1,
          severity: 'WARNING',
          category: 'LINE_LENGTH',
          message: `Line exceeds ${this.rules.maxLineLength} characters (${lines[i].length})`,
        });
      }
    }
  }

  checkFunctionLength(filePath, lines) {
    let inFunction = false;
    let functionStart = 0;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Function start patterns
      if (/^(?:async\s+)?function|const\s+\w+\s*=\s*(?:async\s+)?\(|=>\s*{/.test(line)) {
        inFunction = true;
        functionStart = i;
        braceCount = 0;
      }

      if (inFunction) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0 && i > functionStart) {
          const functionLength = i - functionStart;
          if (functionLength > this.rules.maxFunctionLength) {
            this.results.push({
              file: filePath,
              line: functionStart + 1,
              severity: 'WARNING',
              category: 'FUNCTION_LENGTH',
              message: `Function exceeds ${this.rules.maxFunctionLength} lines (${functionLength})`,
            });
          }
          inFunction = false;
        }
      }
    }
  }

  checkForbiddenPatterns(filePath, content) {
    const lines = content.split('\n');

    for (const rule of this.rules.forbiddenPatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i])) {
          this.results.push({
            file: filePath,
            line: i + 1,
            severity: 'ERROR',
            category: 'FORBIDDEN_PATTERN',
            message: rule.message,
          });
        }
      }
    }
  }

  checkNamingConventions(filePath) {
    const fileName = filePath.split('/').pop();
    const ext = extname(fileName);
    const baseName = fileName.replace(ext, '');

    // Check if file name follows conventions
    if (!this.rules.namingConventions.files.test(baseName)) {
      this.results.push({
        file: filePath,
        line: 0,
        severity: 'INFO',
        category: 'NAMING',
        message: 'File name should use lowercase with hyphens',
      });
    }

    // Check class naming in the file
    try {
      const content = readFileSync(filePath, 'utf8');
      const classMatches = content.match(/class\s+(\w+)/g) || [];
      for (const match of classMatches) {
        const className = match.replace('class ', '');
        if (!this.rules.namingConventions.classes.test(className)) {
          this.results.push({
            file: filePath,
            line: 0,
            severity: 'WARNING',
            category: 'NAMING',
            message: `Class name "${className}" should use PascalCase`,
          });
        }
      }

      // Check constant naming
      const constMatches = content.match(/const\s+([A-Z][A-Z0-9_]+)/g) || [];
      for (const match of constMatches) {
        // This is expected for constants
      }

      // Check function naming
      const functionMatches = content.match(/(?:function\s+(\w+)|(\w+)\s*\([^)]*\)\s*{)/g) || [];
      for (const match of functionMatches) {
        const funcName = match.replace(/function\s+/, '').replace(/\s*\([^)]*\)\s*{/, '');
        if (funcName && !this.rules.namingConventions.functions.test(funcName) && !/^[A-Z]/.test(funcName)) {
          this.results.push({
            file: filePath,
            line: 0,
            severity: 'INFO',
            category: 'NAMING',
            message: `Function "${funcName}" should use camelCase`,
          });
        }
      }
    } catch (err) {
      // ignore
    }
  }

  checkComplexity(filePath, content) {
    // Count cyclomatic complexity indicators
    const complexityKeywords = [
      'if', 'else if', 'for', 'while', 'case', 'catch',
      '?', '&&', '||'
    ];

    let complexity = 0;
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'g');
      const matches = content.match(regex);
      if (matches) complexity += matches.length;
    }

    if (complexity > this.rules.maxCyclomaticComplexity) {
      this.results.push({
        file: filePath,
        line: 0,
        severity: 'WARNING',
        category: 'COMPLEXITY',
        message: `Cyclomatic complexity is high (${complexity}), consider refactoring`,
      });
    }
  }

  checkTechnicalDebt(filePath, content) {
    const lines = content.split('\n');
    const patterns = [
      { pattern: /TODO/i, severity: 'INFO', message: 'TODO comment found' },
      { pattern: /FIXME/i, severity: 'WARNING', message: 'FIXME comment found' },
      { pattern: /HACK/i, severity: 'WARNING', message: 'HACK comment found' },
      { pattern: /\/\/\s*deprecated/i, severity: 'WARNING', message: 'Deprecated code marker' },
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, severity, message } of patterns) {
        if (pattern.test(lines[i])) {
          this.results.push({
            file: filePath,
            line: i + 1,
            severity,
            category: 'TECHNICAL_DEBT',
            message,
          });
        }
      }
    }
  }

  generateSummary() {
    const byCategory = {};
    const bySeverity = { ERROR: 0, WARNING: 0, INFO: 0 };

    for (const result of this.results) {
      byCategory[result.category] = (byCategory[result.category] || 0) + 1;
      bySeverity[result.severity] = (bySeverity[result.severity] || 0) + 1;
    }

    return {
      totalIssues: this.results.length,
      errors: bySeverity.ERROR || 0,
      warnings: bySeverity.WARNING || 0,
      info: bySeverity.INFO || 0,
      byCategory,
      quality: this.calculateQualityScore(),
    };
  }

  calculateQualityScore() {
    const weights = { ERROR: 10, WARNING: 3, INFO: 1 };
    let penalty = 0;

    for (const result of this.results) {
      penalty += weights[result.severity] || 1;
    }

    const score = Math.max(0, 100 - penalty);

    if (score >= 90) return { score, grade: 'A', status: 'EXCELLENT' };
    if (score >= 80) return { score, grade: 'B', status: 'GOOD' };
    if (score >= 70) return { score, grade: 'C', status: 'FAIR' };
    if (score >= 60) return { score, grade: 'D', status: 'POOR' };
    return { score, grade: 'F', status: 'FAILING' };
  }

  async runQuickCheck(targetPath) {
    const files = this.findFiles(targetPath);
    let hasErrors = false;

    for (const file of files.slice(0, 10)) { // Quick check first 10 files
      try {
        const content = readFileSync(file, 'utf8');
        for (const rule of this.rules.forbiddenPatterns) {
          if (rule.pattern.test(content)) {
            hasErrors = true;
            break;
          }
        }
      } catch (err) {
        // ignore
      }
    }

    return {
      passed: !hasErrors,
      quickCheck: true,
      filesChecked: Math.min(10, files.length),
    };
  }
}

export default CodeQualityChecker;