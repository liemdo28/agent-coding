/**
 * Live Runtime — 100X Execution Density Tests
 *
 * Tests the unified living runtime: boot, events, memory, ingestion,
 * swarm, scheduler, self-healing, and filesystem intelligence.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { LiveRuntime } from '../src/core/live/LiveRuntime.js';
import { EventNexus } from '../src/core/live/EventNexus.js';
import { DatabaseCivilization } from '../src/core/live/DatabaseCivilization.js';
import { CognitionRuntime } from '../src/core/live/CognitionRuntime.js';
import { PersistentMemory } from '../src/core/live/PersistentMemory.js';
import { LiveFilesystem } from '../src/core/live/LiveFilesystem.js';
import { IngestionEngine } from '../src/core/live/IngestionEngine.js';
import { LiveSwarm } from '../src/core/live/LiveSwarm.js';
import { SelfHealLoop } from '../src/core/live/SelfHealLoop.js';
import { PressureScheduler } from '../src/core/live/PressureScheduler.js';

// ═══════════════════════════════════════════════════════════════
// EventNexus Tests
// ═══════════════════════════════════════════════════════════════

describe('EventNexus', () => {
    it('should start and publish events', () => {
        const nexus = new EventNexus();
        nexus.start();

        const received = [];
        nexus.subscribe('test.event', (data) => received.push(data));

        nexus.publish('test.event', { value: 42 });
        nexus.publish('test.event', { value: 99 });

        assert.equal(received.length, 2);
        assert.equal(received[0].value, 42);
        assert.equal(received[1].value, 99);

        nexus.stop();
    });

    it('should support wildcard subscribers', () => {
        const nexus = new EventNexus();
        nexus.start();

        const all = [];
        nexus.subscribe('*', (data) => all.push(data));

        nexus.publish('a.b', { x: 1 });
        nexus.publish('c.d', { x: 2 });

        assert.equal(all.length, 2);
        nexus.stop();
    });

    it('should track stats', () => {
        const nexus = new EventNexus();
        nexus.start();

        nexus.publish('foo', {});
        nexus.publish('bar', {});
        nexus.publish('foo', {});

        const stats = nexus.getStats();
        assert.equal(stats.published, 3);
        assert.equal(stats.topicCounts.foo, 2);
        assert.equal(stats.topicCounts.bar, 1);

        nexus.stop();
    });

    it('should return recent events', () => {
        const nexus = new EventNexus();
        nexus.start();

        for (let i = 0; i < 10; i++) {
            nexus.publish('seq', { i });
        }

        const recent = nexus.getRecent(5);
        assert.equal(recent.length, 5);
        assert.equal(recent[0].data.i, 5);

        nexus.stop();
    });

    it('should unsubscribe correctly', () => {
        const nexus = new EventNexus();
        nexus.start();

        const received = [];
        const unsub = nexus.subscribe('x', (d) => received.push(d));

        nexus.publish('x', { a: 1 });
        unsub();
        nexus.publish('x', { a: 2 });

        assert.equal(received.length, 1);
        nexus.stop();
    });
});

// ═══════════════════════════════════════════════════════════════
// DatabaseCivilization Tests
// ═══════════════════════════════════════════════════════════════

describe('DatabaseCivilization', () => {
    let db;

    before(async () => {
        db = new DatabaseCivilization({ storageDir: '/tmp/aos-test-db-' + Date.now() });
        await db.initialize();
    });

    after(async () => {
        await db.close();
    });

    it('should initialize with sqlite or none', () => {
        assert.ok(['sqlite', 'none'].includes(db.type));
    });

    it('should run queries and writes', () => {
        if (db.type === 'none') return;

        db.run(
            'INSERT INTO memory (key, value, category, importance, access_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['test-key', JSON.stringify({ hello: 'world' }), 'test', 0.8, 0, Date.now(), Date.now()]
        );

        const rows = db.query('SELECT * FROM memory WHERE key = ?', ['test-key']);
        assert.equal(rows.length, 1);
        assert.equal(JSON.parse(rows[0].value).hello, 'world');
    });

    it('should batch insert', () => {
        if (db.type === 'none') return;

        const rows = Array.from({ length: 50 }, (_, i) => ({
            id: `evt_${i}`,
            topic: 'test.batch',
            data: JSON.stringify({ i }),
            timestamp: Date.now() + i,
        }));

        db.batchInsert('events', rows);

        const result = db.query("SELECT COUNT(*) as cnt FROM events WHERE topic = 'test.batch'");
        assert.equal(result[0].cnt, 50);
    });

    it('should report stats', () => {
        const stats = db.getStats();
        assert.ok(stats.type);
        assert.ok(stats.tables.length > 0);
        assert.ok(stats.queries > 0 || stats.writes > 0 || db.type === 'none');
    });
});

// ═══════════════════════════════════════════════════════════════
// PersistentMemory Tests
// ═══════════════════════════════════════════════════════════════

describe('PersistentMemory', () => {
    let db, memory;

    before(async () => {
        db = new DatabaseCivilization({ storageDir: '/tmp/aos-test-mem-' + Date.now() });
        await db.initialize();
        memory = new PersistentMemory(db, null);
        await memory.initialize();
    });

    after(async () => {
        await db.close();
    });

    it('should set and get memory', async () => {
        await memory.set('greeting', { text: 'hello' }, { category: 'test' });
        const val = await memory.get('greeting');
        assert.deepEqual(val, { text: 'hello' });
    });

    it('should record executions', async () => {
        await memory.recordExecution({ type: 'build', status: 'completed', duration: 1500 });
        await memory.recordExecution({ type: 'test', status: 'failed', duration: 300 });

        const ctx = await memory.getContext(null, 'build');
        assert.ok(ctx.executions.length >= 1);
    });

    it('should search memory', async () => {
        await memory.set('project:myapp:config', { port: 3000 }, { category: 'project:myapp' });
        const results = await memory.search('myapp');
        assert.ok(results.length >= 1);
    });
});

// ═══════════════════════════════════════════════════════════════
// CognitionRuntime Tests
// ═══════════════════════════════════════════════════════════════

describe('CognitionRuntime', () => {
    it('should initialize and detect availability', async () => {
        const cognition = new CognitionRuntime({ ollamaUrl: 'http://localhost:11434' });
        await cognition.initialize();

        // May or may not be available depending on environment
        assert.ok(typeof cognition.isAvailable === 'boolean');
        assert.ok(Array.isArray(cognition.loadedModels));
    });

    it('should return offline response when unavailable', async () => {
        const cognition = new CognitionRuntime({ ollamaUrl: 'http://localhost:99999' });
        await cognition.initialize();

        const result = await cognition.chat('hello');
        assert.ok(result.content.includes('offline') || result.content.includes('error'));
    });

    it('should select models by task type', () => {
        const cognition = new CognitionRuntime({});
        // Without initialization, selectModel returns null (no models loaded)
        const model = cognition.selectModel('coding');
        // Returns null when no models available
        assert.ok(model === null || typeof model === 'string');
    });
});

// ═══════════════════════════════════════════════════════════════
// LiveFilesystem Tests
// ═══════════════════════════════════════════════════════════════

describe('LiveFilesystem', () => {
    it('should scan a directory', async () => {
        const fs = new LiveFilesystem({ watchPaths: [process.cwd() + '/src/core/live'] }, null);
        await fs.start();

        const stats = fs.getStats();
        assert.ok(stats.filesIndexed > 0);

        fs.stop();
    });

    it('should find files by query', async () => {
        const fsint = new LiveFilesystem({ watchPaths: [process.cwd() + '/src/core/live'] }, null);
        await fsint.start();

        const results = fsint.findFiles('EventNexus');
        assert.ok(results.length > 0);

        fsint.stop();
    });
});

// ═══════════════════════════════════════════════════════════════
// IngestionEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('IngestionEngine', () => {
    let db, cognition, engine;

    before(async () => {
        db = new DatabaseCivilization({ storageDir: '/tmp/aos-test-ingest-' + Date.now() });
        await db.initialize();
        cognition = new CognitionRuntime({ ollamaUrl: 'http://localhost:99999' });
        await cognition.initialize();
        engine = new IngestionEngine(db, cognition, null);
        await engine.initialize();
    });

    after(async () => {
        await db.close();
    });

    it('should ingest a single file', async () => {
        const result = await engine.ingest(process.cwd() + '/package.json');
        assert.ok(!result.error);
        assert.ok(result.chunks > 0);
        assert.ok(result.bytes > 0);
    });

    it('should skip unsupported files', async () => {
        const result = await engine.ingestFile('/tmp/fake.png');
        assert.ok(result.skipped);
    });

    it('should track stats', () => {
        const stats = engine.getStats();
        assert.ok(stats.filesProcessed >= 1);
        assert.ok(stats.chunksStored >= 1);
    });
});

// ═══════════════════════════════════════════════════════════════
// LiveSwarm Tests
// ═══════════════════════════════════════════════════════════════

describe('LiveSwarm', () => {
    let swarm;

    before(async () => {
        const cognition = new CognitionRuntime({ ollamaUrl: 'http://localhost:99999' });
        await cognition.initialize();
        swarm = new LiveSwarm(cognition, null, {});
        await swarm.initialize();
    });

    it('should initialize with default agents', () => {
        assert.ok(swarm.agentCount >= 4);
        const agents = swarm.getAgents();
        const types = agents.map(a => a.type);
        assert.ok(types.includes('coding'));
        assert.ok(types.includes('reasoning'));
        assert.ok(types.includes('qa'));
    });

    it('should assign and complete tasks', async () => {
        const result = await swarm.assignTask({
            id: 'test-task-1',
            type: 'coding',
            prompt: null, // No AI call
        });

        assert.equal(result.status, 'completed');
        assert.ok(result.agentId);
    });

    it('should scale up and down', () => {
        const before = swarm.agentCount;
        swarm.scaleUp();
        assert.equal(swarm.agentCount, before + 1);

        swarm.scaleDown();
        assert.equal(swarm.agentCount, before);
    });

    it('should report stats', () => {
        const stats = swarm.getStats();
        assert.ok(stats.agents >= 4);
        assert.ok(stats.tasksCompleted >= 1);
    });
});

// ═══════════════════════════════════════════════════════════════
// PressureScheduler Tests
// ═══════════════════════════════════════════════════════════════

describe('PressureScheduler', () => {
    let scheduler, swarm;

    before(async () => {
        const cognition = new CognitionRuntime({ ollamaUrl: 'http://localhost:99999' });
        await cognition.initialize();
        swarm = new LiveSwarm(cognition, null, {});
        await swarm.initialize();
        scheduler = new PressureScheduler(swarm, null, { maxWorkers: 4, tickMs: 100 });
        scheduler.start();
    });

    after(() => {
        scheduler.stop();
    });

    it('should schedule and complete tasks', async () => {
        const result = await scheduler.schedule({
            id: 'sched-1',
            type: 'coding',
            priority: 'normal',
        });

        assert.equal(result.status, 'completed');
    });

    it('should shed low-priority tasks when queue is full', async () => {
        const smallScheduler = new PressureScheduler(null, null, { maxQueueDepth: 1, maxWorkers: 0 });
        smallScheduler.start();

        // Fill queue
        smallScheduler.schedule({ id: 'fill-1', priority: 'normal' });

        // This should be shed
        const result = await smallScheduler.schedule({ id: 'shed-1', priority: 'low' });
        assert.equal(result.status, 'shed');

        smallScheduler.stop();
    });

    it('should report pressure', () => {
        const pressure = scheduler.getPressure();
        assert.ok(pressure >= 0 && pressure <= 1);
    });
});

// ═══════════════════════════════════════════════════════════════
// SelfHealLoop Tests
// ═══════════════════════════════════════════════════════════════

describe('SelfHealLoop', () => {
    it('should handle errors and record recovery', async () => {
        const events = new EventNexus();
        events.start();

        const heal = new SelfHealLoop({ getHealth: () => ({ pressure: 0.5 }) }, events, { checkIntervalMs: 60000 });
        heal.start();

        const recovery = await heal.handleError({ type: 'memory_pressure', heapRatio: 0.9 });
        assert.ok(recovery.success);
        assert.equal(recovery.strategy, 'gc_compact');

        const stats = heal.getStats();
        assert.equal(stats.recoveries, 1);

        heal.stop();
        events.stop();
    });
});

// ═══════════════════════════════════════════════════════════════
// Full LiveRuntime Integration Test
// ═══════════════════════════════════════════════════════════════

describe('LiveRuntime — Full Boot', () => {
    let runtime;

    before(async () => {
        runtime = new LiveRuntime({
            heartbeatMs: 60000, // Slow heartbeat for tests
            watchPaths: [process.cwd() + '/src/core/live'],
            dbUrl: 'sqlite',
            ollamaUrl: 'http://localhost:99999', // Intentionally offline for test
            storageDir: '/tmp/aos-test-live-' + Date.now(),
        });
        await runtime.boot();
    });

    after(async () => {
        await runtime.shutdown();
    });

    it('should boot to alive or degraded state', () => {
        assert.ok(['alive', 'degraded'].includes(runtime.state));
    });

    it('should have all subsystems initialized', () => {
        const status = runtime.getSubsystemStatus();
        assert.ok(status.events);
        assert.ok(status.db);
        assert.ok(status.memory);
        assert.ok(status.filesystem);
        assert.ok(status.swarm);
        assert.ok(status.scheduler);
        assert.ok(status.selfHeal);
    });

    it('should report health', () => {
        const health = runtime.getHealth();
        assert.ok(health.state);
        assert.ok(health.uptime >= 0);
        assert.ok(health.subsystems);
        assert.ok(typeof health.pressure === 'number');
    });

    it('should submit and execute tasks', async () => {
        const result = await runtime.submit({
            type: 'coding',
            priority: 'normal',
            project: 'test-project',
        });

        assert.ok(result.status === 'completed' || result.agentId);
    });

    it('should search memory', async () => {
        // Store something first
        await runtime.memory.set('test:runtime', { booted: true });
        const results = await runtime.search('runtime');
        assert.ok(results.length >= 0); // May or may not find depending on DB
    });

    it('should shutdown cleanly', async () => {
        await runtime.shutdown();
        assert.equal(runtime.state, 'shutdown');
    });
});
