/**
 * OrgStateMachine.js — L7: Global Organizational State Machine
 *
 * The system has ONE global state that determines behavior across all subsystems.
 * State transitions are event-driven and affect cognition, scheduling, recovery, and strategy.
 *
 * States: stable | focused | high_pressure | incident | recovery | evolution | strategic
 */

export class OrgStateMachine {
    #state = 'stable';
    #previousState = null;
    #stateHistory = [];
    #events;
    #transitionRules;
    #stateEnteredAt = Date.now();
    #stats = { transitions: 0 };

    constructor(events) {
        this.#events = events;
        this.#transitionRules = this.#buildRules();
    }

    start() {
        // Subscribe to events that trigger state transitions
        this.#events?.subscribe('system.error', () => this.transition('incident'));
        this.#events?.subscribe('selfheal.recovery.completed', (d) => {
            if (d.success) this.transition('recovery');
        });
        this.#events?.subscribe('scheduler.pressure.high', () => this.transition('high_pressure'));
        this.#events?.subscribe('scheduler.pressure.low', () => this.transition('stable'));
        this.#events?.subscribe('swarm.task.assigned', () => {
            if (this.#state === 'stable') this.transition('focused');
        });
        this.#events?.subscribe('system.alive', () => this.transition('stable'));
    }

    /**
     * Attempt a state transition.
     */
    transition(targetState) {
        if (targetState === this.#state) return false;

        // Check if transition is allowed
        const allowed = this.#transitionRules.get(this.#state);
        if (allowed && !allowed.includes(targetState)) return false;

        this.#previousState = this.#state;
        this.#state = targetState;
        this.#stateEnteredAt = Date.now();
        this.#stats.transitions++;

        this.#stateHistory.push({
            from: this.#previousState,
            to: targetState,
            at: Date.now(),
        });
        if (this.#stateHistory.length > 100) this.#stateHistory.shift();

        this.#events?.publish('org.state.changed', {
            from: this.#previousState,
            to: targetState,
            duration: Date.now() - this.#stateEnteredAt,
        });

        return true;
    }

    /**
     * Get behavior modifiers for current state.
     */
    getBehavior() {
        const behaviors = {
            stable: {
                cognitionBudget: 'full',
                schedulerMode: 'eager',
                recoveryPriority: 'low',
                analyticsEnabled: true,
                evolutionEnabled: true,
            },
            focused: {
                cognitionBudget: 'full',
                schedulerMode: 'eager',
                recoveryPriority: 'medium',
                analyticsEnabled: true,
                evolutionEnabled: false,
            },
            high_pressure: {
                cognitionBudget: 'compressed',
                schedulerMode: 'conservative',
                recoveryPriority: 'high',
                analyticsEnabled: false,
                evolutionEnabled: false,
            },
            incident: {
                cognitionBudget: 'minimal',
                schedulerMode: 'emergency',
                recoveryPriority: 'critical',
                analyticsEnabled: false,
                evolutionEnabled: false,
            },
            recovery: {
                cognitionBudget: 'compressed',
                schedulerMode: 'conservative',
                recoveryPriority: 'high',
                analyticsEnabled: true,
                evolutionEnabled: false,
            },
            evolution: {
                cognitionBudget: 'full',
                schedulerMode: 'background',
                recoveryPriority: 'low',
                analyticsEnabled: true,
                evolutionEnabled: true,
            },
            strategic: {
                cognitionBudget: 'full',
                schedulerMode: 'paused',
                recoveryPriority: 'low',
                analyticsEnabled: true,
                evolutionEnabled: true,
            },
        };

        return behaviors[this.#state] || behaviors.stable;
    }

    #buildRules() {
        // Allowed transitions from each state
        return new Map([
            ['stable', ['focused', 'high_pressure', 'incident', 'evolution', 'strategic']],
            ['focused', ['stable', 'high_pressure', 'incident']],
            ['high_pressure', ['stable', 'incident', 'recovery']],
            ['incident', ['recovery', 'stable']],
            ['recovery', ['stable', 'incident']],
            ['evolution', ['stable', 'incident']],
            ['strategic', ['stable', 'incident']],
        ]);
    }

    get state() { return this.#state; }
    get previousState() { return this.#previousState; }
    get stateAge() { return Date.now() - this.#stateEnteredAt; }

    getStats() {
        return {
            state: this.#state,
            previousState: this.#previousState,
            stateAge: this.stateAge,
            transitions: this.#stats.transitions,
            history: this.#stateHistory.slice(-10),
            behavior: this.getBehavior(),
        };
    }
}
