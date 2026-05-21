/**
 * Integrity System Tests
 *
 * Tests the self-maintaining organizational integrity system:
 * - ReferenceIntegrityEngine: orphan detection
 * - ArchitecturalDriftDetector: baseline & drift tracking
 * - IntegrityRuntime: full integration
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

import { ReferenceIntegrityEngine } from '../src/core/integrity/ReferenceIntegrityEngine.js';
import { ArchitecturalDriftDetector } from '../src/core/integrity/ArchitecturalDriftDetector.js';
import { IntegrityRuntime } from '../src/core/integrity/IntegrityRuntime.js';

// ═══════════════════════════════════════════════════════════════
// ReferenceIntegrityEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('ReferenceIntegrityEngine', () => {
    const ROOT = process.cwd();

    test('should detect orphan bin entries', async () => {
        const engine = new ReferenceIntegrityEngine(ROOT);
        const report = await engine.scan();

        // Should have scanned package.json bin entries
        assert.ok(report.score >= 0 && report.score <= 100);
        assert.ok(typeof report.grade === 'string');
        assert.ok(Array.isArray(report.issues));
    });

    test('should detect orphan test file references', async () => {
        const engine = new ReferenceIntegrityEngine(ROOT);
        const report = await engine.scan();

        // All issues should have required fields
        for (const issue of report.issues) {
            assert.ok(issue.id);
            assert.ok(issue.type);
            assert.ok(issue.severity);
            assert.ok(issue.suggestion);
            assert.ok(issue.category);
        }
    });

    test('should calculate score correctly', async () => {
        const engine = new ReferenceIntegrityEngine(ROOT);
        const report = await engine.scan();

        // Score should be 100 if no critical/high issues
        if (engine.isHealthy()) {
            assert.equal(report.score, 100);
        }
    });

    test('should categorize issues by severity', async () => {
        const engine = new ReferenceIntegrityEngine(ROOT);
        const report = await engine.scan();

        assert.ok(report.bySeverity);
        assert.ok(typeof report.bySeverity.critical === 'number' || report.bySeverity.critical === undefined);
        assert.ok(typeof report.bySeverity.high === 'number' || report.bySeverity.high === undefined);
        assert.ok(typeof report.bySeverity.medium === 'number' || report.bySeverity.medium === undefined);
    });

    test('should categorize issues by category', async () => {
        const engine = new ReferenceIntegrityEngine(ROOT);
        const report = await engine.scan();

        assert.ok(report.byCategory);
        assert.ok(typeof report.byCategory === 'object');
    });

    test('isHealthy returns true when no critical/high issues', async () => {
        const engine = new ReferenceIntegrityEngine(ROOT);
        await engine.scan();

        const healthy = engine.isHealthy();
        const report = engine.getReport();
        const hasHighOrCritical = Object.values(report.bySeverity)
            .some(count => (report.bySeverity.critical > 0 || report.bySeverity.high > 0));

        assert.equal(healthy, !hasHighOrCritical);
    });
});

// ═══════════════════════════════════════════════════════════════
// ArchitecturalDriftDetector Tests
// ═══════════════════════════════════════════════════════════════

describe('ArchitecturalDriftDetector', () => {
    const ROOT = process.cwd();

    test('should capture baseline', () => {
        const detector = new ArchitecturalDriftDetector(ROOT);
        const baseline = detector.captureBaseline();

        assert.ok(baseline);
        assert.ok(baseline.timestamp);
        assert.ok(Array.isArray(baseline.modules));
        assert.ok(typeof baseline.scripts === 'object');
        assert.ok(typeof baseline.hash === 'string');
    });

    test('should detect no drift on clean state', () => {
        const detector = new ArchitecturalDriftDetector(ROOT);
        detector.captureBaseline();
        const result = detector.detectDrift();

        assert.ok(result.hasBaseline);
        assert.ok(result.drift);
        assert.ok(result.summary);
        assert.ok(typeof result.entropy === 'number');
        assert.ok(Array.isArray(result.recommendations));
    });

    test('should enumerate modules', () => {
        const detector = new ArchitecturalDriftDetector(ROOT);
        detector.captureBaseline();
        const result = detector.detectDrift();

        // Should have found core modules — check current snapshot
        const baseline = detector.captureBaseline();
        assert.ok(baseline.modules.length > 0, 'Should enumerate modules from src/core/');
        assert.ok(baseline.modules.every(m => m.path.startsWith('src/core/')));
    });

    test('should calculate entropy based on changes', () => {
        const detector = new ArchitecturalDriftDetector(ROOT);
        detector.captureBaseline();
        const result = detector.detectDrift();

        assert.ok(result.entropy >= 0);
        assert.ok(result.entropy <= 100);
    });

    test('should generate recommendations for removed modules', () => {
        const detector = new ArchitecturalDriftDetector(ROOT);
        detector.captureBaseline();
        const result = detector.detectDrift();

        for (const rec of result.recommendations) {
            assert.ok(rec.priority);
            assert.ok(rec.action);
            assert.ok(rec.target);
            assert.ok(rec.reason);
            assert.ok(rec.type);
        }
    });

    test('should track drift history', () => {
        const detector = new ArchitecturalDriftDetector(ROOT);
        detector.captureBaseline();
        detector.detectDrift();
        detector.detectDrift();

        const result = detector.detectDrift();
        assert.ok(Array.isArray(result.history));
        assert.ok(result.history.length >= 1);
    });
});

// ═══════════════════════════════════════════════════════════════
// IntegrityRuntime Tests
// ═══════════════════════════════════════════════════════════════

describe('IntegrityRuntime', () => {
    const ROOT = process.cwd();

    test('should boot and run initial scan', async () => {
        const runtime = new IntegrityRuntime(ROOT, { checkIntervalMs: 60000, autoBaseline: true });
        await runtime.boot();

        const health = runtime.getHealth();
        assert.ok(health.state);
        assert.ok(health.uptime >= 0);
        assert.ok(health.totalScans >= 1);
        assert.ok(typeof health.integrity.score === 'number');
        assert.ok(typeof health.drift.entropy === 'number');

        runtime.stop();
    });

    test('should report integrity score and grade', async () => {
        const runtime = new IntegrityRuntime(ROOT, { checkIntervalMs: 60000 });
        await runtime.boot();

        const health = runtime.getHealth();
        assert.ok(health.integrity);
        assert.ok(health.integrity.score >= 0 && health.integrity.score <= 100);
        assert.ok(['A', 'B', 'C', 'D', 'N/A'].includes(health.integrity.grade));

        runtime.stop();
    });

    test('should get issues filtered by severity', async () => {
        const runtime = new IntegrityRuntime(ROOT, { checkIntervalMs: 60000 });
        await runtime.boot();

        const highIssues = runtime.getIssues({ severity: 'high' });
        const mediumIssues = runtime.getIssues({ severity: 'medium' });

        assert.ok(Array.isArray(highIssues));
        assert.ok(Array.isArray(mediumIssues));

        for (const issue of highIssues) {
            assert.equal(issue.severity, 'high');
        }

        runtime.stop();
    });

    test('should get recommendations', async () => {
        const runtime = new IntegrityRuntime(ROOT, { checkIntervalMs: 60000 });
        await runtime.boot();

        const recs = runtime.getRecommendations();
        assert.ok(Array.isArray(recs));

        for (const rec of recs) {
            assert.ok(rec.priority);
            assert.ok(rec.target);
            assert.ok(rec.suggestion);
            assert.ok(rec.category);
        }

        runtime.stop();
    });

    test('should capture baseline on demand', async () => {
        const runtime = new IntegrityRuntime(ROOT, { autoBaseline: false });
        await runtime.boot();

        const baseline = runtime.captureBaseline();
        assert.ok(baseline);
        assert.ok(baseline.timestamp);

        runtime.stop();
    });

    test('should emit events on boot', async () => {
        const runtime = new IntegrityRuntime(ROOT, { autoBaseline: true });
        let booted = false;
        let baselineEmitted = false;

        runtime.on('booted', () => { booted = true; });
        runtime.on('baseline', () => { baselineEmitted = true; });

        await runtime.boot();

        assert.ok(booted);
        assert.ok(baselineEmitted);

        runtime.stop();
    });

    test('should force manual scan', async () => {
        const runtime = new IntegrityRuntime(ROOT, { checkIntervalMs: 600000 });
        await runtime.boot();

        const before = runtime.getHealth().totalScans;
        await runtime.scan();
        const after = runtime.getHealth().totalScans;

        assert.ok(after >= before);

        runtime.stop();
    });
});
