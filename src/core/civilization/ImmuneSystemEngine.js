/**
 * ImmuneSystemEngine.js — Civilization Immune System
 *
 * Detects and responds to:
 * - Runaway optimization
 * - Execution chaos
 * - Recursive instability
 * - Orchestration collapse
 *
 * Acts as the civilization's immune system — detecting threats
 * and triggering defensive responses automatically.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ImmuneSystemEngine extends EventEmitter {
    #config;
    #threats = [];
    #responses = [];
    #antibodies = new Map();
    #healthIndicators = new Map();
    #quarantine = new Map();
    #stats = {
        threatsDetected: 0,
        responsesTriggered: 0,
        quarantinesActive: 0,
        antibodiesCreated: 0,
        systemRecoveries: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            threatThreshold: config.threatThreshold || 0.6,
            quarantineDuration: config.quarantineDuration || 300000,
            maxThreats: config.maxThreats || 200,
            autoRespond: config.autoRespond !== false,
            ...config,
        };

        this.#registerDefaultAntibodies();
    }

    /**
     * Report a health indicator.
     */
    reportHealth(indicator, value) {
        const clamped = Math.max(0, Math.min(1, value));
        this.#healthIndicators.set(indicator, { value: clamped, reportedAt: Date.now() });

        // Check if this indicates a threat
        if (clamped < this.#config.threatThreshold) {
            this.#detectThreat(indicator, clamped);
        }
    }

    /**
     * Detect a threat to civilization stability.
     */
    detectThreat(type, severity, context = {}) {
        const threat = {
            id: randomUUID(),
            type,
            severity: Math.max(0, Math.min(1, severity)),
            context,
            detectedAt: Date.now(),
            status: 'active',
            responses: [],
        };

        this.#threats.push(threat);
        this.#stats.threatsDetected++;

        if (this.#threats.length > this.#config.maxThreats) {
            this.#threats = this.#threats.slice(-this.#config.maxThreats);
        }

        this.emit('threat:detected', threat);

        // Auto-respond if enabled
        if (this.#config.autoRespond) {
            this.#respondToThreat(threat);
        }

        return threat;
    }

    /**
     * Quarantine a component — isolate it from the system.
     */
    quarantine(componentId, reason) {
        const record = {
            id: randomUUID(),
            componentId,
            reason,
            quarantinedAt: Date.now(),
            expiresAt: Date.now() + this.#config.quarantineDuration,
            status: 'active',
        };

        this.#quarantine.set(componentId, record);
        this.#stats.quarantinesActive++;
        this.emit('quarantine:activated', record);
        return record;
    }

    /**
     * Release a component from quarantine.
     */
    release(componentId) {
        const record = this.#quarantine.get(componentId);
        if (record) {
            record.status = 'released';
            record.releasedAt = Date.now();
            this.#quarantine.delete(componentId);
            this.#stats.quarantinesActive--;
            this.emit('quarantine:released', record);
            return true;
        }
        return false;
    }

    /**
     * Check if a component is quarantined.
     */
    isQuarantined(componentId) {
        const record = this.#quarantine.get(componentId);
        if (!record) return false;
        if (record.expiresAt < Date.now()) {
            this.release(componentId);
            return false;
        }
        return true;
    }

    /**
     * Register an antibody — an automatic response to a threat type.
     */
    registerAntibody(threatType, response) {
        this.#antibodies.set(threatType, {
            threatType,
            response,
            registeredAt: Date.now(),
            activations: 0,
        });
        this.#stats.antibodiesCreated++;
    }

    /**
     * Get active threats.
     */
    getActiveThreats() {
        return this.#threats.filter(t => t.status === 'active');
    }

    /**
     * Get quarantined components.
     */
    getQuarantined() {
        return [...this.#quarantine.values()].filter(q => q.status === 'active');
    }

    /**
     * Get immune system health overview.
     */
    getHealthOverview() {
        const indicators = Object.fromEntries(this.#healthIndicators);
        const activeThreats = this.getActiveThreats();
        const overallHealth = this.#computeOverallHealth();

        return {
            overallHealth,
            status: overallHealth > 0.7 ? 'healthy' : overallHealth > 0.4 ? 'compromised' : 'critical',
            indicators,
            activeThreats: activeThreats.length,
            quarantined: this.#quarantine.size,
            antibodies: this.#antibodies.size,
        };
    }

    /**
     * Trigger system recovery.
     */
    triggerRecovery(reason) {
        this.#stats.systemRecoveries++;

        // Resolve all active threats
        for (const threat of this.#threats) {
            if (threat.status === 'active') {
                threat.status = 'resolved';
                threat.resolvedAt = Date.now();
            }
        }

        // Release all quarantines
        for (const [componentId] of this.#quarantine) {
            this.release(componentId);
        }

        const recovery = {
            id: randomUUID(),
            reason,
            recoveredAt: Date.now(),
            threatsResolved: this.#threats.filter(t => t.status === 'resolved').length,
        };

        this.emit('system:recovered', recovery);
        return recovery;
    }

    getStats() {
        return { ...this.#stats };
    }

    // --- Internal ---

    #detectThreat(indicator, value) {
        const severity = 1 - value;
        this.detectThreat(indicator, severity, { indicator, value });
    }

    #respondToThreat(threat) {
        const antibody = this.#antibodies.get(threat.type);
        if (antibody) {
            antibody.activations++;
            const response = antibody.response(threat);

            const record = {
                id: randomUUID(),
                threatId: threat.id,
                type: response.type,
                action: response.action,
                triggeredAt: Date.now(),
            };

            this.#responses.push(record);
            threat.responses.push(record.id);
            this.#stats.responsesTriggered++;

            this.emit('response:triggered', record);

            if (this.#responses.length > 500) {
                this.#responses = this.#responses.slice(-500);
            }
        }
    }

    #registerDefaultAntibodies() {
        this.registerAntibody('runaway-optimization', (threat) => {
            return {
                type: 'throttle',
                action: 'Reduce optimization rate by 50%',
                parameters: { throttleFactor: 0.5 },
            };
        });

        this.registerAntibody('execution-chaos', (threat) => {
            return {
                type: 'stabilize',
                action: 'Pause new executions, drain queue',
                parameters: { pauseNew: true, drainQueue: true },
            };
        });

        this.registerAntibody('recursive-instability', (threat) => {
            return {
                type: 'circuit-break',
                action: 'Break recursive cycle, reset state',
                parameters: { breakCycle: true, resetDepth: 0 },
            };
        });

        this.registerAntibody('orchestration-collapse', (threat) => {
            return {
                type: 'emergency-restructure',
                action: 'Restart orchestration with minimal config',
                parameters: { minimalMode: true, rebuildOrchestration: true },
            };
        });

        this.registerAntibody('memory-exhaustion', (threat) => {
            return {
                type: 'gc-force',
                action: 'Force garbage collection and memory trim',
                parameters: { forceGC: true, trimCaches: true },
            };
        });
    }

    #computeOverallHealth() {
        if (this.#healthIndicators.size === 0) return 1.0;
        let sum = 0;
        for (const [, indicator] of this.#healthIndicators) {
            sum += indicator.value;
        }
        return sum / this.#healthIndicators.size;
    }
}
