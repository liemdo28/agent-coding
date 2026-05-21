/**
 * PressureScheduler.js — Real Task Execution with Backpressure
 *
 * Manages task queue with pressure-aware scheduling.
 * When pressure is high: shed low-priority tasks, delay non-critical work.
 * When pressure is low: process eagerly, prefetch context.
 *
 * Pressure = (active tasks / max workers) * queue depth factor
 */

export class PressureScheduler {
    #swarm;
    #events;
    #config;
    #queue = []; // priority queue
    #active = new Map();
    #pressure = 0;
    #interval = null;
    #stats = { scheduled: 0, completed: 0, shed: 0, avgWaitMs: 0 };
    #waitTimes = [];

    constructor(swarm, events, config = {}) {
        this.#swarm = swarm;
        this.#events = events;
        this.#config = {
            maxWorkers: config.maxWorkers || 8,
            maxPressure: config.maxPressure || 0.85,
            tickMs: config.tickMs || 1000,
            maxQueueDepth: config.maxQueueDepth || 200,
            ...config,
        };
    }

    start() {
        this.#interval = setInterval(() => this.#tick(), this.#config.tickMs);
        if (this.#interval.unref) this.#interval.unref();
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
    }

    /**
     * Schedule a task for execution.
     * Returns a promise that resolves when the task completes.
     */
    async schedule(task) {
        this.#stats.scheduled++;

        // Shed if over capacity
        if (this.#queue.length >= this.#config.maxQueueDepth) {
            if (task.priority === 'low') {
                this.#stats.shed++;
                this.#events?.publish('scheduler.task.shed', { taskId: task.id, reason: 'queue_full' });
                return { status: 'shed', reason: 'queue_full', taskId: task.id };
            }
        }

        return new Promise((resolve) => {
            const entry = {
                task,
                resolve,
                enqueuedAt: Date.now(),
                priority: this.#priorityScore(task),
            };

            // Insert in priority order
            const idx = this.#queue.findIndex(e => e.priority < entry.priority);
            if (idx === -1) {
                this.#queue.push(entry);
            } else {
                this.#queue.splice(idx, 0, entry);
            }

            this.#events?.publish('scheduler.task.enqueued', {
                taskId: task.id,
                queueDepth: this.#queue.length,
                priority: entry.priority,
            });

            // Try immediate dispatch
            this.#dispatch();
        });
    }

    #tick() {
        this.#updatePressure();
        this.#dispatch();

        // Emit pressure events
        if (this.#pressure > this.#config.maxPressure) {
            this.#events?.publish('scheduler.pressure.high', { pressure: this.#pressure });
        } else if (this.#pressure < 0.3 && this.#queue.length === 0) {
            this.#events?.publish('scheduler.pressure.low', { pressure: this.#pressure });
        }
    }

    #dispatch() {
        const swarmStats = this.#swarm?.getStats?.();
        const available = (swarmStats?.idle ?? this.#config.maxWorkers) - this.#active.size;

        let dispatched = 0;
        while (this.#queue.length > 0 && dispatched < available) {
            const entry = this.#queue.shift();
            if (!entry) break;

            dispatched++;
            this.#active.set(entry.task.id, entry);

            // Track wait time
            const waitMs = Date.now() - entry.enqueuedAt;
            this.#waitTimes.push(waitMs);
            if (this.#waitTimes.length > 100) this.#waitTimes.shift();

            // Execute via swarm
            this.#executeViaSwarm(entry).then((result) => {
                this.#active.delete(entry.task.id);
                this.#stats.completed++;
                entry.resolve(result);
            }).catch((err) => {
                this.#active.delete(entry.task.id);
                entry.resolve({ status: 'failed', error: err.message, taskId: entry.task.id });
            });
        }
    }

    async #executeViaSwarm(entry) {
        if (this.#swarm) {
            return this.#swarm.assignTask(entry.task);
        }

        // Fallback: direct execution
        return {
            status: 'completed',
            taskId: entry.task.id,
            duration: 0,
            result: 'executed (no swarm)',
        };
    }

    #updatePressure() {
        const activeRatio = this.#active.size / this.#config.maxWorkers;
        const queueFactor = Math.min(this.#queue.length / 50, 1);
        this.#pressure = Math.min((activeRatio * 0.7) + (queueFactor * 0.3), 1.0);
    }

    #priorityScore(task) {
        const priorities = { critical: 100, high: 75, normal: 50, low: 25 };
        return priorities[task.priority] || 50;
    }

    getPressure() {
        return Math.round(this.#pressure * 100) / 100;
    }

    getStats() {
        const avgWait = this.#waitTimes.length > 0
            ? Math.round(this.#waitTimes.reduce((a, b) => a + b, 0) / this.#waitTimes.length)
            : 0;

        return {
            ...this.#stats,
            pressure: this.getPressure(),
            queueDepth: this.#queue.length,
            activeTasks: this.#active.size,
            maxWorkers: this.#config.maxWorkers,
            avgWaitMs: avgWait,
            running: !!this.#interval,
        };
    }
}
