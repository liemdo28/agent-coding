/**
 * RegressionCorrelation - Correlate commits with failures
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RegressionCorrelation {
  constructor(projectRoot = process.cwd(), dataDir = null) {
    this.projectRoot = projectRoot;
    this.dataDir = dataDir || path.join(projectRoot, '.local-agent', 'regression');
    this.failures = [];
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadFailureHistory(failures) {
    this.failures = failures.map(f => ({
      ...f,
      timestamp: new Date(f.timestamp).getTime()
    }));
    return this;
  }

  loadFailuresFromFile(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.failures = data.map(f => ({
        ...f,
        timestamp: new Date(f.timestamp).getTime()
      }));
      return this;
    } catch { return this; }
  }

  getRecentCommits(range = 'HEAD~50..HEAD') {
    try {
      const output = execSync(`git log ${range} --format="%H|%an|%at|%s" --no-merges`, {
        cwd: this.projectRoot, encoding: 'utf8'
      });
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, timestamp, subject] = line.split('|');
        return { hash, author, timestamp: parseInt(timestamp) * 1000, subject, shortHash: hash.substring(0, 7) };
      });
    } catch { return []; }
  }

  getCommitFiles(hash) {
    try {
      const output = execSync(`git show ${hash} --name-only --format=""`, {
        cwd: this.projectRoot, encoding: 'utf8'
      });
      return output.trim().split('\n').filter(Boolean);
    } catch { return []; }
  }

  correlateCommitsWithFailures(commits, failures = null) {
    const useFailures = failures || this.failures;
    const correlations = [];

    useFailures.forEach(failure => {
      const failureTime = failure.timestamp;
      const windowStart = failureTime - (7 * 24 * 60 * 60 * 1000); // 7 days before
      const windowEnd = failureTime + (24 * 60 * 60 * 1000); // 1 day after

      const relevantCommits = commits.filter(c =>
        c.timestamp >= windowStart && c.timestamp <= windowEnd
      );

      relevantCommits.forEach(commit => {
        const files = this.getCommitFiles(commit.hash);
        const fileMatch = failure.files ? files.some(f => failure.files.includes(f)) : false;
        const timeDiff = Math.abs(commit.timestamp - failureTime) / (60 * 60 * 1000); // hours

        if (timeDiff < 24 || fileMatch) {
          correlations.push({
            commit: commit.shortHash,
            commitHash: commit.hash,
            failure: failure.error || failure.message,
            timeDiffHours: Math.round(timeDiff),
            filesChanged: files.length,
            fileMatch,
            confidence: fileMatch ? 'high' : timeDiff < 2 ? 'medium' : 'low'
          });
        }
      });
    });

    return correlations;
  }

  detectFailurePatterns(failures = null) {
    const useFailures = failures || this.failures;
    const patterns = {};

    useFailures.forEach(failure => {
      const errorType = this.extractErrorType(failure.error || failure.message);
      if (!patterns[errorType]) {
        patterns[errorType] = { type: errorType, count: 0, failures: [], files: new Set() };
      }
      patterns[errorType].count++;
      patterns[errorType].failures.push(failure);
      if (failure.files) failure.files.forEach(f => patterns[errorType].files.add(f));
    });

    return Object.values(patterns)
      .map(p => ({ ...p, files: Array.from(p.files) }))
      .sort((a, b) => b.count - a.count);
  }

  extractErrorType(errorMsg) {
    if (!errorMsg) return 'unknown';
    const patterns = [
      { pattern: /TypeError/i, type: 'TypeError' },
      { pattern: /ReferenceError/i, type: 'ReferenceError' },
      { pattern: /SyntaxError/i, type: 'SyntaxError' },
      { pattern: /ModuleNotFoundError|NoSuchModule|cannot find/i, type: 'ModuleError' },
      { pattern: /ECONNREFUSED|ENOTFOUND/i, type: 'NetworkError' },
      { pattern: /timeout|timed?out/i, type: 'TimeoutError' },
      { pattern: /permission denied|access denied/i, type: 'PermissionError' },
      { pattern: /memory|heap|out of memory/i, type: 'MemoryError' }
    ];

    for (const { pattern, type } of patterns) {
      if (pattern.test(errorMsg)) return type;
    }
    return 'OtherError';
  }

  suggestRollback() {
    if (this.failures.length === 0) return [];

    const correlations = this.correlateCommitsWithFailures(this.getRecentCommits());
    const highConfidence = correlations.filter(c => c.confidence === 'high');

    if (highConfidence.length === 0) return [];

    const suggestedCommits = [];
    const seen = new Set();

    highConfidence.forEach(c => {
      if (!seen.has(c.commitHash)) {
        seen.add(c.commitHash);
        suggestedCommits.push({
          hash: c.commitHash,
          shortHash: c.commit,
          reason: c.fileMatch ? 'Direct file correlation with failure' : 'Close temporal correlation',
          confidence: c.confidence
        });
      }
    });

    return suggestedCommits.slice(0, 5);
  }

  generateRegressionReport() {
    const commits = this.getRecentCommits();
    const correlations = this.correlateCommitsWithFailures(commits);
    const patterns = this.detectFailurePatterns();
    const suggestions = this.suggestRollback();

    const stats = {
      totalFailures: this.failures.length,
      totalCommits: commits.length,
      highConfidence: correlations.filter(c => c.confidence === 'high').length,
      mediumConfidence: correlations.filter(c => c.confidence === 'medium').length,
      lowConfidence: correlations.filter(c => c.confidence === 'low').length
    };

    return {
      summary: stats,
      correlations: correlations.slice(0, 20),
      patterns,
      rollbackSuggestions: suggestions,
      generatedAt: new Date().toISOString()
    };
  }

  saveReport(report, filename = 'regression-correlation.json') {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }
}

module.exports = { RegressionCorrelation };