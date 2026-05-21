/**
 * WorkerSwarm.js — Dynamic Worker Swarm Engine
 *
 * Workers dynamically:
 * - Spawn on demand
 * - Merge when underutilized
 * - Split when overloaded
 * - Redistribute based on pressure
 *
 * Worker states: idle, working, reasoning, validating, rollback, recovering, dead
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * @typedef {'idle'|'working'|'reasoning'|'validating'|'rollback'|'recovering'|'dead'} WorkerState
 */

export class WorkerSwarm extends EventEmitter {
    #workers = new Map();
    #config;
    #eventStream;
    #maxWorkers;
    #minWorkers;
    #stats = {
        totalSpawned: 0,
        totalKilled: 0,
        totalTasksProcessed: 0,
        redistributions: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            maxWorkers: config.maxWorkers || 16,
            minWorkers: config.minWorkers || 2,
            idleTimeout: config.idleTimeout || 30000,
            spawnThreshold: config.spawnThreshold || 0.8,
            mergeThreshold: config.mergeThreshold || 0.2,
            ...config,
        };
        this.#eventStream = deps.eventStream;
        this.#maxWorkers = this.#config.maxWorkers;
        this.#minWorkers = this.#config.minWorkers;
    }

    /**
     * Initialize the swarm with minimum workers.
     */
    initialize() {
        for (let i = 0; i < this.#minWorkers; i++) {
            this.spawn('general');
        }
        this.emit('initialized', { workers: this.#workers.size });
    }

    /**
     * Spawn a new worker.
     * @param {string} role - Worker specialization
     * @returns {object|null} The spawned worker, or null if at capacity
     */
    spawn(role = 'general') {
        if (this.#workers.size >= this.#maxWorkers) {
            return null;
        }

        const worker = {
            id: randomUUID(),
            role,
            state: 'idle',
            spawnedAt: Date.now(),
            lastActivity: Date.now(),
            tasksProcessed: 0,
            currentTask: null,
            metrics: {
                avgDuration: 0,
                successRate: 1,
                totalDuration: 0,
            },
        };

        this.#workers.set(worker.id, worker);
        this.#stats.totalSpawned++;

        this.emit('worker:spawned', worker);
        this.#eventStream?.publish('WORKER_SPAWNED', { workerId: worker.id, role });

        return worker;
    }

    /**
     * Kill a worker.
     * @param {string} workerId
     * @param {string} reason
     */
    kill(workerId, reason = 'manual') {
        const worker = this.#workers.get(workerId);
        if (!worker) return;

        worker.state = 'dead';
        this.#workers.delete(workerId);
        this.#stats.totalKilled++;

        this.emit('worker:killed', { workerId, reason });
        this.#eventStream?.publish('WORKER_KILLED', { workerId, reason });
    }

    /**
     * Assign a task to the best available worker.
     * @param {object} task - { id, type, priority, project }
     * @returns {object|null} The assigned worker, or null if none available
     */
    assign(task) {
        const worker = this.#selectWorker(task);

        if (!worker) {
            // Try to spawn a new worker
            const spawned = this.spawn(task.type || 'general');
            if (!spawned) return null;
            return this.#assignToWorker(spawned, task);
        }

        return this.#assignToWorker(worker, task);
    }

    /**
     * Mark a worker's task as complete.
     * @param {string} workerId
     * @param {object} result - { status, duration }
     */
    complete(workerId, result) {
        const worker = this.#workers.get(workerId);
        if (!worker) return;

        worker.state = 'idle';
        worker.currentTask = null;
        worker.lastActivity = Date.now();
        worker.tasksProcessed++;
        worker.metrics.totalDuration += result.duration || 0;
        worker.metrics.avgDuration = worker.metrics.totalDuration / worker.tasksProcessed;

        if (result.status === 'success') {
            worker.metrics.successRate = (worker.metrics.successRate * (worker.tasksProcessed - 1) + 1) / worker.tasksProcessed;
        } else {
            worker.metrics.successRate = (worker.metrics.successRate * (worker.tasksProcessed - 1)) / worker.tasksProcessed;
        }

        this.#stats.totalTasksProcessed++;
        this.emit('worker:completed', { workerId, result });
        this.#eventStream?.publish('WORKER_COMPLETED', { workerId, taskId: result.taskId, status: result.status });
    }

    /**
     * Transition a worker to a specific state.
     */
    transition(workerId, newState) {
        const worker = this.#workers.get(workerId);
        if (!worker) return;

        const oldState = worker.state;
        worker.state = newState;
        worker.lastActivity = Date.now();

        this.emit('worker:transition', { workerId, from: oldState, to: newState });
    }

    /**
     * Redistribute workers based on current pressure.
     * Called by the Pressure Engine.
     */
    redistribute() {
        this.#stats.redistributions++;
        const saturation = this.getSaturation();

        // Spawn more if saturated
        if (saturation > this.#config.spawnThreshold && this.#workers.size < this.#maxWorkers) {
            const toSpawn = Math.min(2, this.#maxWorkers - this.#workers.size);
            for (let i = 0; i < toSpawn; i++) {
                this.spawn('general');
            }
            this.emit('swarm:scaled-up', { newSize: this.#workers.size });
        }

        // Kill idle workers if underutilized
        if (saturation < this.#config.mergeThreshold && this.#workers.size > this.#minWorkers) {
            const idleWorkers = this.getWorkersByState('idle')
                .sort((a, b) => a.lastActivity - b.lastActivity);

            const toKill = Math.min(2, this.#workers.size - this.#minWorkers, idleWorkers.length);
            for (let i = 0; i < toKill; i++) {
                this.kill(idleWorkers[i].id, 'merge-underutilized');
            }
            this.emit('swarm:scaled-down', { newSize: this.#workers.size });
        }

        this.#eventStream?.publish('SWARM_REDISTRIBUTED', {
            size: this.#workers.size,
            saturation,
        });
    }

    /**
     * Get current swarm saturation (0-1).
     */
    getSaturation() {
        if (this.#workers.size === 0) return 0;
        const busy = [...this.#workers.values()].filter(w => w.state !== 'idle').length;
        return busy / this.#workers.size;
    }

    /**
     * Get workers by state.
     */
    getWorkersByState(state) {
        return [...this.#workers.values()].filter(w => w.state === state);
    }

    /**
     * Get all workers with their current state.
     */
    getAll() {
        return [...this.#workers.values()].map(w => ({
            id: w.id,
            role: w.role,
            state: w.state,
            tasksProcessed: w.tasksProcessed,
            currentTask: w.currentTask?.id || null,
            uptime: Date.now() - w.spawnedAt,
            metrics: { ...w.metrics },
        }));
    }

    /**
     * Get swarm summary.
     */
    getSummary() {
        const workers = [...this.#workers.values()];
        const byState = {};
        for (const w of workers) {
            byState[w.state] = (byState[w.state] || 0) + 1;
        }

        return {
            total: workers.length,
            max: this.#maxWorkers,
            saturation: this.getSaturation(),
            byState,
            avgSuccessRate: workers.length > 0
                ? workers.reduce((s, w) => s + w.metrics.successRate, 0) / workers.length
                : 0,
        };
    }

    // --- Internal ---

    #selectWorker(task) {
        const idle = this.getWorkersByState('idle');
        if (idle.length === 0) return null;

        // Prefer workers with matching role
        const roleMatch = idle.find(w => w.role === task.type);
        if (roleMatch) return roleMatch;

        // Otherwise pick the one with best success rate
        return idle.sort((a, b) => b.metrics.successRate - a.metrics.successRate)[0];
    }

    #assignToWorker(worker, task) {
        worker.state = 'working';
        worker.currentTask = task;
        worker.lastActivity = Date.now();

        this.emit('worker:assigned', { workerId: worker.id, taskId: task.id });
        this.#eventStream?.publish('WORKER_ASSIGNED', { workerId: worker.id, taskId: task.id });

        return worker;
    }

    get size() { return this.#workers.size; }

    getStats() {
        return { ...this.#stats, currentSize: this.#workers.size, saturation: this.getSaturation() };
    }
}
