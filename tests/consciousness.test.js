/**
 * Consciousness Fabric Tests — Self-Aware Engineering Intelligence
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    GlobalStateEngine,
    SelfObservationEngine,
    CognitiveStabilityEngine,
    StrategicIdentityEngine,
    MetaCognitionEngine,
    ConsciousnessTimeline,
    RealityCoherenceEngine,
    IntelligencePressureEngine,
    SelfReflectionEngine,
    CivilizationPhilosophyEngine,
} from '../src/core/consciousness/index.js';

// ─── GlobalStateEngine ──────────────────────────────────────────────────────

describe('GlobalStateEngine', () => {
    test('should initialize with default dimensions', () => {
        const engine = new GlobalStateEngine();
        const state = engine.getFullState();
        assert.ok('execution-health' in state);
        assert.ok('architecture-entropy' in state);
        assert.ok('chaos-probability' in state);
    });

    test('should update state dimensions', () => {
        const engine = new GlobalStateEngine();
        engine.update('execution-health', 0.9);
        assert.equal(engine.get('execution-health'), 0.9);
    });

    test('should detect anomalies on large changes', () => {
        const engine = new GlobalStateEngine();
        let anomalyDetected = false;
        engine.on('state:anomaly', () => { anomalyDetected = true; });
        engine.update('execution-health', 0.1); // large drop from 0.5
        assert.ok(anomalyDetected);
    });

    test('should compute overall health', () => {
        const engine = new GlobalStateEngine();
        engine.update('execution-health', 0.8);
        engine.update('architecture-entropy', 0.6);
        const health = engine.computeOverallHealth();
        assert.ok(health > 0 && health <= 1);
    });

    test('should take snapshots', () => {
        const engine = new GlobalStateEngine();
        engine.update('execution-health', 0.7);
        const snapshot = engine.takeSnapshot();
        assert.ok(snapshot.id);
        assert.ok('overallHealth' in snapshot);
    });

    test('should track history', () => {
        const engine = new GlobalStateEngine();
        engine.update('execution-health', 0.8);
        engine.update('execution-health', 0.7);
        const history = engine.getHistory('execution-health');
        assert.equal(history.length, 2);
    });

    test('should compute trends', () => {
        const engine = new GlobalStateEngine();
        for (let i = 0; i < 10; i++) {
            engine.update('execution-health', 0.5 + i * 0.03);
        }
        const trend = engine.getTrend('execution-health');
        assert.equal(trend, 'improving');
    });
});

// ─── SelfObservationEngine ──────────────────────────────────────────────────

describe('SelfObservationEngine', () => {
    test('should record observations', () => {
        const engine = new SelfObservationEngine();
        const obs = engine.observe({ type: 'reasoning', subject: 'decision-quality', finding: 'good' });
        assert.ok(obs.id);
        assert.equal(engine.getObservations().length, 1);
    });

    test('should check reasoning quality', () => {
        const engine = new SelfObservationEngine();
        const quality = engine.checkReasoningQuality({ confidence: 0.8, grounded: true, steps: [1, 2, 3] });
        assert.ok(quality.overall > 0.5);
    });

    test('should assess hallucination risk', () => {
        const engine = new SelfObservationEngine();
        const result = engine.assessHallucinationRisk({ groundedFacts: 8, totalClaims: 10, validated: true });
        assert.ok(result.risk < 0.5);
        assert.ok(result.grounding > 0.5);
    });

    test('should flag high hallucination risk', () => {
        const engine = new SelfObservationEngine();
        let alertRaised = false;
        engine.on('alert:raised', () => { alertRaised = true; });
        engine.assessHallucinationRisk({ groundedFacts: 1, totalClaims: 10, validated: false, novel: true });
        assert.ok(alertRaised);
    });

    test('should detect recursive instability', () => {
        const engine = new SelfObservationEngine();
        for (let i = 0; i < 15; i++) {
            engine.observe({ type: 'same-type', subject: 'loop', finding: 'repeating' });
        }
        const result = engine.detectRecursiveInstability();
        assert.equal(result.stable, false);
    });

    test('should compute execution confidence', () => {
        const engine = new SelfObservationEngine();
        const confidence = engine.getExecutionConfidence();
        assert.ok(confidence >= 0 && confidence <= 1);
    });
});

// ─── CognitiveStabilityEngine ───────────────────────────────────────────────

describe('CognitiveStabilityEngine', () => {
    test('should log cognitive events', () => {
        const engine = new CognitiveStabilityEngine();
        const record = engine.logCognitive({ type: 'decision', action: 'scale', input: { x: 1 }, output: 'up' });
        assert.ok(record.id);
    });

    test('should detect loops', () => {
        const engine = new CognitiveStabilityEngine({ loopThreshold: 3, windowSize: 10 });
        for (let i = 0; i < 5; i++) {
            engine.logCognitive({ type: 'fix', action: 'patch', input: { bug: 'A' }, output: 'fail' });
        }
        const loops = engine.detectLoops();
        assert.ok(loops.length > 0);
    });

    test('should detect contradictory plans', () => {
        const engine = new CognitiveStabilityEngine();
        const plans = [
            { target: 'workers', direction: 'up' },
            { target: 'workers', direction: 'down' },
        ];
        const contradictions = engine.detectContradictions(plans);
        assert.equal(contradictions.length, 1);
    });

    test('should trip circuit breakers', () => {
        const engine = new CognitiveStabilityEngine();
        engine.tripCircuitBreaker('optimization', 'runaway detected');
        assert.ok(engine.isCircuitBroken('optimization'));
    });

    test('should report stability score', () => {
        const engine = new CognitiveStabilityEngine();
        const score = engine.getStabilityScore();
        assert.ok(score >= 0 && score <= 1);
    });
});

// ─── StrategicIdentityEngine ────────────────────────────────────────────────

describe('StrategicIdentityEngine', () => {
    test('should have default identity', () => {
        const engine = new StrategicIdentityEngine();
        assert.ok(engine.getMission().includes('autonomous'));
        assert.ok(engine.getPrinciples().length > 0);
        assert.ok(Object.keys(engine.getValues()).length > 0);
    });

    test('should check alignment', () => {
        const engine = new StrategicIdentityEngine();
        const result = engine.checkAlignment({ explainable: true });
        assert.equal(result.aligned, true);
    });

    test('should detect misalignment', () => {
        const engine = new StrategicIdentityEngine();
        const result = engine.checkAlignment({ unsafe: true, noHumanOverride: true, explainable: false });
        assert.equal(result.aligned, false);
        assert.ok(result.violations.length > 0);
    });

    test('should update mission with history', () => {
        const engine = new StrategicIdentityEngine();
        engine.updateMission('New mission', 'Strategic pivot');
        assert.equal(engine.getMission(), 'New mission');
        assert.equal(engine.getHistory().length, 1);
    });

    test('should add principles', () => {
        const engine = new StrategicIdentityEngine();
        const before = engine.getPrinciples().length;
        engine.addPrinciple('test-principle');
        assert.equal(engine.getPrinciples().length, before + 1);
    });

    test('should get full identity', () => {
        const engine = new StrategicIdentityEngine();
        const identity = engine.getIdentity();
        assert.ok('mission' in identity);
        assert.ok('principles' in identity);
        assert.ok('values' in identity);
        assert.ok('objectives' in identity);
        assert.ok('philosophy' in identity);
    });
});

// ─── MetaCognitionEngine ────────────────────────────────────────────────────

describe('MetaCognitionEngine', () => {
    test('should assess domain quality', () => {
        const engine = new MetaCognitionEngine();
        const assessment = engine.assess('reasoning', { successRate: 0.8, accuracy: 0.9 });
        assert.ok(assessment.score > 0.5);
    });

    test('should generate insights', () => {
        const engine = new MetaCognitionEngine();
        const insight = engine.generateInsight({
            finding: 'Reasoning quality declining',
            implication: 'May produce lower quality decisions',
            recommendation: 'Increase validation steps',
            domain: 'reasoning',
        });
        assert.ok(insight.id);
        assert.equal(engine.getInsights().length, 1);
    });

    test('should evaluate optimization outcomes', () => {
        const engine = new MetaCognitionEngine();
        const result = engine.evaluateOutcome({
            id: 'opt-1',
            metricsBefore: { throughput: 100, latency: 50 },
            metricsAfter: { throughput: 120, latency: 45 },
        });
        assert.equal(result.effective, true);
        assert.ok(result.netEffect > 0);
    });

    test('should detect ineffective optimizations', () => {
        const engine = new MetaCognitionEngine();
        const result = engine.evaluateOutcome({
            id: 'opt-2',
            metricsBefore: { throughput: 100, latency: 50 },
            metricsAfter: { throughput: 90, latency: 60 },
        });
        assert.equal(result.effective, false);
    });

    test('should track quality improvements', () => {
        const engine = new MetaCognitionEngine();
        engine.assess('reasoning', { successRate: 0.9 });
        const stats = engine.getStats();
        assert.ok(stats.assessmentsPerformed >= 1);
    });

    test('should get overall quality', () => {
        const engine = new MetaCognitionEngine();
        const quality = engine.getOverallQuality();
        assert.equal(quality, 0.5); // default
    });
});

// ─── ConsciousnessTimeline ──────────────────────────────────────────────────

describe('ConsciousnessTimeline', () => {
    test('should start with awakening phase', () => {
        const timeline = new ConsciousnessTimeline();
        const phase = timeline.getCurrentPhase();
        assert.equal(phase.name, 'awakening');
    });

    test('should record events', () => {
        const timeline = new ConsciousnessTimeline();
        const event = timeline.record({ category: 'reasoning', type: 'improvement', description: 'Better logic' });
        assert.ok(event.id);
        assert.equal(event.phase, 'awakening');
    });

    test('should mark milestones', () => {
        const timeline = new ConsciousnessTimeline();
        const milestone = timeline.markMilestone({ title: 'First self-reflection', category: 'consciousness' });
        assert.ok(milestone.id);
        assert.equal(timeline.getMilestones().length, 1);
    });

    test('should transition phases', () => {
        const timeline = new ConsciousnessTimeline();
        timeline.transitionPhase('self-aware', 'System achieved self-awareness');
        const phase = timeline.getCurrentPhase();
        assert.equal(phase.name, 'self-aware');
        assert.equal(timeline.getPhases().length, 2);
    });

    test('should filter events by category', () => {
        const timeline = new ConsciousnessTimeline();
        timeline.record({ category: 'reasoning', type: 'a', description: 'x' });
        timeline.record({ category: 'governance', type: 'b', description: 'y' });
        const events = timeline.getEvents({ category: 'reasoning' });
        assert.equal(events.length, 1);
    });

    test('should get evolution summary', () => {
        const timeline = new ConsciousnessTimeline();
        timeline.record({ category: 'reasoning', type: 'test', description: 'test' });
        const summary = timeline.getEvolutionSummary();
        assert.equal(summary.reasoning.totalEvents, 1);
    });
});

// ─── RealityCoherenceEngine ─────────────────────────────────────────────────

describe('RealityCoherenceEngine', () => {
    test('should initialize with default alignment pairs', () => {
        const engine = new RealityCoherenceEngine();
        const alignments = engine.getAllAlignments();
        assert.ok('strategy↔execution' in alignments);
        assert.ok('governance↔optimization' in alignments);
    });

    test('should report alignment', () => {
        const engine = new RealityCoherenceEngine();
        engine.reportAlignment('strategy', 'execution', 0.9);
        assert.equal(engine.getAlignment('strategy', 'execution'), 0.9);
    });

    test('should check coherence', () => {
        const engine = new RealityCoherenceEngine();
        engine.reportAlignment('strategy', 'execution', 0.8);
        engine.reportAlignment('governance', 'optimization', 0.7);
        const result = engine.checkCoherence();
        assert.ok(result.coherence > 0);
        assert.ok(result.details.length > 0);
    });

    test('should detect drift', () => {
        const engine = new RealityCoherenceEngine();
        let driftDetected = false;
        engine.on('drift:detected', () => { driftDetected = true; });
        engine.reportAlignment('strategy', 'execution', 0.1); // below threshold
        engine.checkCoherence();
        assert.ok(driftDetected);
    });

    test('should record realignments', () => {
        const engine = new RealityCoherenceEngine();
        engine.recordRealignment('strategy↔execution', 'Revised strategy');
        const stats = engine.getStats();
        assert.equal(stats.realignments, 1);
    });
});

// ─── IntelligencePressureEngine ─────────────────────────────────────────────

describe('IntelligencePressureEngine', () => {
    test('should initialize with zero pressure', () => {
        const engine = new IntelligencePressureEngine();
        assert.equal(engine.getPressure('cognitive-pressure'), 0);
        assert.equal(engine.getStatus(), 'normal');
    });

    test('should report pressure', () => {
        const engine = new IntelligencePressureEngine();
        engine.reportPressure('cognitive-pressure', 0.5);
        assert.equal(engine.getPressure('cognitive-pressure'), 0.5);
    });

    test('should raise alerts on critical pressure', () => {
        const engine = new IntelligencePressureEngine();
        let alertRaised = false;
        engine.on('pressure:critical', () => { alertRaised = true; });
        engine.reportPressure('cognitive-pressure', 0.9);
        assert.ok(alertRaised);
    });

    test('should compute overall pressure', () => {
        const engine = new IntelligencePressureEngine();
        engine.reportPressure('cognitive-pressure', 0.6);
        engine.reportPressure('strategic-entropy', 0.4);
        const overall = engine.computeOverallPressure();
        assert.ok(overall > 0);
    });

    test('should track pressure trends', () => {
        const engine = new IntelligencePressureEngine();
        for (let i = 0; i < 10; i++) {
            engine.reportPressure('cognitive-pressure', 0.1 + i * 0.05);
        }
        const trend = engine.getTrend('cognitive-pressure');
        assert.equal(trend, 'increasing');
    });

    test('should get all pressures', () => {
        const engine = new IntelligencePressureEngine();
        engine.reportPressure('cognitive-pressure', 0.3);
        const all = engine.getAllPressures();
        assert.ok('cognitive-pressure' in all);
        assert.equal(all['cognitive-pressure'].value, 0.3);
    });
});

// ─── SelfReflectionEngine ───────────────────────────────────────────────────

describe('SelfReflectionEngine', () => {
    test('should perform reflections', () => {
        const engine = new SelfReflectionEngine();
        const reflection = engine.reflect({
            category: 'failure',
            subject: 'deploy-crash',
            whatHappened: 'Deploy failed',
            whyItHappened: 'Missing validation',
            whatWeLearned: 'Always validate before deploy',
            whatToImprove: 'Add pre-deploy checks',
        });
        assert.ok(reflection.id);
    });

    test('should extract lessons from reflections', () => {
        const engine = new SelfReflectionEngine();
        engine.reflect({
            category: 'failure',
            subject: 'test',
            whatWeLearned: 'Important lesson',
        });
        const lessons = engine.getLessons();
        assert.equal(lessons.length, 1);
        assert.equal(lessons[0].lesson, 'Important lesson');
    });

    test('should review events and find patterns', () => {
        const engine = new SelfReflectionEngine();
        const events = [
            { subject: 'timeout', type: 'error' },
            { subject: 'timeout', type: 'error' },
            { subject: 'timeout', type: 'error' },
            { subject: 'crash', type: 'error' },
        ];
        const review = engine.review('failure', events);
        assert.ok(review.patterns.length > 0);
        assert.ok(review.improvements.length > 0);
    });

    test('should check precedent', () => {
        const engine = new SelfReflectionEngine();
        engine.reflect({ category: 'failure', subject: 'oom-kill', whatHappened: 'OOM' });
        const precedent = engine.checkPrecedent({ category: 'failure', subject: 'oom-kill' });
        assert.equal(precedent.hasPrecedent, true);
        assert.equal(precedent.occurrences, 1);
    });

    test('should report no precedent for new events', () => {
        const engine = new SelfReflectionEngine();
        const precedent = engine.checkPrecedent({ category: 'failure', subject: 'new-issue' });
        assert.equal(precedent.hasPrecedent, false);
    });
});

// ─── CivilizationPhilosophyEngine ──────────────────────────────────────────

describe('CivilizationPhilosophyEngine', () => {
    test('should have default philosophies', () => {
        const engine = new CivilizationPhilosophyEngine();
        const all = engine.getAllPhilosophies();
        assert.ok('execution' in all);
        assert.ok('governance' in all);
        assert.ok('optimization' in all);
        assert.ok('engineering' in all);
    });

    test('should have default tenets', () => {
        const engine = new CivilizationPhilosophyEngine();
        const tenets = engine.getTenets();
        assert.ok(tenets.length >= 5);
    });

    test('should check ethics — allow ethical actions', () => {
        const engine = new CivilizationPhilosophyEngine();
        const result = engine.checkEthics({ type: 'deploy', deceptive: false, harmful: false });
        assert.equal(result.ethical, true);
    });

    test('should check ethics — block unethical actions', () => {
        const engine = new CivilizationPhilosophyEngine();
        const result = engine.checkEthics({ type: 'action', deceptive: true });
        assert.equal(result.ethical, false);
        assert.ok(result.violations.length > 0);
    });

    test('should define new philosophies', () => {
        const engine = new CivilizationPhilosophyEngine();
        engine.definePhilosophy('testing', { statement: 'Test everything', principles: ['coverage'] });
        const phil = engine.getPhilosophy('testing');
        assert.equal(phil.statement, 'Test everything');
    });

    test('should establish new tenets', () => {
        const engine = new CivilizationPhilosophyEngine();
        const before = engine.getTenets().length;
        engine.establishTenet({ statement: 'New tenet', domain: 'custom' });
        assert.equal(engine.getTenets().length, before + 1);
    });

    test('should add ethical boundaries', () => {
        const engine = new CivilizationPhilosophyEngine();
        engine.addEthicalBoundary('no-spam', { reason: 'No spam', check: (a) => a.spam === true });
        const result = engine.checkEthics({ type: 'send', spam: true });
        assert.equal(result.ethical, false);
    });

    test('should get ethical boundaries', () => {
        const engine = new CivilizationPhilosophyEngine();
        const boundaries = engine.getEthicalBoundaries();
        assert.ok(boundaries.length >= 4);
    });
});
