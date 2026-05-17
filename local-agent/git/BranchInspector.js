/**
 * BranchInspector - Branch analysis without network calls
 */
const { execSync } = require('child_process');

class BranchInspector {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  getBranches() {
    try {
      const output = execSync('git branch -a --format="%(refname:short)|%(objectname:short)|%(upstream:short)"', {
        cwd: this.projectRoot, encoding: 'utf8'
      });
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [name, hash, upstream] = line.split('|');
        return { name, hash, upstream: upstream || null };
      });
    } catch { return []; }
  }

  getBranchInfo(branch) {
    try {
      const hash = execSync(`git rev-parse ${branch}`, { cwd: this.projectRoot, encoding: 'utf8' }).trim();
      const log = execSync(`git log ${branch} -1 --format="%H|%an|%ae|%at|%s"`, { cwd: this.projectRoot, encoding: 'utf8' }).trim();
      const [hash2, author, email, timestamp, subject] = log.split('|');
      const aheadBehind = execSync(`git rev-list --left-right --count ${branch}...${branch}@{upstream} 2>/dev/null`, {
        cwd: this.projectRoot, encoding: 'utf8'
      }).trim().split('\t');
      
      return {
        name: branch,
        hash: hash.substring(0, 7),
        author,
        email,
        timestamp: parseInt(timestamp) * 1000,
        subject,
        ahead: parseInt(aheadBehind[0]) || 0,
        behind: parseInt(aheadBehind[1]) || 0
      };
    } catch { return null; }
  }

  compareBranches(branch1, branch2) {
    try {
      const diff = execSync(`git log ${branch1}...${branch2} --oneline`, { cwd: this.projectRoot, encoding: 'utf8' });
      const ahead = execSync(`git log ${branch2}..${branch1} --oneline`, { cwd: this.projectRoot, encoding: 'utf8' });
      const behind = execSync(`git log ${branch1}..${branch2} --oneline`, { cwd: this.projectRoot, encoding: 'utf8' });
      
      return {
        branch1,
        branch2,
        commonAncestors: diff.trim().split('\n').length,
        commitsAhead: ahead.trim().split('\n').filter(Boolean).length,
        commitsBehind: behind.trim().split('\n').filter(Boolean).length,
        aheadCommits: ahead.trim().split('\n').filter(Boolean),
        behindCommits: behind.trim().split('\n').filter(Boolean)
      };
    } catch { return null; }
  }

  detectStaleBranches(days = 90) {
    try {
      const branches = this.getBranches();
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const stales = [];
      
      branches.forEach(branch => {
        try {
          const log = execSync(`git log ${branch.name} -1 --format="%at"`, { cwd: this.projectRoot, encoding: 'utf8' });
          const lastCommit = parseInt(log.trim()) * 1000;
          if (lastCommit < cutoff) {
            stales.push({
              name: branch.name,
              lastCommit,
              daysSince: Math.floor((Date.now() - lastCommit) / (24 * 60 * 60 * 1000))
            });
          }
        } catch {}
      });
      
      return stales;
    } catch { return []; }
  }

  getBranchTimeline(branch) {
    try {
      const output = execSync(`git log ${branch} --format="%H|%an|%at|%s" -20`, { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, timestamp, subject] = line.split('|');
        return { hash: hash.substring(0, 7), author, timestamp: parseInt(timestamp) * 1000, subject };
      });
    } catch { return []; }
  }

  getMergedBranches() {
    try {
      const output = execSync('git branch --merged', { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean).map(b => b.trim());
    } catch { return []; }
  }

  getUnmergedBranches() {
    try {
      const output = execSync('git branch --no-merged', { cwd: this.projectRoot, encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean).map(b => b.trim());
    } catch { return []; }
  }

  generateBranchReport() {
    return {
      branches: this.getBranches(),
      stale: this.detectStaleBranches(),
      merged: this.getMergedBranches(),
      unmerged: this.getUnmergedBranches(),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { BranchInspector };