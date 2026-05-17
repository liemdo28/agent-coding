/**
 * SandboxRunner.js - Run commands in sandbox with isolation and safety checks
 * Phase 22: Local Runtime Sandbox + Safe Execution Engine
 */

const { spawn } = require('child_process');

class SandboxRunner {
  constructor(options = {}) {
    this.options = {
      workingDirectory: options.workingDirectory || process.cwd(),
      maxConcurrent: options.maxConcurrent || 10,
      defaultTimeout: options.defaultTimeout || 30000,
      env: options.env || { ...process.env },
      ...options,
    };

    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      timedOutRuns: 0,
      blockedRuns: 0,
      totalExecutionTime: 0,
      activeProcesses: 0,
      peakConcurrent: 0,
      startTime: Date.now(),
    };

    this.blockedPatterns = [
      /^rm\s+-rf\s+\/(f)?/i,
      /^sudo\s+/i,
      /^mkfs/i,
      /^dd\s+if=/i,
      /^:{.*:.*\|.*&};:/i,
      /^chmod\s+-R\s+777\s+\/(system|boot|etc)/i,
    ];

    this.activeProcesses = new Map();
    this.processIdCounter = 0;
  }

  run(command, options = {}) {
    return new Promise((resolve) => {
      if (this.isBlocked(command)) {
        this.stats.blockedRuns++;
        resolve({
          success: false,
          stdout: '',
          stderr: 'Command blocked by sandbox',
          exitCode: -1,
          executionTime: 0,
          processId: null,
          blocked: true,
          reason: 'Command matches blocked pattern',
        });
        return;
      }

      const processId = ++this.processIdCounter;
      const startTime = Date.now();

      const runOptions = {
        cwd: options.cwd || this.options.workingDirectory,
        env: { ...this.options.env, ...options.env },
        timeout: options.timeout || this.options.defaultTimeout,
        maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
        ...options,
      };

      this.stats.totalRuns++;
      this.stats.activeProcesses++;

      if (this.stats.activeProcesses > this.stats.peakConcurrent) {
        this.stats.peakConcurrent = this.stats.activeProcesses;
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn('/bin/sh', ['-c', command], {
        cwd: runOptions.cwd,
        env: runOptions.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(processId, child);

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, runOptions.timeout);

      child.stdout.on('data', (data) => {
        if (stdout.length + data.length <= runOptions.maxBuffer) {
          stdout += data.toString();
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length + data.length <= runOptions.maxBuffer) {
          stderr += data.toString();
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);
        this.stats.activeProcesses--;
        const executionTime = Date.now() - startTime;
        this.stats.totalExecutionTime += executionTime;

        if (timedOut) {
          this.stats.timedOutRuns++;
          resolve({ success: false, stdout, stderr: stderr || 'Command timed out', exitCode: -1, executionTime, processId, timedOut: true });
        } else if (code === 0) {
          this.stats.successfulRuns++;
          resolve({ success: true, stdout, stderr, exitCode: code, executionTime, processId });
        } else {
          this.stats.failedRuns++;
          resolve({ success: false, stdout, stderr, exitCode: code, executionTime, processId });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);
        this.stats.activeProcesses--;
        this.stats.failedRuns++;
        const executionTime = Date.now() - startTime;
        this.stats.totalExecutionTime += executionTime;
        resolve({ success: false, stdout: '', stderr: err.message, exitCode: -1, executionTime, processId, error: err.message });
      });
    });
  }

  runWithTimeout(command, timeout, options = {}) {
    return this.run(command, { ...options, timeout });
  }

  isBlocked(command) {
    if (!command || typeof command !== 'string') return true;
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) return true;
    }
    const externalPatterns = [
      /curl\s+https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
      /wget\s+https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
      /fetch\s+https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
    ];
    for (const pattern of externalPatterns) {
      if (pattern.test(command)) return true;
    }
    return false;
  }

  getSandboxStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgExecutionTime = this.stats.totalRuns > 0 ? this.stats.totalExecutionTime / this.stats.totalRuns : 0;
    return {
      ...this.stats,
      uptime,
      averageExecutionTime: avgExecutionTime,
      blockedPatterns: this.blockedPatterns.length,
      activeProcessIds: Array.from(this.activeProcesses.keys()),
    };
  }

  reset() {
    const previousStats = { ...this.stats };
    for (const [processId, child] of this.activeProcesses) {
      try { child.kill('SIGKILL'); } catch (e) { /* already dead */ }
    }
    this.activeProcesses.clear();
    this.stats = {
      totalRuns: 0, successfulRuns: 0, failedRuns: 0, timedOutRuns: 0,
      blockedRuns: 0, totalExecutionTime: 0, activeProcesses: 0,
      peakConcurrent: 0, startTime: Date.now(),
    };
    this.processIdCounter = 0;
    return previousStats;
  }

  killProcess(processId) {
    const child = this.activeProcesses.get(processId);
    if (child) {
      try {
        child.kill('SIGKILL');
        this.activeProcesses.delete(processId);
        this.stats.activeProcesses--;
        return true;
      } catch (e) { return false; }
    }
    return false;
  }

  killAllProcesses() {
    const killed = this.activeProcesses.size;
    for (const [processId, child] of this.activeProcesses) {
      try { child.kill('SIGKILL'); } catch (e) { /* already dead */ }
    }
    this.activeProcesses.clear();
    this.stats.activeProcesses = 0;
    return killed;
  }
}

module.exports = SandboxRunner;
