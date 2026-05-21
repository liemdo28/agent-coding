/**
 * ExecutionLawEngine.js — Immutable Operational Laws
 *
 * Creates and enforces immutable operational laws:
 * - No unsafe overwrite
 * - No patch without QA
 * - No scaling without validation
 *
 * Laws cannot be modified or removed once enacted — they are constitutional.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ExecutionLawEngine extends EventEmitter {
    #laws = new Map();
    #violations = [];
    #stats = {
        lawsEnacted: 0,
        checksPerformed: 0,
        violationsDetected: 0,
        actionsBlocked: 0,
    };

    constructor(config = {}) {
        super();
        this.#registerConstitutionalLaws();
    }

    /**
     * Enact a new immutable law.
     * Once enacted, a law cannot be removed or modified.
     */
    enactLaw(name, law) {
        if (this.#laws.has(name)) {
            return { enacted: false, reason: 'Law already exists and is immutable' };
        }

        const record = {
            id: randomUUID(),
            name,
            description: law.description,
            check: law.check,
            severity: law.severity || 'block',
            enactedAt: Date.now(),
            immutable: true,
        };

        this.#laws.set(name, record);
        this.#stats.lawsEnacted++;
        this.emit('law:enacted', { name, description: law.description });
        return { enacted: true, id: record.id };
    }

    /**
     * Check an action against all laws.
     * @returns {object} { lawful, violations[] }
     */
    enforce(action) {
        this.#stats.checksPerformed++;
        const violations = [];

        for (const [name, law] of this.#laws) {
            const result = law.check(action);
            if (!result.lawful) {
                violations.push({
                    law: name,
                    reason: result.reason,
                    severity: law.severity,
                });
            }
        }

        if (violations.length > 0) {
            this.#stats.violationsDetected++;
            this.#stats.actionsBlocked++;

            const record = {
                id: randomUUID(),
                action: action.type,
                violations,
                timestamp: Date.now(),
            };
            this.#violations.push(record);

            if (this.#violations.length > 500) {
                this.#violations = this.#violations.slice(-500);
            }

            this.emit('law:violated', record);
            return { lawful: false, violations };
        }

        return { lawful: true, violations: [] };
    }

    /**
     * Get all enacted laws.
     */
    getLaws() {
        return [...this.#laws.entries()].map(([name, law]) => ({
            name,
            description: law.description,
            severity: law.severity,
            enactedAt: law.enactedAt,
        }));
    }

    /**
     * Get violation history.
     */
    getViolations(limit = 50) {
        return this.#violations.slice(-limit);
    }

    getStats() {
        return { ...this.#stats, totalLaws: this.#laws.size };
    }

    // --- Constitutional Laws ---

    #registerConstitutionalLaws() {
        this.enactLaw('no-unsafe-overwrite', {
            description: 'No file overwrite without backup or version control',
            check: (action) => {
                if (action.type === 'file-overwrite' && !action.parameters?.hasBackup && !action.parameters?.versionControlled) {
                    return { lawful: false, reason: 'Unsafe overwrite: no backup or version control' };
                }
                return { lawful: true };
            },
            severity: 'block',
        });

        this.enactLaw('no-patch-without-qa', {
            description: 'No patch deployment without QA validation',
            check: (action) => {
                if (action.type === 'patch-deploy' && !action.parameters?.qaValidated) {
                    return { lawful: false, reason: 'Patch deployment without QA validation' };
                }
                return { lawful: true };
            },
            severity: 'block',
        });

        this.enactLaw('no-scaling-without-validation', {
            description: 'No worker/infra scaling without capacity validation',
            check: (action) => {
                if (action.type === 'scale-up' && !action.parameters?.capacityValidated) {
                    return { lawful: false, reason: 'Scaling without capacity validation' };
                }
                return { lawful: true };
            },
            severity: 'block',
        });

        this.enactLaw('no-production-without-rollback-plan', {
            description: 'No production change without rollback plan',
            check: (action) => {
                if (action.type === 'production-change' && !action.parameters?.rollbackPlan) {
                    return { lawful: false, reason: 'Production change without rollback plan' };
                }
                return { lawful: true };
            },
            severity: 'block',
        });

        this.enactLaw('no-data-delete-without-confirmation', {
            description: 'No data deletion without explicit confirmation',
            check: (action) => {
                if (action.type === 'data-delete' && !action.parameters?.confirmed) {
                    return { lawful: false, reason: 'Data deletion without confirmation' };
                }
                return { lawful: true };
            },
            severity: 'block',
        });

        this.enactLaw('no-security-downgrade', {
            description: 'No security policy downgrade without audit',
            check: (action) => {
                if (action.type === 'security-change' && action.parameters?.direction === 'downgrade' && !action.parameters?.audited) {
                    return { lawful: false, reason: 'Security downgrade without audit' };
                }
                return { lawful: true };
            },
            severity: 'block',
        });
    }
}
