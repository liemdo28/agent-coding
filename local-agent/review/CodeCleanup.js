// local-agent/review/CodeCleanup.js
// Phase 24: Code cleanup — automated code cleanup and refactoring

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export class CodeCleanup {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.changes = [];
    this.stats = { filesProcessed: 0, linesChanged: 0, fixes: [] };
  }

  async cleanupDirectory(dirPath) {
    this.changes = [];
    this.stats = { filesProcessed: 0, linesChanged: 0, fixes: [] };

    const files = this.findAllFiles(dirPath);
    for (const file of files) {
      await this.cleanupFile(file);
    }

    return {
      success: true,
      stats: this.stats,
      changes: this.changes,
      summary: this.generateSummary(),
    };
  }

  findAllFiles(dir) {
    const files = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!this.shouldIgnore(entry.name)) {
            files.push(...this.findAllFiles(fullPath));
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
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
    const ignored = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'coverage'];
    return ignored.includes(name) || name.startsWith('.');
  }

  async cleanupFile(filePath) {
    if (!existsSync(filePath)) return;

    try {
      const content = readFileSync(filePath, 'utf8');
      const originalContent = content;
      let modified = false;
      const fileChanges = [];

      // 1. Remove trailing whitespace
      let newContent = content.replace(/[ \t]+$/gm, '');
      if (newContent !== content) {
        fileChanges.push('Removed trailing whitespace');
        modified = true;
        content = newContent;
      }

      // 2. Fix multiple blank lines to single blank line
      newContent = content.replace(/\n{3,}/g, '\n\n');
      if (newContent !== content) {
        fileChanges.push('Fixed multiple blank lines');
        modified = true;
        content = newContent;
      }

      // 3. Add missing semicolons where needed
      newContent = content.replace(/([\]}])[ \t]*\n/g, '$1;\n');
      if (newContent !== content) {
        fileChanges.push('Added missing semicolons');
        modified = true;
        content = newContent;
      }

      // 4. Fix inconsistent indentation (spaces to tabs or vice versa)
      // For simplicity, we'll normalize tabs at line starts
      newContent = content.replace(/^    /gm, '\t');
      if (newContent !== content) {
        fileChanges.push('Normalized indentation to tabs');
        modified = true;
        content = newContent;
      }

      // 5. Remove empty lines at end of file
      newContent = content.replace(/\n+$/, '\n');
      if (newContent !== content) {
        fileChanges.push('Removed trailing empty lines');
        modified = true;
        content = newContent;
      }

      // 6. Fix inconsistent quote usage (simple heuristic)
      // Convert single quotes to double quotes in simple cases
      newContent = content.replace(/'(?=[^']*':[^']*')|'(?=[^']*'\s*:)/g, '"');
      if (newContent !== content) {
        fileChanges.push('Fixed quote inconsistency');
        modified = true;
        content = newContent;
      }

      // 7. Remove debug code
      const debugPatterns = [
        { pattern: /console\.(log|debug|info)\s*\([^)]*\)\s*;?\s*(?:\n|$)/g, fix: 'debug_statement' },
        { pattern: /console\.warn\s*\([^)]*\)\s*;?\s*(?:\n|$)/g, fix: 'warn_statement' },
      ];

      for (const { pattern } of debugPatterns) {
        const before = content;
        content = content.replace(pattern, '');
        if (content !== before) {
          fileChanges.push('Removed debug statements');
          modified = true;
        }
      }

      // 8. Remove TODO/FIXME comments
      const commentPatterns = [
        /\/\/\s*TODO[^\n]*\n/g,
        /\/\/\s*FIXME[^\n]*\n/g,
        /\/\/\s*HACK[^\n]*\n/g,
        /\/\/\s*XXX[^\n]*\n/g,
      ];

      for (const pattern of commentPatterns) {
        const before = content;
        content = content.replace(pattern, '');
        if (content !== before) {
          fileChanges.push('Removed TODO/FIXME comments');
          modified = true;
        }
      }

      // 9. Fix var to let/const
      const varPattern = /\bvar\s+(\w+)/g;
      const varMatches = content.match(varPattern);
      if (varMatches) {
        const usedVars = new Set();
        // Check if variable is reassigned
        const reassignPattern = new RegExp(`\\b${varMatches[0].replace('var ', '')}\\s*=`);
        if (!reassignPattern.test(content)) {
          content = content.replace(/\bvar\s+/g, 'const ');
          fileChanges.push('Converted var to const');
          modified = true;
        } else {
          content = content.replace(/\bvar\s+/g, 'let ');
          fileChanges.push('Converted var to let');
          modified = true;
        }
      }

      // 10. Remove unused imports
      const importPattern = /import\s+.*?from\s+['"][^'"]+['"]/g;
      const imports = content.match(importPattern) || [];
      for (const imp of imports) {
        const nameMatch = imp.match(/import\s+(?:{([^}]+)}|(\w+))/);
        if (nameMatch) {
          const names = nameMatch[1] || nameMatch[2];
          for (const name of names.split(',').map(n => n.trim())) {
            if (!content.includes(name) || !content.includes(name + '(')) {
              // Check if it's actually used
              const usagePattern = new RegExp(`\\b${name}\\b`);
              const usages = content.match(usagePattern);
              if (usages && usages.length <= 1) {
                content = content.replace(imp + '\n', '');
                fileChanges.push(`Removed unused import: ${name}`);
                modified = true;
              }
            }
          }
        }
      }

      if (modified) {
        writeFileSync(filePath, content);
        const linesChanged = content.split('\n').length - originalContent.split('\n').length;
        this.changes.push({ file: filePath, modifications: fileChanges, linesChanged });
        this.stats.filesProcessed++;
        this.stats.linesChanged += Math.abs(linesChanged);
        this.stats.fixes.push(...fileChanges);
      }
    } catch (err) {
      // Ignore files that can't be read/processed
    }
  }

  generateSummary() {
    const fixCounts = {};
    for (const fix of this.stats.fixes) {
      fixCounts[fix] = (fixCounts[fix] || 0) + 1;
    }

    return {
      filesProcessed: this.stats.filesProcessed,
      totalChanges: this.stats.linesChanged,
      fixBreakdown: fixCounts,
      recommendations: this.generateRecommendations(),
    };
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.stats.filesProcessed === 0) {
      recommendations.push('No files were modified - code may already be clean');
    } else {
      recommendations.push(`Processed ${this.stats.filesProcessed} files with ${this.stats.linesChanged} line changes`);
    }

    if (this.stats.fixes.includes('Removed debug statements')) {
      recommendations.push('Consider adding proper logging instead of removing all debug statements');
    }

    if (this.stats.fixes.includes('Removed TODO/FIXME comments')) {
      recommendations.push('Document TODOs in your project tracker instead of removing them entirely');
    }

    return recommendations;
  }

  // Safe cleanup that only applies low-risk changes
  async safeCleanup(filePath) {
    if (!existsSync(filePath)) return { success: false, error: 'File not found' };

    try {
      const content = readFileSync(filePath, 'utf8');
      const originalContent = content;
      let updatedContent = content;

      // Safe changes only:
      // 1. Remove trailing whitespace
      updatedContent = updatedContent.replace(/[ \t]+$/gm, '');

      // 2. Fix multiple blank lines
      updatedContent = updatedContent.replace(/\n{3,}/g, '\n\n');

      // 3. Remove trailing empty lines
      updatedContent = updatedContent.replace(/\n+$/, '\n');

      // 4. Ensure file ends with newline
      if (!updatedContent.endsWith('\n')) {
        updatedContent += '\n';
      }

      if (updatedContent !== originalContent) {
        writeFileSync(filePath, updatedContent);
        return { success: true, changes: true, filePath };
      }

      return { success: true, changes: false, filePath, message: 'No changes needed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export default CodeCleanup;