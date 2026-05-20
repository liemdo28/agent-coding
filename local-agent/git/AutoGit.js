// local-agent/git/AutoGit.js
// Full autonomy Git operations: auto-commit, auto-push, auto-merge, conflict resolution
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export class AutoGit {
  constructor(cwd = process.cwd(), options = {}) {
    this.cwd = cwd;
    this.options = {
      autoStash: options.autoStash ?? true,
      maxRetries: options.maxRetries ?? 3,
      branchStrategy: options.branchStrategy ?? 'main',
      signCommits: options.signCommits ?? false,
      ...options
    };
    this.ledger = [];
  }

  // ========== Core Status & Info ==========

  async status() {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.cwd });
      return stdout.trim();
    } catch (err) {
      return '';
    }
  }

  async currentBranch() {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: this.cwd });
      return stdout.trim();
    } catch (err) {
      return 'unknown';
    }
  }

  async remoteUrl(remote = 'origin') {
    try {
      const { stdout } = await execAsync(`git remote get-url ${remote}`, { cwd: this.cwd });
      return stdout.trim();
    } catch (err) {
      return null;
    }
  }

  async hasChanges() {
    const status = await this.status();
    return status.length > 0;
  }

  async stagedFiles() {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: this.cwd });
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (err) {
      return [];
    }
  }

  async modifiedFiles() {
    try {
      const { stdout } = await execAsync('git diff --name-only', { cwd: this.cwd });
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (err) {
      return [];
    }
  }

  async untrackedFiles() {
    try {
      const { stdout } = await execAsync('git ls-files --others --exclude-standard', { cwd: this.cwd });
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (err) {
      return [];
    }
  }

  async diffSummary() {
    try {
      const { stdout } = await execAsync('git diff --stat', { cwd: this.cwd });
      return stdout.trim();
    } catch (err) {
      return '';
    }
  }

  async lastCommit() {
    try {
      const { stdout } = await execAsync('git log -1 --format="%H|%s|%an|%ai"', { cwd: this.cwd });
      const [hash, message, author, date] = stdout.trim().split('|');
      return { hash, message, author, date };
    } catch (err) {
      return null;
    }
  }

  // ========== Autonomy: Intelligent Commit ==========

  async analyzeChanges() {
    const modified = await this.modifiedFiles();
    const untracked = await this.untrackedFiles();
    const staged = await this.stagedFiles();
    const diff = await this.diffSummary();

    // Categorize changes
    const categories = {
      added: [],
      modified: [],
      deleted: [],
      renamed: [],
      untracked: untracked
    };

    for (const file of modified) {
      try {
        const { stdout } = await execAsync(`git diff --name-status HEAD -- "${file}"`, { cwd: this.cwd });
        const status = stdout.trim()[0];
        if (status === 'A' || status === '?') categories.added.push(file);
        else if (status === 'M') categories.modified.push(file);
        else if (status === 'D') categories.deleted.push(file);
        else if (status === 'R') categories.renamed.push(file);
        else categories.modified.push(file);
      } catch {
        categories.modified.push(file);
      }
    }

    return {
      modified,
      untracked,
      staged,
      diff,
      categories,
      totalChanges: modified.length + untracked.length
    };
  }

  async generateCommitMessage(analysis) {
    // Generate a meaningful commit message based on changes
    const parts = [];

    if (analysis.categories.added.length > 0) {
      const files = analysis.categories.added.slice(0, 3);
      parts.push(`Add ${files.join(', ')}${analysis.categories.added.length > 3 ? '...' : ''}`);
    }

    if (analysis.categories.modified.length > 0) {
      const files = analysis.categories.modified.slice(0, 3);
      parts.push(`Update ${files.join(', ')}${analysis.categories.modified.length > 3 ? '...' : ''}`);
    }

    if (analysis.categories.deleted.length > 0) {
      parts.push(`Remove ${analysis.categories.deleted.length} file(s)`);
    }

    if (analysis.categories.renamed.length > 0) {
      parts.push(`Rename ${analysis.categories.renamed.length} file(s)`);
    }

    if (analysis.categories.untracked.length > 0) {
      parts.push(`Add ${analysis.categories.untracked.length} new file(s)`);
    }

    const prefix = this._getChangePrefix(analysis);
    return `${prefix}: ${parts.join(' | ')}`;
  }

  _getChangePrefix(analysis) {
    const total = analysis.totalChanges;
    const hasSecurity = analysis.categories.modified.some(f =>
      f.includes('auth') || f.includes('security') || f.includes('password') || f.includes('.env')
    );
    const hasTests = analysis.categories.added.some(f => f.includes('.test.') || f.includes('.spec.'));
    const hasDocs = analysis.categories.added.some(f =>
      f.includes('README') || f.includes('.md') || f.includes('docs/')
    );

    if (hasSecurity) return 'security';
    if (hasTests && !hasDocs) return 'test';
    if (hasDocs) return 'docs';
    if (total > 10) return 'chore';
    if (total > 5) return 'refactor';
    return 'feat';
  }

  // ========== Autonomy: Smart Staging ==========

  async smartStage(patterns = ['.']) {
    console.log('[AutoGit] Smart staging...');

    // Stage by patterns
    for (const pattern of patterns) {
      await execAsync(`git add "${pattern}"`, { cwd: this.cwd });
    }

    const staged = await this.stagedFiles();
    console.log(`[AutoGit] Staged ${staged.length} file(s)`);
    return staged;
  }

  async stageByIntent(intent) {
    // Stage files based on intent keywords
    const intents = {
      tests: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.test.py', '**/__tests__/**'],
      docs: ['**/*.md', '**/docs/**', 'README*'],
      deps: ['package*.json', 'requirements.txt', 'Cargo.toml', 'go.mod'],
      config: ['**/config/**', '**/*.config.*', '**/.env*']
    };

    const patterns = intents[intent.toLowerCase()] || [intent];
    return this.smartStage(patterns);
  }

  // ========== Autonomy: Commit with Full Control ==========

  async autoCommit(message = null, options = {}) {
    const {
      all = false,
      sign = this.options.signCommits,
      amend = false,
      allowEmpty = false
    } = options;

    console.log('[AutoGit] Analyzing changes...');
    const analysis = await this.analyzeChanges();

    if (!message) {
      message = await this.generateCommitMessage(analysis);
    }

    if (analysis.totalChanges === 0 && !allowEmpty) {
      console.log('[AutoGit] No changes to commit.');
      return { success: false, reason: 'no_changes', message };
    }

    // Smart stage
    if (all) {
      await execAsync('git add -A', { cwd: this.cwd });
    } else {
      await this.smartStage();
    }

    // Build commit command
    let cmd = `git commit`;
    if (sign) cmd += ' -S';
    if (amend) cmd += ' --amend --no-edit';
    cmd += ` -m "${message.replace(/"/g, '\\"')}"`;

    console.log(`[AutoGit] Committing: "${message}"`);

    try {
      await execAsync(cmd, { cwd: this.cwd });

      this._logAction('commit', { message, analysis });

      return {
        success: true,
        message,
        analysis,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('[AutoGit] Commit failed:', err.message);
      throw err;
    }
  }

  async commitWithFiles(files, message) {
    for (const file of files) {
      await execAsync(`git add "${file}"`, { cwd: this.cwd });
    }

    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.cwd });
    return { success: true, message, files };
  }

  // ========== Autonomy: Push with Retry & Force Protection ==========

  async autoPush(remote = 'origin', branch = null, options = {}) {
    const {
      force = false,
      retry = this.options.maxRetries,
      tags = false,
      setUpstream = false
    } = options;

    if (!branch) {
      branch = await this.currentBranch();
    }

    console.log(`[AutoGit] Pushing to ${remote}/${branch}...`);

    // Check if branch exists on remote
    const remoteBranchExists = await this._remoteBranchExists(remote, branch);

    let cmd = 'git push';
    if (tags) cmd += ' --tags';
    if (setUpstream || !remoteBranchExists) cmd += ' -u';
    if (force) cmd += ' --force-with-lease'; // Safer than --force
    cmd += ` ${remote} ${branch}`;

    let lastError = null;
    for (let attempt = 1; attempt <= retry; attempt++) {
      try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: this.cwd });
        console.log(`[AutoGit] Push successful (attempt ${attempt})`);

        this._logAction('push', { remote, branch, attempt });

        return {
          success: true,
          remote,
          branch,
          output: stdout || stderr,
          attempt
        };
      } catch (err) {
        lastError = err;
        console.warn(`[AutoGit] Push attempt ${attempt} failed: ${err.message}`);

        if (attempt < retry) {
          // Try to resolve common issues
          await this._handlePushFailure(err, remote, branch);
          await this._sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    console.error(`[AutoGit] Push failed after ${retry} attempts`);
    return {
      success: false,
      error: lastError.message,
      attempts: retry
    };
  }

  async _remoteBranchExists(remote, branch) {
    try {
      await execAsync(`git rev-parse --verify ${remote}/${branch}`, { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }

  async _handlePushFailure(err, remote, branch) {
    const message = err.message || '';

    if (message.includes('rejected')) {
      console.log('[AutoGit] Push rejected - fetching and merging...');
      try {
        await execAsync(`git fetch ${remote}`, { cwd: this.cwd });
        await execAsync(`git merge ${remote}/${branch}`, { cwd: this.cwd });
      } catch (mergeErr) {
        console.warn('[AutoGit] Merge failed, will need manual resolution');
      }
    } else if (message.includes('no upstream')) {
      console.log('[AutoGit] Setting upstream branch...');
    }
  }

  // ========== Autonomy: Smart Merge ==========

  async autoMerge(sourceBranch, targetBranch = 'main', options = {}) {
    const {
      noFf = false,
      abortOnConflict = true,
      strategy = 'recursive'
    } = options;

    console.log(`[AutoGit] Auto-merging ${sourceBranch} into ${targetBranch}...`);

    const currentBranch = await this.currentBranch();
    const isOnTarget = currentBranch === targetBranch;

    // Switch to target branch if needed
    if (!isOnTarget) {
      console.log(`[AutoGit] Switching to ${targetBranch}...`);
      await execAsync(`git checkout ${targetBranch}`, { cwd: this.cwd });
    }

    // Build merge command
    let cmd = 'git merge';
    if (no_ff) cmd += ' --no-ff';
    if (strategy) cmd += ` --strategy=${strategy}`;
    cmd += ` ${sourceBranch}`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: this.cwd });
      console.log('[AutoGit] Auto-merge successful.');

      this._logAction('merge', { sourceBranch, targetBranch });

      return {
        success: true,
        sourceBranch,
        targetBranch,
        output: stdout || stderr
      };
    } catch (err) {
      console.error(`[AutoGit] Merge conflict or error: ${err.message}`);

      if (abortOnConflict) {
        console.log('[AutoGit] Aborting merge...');
        await execAsync('git merge --abort', { cwd: this.cwd }).catch(() => { });
      }

      // Analyze conflicts
      const conflicts = await this.getConflicts();

      return {
        success: false,
        reason: 'conflict',
        conflicts,
        sourceBranch,
        targetBranch,
        canAutoResolve: await this._canAutoResolveConflicts(conflicts)
      };
    }
  }

  async getConflicts() {
    try {
      const { stdout } = await execAsync('git diff --name-only --diff-filter=U', { cwd: this.cwd });
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch {
      return [];
    }
  }

  async _canAutoResolveConflicts(conflicts) {
    // Simple heuristic: if conflicts are in test files or docs, we might auto-resolve
    const autoResolvable = conflicts.filter(f =>
      f.includes('.test.') ||
      f.includes('.spec.') ||
      f.includes('README') ||
      f.includes('.md')
    );
    return autoResolvable.length === conflicts.length && conflicts.length > 0;
  }

  async resolveConflict(file, resolution = 'ours') {
    // resolution: 'ours', 'theirs', 'accept-both'
    let cmd;
    if (resolution === 'ours') {
      cmd = `git checkout --ours "${file}"`;
    } else if (resolution === 'theirs') {
      cmd = `git checkout --theirs "${file}"`;
    } else {
      // Accept both - keep both versions with markers
      return;
    }

    await execAsync(cmd, { cwd: this.cwd });
    await execAsync(`git add "${file}"`, { cwd: this.cwd });
  }

  async resolveAllConflicts(resolution = 'ours') {
    const conflicts = await this.getConflicts();
    for (const file of conflicts) {
      await this.resolveConflict(file, resolution);
    }

    // Complete the merge
    await execAsync('git commit -m "Resolve merge conflicts"', { cwd: this.cwd });

    return { resolved: conflicts.length, resolution };
  }

  // ========== Autonomy: Branch Management ==========

  async createBranch(name, checkout = true) {
    const cmd = checkout ? `git checkout -b ${name}` : `git branch ${name}`;
    await execAsync(cmd, { cwd: this.cwd });
    return { success: true, branch: name };
  }

  async switchBranch(name) {
    await execAsync(`git checkout ${name}`, { cwd: this.cwd });
    return { success: true, branch: name };
  }

  async deleteBranch(name, force = false) {
    const cmd = force ? `git branch -D ${name}` : `git branch -d ${name}`;
    await execAsync(cmd, { cwd: this.cwd });
    return { success: true, branch: name };
  }

  async listBranches(remote = false) {
    const cmd = remote ? 'git branch -r' : 'git branch';
    const { stdout } = await execAsync(cmd, { cwd: this.cwd });
    return stdout.trim().split('\n').map(b => b.trim().replace(/^\*/, '')).filter(b => b.length > 0);
  }

  async mergeStatus(sourceBranch, targetBranch = 'main') {
    try {
      // Get commits that are in source but not target
      const { stdout: ahead } = await execAsync(
        `git log ${targetBranch}..${sourceBranch} --oneline`,
        { cwd: this.cwd }
      );

      // Get commits that are in target but not source
      const { stdout: behind } = await execAsync(
        `git log ${sourceBranch}..${targetBranch} --oneline`,
        { cwd: this.cwd }
      );

      return {
        source: sourceBranch,
        target: targetBranch,
        ahead: ahead.trim().split('\n').filter(c => c.length > 0),
        behind: behind.trim().split('\n').filter(c => c.length > 0),
        canMerge: ahead.length === 0,
        hasDiverged: ahead.length > 0 && behind.length > 0
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ========== Autonomy: Stash Operations ==========

  async stash(message = null) {
    const cmd = message
      ? `git stash push -m "${message}"`
      : 'git stash push';

    try {
      await execAsync(cmd, { cwd: this.cwd });
      this._logAction('stash', { message });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async stashPop() {
    try {
      await execAsync('git stash pop', { cwd: this.cwd });
      this._logAction('stash_pop', {});
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async stashList() {
    try {
      const { stdout } = await execAsync('git stash list', { cwd: this.cwd });
      return stdout.trim().split('\n').filter(s => s.length > 0);
    } catch {
      return [];
    }
  }

  // ========== Full Autonomous Workflow ==========

  async executeFullWorkflow(options = {}) {
    const {
      commitMessage = null,
      sourceBranch = null,
      targetBranch = null,
      push = true,
      merge = true,
      autoResolve = false
    } = options;

    console.log('[AutoGit] Starting full autonomous workflow...');
    const workflowId = `wf-${Date.now()}`;
    const startTime = Date.now();

    const results = {
      workflowId,
      startTime: new Date(startTime).toISOString(),
      steps: []
    };

    try {
      // Step 1: Analyze changes
      const analysis = await this.analyzeChanges();
      results.steps.push({
        step: 'analyze',
        success: true,
        changes: analysis.totalChanges
      });

      if (analysis.totalChanges === 0) {
        results.success = true;
        results.message = 'No changes to commit';
        results.endTime = new Date().toISOString();
        results.duration = Date.now() - startTime;
        return results;
      }

      // Step 2: Generate commit message if not provided
      const finalMessage = commitMessage || await this.generateCommitMessage(analysis);
      results.steps.push({
        step: 'message_generated',
        success: true,
        message: finalMessage
      });

      // Step 3: Auto-commit
      const commitResult = await this.autoCommit(finalMessage);
      results.steps.push({
        step: 'commit',
        success: commitResult.success,
        commit: commitResult.success ? await this.lastCommit() : null,
        error: commitResult.success ? null : commitResult.reason
      });

      if (!commitResult.success) {
        throw new Error('Commit failed');
      }

      // Step 4: Auto-merge if branches specified
      if (merge && sourceBranch && targetBranch && sourceBranch !== targetBranch) {
        const currentBranch = await this.currentBranch();

        if (currentBranch !== sourceBranch) {
          await this.switchBranch(sourceBranch);
        }

        const mergeResult = await this.autoMerge(sourceBranch, targetBranch);
        results.steps.push({
          step: 'merge',
          success: mergeResult.success,
          source: sourceBranch,
          target: targetBranch,
          conflicts: mergeResult.conflicts || null
        });

        if (!mergeResult.success && autoResolve && mergeResult.canAutoResolve) {
          await this.resolveAllConflicts('ours');
          results.steps.push({
            step: 'auto_resolve',
            success: true
          });
        } else if (!mergeResult.success) {
          throw new Error(`Merge conflict in ${mergeResult.conflicts?.join(', ')}`);
        }
      }

      // Step 5: Auto-push
      if (push) {
        const currentBranch = await this.currentBranch();
        const pushResult = await this.autoPush('origin', currentBranch);
        results.steps.push({
          step: 'push',
          success: pushResult.success,
          remote: pushResult.remote,
          branch: pushResult.branch,
          error: pushResult.success ? null : pushResult.error
        });

        if (!pushResult.success) {
          throw new Error(`Push failed: ${pushResult.error}`);
        }
      }

      results.success = true;
      results.message = 'Workflow completed successfully';

    } catch (err) {
      results.success = false;
      results.message = err.message;
      results.error = err.stack;
    }

    results.endTime = new Date().toISOString();
    results.duration = Date.now() - startTime;

    console.log(`[AutoGit] Workflow ${workflowId} ${results.success ? 'succeeded' : 'failed'} in ${results.duration}ms`);

    this._logAction('workflow', results);

    return results;
  }

  // ========== Telegram Integration ==========

  async telegramPush(args = '') {
    // Parse args: can include custom message, branch, etc.
    const parts = args.split(' ').filter(p => p.length > 0);
    const message = parts[0] || `Telegram push ${new Date().toISOString()}`;
    const branch = parts[1] || null;

    return this.executeFullWorkflow({
      commitMessage: message,
      targetBranch: branch || await this.currentBranch(),
      push: true,
      merge: false
    });
  }

  // ========== Utility ==========

  _logAction(action, data) {
    this.ledger.push({
      action,
      data,
      timestamp: new Date().toISOString()
    });
  }

  getLedger() {
    return this.ledger;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Rebase ==========

  async rebase(onto = 'main') {
    console.log(`[AutoGit] Rebasing onto ${onto}...`);
    try {
      await execAsync(`git rebase ${onto}`, { cwd: this.cwd });
      this._logAction('rebase', { onto });
      return { success: true, onto };
    } catch (err) {
      console.warn('[AutoGit] Rebase conflict, aborting...');
      await execAsync('git rebase --abort', { cwd: this.cwd }).catch(() => { });
      return { success: false, error: err.message };
    }
  }

  async interactiveRebase(count = 3) {
    await execAsync(`git rebase -i HEAD~${count}`, { cwd: this.cwd, stdio: 'inherit' });
    return { success: true };
  }

  // ========== Tags ==========

  async createTag(name, message = null) {
    const cmd = message
      ? `git tag -a ${name} -m "${message}"`
      : `git tag ${name}`;

    await execAsync(cmd, { cwd: this.cwd });
    return { success: true, tag: name };
  }

  async pushTags(remote = 'origin') {
    await execAsync(`git push ${remote} --tags`, { cwd: this.cwd });
    return { success: true };
  }

  // ========== Cherry Pick ==========

  async cherryPick(commit) {
    try {
      await execAsync(`git cherry-pick ${commit}`, { cwd: this.cwd });
      return { success: true, commit };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ========== Reset ==========

  async reset(mode = 'soft', count = 1) {
    const validModes = ['soft', 'mixed', 'hard', 'keep'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Use: ${validModes.join(', ')}`);
    }

    await execAsync(`git reset --${mode} HEAD~${count}`, { cwd: this.cwd });
    return { success: true, mode, count };
  }

  // ========== Clean ==========

  async clean(options = {}) {
    const {
      force = true,
      directories = false,
      dryRun = false
    } = options;

    let cmd = 'git clean';
    if (force) cmd += ' -f';
    if (directories) cmd += ' -d';
    if (dryRun) cmd += ' -n';

    try {
      const { stdout } = await execAsync(cmd, { cwd: this.cwd });
      return { success: true, output: stdout.trim().split('\n').filter(l => l.length > 0) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export default AutoGit;