/**
 * GitHistoryAnalyzer - Local Git Intelligence
 */
const { execSync } = require('child_process');

class GitHistoryAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.cache = new Map();
    this.cacheTTL = 60000;
  }

  getCommits(range = '--all') {
    const cacheKey = `commits:${range}`;
    if (this.isCached(cacheKey)) return this.cache.get(cacheKey).value;
    try {
      const output = execSync(
        `git log ${range} --format="%H|%an|%ae|%at|%s|%d" --no-merges`,
        { cwd: this.projectRoot, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
      );
      const commits = output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, email, timestamp, subject, refs] = line.split('|');
        return { hash, author, email, timestamp: parseInt(timestamp) * 1000, subject, refs: refs || '', shortHash: hash.substring(0, 7) };
      });
      this.setCache(cacheKey, commits);
      return commits;
    } catch { return []; }
  }

  getCommitFiles(hash) {
    try {
      const output = execSync(`git show ${hash} --format="" --name-status`, { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [status, ...pathParts] = line.split('\t');
        return { status, path: pathParts.join('\t') };
      });
    } catch { return []; }
  }

  getDiff(fromRef, toRef = 'HEAD') {
    try {
      return execSync(`git diff ${fromRef}..${toRef} --stat`, { cwd: this.projectRoot, encoding: 'utf8' }).trim();
    } catch { return ''; }
  }

  getAuthorStats(range = '--all') {
    const commits = this.getCommits(range);
    const stats = {};
    commits.forEach(commit => {
      if (!stats[commit.author]) stats[commit.author] = { author: commit.author, email: commit.email, commitCount: 0, recentCommits: [] };
      stats[commit.author].commitCount++;
      stats[commit.author].recentCommits.push({ hash: commit.shortHash, subject: commit.subject, timestamp: commit.timestamp });
    });
    return Object.values(stats).sort((a, b) => b.commitCount - a.commitCount);
  }

  getFrequentFiles(range = '--all', limit = 20) {
    const commits = this.getCommits(range);
    const fileFreq = {};
    commits.forEach(commit => {
      this.getCommitFiles(commit.hash).forEach(file => {
        if (!fileFreq[file.path]) fileFreq[file.path] = { path: file.path, count: 0, commits: [] };
        fileFreq[file.path].count++;
        fileFreq[file.path].commits.push(commit.shortHash);
      });
    });
    return Object.values(fileFreq).sort((a, b) => b.count - a.count).slice(0, limit);
  }

  getTimeline(range = '--all', interval = 'day') {
    const commits = this.getCommits(range);
    const timeline = {};
    commits.forEach(commit => {
      const date = new Date(commit.timestamp);
      let key;
      switch (interval) {
        case 'hour': key = `${date.toISOString().substring(0, 13)}:00`; break;
        case 'week': const weekStart = new Date(date); weekStart.setDate(date.getDate() - date.getDay()); key = weekStart.toISOString().substring(0, 10); break;
        case 'month': key = date.toISOString().substring(0, 7); break;
        default: key = date.toISOString().substring(0, 10);
      }
      if (!timeline[key]) timeline[key] = { period: key, commits: 0, authors: new Set(), files: new Set() };
      timeline[key].commits++;
      timeline[key].authors.add(commit.author);
      this.getCommitFiles(commit.hash).forEach(f => timeline[key].files.add(f.path));
    });
    return Object.entries(timeline).map(([period, data]) => ({
      period, commits: data.commits, uniqueAuthors: data.authors.size, uniqueFiles: data.files.size
    })).sort((a, b) => a.period.localeCompare(b.period));
  }

  searchCommits(pattern, range = '--all') {
    const regex = new RegExp(pattern, 'i');
    return this.getCommits(range).filter(c => regex.test(c.subject));
  }

  getBlame(filePath) {
    try {
      const output = execSync(`git blame --line-porcelain ${filePath}`, { cwd: this.projectRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const lines = output.split('\n');
      const blame = [];
      let currentCommit = null;
      lines.forEach(line => {
        if (line.startsWith('author ')) currentCommit = { author: line.substring(7) };
        else if (line.startsWith('author-time ') && currentCommit) currentCommit.timestamp = parseInt(line.substring(13)) * 1000;
        else if (line.startsWith('summary ') && currentCommit) currentCommit.subject = line.substring(8);
        else if (/^[0-9a-f]{40}/.test(line)) {
          if (currentCommit) blame.push(currentCommit);
          currentCommit = { hash: line.substring(0, 7) };
        }
      });
      return blame;
    } catch { return []; }
  }

  getStashes() {
    try {
      const output = execSync('git stash list --format="%H|%gd|%s"', { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, ref, subject] = line.split('|');
        return { hash, ref, subject };
      });
    } catch { return []; }
  }

  isClean() {
    try { return execSync('git status --porcelain', { cwd: this.projectRoot, encoding: 'utf8' }).trim().length === 0; }
    catch { return false; }
  }

  getCurrentBranch() {
    try { return execSync('git branch --show-current', { cwd: this.projectRoot, encoding: 'utf8' }).trim(); }
    catch { return 'unknown'; }
  }

  generateReport(range = '--all') {
    const commits = this.getCommits(range);
    const authorStats = this.getAuthorStats(range);
    const frequentFiles = this.getFrequentFiles(range, 30);
    const timeline = this.getTimeline(range);
    return {
      summary: { totalCommits: commits.length, uniqueAuthors: authorStats.length, currentBranch: this.getCurrentBranch(), isClean: this.isClean(), range, generatedAt: new Date().toISOString() },
      authorStats, frequentFiles, timeline, recentCommits: commits.slice(0, 20)
    };
  }

  isCached(key) { const cached = this.cache.get(key); return cached && Date.now() - cached.timestamp < this.cacheTTL; }
  setCache(key, value) { this.cache.set(key, { value, timestamp: Date.now() }); }
  clearCache() { this.cache.clear(); }
}

module.exports = { GitHistoryAnalyzer };