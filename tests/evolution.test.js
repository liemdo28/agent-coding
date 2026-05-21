/**
 * Evolution Fabric Tests — Autonomous Self-Improving Civilization
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    SelfOptimization,
    SimulationUniverse,
    CivilizationGovernance,
} from '../src/core/evolution/index.js';

describe('SelfOptimization', () => {
    test('should instantiate with default policies', () => {
        const opt = new SelfOptimization();
        assert.ok(opt);
        assert.equal(opt.getStats().activePolicies, 4);
    });

    test('should register custom policies', () => {
        const opt = new SelfOptimization();
        opt.registerPolicy('custom', {
            detect: () => false,
            optimize: () => ({ action: 'custom' }),
        });
        assert.equal(opt.getStats().activePolicies, 5);
    });

    test('should run optimization cycle', () => {
        const opt = new SelfOptimization();
        const applied = opt.runCycle();
        assert.ok(Array.isArray(applied));
        assert.equal(opt.getStats().checksRun, 1);
    });

    test('should detect and apply optimizations', () => {
        const opt = new SelfOptimization();
        let triggered = false;

        opt.registerPolicy('always-trigger', {
            detect: () => true,
            optimize: () => { triggered = true; return { action: 'test' }; },
            priority: 0,
        });

        opt.runCycle();
        assert.ok(triggered);
        assert.equal(opt.getStats().optimizationsApplied, 1);
    });

    test('should respect max concurrent optimizations', () => {
        const opt = new SelfOptimization({ maxConcurrentOptimizations: 1 });

        opt.registerPolicy('a', { detect: () => true, optimize: () => ({ a: true }), priority: 1 });
        opt.registerPolicy('b', { detect: () => true, optimize: () => ({ b: true }), priority: 2 });

        const applied = opt.runCycle();
        assert.equal(applied.length, 1);
    });

    test('should provide history', () => {
        const opt = new SelfOptimization();
        opt.registerPolicy('hist', { detect: () => true, optimize: () => ({ ok: true }) });
        opt.runCycle();

        const history = opt.getHistory();
        assert.ok(history.length >= 1);
    });
});

describe('SimulationUniverse', () => {
    test('should simulate scaling scenario', () => {
        const sim = new SimulationUniverse();
        const result = sim.simulate({
            type: 'scaling',
            parameters: { loadMultiplier: 5, currentWorkers: 4 },
        });

        assert.ok(result.outcomes.length > 0);
        assert.ok(result.recommendation);
        assert.ok(result.id);
    });

    test('should simulate outage scenario', () => {
        const sim = new SimulationUniverse();
        const result = sim.simulate({
            type: 'outage',
            parameters: { component: 'database' },
        });

        assert.ok(result.risks.length > 0);
        assert.ok(result.risks.some(r => r.metric === 'service-degradation'));
    });

    test('should simulate rollback storm', () => {
        const sim = new SimulationUniverse();
        const result = sim.simulate({
            type: 'rollback-storm',
            parameters: { failedDeploys: 5 },
        });

        assert.ok(result.risks.some(r => r.metric === 'sla-breach'));
        assert.ok(result.recommendation);
    });

    test('should simulate architecture change', () => {
        const sim = new SimulationUniverse();
        const result = sim.simulate({
            type: 'architecture-change',
            parameters: { changeType: 'service-extraction' },
        });

        assert.ok(result.outcomes.some(o => o.type === 'benefit'));
        assert.equal(result.recommendation.action, 'proceed');
    });

    test('should compare scenarios', () => {
        const sim = new SimulationUniverse();
        const comparison = sim.compareScenarios([
            { type: 'scaling', parameters: { loadMultiplier: 2 } },
            { type: 'scaling', parameters: { loadMultiplier: 10 } },
        ]);

        assert.ok(comparison.best);
        assert.ok(comparison.worst);
        assert.equal(comparison.results.length, 2);
    });

    test('should recommend abort for high-risk scenarios', () => {
        const sim = new SimulationUniverse();
        const result = sim.simulate({
            type: 'outage',
            parameters: { component: 'database' },
        });

        // Database outage has high risks
        assert.equal(result.recommendation.action, 'abort');
    });

    test('should track stats', () => {
        const sim = new SimulationUniverse();
        sim.simulate({ type: 'scaling', parameters: {} });
        sim.simulate({ type: 'outage', parameters: {} });

        const stats = sim.getStats();
        assert.equal(stats.simulationsRun, 2);
        assert.equal(stats.scenariosExplored, 2);
    });
});

describe('CivilizationGovernance', () => {
    test('should instantiate with default rules', () => {
        const gov = new CivilizationGovernance();
        assert.ok(gov);
        assert.equal(gov.getStats().rules, 5);
    });

    test('should allow normal actions', () => {
        const gov = new CivilizationGovernance();
        const result = gov.check({ type: 'build', target: 'my-app' });
        assert.equal(result.allowed, true);
    });

    test('should block actions requiring human approval', () => {
        const gov = new CivilizationGovernance();
        const result = gov.check({ type: 'production-deploy', target: 'my-app' });

        assert.equal(result.allowed, false);
        assert.ok(result.reason.includes('human approval'));
    });

    test('should enforce optimization rate limits', () => {
        const gov = new CivilizationGovernance({ maxOptimizationsPerHour: 2 });

        gov.check({ type: 'optimization' }); // 1
        gov.check({ type: 'optimization' }); // 2
        const result = gov.check({ type: 'optimization' }); // 3 — blocked

        assert.equal(result.allowed, false);
        assert.ok(result.reason.includes('rate limit'));
    });

    test('should enforce rollback storm prevention', () => {
        const gov = new CivilizationGovernance({ maxRollbacksPerHour: 2 });

        gov.check({ type: 'rollback' });
        gov.check({ type: 'rollback' });
        const result = gov.check({ type: 'rollback' });

        assert.equal(result.allowed, false);
        assert.ok(result.reason.includes('storm'));
    });

    test('should support emergency stop', () => {
        const gov = new CivilizationGovernance();
        gov.emergencyStop();

        const result = gov.check({ type: 'build' });
        assert.equal(result.allowed, false);
        assert.ok(result.reason.includes('Emergency'));

        gov.resume();
        const result2 = gov.check({ type: 'build' });
        assert.equal(result2.allowed, true);
    });

    test('should manage escalations', () => {
        const gov = new CivilizationGovernance();
        const esc = gov.requestApproval({ type: 'infra-change', target: 'prod' });

        assert.equal(esc.status, 'pending');
        assert.equal(gov.getPendingEscalations().length, 1);

        gov.approve(esc.id);
        assert.equal(gov.getPendingEscalations().length, 0);
    });

    test('should track violations', () => {
        const gov = new CivilizationGovernance();
        gov.check({ type: 'production-deploy' }); // blocked

        const violations = gov.getViolations();
        assert.ok(violations.length >= 1);
        assert.equal(gov.getStats().violationsDetected, 1);
    });
});
