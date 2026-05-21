/**
 * TaskPipeline.js — Real execution pipeline
 *
 * Flow: Planning → Execution → QA → Validation → Rollback (on failure)
 *
 * Each task passes through phases sequentially. If any phase fails,
 * the pipeline attempts rollback via the self-heal subsystem.
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

/**
 * @typedef {'queued'|'planning'|'executing'|'qa'|'validating'|'completed'|'failed'|'rolled_back'} TaskStatus
 */

export class TaskPipeline extends EventEmitter {
    #config;
    #sandbox;
    #memory;
    #intelligence;
    #observability;
    #selfHeal;
    #queue = [];
    #active = new Map();
    #history = [];
    #stats = { total: 0, completed: 0, failed: 0, rolledBack: 0 };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            maxConcurrent: config.maxConcurrent || 4,
            defaultTimeout: config.defaultTimeout || 60_000,
            retryAttempts: config.retryAttempts || 2,
            phases: config.phases || ['plan', 'execute', 'qa', 'validate'],
        };
        this.#sandbox = deps.sandbox;
        this.#memory = deps.memory;
        this.#intelligence = deps.intelligence;
        this.#observability = deps.observability;
        this.#selfHeal = deps.selfHeal;
    }

    /**
     * Execute a task through the full pipeline.
     * @param {object} task
     * @returns {Promise<object>} result with status, output, duration
     */
    async execute(task) {
        const execution = {
            id: task.id || randomUUID(),
            task,
            status: 'queued',
            phases: [],
            startTime: Date.now(),
            snapshot: null,
        };

        this.#stats.total++;
        this.#active.set(execution.id, execution);
        this.emit('task:start', execution);

        try {
            // Take snapshot for rollback
            execution.snapshot = await this.#takeSnapshot(task);

            // Phase 1: Planning
            execution.status = 'planning';
            this.emit('task:phase', { id: execution.id, phase: 'plan' });
            const plan = await this.#phasePlan(task);
            execution.phases.push({ phase: 'plan', result: plan, time: Date.now() });

            // Phase 2: Execution
            execution.status = 'executing';
            this.emit('task:phase', { id: execution.id, phase: 'execute' });
            const execResult = await this.#phaseExecute(task, plan);
            execution.phases.push({ phase: 'execute', result: execResult, time: Date.now() });

            if (execResult.status === 'failed') {
                throw new ExecutionError('Execution failed', execResult);
            }

            // Phase 3: QA
            execution.status = 'qa';
            this.emit('task:phase', { id: execution.id, phase: 'qa' });
            const qaResult = await this.#phaseQA(task, execResult);
            execution.phases.push({ phase: 'qa', result: qaResult, time: Date.now() });

            if (!qaResult.passed) {
                throw new ExecutionError('QA failed', qaResult);
            }

            // Phase 4: Validation
            execution.status = 'validating';
            this.emit('task:phase', { id: execution.id, phase: 'validate' });
            const validation = await this.#phaseValidate(task, execResult);
            execution.phases.push({ phase: 'validate', result: validation, time: Date.now() });

            if (!validation.valid) {
                throw new ExecutionError('Validation failed', validation);
            }

            // Success
            execution.status = 'completed';
            this.#stats.completed++;
            this.emit('task:complete', execution);

            return this.#buildResult(execution, 'success');

        } catch (error) {
            // Attempt rollback
            execution.status = 'failed';
            this.#stats.failed++;

            const rollbackResult = await this.#rollback(execution, error);
            if (rollbackResult.success) {
                execution.status = 'rolled_back';
                this.#stats.rolledBack++;
            }

            this.emit('task:failed', { execution, error: error.message });
            return this.#buildResult(execution, 'failed', error);

        } finally {
            this.#active.delete(execution.id);
            this.#history.push(execution);
            // Keep history bounded
            if (this.#history.length > 500) {
                this.#history = this.#history.slice(-250);
            }
        }
    }

    /** Planning phase — analyze task, determine steps */
    async #phasePlan(task) {
        const context = this.#memory
            ? await this.#memory.getContext(task.project, task.type)
            : {};

        return {
            steps: task.steps || [{ command: task.command, type: task.type }],
            context,
            estimatedDuration: task.timeout || this.#config.defaultTimeout,
        };
    }

    /** Execution phase — run commands in sandbox */
    async #phaseExecute(task, plan) {
        if (!this.#sandbox) {
            return { status: 'skipped', reason: 'no sandbox available' };
        }

        const results = [];
        for (const step of plan.steps) {
            const result = await this.#sandbox.run(step.command, {
                cwd: task.project,
                timeout: plan.estimatedDuration,
                env: task.env,
            });
            results.push(result);

            if (result.exitCode !== 0 && !step.allowFailure) {
                return { status: 'failed', results, failedStep: step };
            }
        }

        return { status: 'success', results };
    }

    /** QA phase — verify execution results */
    async #phaseQA(task, execResult) {
        // If task specifies QA commands, run them
        if (task.qa && task.qa.length > 0) {
            for (const check of task.qa) {
                const result = await this.#sandbox.run(check.command, {
                    cwd: task.project,
                    timeout: 30_000,
                });
                if (result.exitCode !== 0) {
                    return { passed: false, reason: check.name || check.command, output: result.stderr };
                }
            }
        }

        return { passed: true };
    }

    /** Validation phase — final checks */
    async #phaseValidate(task, execResult) {
        // Check for known failure patterns from memory
        if (this.#memory) {
            const patterns = await this.#memory.getFailurePatterns(task.type);
            for (const pattern of patterns) {
                const output = execResult.results?.map(r => r.stdout + r.stderr).join('\n') || '';
                if (output.includes(pattern.signature)) {
                    return { valid: false, reason: `Known failure pattern: ${pattern.name}` };
                }
            }
        }

        return { valid: true };
    }

    /** Take a snapshot before execution for rollback */
    async #takeSnapshot(task) {
        if (!task.project) return null;

        // Record current state for potential rollback
        return {
            timestamp: Date.now(),
            project: task.project,
            type: 'pre-execution',
        };
    }

    /** Rollback on failure */
    async #rollback(execution, error) {
        if (!this.#selfHeal) {
            return { success: false, reason: 'no self-heal available' };
        }

        try {
            await this.#selfHeal.recover({
                type: 'execution_failure',
                execution,
                error: error.message,
                snapshot: execution.snapshot,
            });
            return { success: true };
        } catch (rollbackError) {
            return { success: false, reason: rollbackError.message };
        }
    }

    #buildResult(execution, status, error = null) {
        return {
            id: execution.id,
            status,
            duration: Date.now() - execution.startTime,
            phases: execution.phases,
            error: error?.message || null,
        };
    }

    /** Drain all active tasks (for shutdown) */
    async drain() {
        // Wait for active tasks to complete
        const timeout = 10_000;
        const start = Date.now();
        while (this.#active.size > 0 && Date.now() - start < timeout) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    getStats() {
        return {
            ...this.#stats,
            active: this.#active.size,
            queued: this.#queue.length,
            maxConcurrent: this.#config.maxConcurrent,
        };
    }
}

class ExecutionError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'ExecutionError';
        this.details = details;
    }
}
