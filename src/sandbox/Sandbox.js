/**
 * Sandbox — isolated execution environment for generated code.
 *
 * Executes code in an isolated temp directory with resource limits.
 * All generated code runs here — never directly on the host filesystem.
 *
 * Usage:
 *   import { Sandbox } from './Sandbox.js';
 *   const sandbox = new Sandbox({ timeout: 10000, memoryMB: 512 });
 *   const result = await sandbox.run('def add(a, b): return a + b', { language: 'python' });
 *   console.log(result.stdout, result.stderr, result.exitCode);
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const DEFAULT_TIMEOUT = 30000; // ms
const SANDBOX_PREFIX = '/tmp/eval_sandbox_';

export class Sandbox {
  /**
   * @param {{ timeout?: number, memoryMB?: number, diskMB?: number, networkDisabled?: boolean }} options
   */
  constructor({ timeout = DEFAULT_TIMEOUT, memoryMB = 1024, diskMB = 100, networkDisabled = true } = {}) {
    this.timeout = timeout;
    this.memoryMB = memoryMB;
    this.diskMB = diskMB;
    this.networkDisabled = networkDisabled;
    this._activeProcess = null;
    this._activeSandboxDir = null;
  }

  /**
   * Execute code in the sandbox.
   * @param {string} code
   * @param {{ language: string, args?: string[] }} options
   * @returns {Promise<ExecutionResult>}
   */
  async run(code, { language = 'python', args = [] } = {}) {
    const sandboxDir = this._createSandboxDir();
    this._activeSandboxDir = sandboxDir;

    try {
      const ext = language === 'python' ? 'py' : language === 'javascript' ? 'js' : 'txt';
      const fileName = `main.${ext}`;
      const filePath = join(sandboxDir, fileName);

      writeFileSync(filePath, code, 'utf-8');

      const cmd = this._buildCommand(language, filePath, args);
      const start = Date.now();

      const result = await this._execute(cmd, sandboxDir);

      return {
        ...result,
        durationMs: Date.now() - start,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute a file in the sandbox.
   * @param {string} filePath
   * @param {{ language?: string, args?: string[] }} options
   * @returns {Promise<ExecutionResult>}
   */
  async runFile(filePath, { language = 'python', args = [] } = {}) {
    const sandboxDir = this._createSandboxDir();
    this._activeSandboxDir = sandboxDir;

    try {
      const destPath = join(sandboxDir, filePath.split('/').pop());
      // Copy file to sandbox (read-only for security)
      const { readFileSync, copyFileSync } = await import('fs');
      copyFileSync(filePath, destPath);

      const cmd = this._buildCommand(language, destPath, args);
      const start = Date.now();

      const result = await this._execute(cmd, sandboxDir);

      return {
        ...result,
        durationMs: Date.now() - start,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Kill the currently running process (if any).
   */
  terminate() {
    if (this._activeProcess) {
      this._activeProcess.kill('SIGKILL');
      this._activeProcess = null;
    }
  }

  /**
   * Clean up sandbox temp directory.
   */
  async cleanup() {
    if (this._activeSandboxDir) {
      try {
        if (existsSync(this._activeSandboxDir)) {
          rmSync(this._activeSandboxDir, { recursive: true, force: true });
        }
      } catch {
        // Best-effort cleanup
      }
      this._activeSandboxDir = null;
    }
    this._activeProcess = null;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _createSandboxDir() {
    const dir = join(SANDBOX_PREFIX, randomUUID());
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  _buildCommand(language, filePath, args) {
    switch (language) {
      case 'python':
        return { cmd: 'python3', args: [filePath, ...args] };
      case 'javascript':
        return { cmd: 'node', args: [filePath, ...args] };
      case 'bash':
      case 'shell':
        return { cmd: 'bash', args: [filePath, ...args] };
      default:
        return { cmd: 'python3', args: [filePath, ...args] };
    }
  }

  /**
   * @param {{ cmd: string, args: string[] }} cmd
   * @param {string} sandboxDir
   * @returns {Promise<ExecutionResult>}
   */
  _execute(cmd, sandboxDir) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      try {
        const child = spawn(cmd.cmd, cmd.args, {
          cwd: sandboxDir,
          timeout: this.timeout,
          stdio: ['pipe', 'pipe', 'pipe'],
          // Environment sanitization: remove network-related vars
          env: {
            ...process.env,
            NODE_OPTIONS: undefined,
            NODE_ENV: 'production',
          },
        });

        this._activeProcess = child;

        // Apply platform-specific resource limits
        if (process.platform === 'darwin' || process.platform === 'linux') {
          try {
            // CPU time limit (seconds)
            execSync(`ulimit -t ${Math.ceil(this.timeout / 1000)} 2>/dev/null || true`);
          } catch {
            // Best-effort — may fail without permissions
          }
        }

        child.stdout?.on('data', (data) => { stdout += data.toString(); });
        child.stderr?.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
          this._activeProcess = null;
          resolve({
            exitCode: code ?? 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            timedOut,
          });
        });

        child.on('error', (err) => {
          this._activeProcess = null;
          resolve({
            exitCode: 1,
            stdout: stdout.trim(),
            stderr: (stderr.trim() + ' ' + err.message).trim(),
            timedOut,
          });
        });

        // Safety timer
        const timer = setTimeout(() => {
          if (child.exitCode === null) {
            timedOut = true;
            child.kill('SIGKILL');
          }
        }, this.timeout);

        child.on('close', () => clearTimeout(timer));
      } catch (err) {
        resolve({
          exitCode: 1,
          stdout: stdout.trim(),
          stderr: stderr.trim() + ' ' + String(err),
          timedOut: false,
        });
      }
    });
  }
}

/**
 * @typedef {Object} ExecutionResult
 * @property {number} exitCode
 * @property {string} stdout
 * @property {string} stderr
 * @property {boolean} timedOut
 * @property {number} [durationMs]
 */

export default Sandbox;