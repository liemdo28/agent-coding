/**
 * CognitionLoop.js — M1: Continuous Cognition Runtime
 *
 * THE SYSTEM NEVER SLEEPS.
 * Even when owner is inactive, this loop continuously:
 * observe → analyze → correlate → prioritize → reason → adapt → remember → evolve
 *
 * This is what makes the system feel "alive".
 */

export class CognitionLoop {
    #runtime;
    #events;
    #contextUnifier;
    #compression;
    #intelligence;
    #orgState;
    #memoryEvolution;
    #strategic;

    #interval = null;
    #tickMs;
    #cycle = 0;
    #lastObservation = null;
    #stats = { cycles: 0, observations: 0, adaptations: 0, evolutions: 0 };

    constructor({ runtime, events, contextUnifier, compression, intelligence, orgState, memoryEvolution, strategic }) {
        this.#runtime = runtime;
        this.#events = events;
        this.#contextUnifier = contextUnifier;
        this.#compression = compression;
        this.#intelligence = intelligence;
        this.#orgState = orgState;
        this.#memoryEvolution = memoryEvolution;
        this.#strategic = strategic;
        this.#tickMs = 10000; // 10s default cycle
    }

    start() {
        this.#interval = setInterval(() => this.#tick(), this.#tickMs);
        if (this.#interval.unref) this.#interval.unref();
        this.#events?.publish('cognition.loop.started');
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
        this.#events?.publish('cognition.loop.stopped');
    }

    async #tick() {
        this.#cycle++;
        this.#stats.cycles++;

        try {
            // 1. OBSERVE — gather current state
            const observation = await this.#observe();

            // 2. ANALYZE — detect patterns and anomalies
            const analysis = this.#analyze(observation);

            // 3. CORRELATE — connect to memory and history
            const correlation = this.#correlate(analysis);

            // 4. PRIORITIZE — determine what needs attention
            const priorities = this.#prioritize(correlation);

            // 5. ADAPT — adjust runtime behavior
            if (priorities.adaptations.length > 0) {
                await this.#adapt(priorities.adaptations);
            }

            // 6. REMEMBER — persist learnings
            await this.#remember(observation, analysis);

            // 7. EVOLVE — periodic deep evolution (every 12 cycles = ~2 min)
            if (this.#cycle % 12 === 0) {
                await this.#evolve();
            }

            this.#lastObservation = observation;
            this.#events?.publish('cognition.loop.tick', {
                cycle: this.#cycle,
                state: this.#orgState?.state,
                priorities: priorities.adaptations.length,
            });
        } catch (err) {
            this.#events?.publish('cognition.loop.error', { error: err.message, cycle: this.#cycle });
        }
    }

    /**
     * OBSERVE: Gather all system state into a snapshot.
     */
    async #observe() {
        this.#stats.observations++;

        const health = this.#runtime?.getHealth?.() || {};
        const recentEvents = this.#events?.getRecent(50) || [];
        const swarmStats = this.#runtime?.swarm?.getStats?.() || {};
        const schedulerStats = this.#runtime?.scheduler?.getStats?.() || {};
        const predictions = this.#intelligence?.getPredictions?.() || [];

        return {
            timestamp: Date.now(),
            state: this.#orgState?.state || 'unknown',
            pressure: health.pressure ?? 0,
            memory: process.memoryUsage(),
            eventRate: this.#events?.getRate?.() || 0,
            swarm: { agents: swarmStats.agents || 0, busy: swarmStats.busy || 0, queue: swarmStats.queueSize || 0 },
            scheduler: { queue: schedulerStats.queueDepth || 0, active: schedulerStats.activeTasks || 0 },
            predictions,
            recentTopics: [...new Set(recentEvents.slice(-20).map(e => e.topic))],
        };
    }

    /**
     * ANALYZE: Detect patterns, anomalies, and trends.
     */
    #analyze(observation) {
        const signals = [];

        // Pressure analysis
        if (observation.pressure > 0.8) {
            signals.push({ type: 'critical_pressure', value: observation.pressure });
        } else if (observation.pressure > 0.6) {
            signals.push({ type: 'elevated_pressure', value: observation.pressure });
        }

        // Queue analysis
        if (observation.scheduler.queue > 30) {
            signals.push({ type: 'queue_growing', value: observation.scheduler.queue });
        }

        // Swarm saturation
        if (observation.swarm.agents > 0 && observation.swarm.busy >= observation.swarm.agents) {
            signals.push({ type: 'swarm_saturated', busy: observation.swarm.busy, total: observation.swarm.agents });
        }

        // Event storm
        if (observation.eventRate > 50) {
            signals.push({ type: 'event_storm', rate: observation.eventRate });
        }

        // Memory pressure
        const heapRatio = observation.memory.heapUsed / observation.memory.heapTotal;
        if (heapRatio > 0.85) {
            signals.push({ type: 'memory_pressure', ratio: heapRatio });
        }

        // Prediction alerts
        for (const p of observation.predictions) {
            if (p.severity === 'high') {
                signals.push({ type: 'prediction_alert', prediction: p });
            }
        }

        return { signals, severity: signals.length > 2 ? 'high' : signals.length > 0 ? 'medium' : 'low' };
    }

    /**
     * CORRELATE: Connect current analysis to historical patterns.
     */
    #correlate(analysis) {
        // Compare with last observation
        const delta = {};
        if (this.#lastObservation) {
            delta.pressureChange = (this.#lastObservation.pressure || 0) - (analysis.signals.find(s => s.type === 'critical_pressure')?.value || 0);
            delta.isWorsening = analysis.severity === 'high' && this.#lastObservation;
        }

        return { ...analysis, delta, correlatedAt: Date.now() };
    }

    /**
     * PRIORITIZE: Determine what needs immediate attention.
     */
    #prioritize(correlation) {
        const adaptations = [];

        for (const signal of correlation.signals) {
            switch (signal.type) {
                case 'critical_pressure':
                    adaptations.push({ action: 'shed_load', urgency: 'immediate' });
                    break;
                case 'swarm_saturated':
                    adaptations.push({ action: 'scale_swarm', urgency: 'soon' });
                    break;
                case 'queue_growing':
                    adaptations.push({ action: 'increase_throughput', urgency: 'soon' });
                    break;
                case 'memory_pressure':
                    adaptations.push({ action: 'gc_compact', urgency: 'immediate' });
                    break;
                case 'event_storm':
                    adaptations.push({ action: 'compress_events', urgency: 'soon' });
                    break;
            }
        }

        return { adaptations, severity: correlation.severity };
    }

    /**
     * ADAPT: Execute runtime adaptations.
     */
    async #adapt(adaptations) {
        this.#stats.adaptations += adaptations.length;

        for (const a of adaptations) {
            switch (a.action) {
                case 'shed_load':
                    this.#orgState?.transition('high_pressure');
                    this.#events?.publish('cognition.adaptation', { action: 'shed_load' });
                    break;
                case 'scale_swarm':
                    this.#runtime?.swarm?.scaleUp?.();
                    this.#events?.publish('cognition.adaptation', { action: 'scale_swarm' });
                    break;
                case 'gc_compact':
                    if (global.gc) global.gc();
                    this.#events?.publish('cognition.adaptation', { action: 'gc_compact' });
                    break;
                case 'compress_events':
                    // Trigger event compression
                    this.#events?.publish('cognition.adaptation', { action: 'compress_events' });
                    break;
                case 'increase_throughput':
                    this.#runtime?.swarm?.scaleUp?.();
                    break;
            }
        }
    }

    /**
     * REMEMBER: Persist observations and learnings.
     */
    async #remember(observation, analysis) {
        // Only persist significant observations
        if (analysis.severity !== 'low') {
            const memory = this.#runtime?.memory;
            if (memory) {
                await memory.set(`observation:${this.#cycle}`, {
                    state: observation.state,
                    pressure: observation.pressure,
                    signals: analysis.signals.length,
                    severity: analysis.severity,
                    timestamp: observation.timestamp,
                }, { category: 'observation', importance: analysis.severity === 'high' ? 0.8 : 0.5 });
            }
        }
    }

    /**
     * EVOLVE: Deep periodic evolution — memory cleanup, strategic analysis.
     */
    async #evolve() {
        this.#stats.evolutions++;
        await this.#memoryEvolution?.forceEvolve?.();
        this.#events?.publish('cognition.evolution.triggered', { cycle: this.#cycle });
    }

    /**
     * Adjust tick speed based on organizational state.
     */
    adjustSpeed(state) {
        const speeds = {
            stable: 15000,      // Relaxed
            focused: 10000,     // Normal
            high_pressure: 5000, // Fast
            incident: 3000,     // Very fast
            recovery: 8000,     // Moderate
        };

        const newTick = speeds[state] || 10000;
        if (newTick !== this.#tickMs) {
            this.#tickMs = newTick;
            this.stop();
            this.start();
        }
    }

    get cycle() { return this.#cycle; }

    getStats() {
        return {
            ...this.#stats,
            cycle: this.#cycle,
            tickMs: this.#tickMs,
            running: !!this.#interval,
            lastObservation: this.#lastObservation ? {
                state: this.#lastObservation.state,
                pressure: this.#lastObservation.pressure,
                eventRate: this.#lastObservation.eventRate,
            } : null,
        };
    }
}
