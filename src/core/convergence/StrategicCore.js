/**
 * StrategicCore.js — L10: Continuous Strategic Analysis + Continuity
 *
 * Continuously asks: "What threatens long-term organizational continuity?"
 * Analyzes technical debt, bottlenecks, scaling risks, coordination complexity.
 * Outputs evolution proposals, runtime optimizations, priority shifts.
 */

export class StrategicCore {
    #runtime;
    #events;
    #db;
    #interval = null;
    #proposals = [];
    #risks = [];
    #stats = { analyses: 0, proposals: 0, risksDetected: 0 };

    constructor(runtime, events, db) {
        this.#runtime = runtime;
        this.#events = events;
        this.#db = db;
    }

    start(intervalMs = 120000) {
        this.#interval = setInterval(() => this.#analyze(), intervalMs);
        if (this.#interval.unref) this.#interval.unref();
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
    }

    async #analyze() {
        this.#stats.analyses++;
        const risks = [];
        const proposals = [];

        // 1. Technical analysis
        const execStats = this.#getExecutionStats();
        if (execStats.failureRate > 0.3) {
            risks.push({ type: 'high_failure_rate', severity: 'high', rate: execStats.failureRate });
            proposals.push({ action: 'investigate_failures', reason: `${(execStats.failureRate * 100).toFixed(0)}% failure rate` });
        }

        // 2. Runtime analysis
        const health = this.#runtime?.getHealth?.();
        if (health?.pressure > 0.7) {
            risks.push({ type: 'sustained_pressure', severity: 'medium', pressure: health.pressure });
            proposals.push({ action: 'scale_workers', reason: 'Sustained high pressure' });
        }

        // 3. Memory saturation
        const memStats = this.#runtime?.memory?.getStats?.();
        if (memStats?.cacheSize > 500) {
            risks.push({ type: 'memory_bloat', severity: 'low', cacheSize: memStats.cacheSize });
            proposals.push({ action: 'memory_evolution', reason: 'Cache growing large' });
        }

        // 4. Swarm utilization
        const swarmStats = this.#runtime?.swarm?.getStats?.();
        if (swarmStats && swarmStats.busy > swarmStats.idle * 2) {
            risks.push({ type: 'swarm_saturation', severity: 'medium' });
            proposals.push({ action: 'scale_swarm', reason: 'Agents consistently saturated' });
        }

        // 5. Queue depth
        const schedulerStats = this.#runtime?.scheduler?.getStats?.();
        if (schedulerStats?.queueDepth > 50) {
            risks.push({ type: 'queue_backlog', severity: 'high', depth: schedulerStats.queueDepth });
            proposals.push({ action: 'shed_or_scale', reason: `Queue depth: ${schedulerStats.queueDepth}` });
        }

        this.#risks = risks;
        this.#proposals = proposals;
        this.#stats.risksDetected += risks.length;
        this.#stats.proposals += proposals.length;

        if (risks.length > 0 || proposals.length > 0) {
            this.#events?.publish('strategic.analysis.completed', { risks, proposals });

            // Persist strategic decisions
            if (this.#db?.type !== 'none') {
                try {
                    this.#db.run(
                        `INSERT OR REPLACE INTO memory (key, value, category, importance, access_count, created_at, updated_at)
                         VALUES (?, ?, ?, ?, 0, ?, ?)`,
                        [
                            `strategic:analysis:${Date.now()}`,
                            JSON.stringify({ risks, proposals }),
                            'strategic',
                            0.8,
                            Date.now(),
                            Date.now(),
                        ]
                    );
                } catch { }
            }
        }
    }

    #getExecutionStats() {
        if (this.#db?.type === 'none') return { failureRate: 0, total: 0 };

        try {
            const total = this.#db.get('SELECT COUNT(*) as cnt FROM executions');
            const failed = this.#db.get("SELECT COUNT(*) as cnt FROM executions WHERE status = 'failed'");
            const t = total?.cnt || 0;
            const f = failed?.cnt || 0;
            return { failureRate: t > 0 ? f / t : 0, total: t, failed: f };
        } catch {
            return { failureRate: 0, total: 0 };
        }
    }

    getRisks() { return this.#risks; }
    getProposals() { return this.#proposals; }

    getStats() {
        return {
            ...this.#stats,
            activeRisks: this.#risks.length,
            activeProposals: this.#proposals.length,
            running: !!this.#interval,
        };
    }
}
