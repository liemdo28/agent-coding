/**
 * Cognition Stack Tests
 *
 * Tests the AI Brain modules:
 * - ThinkingEngine
 * - ExecutionIntelligence
 * - CognitionMemory
 * - RuntimeNervousSystem
 * - ExecutionTimeline
 * - StrategicEngine
 * - ReasoningStream
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    ThinkingEngine,
    ExecutionIntelligence,
    CognitionMemory,
    RuntimeNervousSystem,
    ExecutionTimeline,
    StrategicEngine,
    ReasoningStream,
} from '../src/core/cognition/index.js';

describe('ThinkingEngine', () => {
    test('should instantiate with default config', () => {
        const engine = new ThinkingEngine();
        assert.ok(engine);
        assert.deepEqual(engine.getStats().totalThoughts, 0);
    });

    test('should execute a reasoning chain', async () => {
        const engine = new ThinkingEngine();
        const result = await engine.reason({
            description: 'fix build error in Next.js project',
            project: 'test-project',
        });

        assert.ok(result.chainId);
        assert.ok(result.plan.length > 0);
        assert.ok(result.confidence.overall > 0);
        assert.ok(result.confidence.risk >= 0);
        assert.ok(result.confidence.rollback_probability >= 0);
        assert.ok(result.thoughtTree);
        assert.ok(result.duration >= 0);
    });

    test('should estimate confidence for actions', () => {
        const engine = new ThinkingEngine();
        const estimate = engine.estimateConfidence({
            type: 'build',
            context: true,
            previousSuccess: true,
        });

        assert.ok(estimate.confidence > 0);
        assert.ok(estimate.confidence <= 1);
        assert.ok(estimate.risk >= 0);
        assert.ok(estimate.rollback_probability >= 0);
        assert.equal(estimate.confidence + estimate.risk, 1);
    });

    test('should emit reasoning events', async () => {
        const engine = new ThinkingEngine();
        const phases = [];

        engine.on('reasoning:phase', ({ phase }) => phases.push(phase));

        await engine.reason({ description: 'test failure analysis' });

        assert.ok(phases.includes('observe'));
        assert.ok(phases.includes('analyze'));
        assert.ok(phases.includes('reason'));
        assert.ok(phases.includes('plan'));
    });

    test('should classify problem types correctly', async () => {
        const engine = new ThinkingEngine();

        const buildResult = await engine.reason({ description: 'build failed' });
        const testResult = await engine.reason({ description: 'test spec failing' });
        const deployResult = await engine.reason({ description: 'deploy to production' });

        // All should complete successfully
        assert.ok(buildResult.confidence.overall > 0);
        assert.ok(testResult.confidence.overall > 0);
        assert.ok(deployResult.confidence.overall > 0);
    });
});

describe('ExecutionIntelligence', () => {
    test('should instantiate', () => {
        const ei = new ExecutionIntelligence();
        assert.ok(ei);
        assert.deepEqual(ei.getStats().logsAnalyzed, 0);
    });

    test('should analyze npm errors', () => {
        const ei = new ExecutionIntelligence();
        const log = `npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! Found: react@18.2.0`;

        const result = ei.analyze(log, { type: 'build' });

        assert.ok(result.errors.length > 0);
        assert.ok(result.suggestions.length > 0);
        assert.equal(result.severity, 'medium');
        assert.ok(result.rootCause);
    });

    test('should analyze TypeScript errors', () => {
        const ei = new ExecutionIntelligence();
        const log = `src/index.ts(15,3): error TS2307: Cannot find module './missing'.
src/app.ts(42,10): error TS2345: Argument of type 'string' is not assignable.`;

        const result = ei.analyze(log);

        assert.ok(result.errors.length >= 2);
        assert.ok(result.errors.some(e => e.type === 'typescript'));
        assert.ok(result.errors.some(e => e.code === 'TS2307'));
    });

    test('should detect missing modules', () => {
        const ei = new ExecutionIntelligence();
        const log = `Error: Cannot find module 'express'
    at Function.Module._resolveFilename`;

        const result = ei.analyze(log);

        assert.ok(result.errors.some(e => e.type === 'missing-module'));
        assert.ok(result.patchHints.length > 0);
    });

    test('should parse stack traces', () => {
        const ei = new ExecutionIntelligence();
        const stack = `Error: Connection refused
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1278:16)
    at MyService.connect (/app/src/service.js:42:10)`;

        const frames = ei.parseStackTrace(stack);

        assert.ok(frames.length >= 2);
        assert.ok(frames.some(f => f.file === '/app/src/service.js'));
        assert.ok(frames.some(f => f.isInternal));
    });

    test('should detect memory errors as critical', () => {
        const ei = new ExecutionIntelligence();
        const log = `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`;

        const result = ei.analyze(log);

        assert.equal(result.severity, 'critical');
    });
});

describe('CognitionMemory', () => {
    test('should instantiate without base memory', () => {
        const mem = new CognitionMemory(null);
        assert.ok(mem);
    });

    test('should record and recall episodes', async () => {
        const mem = new CognitionMemory(null);

        await mem.recordEpisode({
            type: 'fix',
            project: 'test-project',
            description: 'Fixed build error',
            outcome: 'success',
            metadata: { errorType: 'dependency' },
        });

        const episodes = mem.recallEpisodes({ project: 'test-project' });
        assert.equal(episodes.length, 1);
        assert.equal(episodes[0].outcome, 'success');
    });

    test('should record and recall strategies', async () => {
        const mem = new CognitionMemory(null);

        await mem.recordStrategy('build-fix-deps', {
            type: 'workflow',
            description: 'Fix dependency issues by clearing cache',
            confidence: 0.85,
            tags: ['build'],
        });

        const strategy = mem.recallStrategy('build-fix-deps');
        assert.ok(strategy);
        assert.equal(strategy.confidence, 0.85);
    });

    test('should recall fixes by error type', async () => {
        const mem = new CognitionMemory(null);

        await mem.recordEpisode({
            type: 'fix',
            project: 'proj-a',
            description: 'Fixed TS2307',
            outcome: 'success',
            metadata: { errorType: 'typescript' },
        });

        const fixes = mem.recallFixes('typescript', 'proj-a');
        assert.equal(fixes.length, 1);
    });

    test('should record organizational memory', async () => {
        const mem = new CognitionMemory(null);

        await mem.recordOrganizational('project-history', 'my-app', {
            created: '2024-01-01',
            stack: 'Next.js',
        });

        const history = mem.recallOrganizational('project-history', 'my-app');
        assert.ok(history);
        assert.equal(history.stack, 'Next.js');
    });
});

describe('RuntimeNervousSystem', () => {
    test('should instantiate and sense', () => {
        const ns = new RuntimeNervousSystem();
        const reading = ns.sense();

        assert.ok(reading.timestamp);
        assert.ok(reading.memory);
        assert.ok(reading.memory.heapUsed > 0);
        assert.ok(reading.uptime >= 0);
    });

    test('should assess health', () => {
        const ns = new RuntimeNervousSystem();
        const health = ns.assessHealth();

        assert.ok(['healthy', 'degraded', 'critical'].includes(health.status));
        assert.ok(health.score >= 0 && health.score <= 1);
        assert.ok(Array.isArray(health.risks));
    });

    test('should start and stop', () => {
        const ns = new RuntimeNervousSystem({ sensorInterval: 100000 });
        ns.start();
        assert.ok(ns.getStats().totalReadings === 0); // hasn't ticked yet
        ns.stop();
    });

    test('should assess SLA risk', () => {
        const ns = new RuntimeNervousSystem();
        const sla = ns.assessSLARisk();

        assert.ok('atRisk' in sla);
        assert.ok('probability' in sla);
        assert.ok(Array.isArray(sla.factors));
    });
});

describe('ExecutionTimeline', () => {
    test('should record events', () => {
        const tl = new ExecutionTimeline();
        const event = tl.record({ type: 'build', description: 'Build started' });

        assert.ok(event.id);
        assert.ok(event.timestamp);
        assert.equal(event.type, 'build');
    });

    test('should record typed events', () => {
        const tl = new ExecutionTimeline();
        tl.recordBuild('my-app', 'success');
        tl.recordFailure('my-app', 'OOM');
        tl.recordPatch('my-app', 'fix deps');
        tl.recordRollback('my-app', 'test failed');

        const stats = tl.getStats();
        assert.equal(stats.builds, 1);
        assert.equal(stats.failures, 1);
        assert.equal(stats.patches, 1);
        assert.equal(stats.rollbacks, 1);
    });

    test('should query by project', () => {
        const tl = new ExecutionTimeline();
        tl.recordBuild('app-a', 'success');
        tl.recordBuild('app-b', 'failed');
        tl.recordBuild('app-a', 'success');

        const results = tl.query({ project: 'app-a' });
        assert.equal(results.length, 2);
    });

    test('should compute trends', () => {
        const tl = new ExecutionTimeline();
        tl.recordBuild('app', 'success');
        tl.recordFailure('app', 'error');
        tl.recordBuild('app', 'success');

        const trends = tl.getTrends(3600000);
        assert.ok(trends.totalEvents >= 3);
        assert.ok(trends.failureRate >= 0);
    });

    test('should format timeline', () => {
        const tl = new ExecutionTimeline();
        tl.recordBuild('app', 'success');
        tl.recordFailure('app', 'crash');

        const formatted = tl.formatTimeline();
        assert.ok(formatted.includes('🔨'));
        assert.ok(formatted.includes('❌'));
    });
});

describe('StrategicEngine', () => {
    test('should instantiate', () => {
        const se = new StrategicEngine();
        assert.ok(se);
        assert.equal(se.getStats().proposalsGenerated, 0);
    });

    test('should analyze a project profile', async () => {
        const se = new StrategicEngine();
        const profile = {
            name: 'test-app',
            stack: { runtime: 'node', frameworks: ['React'], tools: [] },
            dependencies: { production: ['react', 'express'], development: [] },
            architecture: { patterns: [], hasTests: false, hasCI: false, graph: { fileCount: 60 } },
        };

        const analysis = await se.analyze(profile);

        assert.ok(analysis.proposals.length > 0);
        assert.ok(analysis.summary);
        assert.equal(analysis.project, 'test-app');
    });

    test('should detect missing security headers', async () => {
        const se = new StrategicEngine();
        const profile = {
            name: 'api-server',
            stack: { runtime: 'node', frameworks: ['Express'], tools: [] },
            dependencies: { production: ['express'], development: [] },
            architecture: { patterns: ['api-layer'], hasTests: true, hasCI: true },
        };

        const analysis = await se.analyze(profile);
        const securityProposal = analysis.proposals.find(p => p.type === 'security-headers');

        assert.ok(securityProposal);
        assert.equal(securityProposal.category, 'security');
    });

    test('should accept and reject proposals', async () => {
        const se = new StrategicEngine();
        const profile = {
            name: 'app',
            stack: { runtime: 'node', frameworks: [], tools: [] },
            dependencies: { production: ['express'], development: [] },
            architecture: { patterns: [], hasTests: false, hasCI: false },
        };

        const analysis = await se.analyze(profile);
        const proposal = analysis.proposals[0];

        const accepted = se.acceptProposal(proposal.id);
        assert.equal(accepted.status, 'accepted');

        const stats = se.getStats();
        assert.equal(stats.proposalsAccepted, 1);
    });
});

describe('ReasoningStream', () => {
    test('should instantiate', () => {
        const stream = new ReasoningStream();
        assert.ok(stream);
        assert.equal(stream.isActive, false);
    });

    test('should start and push messages', () => {
        const stream = new ReasoningStream();
        stream.start();
        assert.equal(stream.isActive, true);

        stream.streamAnalyze('project architecture');
        stream.streamReason('generating hypotheses', 0.8);
        stream.streamPlan('building execution plan');

        const recent = stream.getRecent(10);
        assert.equal(recent.length, 3);
        assert.ok(recent[0].formatted.includes('AI analyze'));
    });

    test('should support subscribers', () => {
        const stream = new ReasoningStream();
        stream.start();

        const messages = [];
        const unsub = stream.subscribe(msg => messages.push(msg));

        stream.streamExecute('running build');
        assert.equal(messages.length, 1);

        unsub();
        stream.streamExecute('another action');
        assert.equal(messages.length, 1); // unsubscribed
    });

    test('should connect to ThinkingEngine', async () => {
        const engine = new ThinkingEngine();
        const stream = new ReasoningStream();
        stream.start();
        stream.connectToThinkingEngine(engine);

        await engine.reason({ description: 'test problem' });

        const recent = stream.getRecent(50);
        assert.ok(recent.length > 0);
        assert.ok(recent.some(m => m.phase === 'start'));
        assert.ok(recent.some(m => m.phase === 'complete'));
    });

    test('should format output for CLI', () => {
        const stream = new ReasoningStream();
        stream.start();
        stream.streamObserve('scanning files');
        stream.streamValidate('checking results', 0.95);

        const output = stream.getFormattedOutput();
        assert.ok(output.includes('AI observe'));
        assert.ok(output.includes('AI validate'));
    });
});
