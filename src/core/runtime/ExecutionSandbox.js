/**
 * ExecutionSandbox.js — Safe command execution with isolation
 *
 * Runs commands in a controlled environment with:
 * - Blocked dangerous patterns
 * - Timeout enforcement
 * - Concurrency limits
 * - Resource tracking
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class ExecutionSandbox extends EventEmitter {
    #config;
    #activeProcesses = new Map();
    #processCounter = 0;
    #stats = {
        totalRuns: 0,
        successful: 0,
        failed: 0,
        timedOut: 0,
        blocked: 0,
    };

    #blockedPatterns = [
        /^rm\s+-rf\s+\/($|\s)/i,
        /^sudo\s+/i,
        /^mkfs/i,
        /^dd\s+if=/i,
        /^chmod\s+-R\s+777\s+\//i,
        />\s*\/dev\/sd/i,
        /\|\s*sh\s*$/i,
    ];

    constructor(config = {}) {
        super();
        this.#config = {
            maxConcurrent: config.maxConcurrent || 10,
            defaultTimeout: config.defaultTimeout || 30_000,
            ...config,
        };

        // Add user-defined blocked patterns
        if (config.blockedPatterns) {
            for (const p of config.blockedPatterns) {
                if (typeof p === 'string') {
                    this.#blockedPatterns.push(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
                }
            }
        }
    }

    /**
     * Run a command in the sandbox.
     * @param {string} command
     * @param {object} options - { cwd, timeout, env }
     * @returns {Promise<{exitCode, stdout, stderr, duration, blocked}>}
     */
    async run(command, options = {}) {
        // Safety check
        if (this.#isBlocked(command)) {
            this.#stats.blocked++;
            this.emit('blocked', { command });
            return {
                exitCode: -1,
                stdout: '',
                stderr: `BLOCKED: Command "${command}" matches a dangerous pattern`,
                duration: 0,
                blocked: true,
            };
        }

        // Concurrency check
        if (this.#activeProcesses.size >= this.#config.maxConcurrent) {
            await this.#waitForSlot();
        }

        const id = ++this.#processCounter;
        const timeout = options.timeout || this.#config.defaultTimeout;
        const startTime = Date.now();

        this.#stats.totalRuns++;

        return new Promise((resolve) => {
            const proc = spawn('sh', ['-c', command], {
                cwd: options.cwd || process.cwd(),
                env: { ...process.env, ...options.env },
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            this.#activeProcesses.set(id, proc);

            let stdout = '';
            let stderr = '';
            let killed = false;

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            const timer = setTimeout(() => {
                killed = true;
                proc.kill('SIGTERM');
                setTimeout(() => {
                    if (!proc.killed) proc.kill('SIGKILL');
                }, 5000);
            }, timeout);

            proc.on('close', (code) => {
                clearTimeout(timer);
                this.#activeProcesses.delete(id);
                const duration = Date.now() - startTime;

                if (killed) {
                    this.#stats.timedOut++;
                    resolve({
                        exitCode: -1,
                        stdout,
                        stderr: stderr + '\n[TIMEOUT]',
                        duration,
                        blocked: false,
                        timedOut: true,
                    });
                } else if (code === 0) {
                    this.#stats.successful++;
                    resolve({ exitCode: 0, stdout, stderr, duration, blocked: false });
                } else {
                    this.#stats.failed++;
                    resolve({ exitCode: code, stdout, stderr, duration, blocked: false });
                }

                this.emit('complete', { id, exitCode: code, duration });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                this.#activeProcesses.delete(id);
                this.#stats.failed++;
                resolve({
                    exitCode: -1,
                    stdout: '',
                    stderr: err.message,
                    duration: Date.now() - startTime,
                    blocked: false,
                });
            });
        });
    }

    #isBlocked(command) {
        return this.#blockedPatterns.some(pattern => pattern.test(command));
    }

    #waitForSlot() {
        return new Promise((resolve) => {
            const check = () => {
                if (this.#activeProcesses.size < this.#config.maxConcurrent) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    getStats() {
        return { ...this.#stats, active: this.#activeProcesses.size };
    }

    /** Kill all active processes */
    killAll() {
        for (const [id, proc] of this.#activeProcesses) {
            proc.kill('SIGTERM');
        }
        this.#activeProcesses.clear();
    }
}
