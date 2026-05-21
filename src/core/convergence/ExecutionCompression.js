/**
 * ExecutionCompression.js — L4: Compress Cognition/Events/Noise
 *
 * As system scales, raw data explodes. This engine compresses:
 * - Event streams into semantic summaries
 * - Telemetry into trend signals
 * - Memory retrievals into relevant highlights
 * - Swarm chatter into consensus signals
 */

export class ExecutionCompression {
    #events;
    #stats = { compressions: 0, inputEvents: 0, outputTokens: 0 };

    constructor(events) {
        this.#events = events;
    }

    /**
     * Compress a batch of raw events into a semantic summary.
     */
    compressEvents(events, maxTokens = 500) {
        this.#stats.compressions++;
        this.#stats.inputEvents += events.length;

        if (events.length === 0) return { summary: 'No activity', signals: [] };

        // Group by topic prefix
        const groups = {};
        for (const e of events) {
            const prefix = e.topic?.split('.').slice(0, 2).join('.') || 'unknown';
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(e);
        }

        // Generate semantic signals
        const signals = [];
        for (const [topic, items] of Object.entries(groups)) {
            const signal = {
                topic,
                count: items.length,
                rate: items.length / Math.max(1, (Date.now() - (items[0]?.timestamp || Date.now())) / 1000),
                latest: items[items.length - 1]?.data,
            };

            // Detect patterns
            if (signal.rate > 10) signal.pattern = 'burst';
            else if (signal.count > 20) signal.pattern = 'sustained';
            else signal.pattern = 'normal';

            signals.push(signal);
        }

        // Sort by importance (bursts first)
        signals.sort((a, b) => {
            const order = { burst: 0, sustained: 1, normal: 2 };
            return (order[a.pattern] ?? 2) - (order[b.pattern] ?? 2);
        });

        // Build compressed summary
        const lines = [`Activity: ${events.length} events across ${Object.keys(groups).length} topics`];
        for (const s of signals.slice(0, 8)) {
            const icon = s.pattern === 'burst' ? '⚡' : s.pattern === 'sustained' ? '📊' : '•';
            lines.push(`${icon} ${s.topic}: ${s.count}x (${s.rate.toFixed(1)}/s)`);
        }

        const summary = lines.join('\n');
        this.#stats.outputTokens += summary.length;

        return { summary, signals, inputCount: events.length, outputLength: summary.length };
    }

    /**
     * Compress telemetry history into trend signals.
     */
    compressTelemetry(history) {
        if (history.length < 3) return { trends: [], health: 'unknown' };

        const latest = history[history.length - 1];
        const trends = [];

        // Extract numeric fields and compute trends
        const fields = ['pressure', 'uptime'];
        for (const field of fields) {
            const values = history.map(h => h[field]).filter(v => typeof v === 'number');
            if (values.length >= 3) {
                const trend = this.#linearTrend(values);
                const current = values[values.length - 1];
                trends.push({ field, current, trend, direction: trend > 0 ? 'rising' : trend < 0 ? 'falling' : 'stable' });
            }
        }

        const health = (latest?.pressure ?? 0) < 0.5 ? 'healthy' :
            (latest?.pressure ?? 0) < 0.8 ? 'stressed' : 'critical';

        return { trends, health, latest };
    }

    /**
     * Compress memory search results into relevant highlights.
     */
    compressMemory(results, maxItems = 5) {
        if (!results || results.length === 0) return '';

        return results.slice(0, maxItems).map(r => {
            const value = typeof r.value === 'string' ? r.value.slice(0, 150) : JSON.stringify(r.value).slice(0, 150);
            return `[${r.category || 'mem'}] ${r.key}: ${value}`;
        }).join('\n');
    }

    #linearTrend(values) {
        const n = values.length;
        if (n < 3) return 0;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i;
        }
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    getStats() { return { ...this.#stats }; }
}
