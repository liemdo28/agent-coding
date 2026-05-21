/**
 * Civilization Core Tests — Self-Governing Engineering Civilization
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    GovernanceEngine,
    StrategicContinuityEngine,
    StabilityEngine,
    AutonomousPolicyEngine,
    ExecutionLawEngine,
    HumanAuthorityLayer,
    UnifiedCivilizationMemory,
    HorizonPlanningEngine,
    MetaReasoningEngine,
    ImmuneSystemEngine,
} from '../src/core/civilization/index.js';

// ─── GovernanceEngine ───────────────────────────────────────────────────────

describe('GovernanceEngine', () => {
    test('should instantiate with default policies', () => {
        const engine = new GovernanceEngine();
        const state = engine.getState();
        assert.ok(state.policies.length > 0);
        assert.ok(state.policies.includes('worker-scale-limit'));
        assert.ok(state.policies.includes('human-override-required'));
    });

    test('should allow normal actions', () => {
        const engine = new GovernanceEngine();
        const result = engine.govern({ type: 'task-execute', source: 'ai' });
        assert.equal(result.allowed, true);
    });

    test('should block actions requiring human override', () => {
        const engine = new GovernanceEngine();
        const result = engine.govern({ type: 'schema_migration', source: 'ai' });
        assert.equal(result.allowed, false);
        assert.equal(result.escalation, true);
    });

    test('should block worker scale exceeding limit', () => {
        const engine = new GovernanceEngine();
        const result = engine.govern({ type: 'worker-scale', parameters: { count: 1000 } });
        assert.equal(result.allowed, false);
    });

    test('should enforce freeze override', () => {
        const engine = new GovernanceEngine();
        engine.pushOverride('freeze');
        const result = engine.govern({ type: 'task-execute', source: 'ai' });
        assert.equal(result.allowed, false);
        assert.ok(result.reason.includes('freeze'));
    });

    test('should pop override and resume', () => {
        const engine = new GovernanceEngine();
        engine.pushOverride('freeze');
        engine.popOverride();
        const result = engine.govern({ type: 'task-execute', source: 'ai' });
        assert.equal(result.allowed, true);
    });

    test('should register and remove mutable policies', () => {
        const engine = new GovernanceEngine();
        engine.registerPolicy('test-policy', { evaluate: () => ({ allowed: true }), mutable: true });
        assert.ok(engine.getState().policies.includes('test-policy'));
        engine.removePolicy('test-policy');
        assert.ok(!engine.getState().policies.includes('test-policy'));
    });

    test('should not remove immutable policies', () => {
        const engine = new GovernanceEngine();
        const removed = engine.removePolicy('worker-scale-limit');
        assert.equal(removed, false);
    });

    test('should create sandboxes', () => {
        const engine = new GovernanceEngine();
        const sandbox = engine.createSandbox('test-sandbox', { allowedTypes: ['read'] });
        assert.equal(sandbox.id, 'test-sandbox');
    });

    test('should authorize rollbacks', () => {
        const engine = new GovernanceEngine();
        const auth = engine.authorizeRollback('service-a', 'critical bug');
        assert.equal(auth.target, 'service-a');
        assert.ok(auth.expiresAt > Date.now());
    });

    test('should track stats', () => {
        const engine = new GovernanceEngine();
        engine.govern({ type: 'task-execute' });
        engine.govern({ type: 'schema_migration' });
        const stats = engine.getStats();
        assert.equal(stats.actionsGoverned, 2);
        assert.ok(stats.policiesEnforced > 0);
    });
});

// ─── StrategicContinuityEngine ──────────────────────────────────────────────

describe('StrategicContinuityEngine', () => {
    test('should initialize with default roadmap categories', () => {
        const engine = new StrategicContinuityEngine();
        const roadmaps = engine.getAllRoadmaps();
        assert.ok('architecture' in roadmaps);
        assert.ok('infrastructure' in roadmaps);
        assert.ok('technical-debt' in roadmaps);
    });

    test('should add roadmap entries', () => {
        const engine = new StrategicContinuityEngine();
        engine.updateRoadmap('architecture', { title: 'Migrate to microservices', priority: 'high' });
        const roadmap = engine.getRoadmap('architecture');
        assert.equal(roadmap.length, 1);
        assert.equal(roadmap[0].title, 'Migrate to microservices');
    });

    test('should update existing roadmap entries', () => {
        const engine = new StrategicContinuityEngine();
        engine.updateRoadmap('architecture', { id: 'test-1', title: 'Original' });
        engine.updateRoadmap('architecture', { id: 'test-1', title: 'Updated' });
        const roadmap = engine.getRoadmap('architecture');
        assert.equal(roadmap.length, 1);
        assert.equal(roadmap[0].title, 'Updated');
    });

    test('should record strategic decisions', () => {
        const engine = new StrategicContinuityEngine();
        const decision = engine.recordDecision({
            title: 'Adopt event sourcing',
            rationale: 'Better audit trail',
            category: 'architecture',
        });
        assert.ok(decision.id);
        assert.equal(decision.status, 'active');
    });

    test('should track milestones', () => {
        const engine = new StrategicContinuityEngine();
        const milestone = engine.trackMilestone({
            title: 'Complete migration',
            category: 'infrastructure',
            targetDate: Date.now() + 86400000,
        });
        assert.equal(milestone.status, 'pending');
        assert.equal(milestone.progress, 0);
    });

    test('should update milestone progress', () => {
        const engine = new StrategicContinuityEngine();
        const milestone = engine.trackMilestone({ title: 'Test', category: 'architecture' });
        engine.updateMilestone(milestone.id, { progress: 100 });
        const summary = engine.getSummary();
        assert.equal(summary.milestones.completed, 1);
    });

    test('should take snapshots', () => {
        const engine = new StrategicContinuityEngine();
        engine.updateRoadmap('architecture', { title: 'Test entry' });
        const snapshot = engine.takeSnapshot();
        assert.equal(snapshot.roadmaps.architecture.length, 1);
    });
});

// ─── StabilityEngine ────────────────────────────────────────────────────────

describe('StabilityEngine', () => {
    test('should start with perfect stability', () => {
        const engine = new StabilityEngine();
        assert.equal(engine.getScore(), 1.0);
        assert.equal(engine.getStatus(), 'healthy');
    });

    test('should compute score from reported metrics', () => {
        const engine = new StabilityEngine();
        engine.reportMetric('rollback-pressure', 0.2);
        engine.reportMetric('queue-pressure', 0.3);
        const score = engine.computeScore();
        assert.ok(score < 1.0);
    });

    test('should detect critical threshold', () => {
        const engine = new StabilityEngine();
        let criticalEmitted = false;
        engine.on('stability:critical', () => { criticalEmitted = true; });

        for (const dim of ['rollback-pressure', 'queue-pressure', 'worker-load', 'infra-stability', 'architecture-risk', 'governance-health', 'memory-pressure']) {
            engine.reportMetric(dim, 0.1);
        }
        engine.computeScore();
        assert.equal(engine.getStatus(), 'critical');
        assert.ok(criticalEmitted);
    });

    test('should track history', () => {
        const engine = new StabilityEngine();
        engine.computeScore();
        engine.computeScore();
        const history = engine.getHistory();
        assert.equal(history.length, 2);
    });

    test('should generate stability report', () => {
        const engine = new StabilityEngine();
        engine.reportMetric('queue-pressure', 0.5);
        engine.computeScore();
        const report = engine.getReport();
        assert.ok('score' in report);
        assert.ok('status' in report);
        assert.ok('dimensions' in report);
        assert.ok('trend' in report);
    });

    test('should start and stop monitoring', () => {
        const engine = new StabilityEngine();
        engine.start();
        engine.stop();
        assert.ok(engine.getStats().checksPerformed >= 0);
    });
});

// ─── AutonomousPolicyEngine ─────────────────────────────────────────────────

describe('AutonomousPolicyEngine', () => {
    test('should generate policies from triggers', () => {
        const engine = new AutonomousPolicyEngine();
        engine.react('rollback-storm', { rollbackRate: 0.8, currentConcurrency: 10 });
        const policies = engine.getActivePolicies();
        assert.ok(policies.length > 0);
    });

    test('should evaluate actions against active policies', () => {
        const engine = new AutonomousPolicyEngine();
        engine.generatePolicy('test', { throttle: true });
        const result = engine.evaluate({ type: 'task-submit' });
        assert.equal(result.allowed, false);
    });

    test('should revoke policies', () => {
        const engine = new AutonomousPolicyEngine();
        const policy = engine.generatePolicy('test', { concurrencyLimit: 5 });
        engine.revokePolicy(policy.id);
        assert.equal(engine.getActivePolicies().length, 0);
    });

    test('should register custom triggers', () => {
        const engine = new AutonomousPolicyEngine();
        let triggered = false;
        engine.registerTrigger('custom-condition', () => { triggered = true; return []; });
        engine.react('custom-condition', {});
        assert.ok(triggered);
    });

    test('should expire policies after TTL', async () => {
        const engine = new AutonomousPolicyEngine({ policyTTL: 1 });
        engine.generatePolicy('test', { throttle: true });
        await new Promise(resolve => setTimeout(resolve, 10));
        const result = engine.evaluate({ type: 'task-submit' });
        assert.equal(result.allowed, true);
    });

    test('should track stats', () => {
        const engine = new AutonomousPolicyEngine();
        engine.react('rollback-storm', { rollbackRate: 0.8, currentConcurrency: 10 });
        const stats = engine.getStats();
        assert.equal(stats.triggersActivated, 1);
        assert.ok(stats.policiesGenerated > 0);
    });
});

// ─── ExecutionLawEngine ─────────────────────────────────────────────────────

describe('ExecutionLawEngine', () => {
    test('should have constitutional laws enacted', () => {
        const engine = new ExecutionLawEngine();
        const laws = engine.getLaws();
        assert.ok(laws.length >= 6);
        assert.ok(laws.find(l => l.name === 'no-unsafe-overwrite'));
        assert.ok(laws.find(l => l.name === 'no-patch-without-qa'));
    });

    test('should block unsafe overwrites', () => {
        const engine = new ExecutionLawEngine();
        const result = engine.enforce({ type: 'file-overwrite', parameters: {} });
        assert.equal(result.lawful, false);
        assert.equal(result.violations[0].law, 'no-unsafe-overwrite');
    });

    test('should allow safe overwrites', () => {
        const engine = new ExecutionLawEngine();
        const result = engine.enforce({ type: 'file-overwrite', parameters: { hasBackup: true } });
        assert.equal(result.lawful, true);
    });

    test('should block patches without QA', () => {
        const engine = new ExecutionLawEngine();
        const result = engine.enforce({ type: 'patch-deploy', parameters: {} });
        assert.equal(result.lawful, false);
    });

    test('should allow patches with QA', () => {
        const engine = new ExecutionLawEngine();
        const result = engine.enforce({ type: 'patch-deploy', parameters: { qaValidated: true } });
        assert.equal(result.lawful, true);
    });

    test('should not allow duplicate law enactment', () => {
        const engine = new ExecutionLawEngine();
        const result = engine.enactLaw('no-unsafe-overwrite', { description: 'dup', check: () => ({ lawful: true }) });
        assert.equal(result.enacted, false);
    });

    test('should allow enacting new laws', () => {
        const engine = new ExecutionLawEngine();
        const result = engine.enactLaw('custom-law', {
            description: 'Custom test law',
            check: (action) => {
                if (action.type === 'custom-blocked') return { lawful: false, reason: 'blocked' };
                return { lawful: true };
            },
        });
        assert.equal(result.enacted, true);
    });

    test('should track violations', () => {
        const engine = new ExecutionLawEngine();
        engine.enforce({ type: 'file-overwrite', parameters: {} });
        const violations = engine.getViolations();
        assert.equal(violations.length, 1);
    });
});

// ─── HumanAuthorityLayer ────────────────────────────────────────────────────

describe('HumanAuthorityLayer', () => {
    test('should start in normal mode', () => {
        const layer = new HumanAuthorityLayer();
        assert.equal(layer.getMode(), 'normal');
    });

    test('should allow actions in normal mode', () => {
        const layer = new HumanAuthorityLayer();
        const result = layer.checkAuthority({ type: 'task-execute' });
        assert.equal(result.allowed, true);
    });

    test('should block all actions after emergency stop', () => {
        const layer = new HumanAuthorityLayer();
        layer.emergencyStop('critical failure');
        assert.equal(layer.getMode(), 'stopped');
        const result = layer.checkAuthority({ type: 'task-execute' });
        assert.equal(result.allowed, false);
    });

    test('should resume from emergency stop', () => {
        const layer = new HumanAuthorityLayer();
        layer.emergencyStop('test');
        const resumeResult = layer.resume();
        assert.equal(resumeResult.resumed, true);
        assert.equal(layer.getMode(), 'normal');
    });

    test('should freeze execution', () => {
        const layer = new HumanAuthorityLayer();
        layer.freeze('maintenance window');
        assert.equal(layer.getMode(), 'frozen');
        const result = layer.checkAuthority({ type: 'task-execute' });
        assert.equal(result.allowed, false);
    });

    test('should allow read-only during freeze', () => {
        const layer = new HumanAuthorityLayer();
        layer.freeze('maintenance');
        const result = layer.checkAuthority({ type: 'read-only' });
        assert.equal(result.allowed, true);
    });

    test('should enter simulation mode', () => {
        const layer = new HumanAuthorityLayer();
        layer.simulationMode('testing');
        assert.equal(layer.getMode(), 'simulation');
        const result = layer.checkAuthority({ type: 'task-execute' });
        assert.equal(result.allowed, true);
        assert.equal(result.simulationOnly, true);
    });

    test('should track rollback overrides', () => {
        const layer = new HumanAuthorityLayer();
        const override = layer.rollbackOverride('service-a', 'false positive');
        assert.equal(override.type, 'rollback-override');
        assert.equal(layer.getActiveOverrides().length, 1);
    });

    test('should issue commands', () => {
        const layer = new HumanAuthorityLayer();
        layer.issueCommand('scale-down', { factor: 0.5 });
        const history = layer.getCommandHistory();
        assert.equal(history.length, 1);
        assert.equal(history[0].type, 'scale-down');
    });

    test('should track stats', () => {
        const layer = new HumanAuthorityLayer();
        layer.emergencyStop('test');
        layer.resume();
        const stats = layer.getStats();
        assert.equal(stats.emergencyStops, 1);
        assert.equal(stats.resumptions, 1);
    });
});

// ─── UnifiedCivilizationMemory ──────────────────────────────────────────────

describe('UnifiedCivilizationMemory', () => {
    test('should initialize with default stores', () => {
        const memory = new UnifiedCivilizationMemory();
        const summary = memory.getSummary();
        assert.ok('governance' in summary.stores);
        assert.ok('optimization' in summary.stores);
        assert.ok('architecture' in summary.stores);
    });

    test('should store and retrieve memories', () => {
        const memory = new UnifiedCivilizationMemory();
        memory.store('governance', { data: { event: 'policy-change' }, tags: ['policy'] });
        const results = memory.retrieve('governance');
        assert.equal(results.length, 1);
        assert.equal(results[0].data.event, 'policy-change');
    });

    test('should filter by tags', () => {
        const memory = new UnifiedCivilizationMemory();
        memory.store('governance', { data: { a: 1 }, tags: ['policy'] });
        memory.store('governance', { data: { b: 2 }, tags: ['escalation'] });
        const results = memory.retrieve('governance', { tags: ['policy'] });
        assert.equal(results.length, 1);
    });

    test('should search across stores', () => {
        const memory = new UnifiedCivilizationMemory();
        memory.store('governance', { data: { msg: 'hello world' }, tags: [] });
        memory.store('optimization', { data: { msg: 'hello again' }, tags: [] });
        const results = memory.search({ text: 'hello' });
        assert.equal(results.length, 2);
    });

    test('should manage epochs', () => {
        const memory = new UnifiedCivilizationMemory();
        const epoch = memory.startNewEpoch('evolution-v2', 'Second evolution phase');
        assert.equal(epoch.name, 'evolution-v2');
        const epochs = memory.getEpochs();
        assert.equal(epochs.length, 2); // genesis + new
    });

    test('should detect patterns', () => {
        const memory = new UnifiedCivilizationMemory();
        for (let i = 0; i < 10; i++) {
            memory.store('governance', { data: { i }, tags: ['recurring-issue'] });
        }
        const patterns = memory.detectPatterns('governance');
        assert.ok(patterns.length > 0);
        assert.equal(patterns[0].pattern, 'recurring-issue');
    });

    test('should maintain timeline', () => {
        const memory = new UnifiedCivilizationMemory();
        memory.store('governance', { data: { a: 1 } });
        memory.store('optimization', { data: { b: 2 } });
        const timeline = memory.getTimeline();
        assert.equal(timeline.length, 2);
    });
});

// ─── HorizonPlanningEngine ──────────────────────────────────────────────────

describe('HorizonPlanningEngine', () => {
    test('should create plans for valid horizons', () => {
        const engine = new HorizonPlanningEngine();
        const plan = engine.createPlan('1-week', {
            title: 'Fix critical bugs',
            objectives: ['Resolve P0 issues'],
        });
        assert.ok(plan);
        assert.equal(plan.horizon, '1-week');
        assert.equal(plan.type, 'tactical');
    });

    test('should reject plans for invalid horizons', () => {
        const engine = new HorizonPlanningEngine();
        const plan = engine.createPlan('invalid', { title: 'Test' });
        assert.equal(plan, null);
    });

    test('should generate projections', () => {
        const engine = new HorizonPlanningEngine();
        const projection = engine.project('queue-depth', [10, 12, 14, 16, 18], '1-month');
        assert.ok(projection);
        assert.equal(projection.trend, 'increasing');
        assert.ok(projection.projectedValue > 18);
    });

    test('should detect trends', () => {
        const engine = new HorizonPlanningEngine();
        const trend = engine.detectTrend('cpu-usage', [0.5, 0.55, 0.6, 0.65, 0.7, 0.75]);
        assert.ok(trend);
        assert.equal(trend.direction, 'up');
    });

    test('should detect flat trends', () => {
        const engine = new HorizonPlanningEngine();
        const trend = engine.detectTrend('memory', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
        assert.equal(trend.direction, 'flat');
    });

    test('should issue recommendations', () => {
        const engine = new HorizonPlanningEngine();
        const rec = engine.recommend({
            title: 'Scale infrastructure',
            description: 'Queue pressure trending up',
            urgency: 'high',
            horizon: '1-month',
        });
        assert.equal(rec.status, 'pending');
        assert.equal(engine.getRecommendations().length, 1);
    });

    test('should get plans by horizon', () => {
        const engine = new HorizonPlanningEngine();
        engine.createPlan('1-week', { title: 'Plan A' });
        engine.createPlan('1-month', { title: 'Plan B' });
        const weekPlans = engine.getPlans('1-week');
        assert.equal(weekPlans.length, 1);
    });
});

// ─── MetaReasoningEngine ────────────────────────────────────────────────────

describe('MetaReasoningEngine', () => {
    test('should log reasoning steps', () => {
        const engine = new MetaReasoningEngine();
        const record = engine.logReasoning({
            type: 'optimization',
            input: { metric: 'throughput' },
            output: 'scale-up',
            rationale: 'Throughput below threshold',
            confidence: 0.8,
        });
        assert.ok(record.id);
        assert.equal(record.confidence, 0.8);
    });

    test('should perform audits', () => {
        const engine = new MetaReasoningEngine();
        for (let i = 0; i < 5; i++) {
            engine.logReasoning({ type: 'decision', input: { i }, output: `result-${i}`, confidence: 0.7 });
        }
        const audit = engine.audit();
        assert.ok('score' in audit);
        assert.ok('status' in audit);
    });

    test('should detect failure loops', () => {
        const engine = new MetaReasoningEngine();
        let loopDetected = false;
        engine.on('failure-loop:detected', () => { loopDetected = true; });

        for (let i = 0; i < 4; i++) {
            engine.logReasoning({ type: 'fix', input: { bug: 'X' }, output: 'same-fix' });
        }
        assert.ok(loopDetected);
    });

    test('should detect contradictions', () => {
        const engine = new MetaReasoningEngine();
        engine.logReasoning({ type: 'decision', input: { x: 1 }, output: 'A' });
        const check = engine.checkConsistency({ type: 'decision', input: { x: 1 }, output: 'B' });
        assert.equal(check.consistent, false);
    });

    test('should report healthy when no issues', () => {
        const engine = new MetaReasoningEngine();
        engine.logReasoning({ type: 'a', input: { x: 1 }, output: '1', confidence: 0.9 });
        engine.logReasoning({ type: 'b', input: { x: 2 }, output: '2', confidence: 0.9 });
        const audit = engine.audit();
        assert.equal(audit.status, 'healthy');
    });

    test('should get health score', () => {
        const engine = new MetaReasoningEngine();
        const score = engine.getHealthScore();
        assert.equal(score, 1.0);
    });
});

// ─── ImmuneSystemEngine ─────────────────────────────────────────────────────

describe('ImmuneSystemEngine', () => {
    test('should detect threats', () => {
        const engine = new ImmuneSystemEngine();
        const threat = engine.detectThreat('runaway-optimization', 0.8, { source: 'test' });
        assert.equal(threat.type, 'runaway-optimization');
        assert.equal(threat.status, 'active');
    });

    test('should auto-respond to known threats', () => {
        const engine = new ImmuneSystemEngine();
        let responded = false;
        engine.on('response:triggered', () => { responded = true; });
        engine.detectThreat('execution-chaos', 0.9);
        assert.ok(responded);
    });

    test('should quarantine components', () => {
        const engine = new ImmuneSystemEngine();
        engine.quarantine('worker-pool-3', 'unstable behavior');
        assert.ok(engine.isQuarantined('worker-pool-3'));
    });

    test('should release from quarantine', () => {
        const engine = new ImmuneSystemEngine();
        engine.quarantine('worker-pool-3', 'test');
        engine.release('worker-pool-3');
        assert.equal(engine.isQuarantined('worker-pool-3'), false);
    });

    test('should report health indicators', () => {
        const engine = new ImmuneSystemEngine();
        engine.reportHealth('cpu', 0.9);
        engine.reportHealth('memory', 0.7);
        const overview = engine.getHealthOverview();
        assert.equal(overview.overallHealth, 0.8);
        assert.equal(overview.status, 'healthy');
    });

    test('should detect threats from low health', () => {
        const engine = new ImmuneSystemEngine();
        let threatDetected = false;
        engine.on('threat:detected', () => { threatDetected = true; });
        engine.reportHealth('cpu', 0.3);
        assert.ok(threatDetected);
    });

    test('should trigger system recovery', () => {
        const engine = new ImmuneSystemEngine();
        engine.detectThreat('test-threat', 0.5);
        engine.quarantine('comp-1', 'test');
        const recovery = engine.triggerRecovery('manual intervention');
        assert.ok(recovery.threatsResolved > 0);
        assert.equal(engine.getActiveThreats().length, 0);
    });

    test('should register custom antibodies', () => {
        const engine = new ImmuneSystemEngine();
        engine.registerAntibody('custom-threat', () => ({
            type: 'custom-response',
            action: 'Do something',
        }));
        const stats = engine.getStats();
        assert.ok(stats.antibodiesCreated > 5);
    });

    test('should provide health overview', () => {
        const engine = new ImmuneSystemEngine();
        const overview = engine.getHealthOverview();
        assert.ok('overallHealth' in overview);
        assert.ok('status' in overview);
        assert.ok(overview.antibodies > 0);
    });
});
