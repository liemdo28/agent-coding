/**
 * Omniversal Intelligence Fabric Tests
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    UnifiedIntelligenceField, RealityComputationEngine, AdaptiveOperationalPhysics,
    SelfGeneratingInfrastructure, AutonomousRealityExpansion, IntelligenceEntropyEngine,
    OmniversalMemoryFabric, MultiCivilizationOrchestrator, AutonomousIntelligenceEvolution,
    RealityStabilityField, OperationalSingularityEngine,
} from '../src/core/omniversal/index.js';

describe('UnifiedIntelligenceField', () => {
    test('should compute field', () => { const e = new UnifiedIntelligenceField(); e.updateNode('cognition', { strength: 0.8, adaptivity: 0.7 }); const state = e.computeField(); assert.ok(state.coherence > 0); assert.ok(state.intelligence > 0); });
    test('should adapt', () => { const e = new UnifiedIntelligenceField(); const r = e.adapt('pressure', 'scale-down'); assert.ok(r.trigger === 'pressure'); });
    test('should merge nodes', () => { const e = new UnifiedIntelligenceField(); e.merge('cognition', 'execution'); assert.equal(e.getStats().merges, 1); });
});

describe('RealityComputationEngine', () => {
    test('should compute futures', () => { const e = new RealityComputationEngine(); const f = e.compute('operational', { current: 0.5, trend: 0.01 }); assert.ok(f.id); assert.ok(f.projectedState >= 0); });
    test('should compute all domains', () => { const e = new RealityComputationEngine(); const r = e.computeAll(); assert.ok('operational' in r); assert.ok('architecture' in r); });
});

describe('AdaptiveOperationalPhysics', () => {
    test('should set and adapt physics', () => { const e = new AdaptiveOperationalPhysics(); e.adapt('execution-gravity', 'high-load', 0.8); assert.equal(e.getPhysics('execution-gravity'), 0.8); assert.equal(e.getStats().adaptationsApplied, 1); });
    test('should get all physics', () => { const e = new AdaptiveOperationalPhysics(); e.setPhysics('chaos-entropy', 0.3); const all = e.getAllPhysics(); assert.equal(all['chaos-entropy'], 0.3); });
});

describe('SelfGeneratingInfrastructure', () => {
    test('should generate swarms', () => { const e = new SelfGeneratingInfrastructure(); const infra = e.generate({ type: 'swarm', target: 'optimization' }); assert.equal(infra.type, 'swarm'); assert.equal(e.getActive().length, 1); });
    test('should generate fabrics', () => { const e = new SelfGeneratingInfrastructure(); e.generate({ type: 'fabric', target: 'execution' }); assert.equal(e.getStats().fabricsDeployed, 1); });
    test('should decommission', () => { const e = new SelfGeneratingInfrastructure(); const infra = e.generate({ type: 'swarm' }); e.decommission(infra.id); assert.equal(e.getActive().length, 0); });
});

describe('AutonomousRealityExpansion', () => {
    test('should create departments', () => { const e = new AutonomousRealityExpansion(); e.expand('department', { name: 'AI-ops' }); assert.equal(e.getDepartments().length, 1); });
    test('should add layers', () => { const e = new AutonomousRealityExpansion(); e.expand('layer', { name: 'orchestration-v2' }); assert.equal(e.getStats().layersAdded, 1); });
    test('should spawn ecosystems', () => { const e = new AutonomousRealityExpansion(); e.expand('ecosystem', { name: 'optimization-eco' }); assert.equal(e.getStats().ecosystemsSpawned, 1); });
});

describe('IntelligenceEntropyEngine', () => {
    test('should measure entropy', () => { const e = new IntelligenceEntropyEngine(); e.measure('strategic', 0.5); assert.equal(e.getEntropy('strategic'), 0.5); });
    test('should alert on critical entropy', () => { const e = new IntelligenceEntropyEngine(); let alerted = false; e.on('entropy:critical', () => { alerted = true; }); e.measure('cognition', 0.9); assert.ok(alerted); });
    test('should compute total entropy', () => { const e = new IntelligenceEntropyEngine(); e.measure('strategic', 0.4); e.measure('cognition', 0.6); const total = e.computeTotalEntropy(); assert.ok(total > 0); });
});

describe('OmniversalMemoryFabric', () => {
    test('should absorb memories', () => { const e = new OmniversalMemoryFabric(); const m = e.absorb('operational', { data: { x: 1 }, tags: ['test'] }); assert.ok(m.id); });
    test('should synthesize patterns', () => { const e = new OmniversalMemoryFabric(); for (let i = 0; i < 5; i++) e.absorb('operational', { data: { i }, tags: ['recurring'] }); const patterns = e.synthesizePatterns('operational'); assert.ok(patterns.length > 0); });
    test('should query by tags', () => { const e = new OmniversalMemoryFabric(); e.absorb('strategic', { data: {}, tags: ['important'] }); e.absorb('strategic', { data: {}, tags: ['trivial'] }); const results = e.query('strategic', { tags: ['important'] }); assert.equal(results.length, 1); });
});

describe('MultiCivilizationOrchestrator', () => {
    test('should orchestrate', () => { const e = new MultiCivilizationOrchestrator(); const r = e.orchestrate({ type: 'coordinate' }); assert.ok(r.id); assert.equal(r.coordination, 1); });
    test('should detect conflicts', () => { const e = new MultiCivilizationOrchestrator(); e.updateCivilization('engineering', { direction: 'up' }); e.updateCivilization('governance', { direction: 'down' }); const r = e.orchestrate({ type: 'scale' }); assert.ok(r.conflicts.length > 0); });
    test('should manage civilizations', () => { const e = new MultiCivilizationOrchestrator(); assert.equal(e.getStats().civilizationsManaged, 5); });
});

describe('AutonomousIntelligenceEvolution', () => {
    test('should propose evolutions', () => { const e = new AutonomousIntelligenceEvolution(); const p = e.propose('reasoning', { title: 'Add meta-layer', description: 'New reasoning layer' }); assert.ok(p.id); assert.equal(p.status, 'proposed'); });
    test('should apply proposals', () => { const e = new AutonomousIntelligenceEvolution(); const p = e.propose('governance', { title: 'Evolve policies' }); const applied = e.apply(p.id); assert.ok(applied); assert.equal(e.getStats().evolutionsApplied, 1); });
    test('should filter proposals by status', () => { const e = new AutonomousIntelligenceEvolution(); e.propose('reasoning', { title: 'A' }); e.propose('governance', { title: 'B' }); assert.equal(e.getProposals('proposed').length, 2); });
});

describe('RealityStabilityField', () => {
    test('should report stability', () => { const e = new RealityStabilityField(); e.reportStability('cognition', 0.9); assert.equal(e.getStability('cognition'), 0.9); });
    test('should detect instability', () => { const e = new RealityStabilityField(); let detected = false; e.on('instability:detected', () => { detected = true; }); e.reportStability('execution', 0.1); assert.ok(detected); });
    test('should compute field stability', () => { const e = new RealityStabilityField(); e.reportStability('cognition', 0.8); e.reportStability('governance', 0.6); const fs = e.computeFieldStability(); assert.ok(fs > 0 && fs < 1); });
    test('should apply stabilization', () => { const e = new RealityStabilityField(); e.stabilize('execution', 'throttle-workers'); assert.equal(e.getStats().interventionsApplied, 1); });
});

describe('OperationalSingularityEngine', () => {
    test('should run cycles', () => { const e = new OperationalSingularityEngine(); const c = e.cycle({ pressure: 0.5, entropy: 0.3 }); assert.ok(c.id); assert.equal(e.getStats().cyclesCompleted, 1); });
    test('should detect optimizations under pressure', () => { const e = new OperationalSingularityEngine(); const c = e.cycle({ pressure: 0.9, entropy: 0.8, stagnation: true, source: 'test' }); assert.ok(c.optimizations.length >= 3); assert.ok(c.emergent); });
    test('should apply mutations', () => { const e = new OperationalSingularityEngine(); e.mutate('orchestration', { type: 'restructure' }); assert.equal(e.getStats().mutationsApplied, 1); });
});
