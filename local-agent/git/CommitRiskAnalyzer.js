/**
 * CommitRiskAnalyzer - Analyze commit risk without network calls
 */
const { execSync } = require('child_process');

class CommitRiskAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  analyzeCommitRisk(hash) {
    try {
      const output = execSync(`git show ${hash} --format="%s|%b"`, { cwd: this.projectRoot, encoding: 'utf8' });
      const [subject, body] = output.trim().split('\n').join('\n').split('|');
      const files = this.getChangedFiles(hash);
      const linesChanged = this.getLinesChanged(hash);
      const factors = [];
      let score = 0;

      // Check for large diffs
      if (files.length > 10) {
        factors.push({ type: 'large_diff', severity: 'medium', message: `${files.length} files changed` });
        score += 20;
      }
      if (linesChanged > 500) {
        factors.push({ type: 'huge_diff', severity: 'high', message: `${linesChanged} lines changed` });
        score += 30;
      }

      // Check for secret patterns
      const secretPatterns = [/(password|secret|api[_-]?key|token|private[_-]?key)/i];
      secretPatterns.forEach(pattern => {
        if (pattern.test(output)) {
          factors.push({ type: 'secret_risk', severity: 'critical', message: 'Possible secret in commit' });
          score += 40;
        }
      });

      // Check for revert patterns
      if (/revert|reverted|undo|rollback/i.test(subject)) {
        factors.push({ type: 'revert', severity: 'medium', message: 'Revert commit detected' });
        score += 10;
      }

      // Check for merge commits
      if (files.some(f => f.includes('Merge branch'))) {
        factors.push({ type: 'merge', severity: 'low', message: 'Merge commit' });
        score += 5;
      }

      return { hash, score: Math.min(score, 100), factors, subject };
    } catch { return { hash, score: 0, factors: [], subject: '' }; }
  }

  getChangedFiles(hash) {
    try {
      const output = execSync(`git show ${hash} --name-only --format=""`, { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean);
    } catch { return []; }
  }

  getLinesChanged(hash) {
    try {
      const output = execSync(`git show ${hash} --format="" --numstat`, { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').reduce((sum, line) => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const added = parseInt(parts[0]) || 0;
          const removed = parseInt(parts[1]) || 0;
          return sum + added + removed;
        }
        return sum;
      }, 0);
    } catch { return 0; }
  }

  detectLargeDiffs(range = '--all', threshold = 10) {
    try {
      const output = execSync(`git log ${range} --format="%H" --no-merges`, { cwd: this.projectRoot, encoding: 'utf8' });
      const hashes = output.trim().split('\n').filter(Boolean);
      return hashes.filter(hash => this.getChangedFiles(hash).length > threshold).map(hash => ({
        hash, filesChanged: this.getChangedFiles(hash).length
      }));
    } catch { return []; }
  }

  detectSecretExposure(commits) {
    const secretPatterns = [
      /api[_-]?key/gi, /password/gi, /secret/gi, /token/gi,
      /private[_-]?key/gi, /bearer/gi, /aws[_-]?key/gi
    ];
    return commits.filter(commit => {
      try {
        const output = execSync(`git show ${commit.hash} --format="%s|%b"`, { cwd: this.projectRoot, encoding: 'utf8' });
        return secretPatterns.some(p => p.test(output));
      } catch { return false; }
    });
  }

  detectRevertedCommits(commits) {
    return commits.filter(commit => /revert|reverted|undo|rollback/i.test(commit.subject));
  }

  getUnstableModules(commits) {
    const fileFreq = {};
    commits.forEach(commit => {
      this.getChangedFiles(commit.hash).forEach(file => {
        if (!fileFreq[file]) fileFreq[file] = { path: file, count: 0, commits: [] };
        fileFreq[file].count++;
        fileFreq[file].commits.push(commit.shortHash);
      });
    });
    return Object.values(fileFreq)
      .filter(f => f.count > 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  generateRiskReport(commits) {
    const risky = commits.map(c => this.analyzeCommitRisk(c.hash));
    return {
      totalCommits: commits.length,
      highRisk: risky.filter(r => r.score >= 50).length,
      mediumRisk: risky.filter(r => r.score >= 20 && r.score < 50).length,
      lowRisk: risky.filter(r => r.score < 20).length,
      averageScore: risky.reduce((sum, r) => sum + r.score, 0) / risky.length || 0,
      riskyCommits: risky.filter(r => r.score >= 20).slice(0, 10),
      unstableModules: this.getUnstableModules(commits),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { CommitRiskAnalyzer };