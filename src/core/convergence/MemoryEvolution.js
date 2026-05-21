/**
 * MemoryEvolution.js — L9: Memory Consolidation & Evolution
 *
 * Memory must evolve. Without this, memory becomes unusable semantic garbage.
 * Continuously: merge duplicates, strengthen patterns, compress noise, elevate lessons.
 */

export class MemoryEvolution {
    #db;
    #events;
    #interval = null;
    #stats = { cycles: 0, merged: 0, compressed: 0, elevated: 0 };

    constructor(db, events) {
        this.#db = db;
        this.#events = events;
    }

    start(intervalMs = 60000) {
        this.#interval = setInterval(() => this.#evolve(), intervalMs);
        if (this.#interval.unref) this.#interval.unref();
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
    }

    async #evolve() {
        if (this.#db?.type === 'none') return;
        this.#stats.cycles++;

        await this.#strengthenFrequent();
        await this.#compressOld();
        await this.#elevatePatterns();

        this.#events?.publish('memory.evolution.cycle', { cycle: this.#stats.cycles });
    }

    /**
     * Strengthen frequently accessed memories (increase importance).
     */
    async #strengthenFrequent() {
        try {
            this.#db.run(
                `UPDATE memory SET importance = MIN(1.0, importance + 0.05)
                 WHERE access_count > 5 AND importance < 0.9`
            );
        } catch { }
    }

    /**
     * Compress old, low-importance memories.
     */
    async #compressOld() {
        try {
            const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
            const old = this.#db.query(
                `SELECT key FROM memory WHERE updated_at < ? AND importance < 0.3 AND access_count < 2 LIMIT 50`,
                [cutoff]
            );

            if (old.length > 0) {
                const keys = old.map(r => r.key);
                for (const key of keys) {
                    this.#db.run('DELETE FROM memory WHERE key = ?', [key]);
                }
                this.#stats.compressed += old.length;
            }
        } catch { }
    }

    /**
     * Elevate execution patterns into strategic memory.
     */
    async #elevatePatterns() {
        try {
            // Find repeated task types with consistent outcomes
            const patterns = this.#db.query(
                `SELECT task_type, status, COUNT(*) as cnt, AVG(duration_ms) as avg_duration
                 FROM executions
                 GROUP BY task_type, status
                 HAVING cnt >= 5
                 ORDER BY cnt DESC
                 LIMIT 20`
            );

            for (const p of patterns) {
                const key = `pattern:${p.task_type}:${p.status}`;
                const existing = this.#db.get('SELECT key FROM memory WHERE key = ?', [key]);
                if (!existing) {
                    this.#db.run(
                        `INSERT OR REPLACE INTO memory (key, value, category, importance, access_count, created_at, updated_at)
                         VALUES (?, ?, ?, ?, 0, ?, ?)`,
                        [key, JSON.stringify(p), 'pattern', 0.7, Date.now(), Date.now()]
                    );
                    this.#stats.elevated++;
                }
            }
        } catch { }
    }

    /**
     * Force a full evolution cycle (for testing or manual trigger).
     */
    async forceEvolve() {
        await this.#evolve();
    }

    getStats() {
        return { ...this.#stats, running: !!this.#interval };
    }
}
