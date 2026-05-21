/**
 * Meta-Civilization Fabric Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    CivilizationEconomyEngine, IntelligenceEcologyEngine, AutonomousExpansionEngine,
    RealityOrchestrationEngine, MetaGovernanceEngine, CivilizationPhysicsEngine,
    MultiRealitySimulationEngine, CivilizationDNAEngine, AutonomousScienceEngine,
    UnifiedCivilizationField, MetaIntelligenceEngine,
} from '../src/core/meta-civilization/index.js';

describe('CivilizationEconomyEngine', () => {
    test('should credit and debit accounts', () => {
        const e = new CivilizationEconomyEngine();
        e.credit('innovation-value', 100, 'new feature');
        e.debit('execution-cost', 50, 'worker hours');
        assert.equal(e.getBalance('innovation-value'), 100);
        assert.equal(e.getBalance('execution-cost'), -50);
    });
    test('should compute ROI', () => {
        const e = new CivilizationEconomyEngine();
        e.debit('execution-cost', 100);
        e.credit('innovation-value', 200);
        assert.equal(e.computeROI(), 2);
    });
    test('should track transactions', () => {
        const e = new CivilizationEconomyEngine();
        e.credit('innovation-value', 10);
        e.debit('worker-cost', 5);
        assert.equal(e.getTransactions().length, 2);
    });
});

describe('IntelligenceEcologyEngine', () => {
    test('should scan and detect stagnation', () => {
        const e = new IntelligenceEcologyEngine();
        e.reportZone('cognition', { activity: 0.1, diversity: 0.5, health: 0.5 });
        const result = e.scan();
        assert.ok(result.issues.length > 0);
        assert.ok(result.issues.some(i => i.type === 'stagnant'));
    });
    test('should detect overload', () => {
        const e = new IntelligenceEcologyEngine();
        e.reportZone('execution', { activity: 0.95, diversity: 0.5, health: 0.5 });
        const result = e.scan();
        assert.ok(result.issues.some(i => i.type === 'overloaded'));
    });
    test('should report healthy zones', () => {
        const e = new IntelligenceEcologyEngine();
        const result = e.scan();
        assert.ok(result.healthy > 0);
    });
});

describe('AutonomousExpansionEngine', () => {
    test('should expand with swarms', () => {
        const e = new AutonomousExpansionEngine();
        const exp = e.expand('frontend-pressure', { type: 'swarm', agents: 3, target: 'ui-optimization' });
        assert.equal(exp.type, 'swarm');
        assert.equal(e.getActiveSwarms().length, 1);
        assert.equal(e.getStats().agentsCreated, 3);
    });
    test('should dissolve swarms', () => {
        const e = new AutonomousExpansionEngine();
        const exp = e.expand('test', { type: 'swarm', agents: 2 });
        e.dissolveSwarm(exp.id);
        assert.equal(e.getActiveSwarms().length, 0);
    });
    test('should expand pipelines', () => {
        const e = new AutonomousExpansionEngine();
        e.expand('queue-pressure', { type: 'pipeline', target: 'optimization' });
        assert.equal(e.getStats().pipelinesExpanded, 1);
    });
});

describe('RealityOrchestrationEngine', () => {
    test('should orchestrate actions', () => {
        const e = new RealityOrchestrationEngine();
        const result = e.orchestrate({ type: 'scale', domains: ['execution', 'governance'] });
        assert.ok(result.id);
        assert.equal(result.coordination, 1.0);
    });
    test('should detect conflicts', () => {
        const e = new RealityOrchestrationEngine();
        e.updateDomain('execution', { direction: 'up' });
        e.updateDomain('governance', { direction: 'down' });
        const result = e.orchestrate({ type: 'scale', domains: ['execution', 'governance'] });
        assert.ok(result.conflicts.length > 0);
    });
});

describe('MetaGovernanceEngine', () => {
    test('should register and audit policies', () => {
        const e = new MetaGovernanceEngine();
        e.registerPolicy('pol-a', { target: 'workers', direction: 'up' });
        e.registerPolicy('pol-b', { target: 'workers', direction: 'down' });
        const audit = e.auditPolicies();
        assert.ok(audit.contradictions > 0);
    });
    test('should evolve policies', () => {
        const e = new MetaGovernanceEngine();
        e.registerPolicy('test', { target: 'x', direction: 'up' });
        const evolved = e.evolvePolicy('test', { direction: 'neutral' });
        assert.ok(evolved);
        assert.equal(e.getStats().policiesEvolved, 1);
    });
});

describe('CivilizationPhysicsEngine', () => {
    test('should apply forces', () => {
        const e = new CivilizationPhysicsEngine();
        e.applyForce('execution-gravity', 0.7, 'down');
        const force = e.getForce('execution-gravity');
        assert.equal(force.magnitude, 0.7);
    });
    test('should compute net force', () => {
        const e = new CivilizationPhysicsEngine();
        e.applyForce('execution-gravity', 0.5);
        e.applyForce('optimization-momentum', -0.3);
        const net = e.computeNetForce();
        assert.ok(typeof net === 'number');
    });
});

describe('MultiRealitySimulationEngine', () => {
    test('should simulate alternate realities', () => {
        const e = new MultiRealitySimulationEngine();
        const sim = e.simulate({
            name: 'architecture-choice',
            alternatives: [
                { name: 'microservices', parameters: { stability: 0.7, performance: 0.9, risk: 0.4 } },
                { name: 'monolith', parameters: { stability: 0.9, performance: 0.6, risk: 0.2 } },
            ],
        });
        assert.ok(sim.optimal);
        assert.equal(sim.realities.length, 2);
    });
    test('should find optimal reality', () => {
        const e = new MultiRealitySimulationEngine();
        const sim = e.simulate({
            name: 'test',
            alternatives: [
                { name: 'a', parameters: { stability: 0.9, performance: 0.9, risk: 0.1 } },
                { name: 'b', parameters: { stability: 0.3, performance: 0.3, risk: 0.9 } },
            ],
        });
        assert.equal(sim.optimal.name, 'a');
    });
});

describe('CivilizationDNAEngine', () => {
    test('should register genes', () => {
        const e = new CivilizationDNAEngine();
        const gene = e.registerGene('governance', { name: 'safety-first', traits: { priority: 'absolute' } });
        assert.ok(gene.id);
        assert.equal(e.getStrand('governance').length, 1);
    });
    test('should mutate genes', () => {
        const e = new CivilizationDNAEngine();
        e.registerGene('governance', { name: 'safety', traits: { level: 'high' } });
        const mutated = e.mutate('governance', 'safety', { level: 'critical' });
        assert.ok(mutated);
        assert.equal(e.getStats().mutationsApplied, 1);
    });
    test('should express active genes', () => {
        const e = new CivilizationDNAEngine();
        e.registerGene('architecture', { name: 'modular', expression: 'active' });
        e.registerGene('architecture', { name: 'legacy', expression: 'dormant' });
        const expressed = e.express('architecture');
        assert.equal(expressed.length, 1);
        assert.equal(expressed[0].name, 'modular');
    });
});

describe('AutonomousScienceEngine', () => {
    test('should run experiments', () => {
        const e = new AutonomousScienceEngine();
        const result = e.runExperiment({
            hypothesis: 'Increasing workers improves throughput',
            method: 'A/B test',
            outcome: { success: true, novel: false, finding: 'Confirmed' },
        });
        assert.ok(result.id);
        assert.equal(result.validated, true);
    });
    test('should record discoveries', () => {
        const e = new AutonomousScienceEngine();
        e.runExperiment({
            hypothesis: 'New scheduling algorithm',
            outcome: { success: true, novel: true, finding: 'Better throughput' },
        });
        assert.equal(e.getDiscoveries().length, 1);
    });
});

describe('UnifiedCivilizationField', () => {
    test('should compute field state', () => {
        const e = new UnifiedCivilizationField();
        e.updateComponent('cognition', { strength: 0.8, vector: 'forward' });
        e.updateComponent('execution', { strength: 0.7, vector: 'forward' });
        const state = e.computeField();
        assert.ok(state.coherence > 0);
        assert.ok(state.energy > 0);
    });
    test('should detect entropy from diverse vectors', () => {
        const e = new UnifiedCivilizationField();
        e.updateComponent('cognition', { strength: 0.5, vector: 'up' });
        e.updateComponent('execution', { strength: 0.5, vector: 'down' });
        e.updateComponent('governance', { strength: 0.5, vector: 'left' });
        const state = e.computeField();
        assert.ok(state.entropy > 0);
        assert.ok(state.coherence < 1);
    });
});

describe('MetaIntelligenceEngine', () => {
    test('should report metrics', () => {
        const e = new MetaIntelligenceEngine();
        e.reportMetric('reasoning', 0.8, 0.9);
        const metric = e.getMetric('reasoning');
        assert.equal(metric.quality, 0.8);
        assert.equal(metric.efficiency, 0.9);
    });
    test('should detect improvements', () => {
        const e = new MetaIntelligenceEngine();
        e.reportMetric('reasoning', 0.8, 0.7);
        assert.equal(e.getStats().improvementsDetected, 1);
    });
    test('should apply optimizations', () => {
        const e = new MetaIntelligenceEngine();
        e.optimize('reasoning', { action: 'add-validation-step', impact: 'high' });
        assert.equal(e.getOptimizations().length, 1);
    });
    test('should compute meta score', () => {
        const e = new MetaIntelligenceEngine();
        e.reportMetric('reasoning', 0.9, 0.8);
        e.reportMetric('governance', 0.7, 0.6);
        const score = e.computeMetaScore();
        assert.ok(score > 0.5);
    });
});
