/**
 * Reality Synthesis Fabric Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    UnifiedRealityEngine,
    CivilizationTrajectoryEngine,
    RealityPressureField,
    OperationalCoherenceEngine,
    FutureStateEngine,
    MissionAlignmentEngine,
    CivilizationEnergyEngine,
    MemoryCosmosEngine,
    SynthesisReasoningEngine,
    RealityImmuneSystem,
} from '../src/core/reality-synthesis/index.js';

describe('UnifiedRealityEngine', () => {
    test('should initialize with default layers', () => {
        const engine = new UnifiedRealityEngine();
        const layers = engine.getAllLayers();
        assert.ok('cognition' in layers);
        assert.ok('execution' in layers);
        assert.ok('governance' in layers);
    });

    test('should update layers', () => {
        const engine = new UnifiedRealityEngine();
        engine.updateLayer('cognition', { health: 0.9, pressure: 0.2 });
        const layer = engine.getLayer('cognition');
        assert.equal(layer.health, 0.9);
    });

    test('should synthesize reality', () => {
        const engine = new UnifiedRealityEngine();
        engine.updateLayer('cognition', { health: 0.9 });
        engine.updateLayer('execution', { health: 0.8 });
        const result = engine.synthesize();
        assert.ok(result.unifiedHealth > 0);
        assert.ok('synthesis' in result);
    });

    test('should detect health divergence conflicts', () => {
        const engine = new UnifiedRealityEngine();
        engine.updateLayer('cognition', { health: 0.9 });
        engine.updateLayer('execution', { health: 0.2 });
        const result = engine.synthesize();
        assert.ok(result.conflicts.length > 0);
    });

    test('should track synthesis history', () => {
        const engine = new UnifiedRealityEngine();
        engine.synthesize();
        engine.synthesize();
        assert.equal(engine.getHistory().length, 2);
    });
});

describe('CivilizationTrajectoryEngine', () => {
    test('should feed data points', () => {
        const engine = new CivilizationTrajectoryEngine();
        for (let i = 0; i < 10; i++) engine.feed('architecture-drift', 0.1 + i * 0.05);
        assert.equal(engine.getStats().trajectoryUpdates, 10);
    });

    test('should predict trajectory', () => {
        const engine = new CivilizationTrajectoryEngine();
        for (let i = 0; i < 10; i++) engine.feed('architecture-drift', 0.1 + i * 0.05);
        const prediction = engine.predict('architecture-drift', 30);
        assert.ok(prediction);
        assert.equal(prediction.trend, 'worsening');
        assert.ok(prediction.projectedValue > 0.5);
    });

    test('should return null for insufficient data', () => {
        const engine = new CivilizationTrajectoryEngine();
        engine.feed('architecture-drift', 0.5);
        assert.equal(engine.predict('architecture-drift'), null);
    });

    test('should warn on high projections', () => {
        const engine = new CivilizationTrajectoryEngine();
        let warned = false;
        engine.on('trajectory:warning', () => { warned = true; });
        for (let i = 0; i < 10; i++) engine.feed('architecture-drift', 0.5 + i * 0.05);
        engine.predict('architecture-drift', 90);
        assert.ok(warned);
    });

    test('should predict all dimensions', () => {
        const engine = new CivilizationTrajectoryEngine();
        for (let i = 0; i < 10; i++) engine.feed('architecture-drift', 0.3 + i * 0.02);
        const results = engine.predictAll();
        assert.ok('architecture-drift' in results);
    });
});

describe('RealityPressureField', () => {
    test('should apply pressure', () => {
        const field = new RealityPressureField();
        field.applyPressure('strategic', 0.7);
        assert.equal(field.getField('strategic'), 0.7);
    });

    test('should compute total pressure', () => {
        const field = new RealityPressureField();
        field.applyPressure('strategic', 0.6);
        field.applyPressure('execution', 0.4);
        const total = field.getTotalPressure();
        assert.ok(total > 0);
    });

    test('should detect cascade risks', () => {
        const field = new RealityPressureField();
        field.applyPressure('strategic', 0.9);
        field.applyPressure('execution', 0.8);
        const interactions = field.computeInteractions();
        assert.ok(interactions.length > 0);
        assert.equal(interactions[0].type, 'cascade-risk');
    });

    test('should get all fields', () => {
        const field = new RealityPressureField();
        field.applyPressure('governance', 0.5);
        const all = field.getAllFields();
        assert.equal(all.governance, 0.5);
    });

    test('should track history', () => {
        const field = new RealityPressureField();
        field.applyPressure('strategic', 0.3);
        field.applyPressure('strategic', 0.5);
        assert.equal(field.getHistory().length, 2);
    });
});

describe('OperationalCoherenceEngine', () => {
    test('should initialize with default pairs', () => {
        const engine = new OperationalCoherenceEngine();
        const result = engine.checkCoherence();
        assert.ok(result.coherence > 0);
        assert.ok(result.details.length > 0);
    });

    test('should report coherence', () => {
        const engine = new OperationalCoherenceEngine();
        engine.reportCoherence('governance', 'mission', 0.9);
        const result = engine.checkCoherence();
        assert.ok(result.coherence > 0);
    });

    test('should detect fragmentation', () => {
        const engine = new OperationalCoherenceEngine();
        let fragmented = false;
        engine.on('fragmentation:detected', () => { fragmented = true; });
        engine.reportCoherence('governance', 'mission', 0.1);
        engine.checkCoherence();
        assert.ok(fragmented);
    });

    test('should track stats', () => {
        const engine = new OperationalCoherenceEngine();
        engine.checkCoherence();
        assert.equal(engine.getStats().checksPerformed, 1);
    });
});

describe('FutureStateEngine', () => {
    test('should feed metrics', () => {
        const engine = new FutureStateEngine();
        engine.feedMetric('queue-depth', 0.3);
        engine.feedMetric('queue-depth', 0.4);
        assert.ok(engine.getStats().simulationsRun === 0);
    });

    test('should simulate future states', () => {
        const engine = new FutureStateEngine();
        for (let i = 0; i < 5; i++) engine.feedMetric('queue-depth', 0.3 + i * 0.1);
        const sim = engine.simulate();
        assert.ok(sim.id);
        assert.ok('30-day' in sim.results);
        assert.ok('90-day' in sim.results);
        assert.ok('1-year' in sim.results);
    });

    test('should generate warnings for high projections', () => {
        const engine = new FutureStateEngine();
        for (let i = 0; i < 5; i++) engine.feedMetric('queue-depth', 0.5 + i * 0.1);
        const sim = engine.simulate();
        const warnings = Object.values(sim.results).flatMap(r => r.warnings);
        assert.ok(warnings.length > 0);
    });

    test('should get latest simulation', () => {
        const engine = new FutureStateEngine();
        for (let i = 0; i < 5; i++) engine.feedMetric('queue-depth', 0.3);
        engine.simulate();
        assert.ok(engine.getLatest());
    });
});

describe('MissionAlignmentEngine', () => {
    test('should have default mission', () => {
        const engine = new MissionAlignmentEngine();
        assert.ok(engine.getMission().includes('autonomous'));
    });

    test('should report alignment', () => {
        const engine = new MissionAlignmentEngine();
        engine.reportAlignment('execution', 0.9);
        assert.equal(engine.getAlignment('execution'), 0.9);
    });

    test('should check overall alignment', () => {
        const engine = new MissionAlignmentEngine();
        engine.reportAlignment('execution', 0.8);
        engine.reportAlignment('governance', 0.9);
        const result = engine.checkAlignment();
        assert.ok(result.overall > 0);
        assert.ok(result.aligned);
    });

    test('should detect drift', () => {
        const engine = new MissionAlignmentEngine();
        let drifted = false;
        engine.on('drift:detected', () => { drifted = true; });
        engine.reportAlignment('execution', 0.1);
        assert.ok(drifted);
    });

    test('should record realignments', () => {
        const engine = new MissionAlignmentEngine();
        engine.recordRealignment('execution', 'Revised execution strategy');
        assert.equal(engine.getStats().realignments, 1);
    });
});

describe('CivilizationEnergyEngine', () => {
    test('should initialize with default energies', () => {
        const engine = new CivilizationEnergyEngine();
        assert.equal(engine.getEnergy('execution-vitality'), 0.5);
    });

    test('should report energy', () => {
        const engine = new CivilizationEnergyEngine();
        engine.reportEnergy('execution-vitality', 0.8);
        assert.equal(engine.getEnergy('execution-vitality'), 0.8);
    });

    test('should compute total energy', () => {
        const engine = new CivilizationEnergyEngine();
        engine.reportEnergy('execution-vitality', 0.9);
        engine.reportEnergy('innovation-velocity', 0.7);
        const total = engine.computeTotalEnergy();
        assert.ok(total > 0);
    });

    test('should detect low energy', () => {
        const engine = new CivilizationEnergyEngine();
        let lowDetected = false;
        engine.on('energy:low', () => { lowDetected = true; });
        engine.reportEnergy('execution-vitality', 0.1);
        assert.ok(lowDetected);
    });

    test('should compute energy balance', () => {
        const engine = new CivilizationEnergyEngine();
        engine.reportEnergy('execution-vitality', 0.8);
        engine.reportEnergy('chaos-energy', 0.2);
        const balance = engine.getEnergyBalance();
        assert.ok(balance.productive > balance.chaotic);
        assert.ok(balance.balance > 0);
    });
});

describe('MemoryCosmosEngine', () => {
    test('should ingest memories', () => {
        const engine = new MemoryCosmosEngine();
        const mem = engine.ingest('cognition', { data: { thought: 'test' }, tags: ['reasoning'] });
        assert.ok(mem.id);
    });

    test('should query across domains', () => {
        const engine = new MemoryCosmosEngine();
        engine.ingest('cognition', { data: { a: 1 }, tags: ['test'] });
        engine.ingest('execution', { data: { b: 2 }, tags: ['test'] });
        const results = engine.query({ tags: ['test'] });
        assert.equal(results.length, 2);
    });

    test('should filter by domain', () => {
        const engine = new MemoryCosmosEngine();
        engine.ingest('cognition', { data: { a: 1 }, tags: ['x'] });
        engine.ingest('execution', { data: { b: 2 }, tags: ['x'] });
        const results = engine.query({ domains: ['cognition'], tags: ['x'] });
        assert.equal(results.length, 1);
    });

    test('should create cross-references', () => {
        const engine = new MemoryCosmosEngine();
        const mem = engine.ingest('cognition', { data: {}, connections: ['ref-1', 'ref-2'] });
        const conns = engine.getConnections(mem.id);
        assert.equal(conns.length, 2);
    });

    test('should get cosmos summary', () => {
        const engine = new MemoryCosmosEngine();
        engine.ingest('cognition', { data: {} });
        engine.ingest('governance', { data: {} });
        const summary = engine.getSummary();
        assert.equal(summary.sizes.cognition, 1);
        assert.equal(summary.sizes.governance, 1);
    });
});

describe('SynthesisReasoningEngine', () => {
    test('should reason across domains', () => {
        const engine = new SynthesisReasoningEngine();
        const session = engine.reason({
            question: 'Should we scale workers?',
            inputs: {
                governance: { recommendation: 'approve' },
                execution: { recommendation: 'approve' },
                architecture: { recommendation: 'approve' },
            },
        });
        assert.ok(session.id);
        assert.equal(session.conflicts.length, 0);
        assert.ok(session.synthesis.confidence > 0.5);
    });

    test('should detect cross-domain conflicts', () => {
        const engine = new SynthesisReasoningEngine();
        const session = engine.reason({
            question: 'Scale decision',
            inputs: {
                governance: { recommendation: 'deny' },
                execution: { recommendation: 'approve' },
            },
        });
        assert.equal(session.conflicts.length, 1);
    });

    test('should record decisions', () => {
        const engine = new SynthesisReasoningEngine();
        engine.recordDecision({ title: 'Scale approved', rationale: 'All aligned' });
        assert.equal(engine.getDecisions().length, 1);
    });

    test('should track stats', () => {
        const engine = new SynthesisReasoningEngine();
        engine.reason({ question: 'test', inputs: { governance: { recommendation: 'x' } } });
        const stats = engine.getStats();
        assert.equal(stats.sessionsCompleted, 1);
        assert.ok(stats.domainsConsidered >= 1);
    });
});

describe('RealityImmuneSystem', () => {
    test('should detect threats', () => {
        const engine = new RealityImmuneSystem();
        const threat = engine.detectThreat('coherence-collapse', 0.8);
        assert.equal(threat.type, 'coherence-collapse');
        assert.equal(threat.status, 'active');
    });

    test('should auto-defend against known threats', () => {
        const engine = new RealityImmuneSystem();
        let defended = false;
        engine.on('defense:activated', () => { defended = true; });
        engine.detectThreat('execution-chaos', 0.9);
        assert.ok(defended);
    });

    test('should report health and detect threats', () => {
        const engine = new RealityImmuneSystem();
        let threatDetected = false;
        engine.on('threat:detected', () => { threatDetected = true; });
        engine.reportHealth('stability', 0.2);
        assert.ok(threatDetected);
    });

    test('should trigger recovery', () => {
        const engine = new RealityImmuneSystem();
        engine.detectThreat('mission-drift', 0.7);
        const result = engine.triggerRecovery('manual');
        assert.ok(result.resolved > 0);
        assert.equal(engine.getActiveThreats().length, 0);
    });

    test('should compute immune health', () => {
        const engine = new RealityImmuneSystem();
        engine.reportHealth('coherence', 0.8);
        engine.reportHealth('stability', 0.6);
        const health = engine.getImmuneHealth();
        assert.equal(health, 0.7);
    });
});
