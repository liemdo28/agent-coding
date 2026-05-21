/**
 * IntegrityRuntime.js — Self-Maintaining Organizational Integrity System
 *
 * Continuously monitors and preserves architectural integrity:
 * - Detects orphaned references (deleted files still referenced)
 * - Tracks architectural drift over time
 * - Validates dependency topology
 * - Emits integrity events to the event bus
 * - Integrates with StrategicCore for recommendations
 *
 * This is the immune system for organizational coherence.
 */

import { EventEmitter } from 'events';
import { ReferenceIntegrityEngine } from './ReferenceIntegrityEngine.js';
import { ArchitecturalDriftDetector } from './ArchitecturalDriftDetector.js';

export class IntegrityRuntime extends EventEmitter {
    #root;
    #referenceEngine;
    #driftDetector;
    #interval = null;
    #checkIntervalMs;
    #lastIntegrityReport = null;
    #lastDriftReport = null;
    #bootTime = 0;
    #totalScans = 0;
    #startBaseline = false;

    constructor(root, options = {}) {
        super();
        this.#root = root;
        this.#checkIntervalMs = options.checkIntervalMs || 300000; // 5 min default
        this.#startBaseline = options.autoBaseline !== false;

        this.#referenceEngine = new ReferenceIntegrityEngine(root);
        this.#driftDetector = new ArchitecturalDriftDetector(root);
    }

    /**
     * Boot the integrity runtime.
     */
    async boot() {
        this.#bootTime = Date.now();

        // Capture baseline on first boot if requested
        if (this.#startBaseline) {
            this.#driftDetector.captureBaseline();
            this.emit('baseline', { timestamp: this.#bootTime });
        }

        // Run initial scan
        await this.#runScan();

        // Start periodic scanning
        this.#interval = setInterval(() => this.#runScan(), this.#checkIntervalMs);
        if (this.#interval.unref) this.#interval.unref();

        this.emit('booted', {
            uptime: 0,
            lastReport: this.#lastIntegrityReport,
            baselineActive: this.#startBaseline,
        });

        return this;
    }

    /**
     * Run a full integrity scan.
     */
    async #runScan() {
        this.#totalScans++;

        // Run both scans in parallel
        const [refReport, driftResult] = await Promise.all([
            this.#referenceEngine.scan(),
            this.#driftDetector.detectDrift(),
        ]);

        this.#lastIntegrityReport = refReport;
        this.#lastDriftReport = driftResult;

        // Emit high-severity issues
        for (const issue of refReport.issues) {
            if (issue.severity === 'critical' || issue.severity === 'high') {
                this.emit('integrity:issue', issue);
            }
        }

        // Emit drift events if significant
        if (driftResult.hasBaseline && driftResult.entropy > 10) {
            this.emit('architectural:drift', {
                entropy: driftResult.entropy,
                summary: driftResult.summary,
                recommendations: driftResult.recommendations,
            });
        }

        // Overall health event
        this.emit('integrity:heartbeat', this.getHealth());

        return { integrity: refReport, drift: driftResult };
    }

    /**
     * Force a manual scan.
     */
    async scan() {
        return this.#runScan();
    }

    /**
     * Capture a new baseline (e.g., after major refactor).
     */
    captureBaseline() {
        const baseline = this.#driftDetector.captureBaseline();
        this.emit('baseline', { timestamp: Date.now(), modules: baseline?.modules?.length });
        return baseline;
    }

    /**
     * Get full integrity health report.
     */
    getHealth() {
        const integrityHealthy = this.#referenceEngine?.isHealthy() ?? true;
        const driftEntropy = this.#lastDriftReport?.entropy ?? 0;

        let state = 'healthy';
        if (!integrityHealthy) state = 'degraded';
        if (driftEntropy > 50) state = 'drifting';
        if (driftEntropy > 75) state = 'critical';

        return {
            state,
            uptime: Date.now() - this.#bootTime,
            totalScans: this.#totalScans,
            integrity: {
                score: this.#lastIntegrityReport?.score ?? 100,
                grade: this.#lastIntegrityReport?.grade ?? 'N/A',
                totalIssues: this.#lastIntegrityReport?.totalIssues ?? 0,
                healthy: integrityHealthy,
                bySeverity: this.#lastIntegrityReport?.bySeverity ?? {},
            },
            drift: {
                entropy: driftEntropy,
                hasBaseline: this.#lastDriftReport?.hasBaseline ?? false,
                summary: this.#lastDriftReport?.summary ?? 'N/A',
                recommendations: this.#lastDriftReport?.recommendations ?? [],
            },
        };
    }

    /**
     * Get specific issues by category or severity.
     */
    getIssues(filter = {}) {
        if (!this.#lastIntegrityReport) return [];
        return this.#lastIntegrityReport.issues.filter(issue => {
            if (filter.category && issue.category !== filter.category) return false;
            if (filter.severity && issue.severity !== filter.severity) return false;
            if (filter.type && issue.type !== filter.type) return false;
            return true;
        });
    }

    /**
     * Get recommendations for fixing issues.
     */
    getRecommendations() {
        const recs = [];

        // From integrity issues
        for (const issue of this.getIssues({ severity: 'high' })) {
            recs.push({
                priority: 'high',
                category: issue.category,
                target: issue.file || issue.testFile || issue.script || issue.indexFile || issue.name,
                suggestion: issue.suggestion,
                type: issue.type,
            });
        }

        // From drift recommendations
        if (this.#lastDriftReport?.recommendations) {
            for (const rec of this.#lastDriftReport.recommendations) {
                recs.push({
                    priority: rec.priority,
                    category: 'architectural_drift',
                    target: rec.target,
                    suggestion: rec.reason,
                    type: rec.type,
                    action: rec.action,
                });
            }
        }

        // Sort by priority
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        recs.sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));

        return recs;
    }

    /**
     * Stop the integrity runtime.
     */
    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
        this.emit('stopped');
    }
}
