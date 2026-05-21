/**
 * HumanAuthorityLayer.js — Human Override & Emergency Control
 *
 * Supports:
 * - Emergency stop
 * - Rollback override
 * - Execution freeze
 * - Simulation-only mode
 *
 * Ensures humans always retain ultimate authority over the civilization.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class HumanAuthorityLayer extends EventEmitter {
    #config;
    #mode = 'normal';
    #overrides = [];
    #commands = [];
    #freezeState = null;
    #stats = {
        emergencyStops: 0,
        rollbackOverrides: 0,
        freezesActivated: 0,
        commandsIssued: 0,
        resumptions: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            requireConfirmation: config.requireConfirmation !== false,
            maxOverrideHistory: config.maxOverrideHistory || 200,
            freezeTimeout: config.freezeTimeout || 3600000,
            ...config,
        };
    }

    /**
     * Emergency stop — halt all autonomous execution immediately.
     */
    emergencyStop(reason, operator = 'human') {
        this.#mode = 'stopped';
        this.#stats.emergencyStops++;

        const command = {
            id: randomUUID(),
            type: 'emergency-stop',
            reason,
            operator,
            issuedAt: Date.now(),
            status: 'active',
        };

        this.#commands.push(command);
        this.#stats.commandsIssued++;
        this.emit('emergency:stop', command);
        return command;
    }

    /**
     * Resume from emergency stop.
     */
    resume(operator = 'human') {
        if (this.#mode !== 'stopped' && this.#mode !== 'frozen') {
            return { resumed: false, reason: 'System not in stopped/frozen state' };
        }

        this.#mode = 'normal';
        this.#freezeState = null;
        this.#stats.resumptions++;

        const command = {
            id: randomUUID(),
            type: 'resume',
            operator,
            issuedAt: Date.now(),
        };

        this.#commands.push(command);
        this.#stats.commandsIssued++;
        this.emit('system:resumed', command);
        return { resumed: true, command };
    }

    /**
     * Override a rollback decision.
     */
    rollbackOverride(target, reason, operator = 'human') {
        this.#stats.rollbackOverrides++;

        const override = {
            id: randomUUID(),
            type: 'rollback-override',
            target,
            reason,
            operator,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 600000,
        };

        this.#overrides.push(override);
        this.emit('rollback:override', override);
        return override;
    }

    /**
     * Freeze execution — no new tasks, existing tasks complete.
     */
    freeze(reason, operator = 'human') {
        this.#mode = 'frozen';
        this.#stats.freezesActivated++;

        this.#freezeState = {
            id: randomUUID(),
            reason,
            operator,
            frozenAt: Date.now(),
            expiresAt: Date.now() + this.#config.freezeTimeout,
        };

        const command = {
            id: randomUUID(),
            type: 'freeze',
            reason,
            operator,
            issuedAt: Date.now(),
        };

        this.#commands.push(command);
        this.#stats.commandsIssued++;
        this.emit('execution:frozen', this.#freezeState);
        return this.#freezeState;
    }

    /**
     * Switch to simulation-only mode — actions are simulated, not executed.
     */
    simulationMode(reason, operator = 'human') {
        this.#mode = 'simulation';

        const command = {
            id: randomUUID(),
            type: 'simulation-mode',
            reason,
            operator,
            issuedAt: Date.now(),
        };

        this.#commands.push(command);
        this.#stats.commandsIssued++;
        this.emit('mode:simulation', command);
        return command;
    }

    /**
     * Check if an action is allowed under current human authority state.
     */
    checkAuthority(action) {
        switch (this.#mode) {
            case 'stopped':
                return { allowed: false, reason: 'Emergency stop active', mode: this.#mode };
            case 'frozen':
                if (action.type !== 'status-check' && action.type !== 'read-only') {
                    return { allowed: false, reason: 'Execution frozen', mode: this.#mode };
                }
                return { allowed: true, mode: this.#mode };
            case 'simulation':
                return { allowed: true, simulationOnly: true, mode: this.#mode };
            default:
                return { allowed: true, mode: this.#mode };
        }
    }

    /**
     * Issue a direct command to the civilization.
     */
    issueCommand(type, parameters = {}, operator = 'human') {
        const command = {
            id: randomUUID(),
            type,
            parameters,
            operator,
            issuedAt: Date.now(),
            status: 'issued',
        };

        this.#commands.push(command);
        this.#stats.commandsIssued++;

        if (this.#commands.length > this.#config.maxOverrideHistory) {
            this.#commands = this.#commands.slice(-this.#config.maxOverrideHistory);
        }

        this.emit('command:issued', command);
        return command;
    }

    /**
     * Get current mode.
     */
    getMode() {
        return this.#mode;
    }

    /**
     * Get command history.
     */
    getCommandHistory(limit = 50) {
        return this.#commands.slice(-limit);
    }

    /**
     * Get active overrides.
     */
    getActiveOverrides() {
        const now = Date.now();
        return this.#overrides.filter(o => o.expiresAt > now);
    }

    getStats() {
        return { ...this.#stats, currentMode: this.#mode };
    }
}
