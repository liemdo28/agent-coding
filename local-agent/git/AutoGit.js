// local-agent/git/AutoGit.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AutoGit {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  async status() {
    const { stdout } = await execAsync('git status --porcelain', { cwd: this.cwd });
    return stdout.trim();
  }

  async autoCommit(message) {
    console.log(`[AutoGit] Staging changes...`);
    await execAsync('git add .', { cwd: this.cwd });
    
    const status = await this.status();
    if (!status) {
      console.log(`[AutoGit] No changes to commit.`);
      return false;
    }

    console.log(`[AutoGit] Committing with message: "${message}"`);
    await execAsync(`git commit -m "${message}"`, { cwd: this.cwd });
    return true;
  }

  async autoPush(remote = 'origin', branch = 'main') {
    console.log(`[AutoGit] Pushing to ${remote}/${branch}...`);
    try {
      const { stdout } = await execAsync(`git push ${remote} ${branch}`, { cwd: this.cwd });
      console.log(`[AutoGit] Push successful.`);
      return stdout;
    } catch (err) {
      console.error(`[AutoGit] Push failed:`, err.message);
      throw err;
    }
  }

  async autoMerge(sourceBranch, targetBranch = 'main') {
    console.log(`[AutoGit] Auto-merging ${sourceBranch} into ${targetBranch}...`);
    try {
      // Switch to target branch
      await execAsync(`git checkout ${targetBranch}`, { cwd: this.cwd });
      // Perform merge
      await execAsync(`git merge ${sourceBranch}`, { cwd: this.cwd });
      console.log(`[AutoGit] Auto-merge successful.`);
      return true;
    } catch (err) {
      console.error(`[AutoGit] Auto-merge encountered a conflict or error. Aborting merge.`);
      await execAsync('git merge --abort', { cwd: this.cwd }).catch(() => {});
      throw err;
    }
  }

  async executeFullWorkflow(commitMessage, sourceBranch = 'main', targetBranch = 'main') {
    console.log(`[AutoGit] Starting full autonomous workflow...`);
    const committed = await this.autoCommit(commitMessage);
    if (!committed) {
      return "No changes were made.";
    }

    if (sourceBranch !== targetBranch) {
      await this.autoMerge(sourceBranch, targetBranch);
    }
    
    await this.autoPush('origin', targetBranch);
    console.log(`[AutoGit] Workflow completed.`);
    return "Workflow completed successfully.";
  }
}
