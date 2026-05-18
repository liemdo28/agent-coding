/**
 * DiffSummarizer - Summarize code changes
 */
const { execSync } = require('child_process');

class DiffSummarizer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  summarizeDiff(fromRef, toRef = 'HEAD') {
    try {
      const stat = execSync(`git diff ${fromRef}..${toRef} --stat`, { cwd: this.projectRoot, encoding: 'utf8' }).trim();
      const summary = { files: [], totalAdditions: 0, totalDeletions: 0, totalChanges: 0 };
      stat.split('\n').forEach(line => {
        const match = line.match(/\|/);
        if (match) {
          const parts = line.trim().split(/\s+/);
          const file = parts[0];
          const changes = parseInt(parts[2]) || 0;
          summary.files.push({ file, changes });
          summary.totalChanges += changes;
        }
      });
      return summary;
    } catch { return { files: [], totalAdditions: 0, totalDeletions: 0, totalChanges: 0 }; }
  }

  categorizeChanges(diff) {
    const categories = { components: [], api: [], config: [], utils: [], tests: [], docs: [], other: [] };
    const patterns = {
      components: /\.(jsx?|tsx?)$/,
      api: /api|route|endpoint|controller/i,
      config: /config|\.(json|yaml|yml|toml)$/i,
      utils: /util|helper|lib/i,
      tests: /\.(test|spec)\.(js|ts|jsx|tsx)$/i,
      docs: /README|CHANGELOG|\.(md|txt)$/i
    };
    diff.split('\n').filter(l => l.match(/^\+\+\+/) || /^---/.test(l)).forEach(line => {
      const file = line.replace(/^[+-]{3}\s/, '').trim();
      Object.entries(patterns).forEach(([cat, pattern]) => {
        if (pattern.test(file) && !categories[cat].includes(file)) categories[cat].push(file);
      });
      if (Object.values(categories).every(arr => !arr.includes(file))) categories.other.push(file);
    });
    return categories;
  }

  estimateComplexity(diff) {
    const additions = (diff.match(/^\+[^+]/gm) || []).length;
    const deletions = (diff.match(/^-[^-]/gm) || []).length;
    const total = additions + deletions;
    if (total > 1000) return { level: 'high', score: 3, message: 'Large change, high risk' };
    if (total > 200) return { level: 'medium', score: 2, message: 'Moderate change' };
    return { level: 'low', score: 1, message: 'Small change, low risk' };
  }

  detectBreakingChanges(diff) {
    const breaking = [];
    const patterns = [
      { pattern: /export\s+default\s+function/g, type: 'export_removal', severity: 'high' },
      { pattern: /interface\s+\w+\s*\{/g, type: 'interface_removed', severity: 'high' },
      { pattern: /type\s+\w+\s*=/g, type: 'type_removed', severity: 'high' },
      { pattern: /process\.env\.\w+/g, type: 'env_change', severity: 'medium' },
      { pattern: /require\s*\(['"]/g, type: 'require_change', severity: 'low' }
    ];
    patterns.forEach(({ pattern, type, severity }) => {
      const matches = diff.match(pattern);
      if (matches) breaking.push({ type, severity, count: matches.length });
    });
    return breaking;
  }

  generateDiffReport(fromRef, toRef = 'HEAD') {
    try {
      const diff = execSync(`git diff ${fromRef}..${toRef}`, { cwd: this.projectRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      return {
        summary: this.summarizeDiff(fromRef, toRef),
        categories: this.categorizeChanges(diff),
        complexity: this.estimateComplexity(diff),
        breakingChanges: this.detectBreakingChanges(diff),
        generatedAt: new Date().toISOString()
      };
    } catch { return null; }
  }
}

module.exports = { DiffSummarizer };