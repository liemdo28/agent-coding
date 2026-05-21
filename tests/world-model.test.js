/**
 * World Model Tests — Engineering Reality Intelligence
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
    WorkspaceGraph,
    ProjectDNA,
    CausalGraph,
    ReasoningTrace,
} from '../src/core/world-model/index.js';

// Helper: create a temp workspace with fake projects
function createTempWorkspace() {
    const root = join(tmpdir(), `aos-test-${Date.now()}`);
    mkdirSync(root, { recursive: true });

    // Project A: Node.js with Express
    const projA = join(root, 'api-server');
    mkdirSync(projA);
    mkdirSync(join(projA, '.git'));
    writeFileSync(join(projA, '.git', 'HEAD'), 'ref: refs/heads/main');
    writeFileSync(join(projA, 'package.json'), JSON.stringify({
        name: 'api-server',
        description: 'REST API service',
        dependencies: { express: '^4.18.0', pg: '^8.0.0' },
        devDependencies: { jest: '^29.0.0' },
        scripts: { test: 'jest', start: 'node index.js' },
    }));
    writeFileSync(join(projA, 'README.md'), '# API Server\nA REST API');
    mkdirSync(join(projA, 'tests'));

    // Project B: Next.js frontend
    const projB = join(root, 'web-app');
    mkdirSync(projB);
    mkdirSync(join(projB, '.git'));
    writeFileSync(join(projB, '.git', 'HEAD'), 'ref: refs/heads/main');
    writeFileSync(join(projB, 'package.json'), JSON.stringify({
        name: 'web-app',
        description: 'Customer portal',
        dependencies: { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0' },
        scripts: { dev: 'next dev', build: 'next build' },
    }));
    writeFileSync(join(projB, 'tsconfig.json'), '{}');
    writeFileSync(join(projB, 'README.md'), '# Web App');

    return root;
}

describe('WorkspaceGraph', () => {
    test('should scan a workspace and discover projects', async () => {
        const root = createTempWorkspace();
        const graph = new WorkspaceGraph();

        const result = await graph.scan(root);

        assert.ok(result.nodes.length >= 2);
        assert.ok(result.summary.totalProjects >= 2);
        rmSync(root, { recursive: true, force: true });
    });

    test('should detect project languages', async () => {
        const root = createTempWorkspace();
        const graph = new WorkspaceGraph();
        await graph.scan(root);

        const webApp = graph.getProject('web-app');
        assert.equal(webApp.language, 'typescript');

        const apiServer = graph.getProject('api-server');
        assert.equal(apiServer.language, 'javascript');
        rmSync(root, { recursive: true, force: true });
    });

    test('should detect frameworks', async () => {
        const root = createTempWorkspace();
        const graph = new WorkspaceGraph();
        await graph.scan(root);

        const webApp = graph.getProject('web-app');
        assert.ok(webApp.frameworks.includes('Next.js'));

        const api = graph.getProject('api-server');
        assert.ok(api.frameworks.includes('Express'));
        rmSync(root, { recursive: true, force: true });
    });

    test('should query projects by dependency', async () => {
        const root = createTempWorkspace();
        const graph = new WorkspaceGraph();
        await graph.scan(root);

        const pgProjects = graph.findByDependency('pg');
        assert.equal(pgProjects.length, 1);
        assert.equal(pgProjects[0].name, 'api-server');
        rmSync(root, { recursive: true, force: true });
    });

    test('should find shared dependencies', async () => {
        const root = createTempWorkspace();
        const graph = new WorkspaceGraph();
        await graph.scan(root);

        const result = graph.getGraph();
        assert.ok(Array.isArray(result.summary.sharedDependencies));
        rmSync(root, { recursive: true, force: true });
    });
});

describe('ProjectDNA', () => {
    test('should generate a DNA profile', () => {
        const dna = new ProjectDNA();
        const profile = dna.generateProfile({
            name: 'test-app',
            path: '/tmp/test-app',
            language: 'typescript',
            type: 'frontend',
            frameworks: ['Next.js'],
            dependencies: ['react', 'next', 'typescript'],
            status: 'active',
            files: ['README.md', 'package.json', 'tsconfig.json', 'tests'],
            description: 'Customer portal',
            metrics: { scripts: ['dev', 'build', 'test', 'lint', 'deploy', 'ci'] },
        });

        assert.ok(profile.health.score > 0);
        assert.ok(profile.risk.score >= 0);
        assert.ok(profile.architecture.type);
        assert.ok(profile.maturity.level);
        assert.ok(profile.summary);
    });

    test('should assess health correctly', () => {
        const dna = new ProjectDNA();

        // Healthy project
        const healthy = dna.generateProfile({
            name: 'healthy',
            path: '/tmp/healthy',
            language: 'typescript',
            type: 'backend',
            frameworks: ['Express'],
            dependencies: ['express', 'helmet'],
            status: 'active',
            files: ['README.md', 'tests', '.github'],
        });

        // Unhealthy project
        const unhealthy = dna.generateProfile({
            name: 'unhealthy',
            path: '/tmp/unhealthy',
            language: 'javascript',
            type: 'library',
            frameworks: [],
            dependencies: new Array(120).fill('dep'),
            status: 'dead',
            files: [],
        });

        assert.ok(healthy.health.score > unhealthy.health.score);
    });

    test('should rank projects by risk', () => {
        const dna = new ProjectDNA();

        dna.generateProfile({ name: 'safe', path: '/a', language: 'typescript', status: 'active', files: ['tests', 'README.md'], dependencies: ['express', 'helmet'] });
        dna.generateProfile({ name: 'risky', path: '/b', language: 'javascript', status: 'dead', files: [], dependencies: new Array(90).fill('x') });

        const ranked = dna.rankByRisk();
        assert.equal(ranked[0].project, 'risky');
    });

    test('should compare projects', () => {
        const dna = new ProjectDNA();
        dna.generateProfile({ name: 'a', path: '/a', language: 'typescript', status: 'active', files: ['tests'], dependencies: [] });
        dna.generateProfile({ name: 'b', path: '/b', language: 'javascript', status: 'dead', files: [], dependencies: [] });

        const comparison = dna.compare('a', 'b');
        assert.ok(comparison);
        assert.ok(comparison.health.a > comparison.health.b);
    });
});

describe('CausalGraph', () => {
    test('should have builtin patterns', () => {
        const cg = new CausalGraph();
        const patterns = cg.getPatterns();
        assert.ok(patterns.length >= 10);
    });

    test('should predict effects from a cause', () => {
        const cg = new CausalGraph();
        const predictions = cg.predict('memory-leak');

        assert.ok(predictions.length > 0);
        assert.ok(predictions.some(p => p.effect === 'worker-crash'));
    });

    test('should trace causal chains', () => {
        const cg = new CausalGraph();
        const chain = cg.getChain('dependency-duplication');

        assert.ok(chain.steps.length > 0);
        assert.equal(chain.root, 'dependency-duplication');
        // Should trace: dep-dup → build-slowdown → queue-saturation → sla-degradation
        assert.ok(chain.steps.some(s => s.cause === 'dependency-duplication'));
    });

    test('should explain effects', () => {
        const cg = new CausalGraph();
        const causes = cg.explain('worker-crash');

        assert.ok(causes.length > 0);
        assert.ok(causes.some(c => c.cause === 'memory-leak'));
    });

    test('should observe events and update counts', () => {
        const cg = new CausalGraph();
        cg.observe('memory-leak', { project: 'test' });
        cg.observe('memory-leak', { project: 'test' });

        const patterns = cg.getPatterns();
        const memLeak = patterns.find(p => p.cause === 'memory-leak');
        assert.equal(memLeak.observedCount, 2);
    });

    test('should register custom patterns', () => {
        const cg = new CausalGraph();
        cg.registerPattern({
            cause: 'api-timeout',
            effect: 'user-churn',
            probability: 0.6,
            description: 'Slow APIs lose users',
        });

        const predictions = cg.predict('api-timeout');
        assert.ok(predictions.some(p => p.effect === 'user-churn'));
    });
});

describe('ReasoningTrace', () => {
    test('should record traces', () => {
        const rt = new ReasoningTrace();
        const trace = rt.record({
            type: 'patch',
            decision: 'Apply dependency fix',
            reasoning: ['Detected missing module', 'Found in npm registry', 'No conflicts'],
            confidence: 0.9,
            project: 'my-app',
        });

        assert.ok(trace.id);
        assert.equal(trace.type, 'patch');
        assert.equal(trace.confidence, 0.9);
    });

    test('should explain decisions', () => {
        const rt = new ReasoningTrace();
        const trace = rt.record({
            type: 'rollback',
            decision: 'Rollback deployment',
            reasoning: ['QA failed', 'Error rate spiked', 'SLA at risk'],
            confidence: 0.85,
            alternatives: [
                { description: 'Hotfix', reason: 'too risky' },
                { description: 'Ignore', reason: 'SLA breach' },
            ],
        });

        const explanation = rt.explain(trace.id);
        assert.ok(explanation.explanation.includes('Rollback deployment'));
        assert.ok(explanation.explanation.includes('QA failed'));
        assert.ok(explanation.explanation.includes('Hotfix'));
    });

    test('should query traces', () => {
        const rt = new ReasoningTrace();
        rt.record({ type: 'patch', decision: 'Fix A', confidence: 0.9, project: 'app-1' });
        rt.record({ type: 'scale', decision: 'Scale up', confidence: 0.7, project: 'app-2' });
        rt.record({ type: 'patch', decision: 'Fix B', confidence: 0.6, project: 'app-1' });

        const patches = rt.query({ type: 'patch' });
        assert.equal(patches.length, 2);

        const highConf = rt.query({ minConfidence: 0.8 });
        assert.equal(highConf.length, 1);
    });

    test('should track outcomes and accuracy', () => {
        const rt = new ReasoningTrace();
        const t1 = rt.record({ type: 'patch', decision: 'Fix 1', confidence: 0.9 });
        const t2 = rt.record({ type: 'patch', decision: 'Fix 2', confidence: 0.8 });
        const t3 = rt.record({ type: 'patch', decision: 'Fix 3', confidence: 0.7 });

        rt.recordOutcome(t1.id, 'success');
        rt.recordOutcome(t2.id, 'success');
        rt.recordOutcome(t3.id, 'failure');

        const accuracy = rt.getAccuracy('patch');
        assert.equal(accuracy.sampleSize, 3);
        assert.ok(accuracy.accuracy > 0.6);
    });

    test('should explain latest by type', () => {
        const rt = new ReasoningTrace();
        rt.record({ type: 'scale', decision: 'Scale up workers', confidence: 0.8 });
        rt.record({ type: 'scale', decision: 'Scale down workers', confidence: 0.7 });

        const latest = rt.explainLatest('scale');
        assert.ok(latest.decision === 'Scale down workers');
    });
});
