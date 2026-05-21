/**
 * Execution Fabric Tests
 *
 * Tests the Realtime Autonomous Execution Layer:
 * - EventStreamCore
 * - WorkerSwarm
 * - ExecutionPressure
 * - ReflexEngine
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    EventStreamCore,
    WorkerSwarm,
    ExecutionPressure,
    ReflexEngine,
} from '../src/core/fabric/index.js';

describe('EventStreamCore', () => {
    test('should instantiate and start', () => {
        const stream = new EventStreamCore();
        stream.start();
        assert.ok(stream);
        stream.stop();
    });

    test('should publish and subscribe to events', () => {
        const stream = new EventStreamCore();
        stream.start();
        const received = [];

        stream.subscribe('BUILD_FAILED', (event) => received.push(event));
        stream.publish('BUILD_FAILED', { project: 'test' });
        stream.publish('BUILD_FAILED', { project: 'test2' });

        assert.equal(received.length, 2);
        assert.equal(received[0].topic, 'BUILD_FAILED');
        assert.equal(received[0].payload.project, 'test');
        stream.stop();
    });

    test('should support wildcard subscribers', () => {
        const stream = new EventStreamCore();
        stream.start();
        const all = [];

        stream.subscribeAll((event) => all.push(event));
        stream.publish('TASK_CREATED', { id: '1' });
        stream.publish('BUILD_FAILED', { id: '2' });

        assert.equal(all.length, 2);
        stream.stop();
    });

    test('should unsubscribe correctly', () => {
        const stream = new EventStreamCore();
        stream.start();
        const received = [];

        const unsub = stream.subscribe('TEST', (e) => received.push(e));
        stream.publish('TEST', {});
        unsub();
        stream.publish('TEST', {});

        assert.equal(received.length, 1);
        stream.stop();
    });

    test('should read events from log', () => {
        const stream = new EventStreamCore();
        stream.start();

        stream.publish('A', { n: 1 });
        stream.publish('B', { n: 2 });
        stream.publish('A', { n: 3 });

        const allA = stream.read({ topic: 'A' });
        assert.equal(allA.length, 2);

        const latest = stream.latest(2);
        assert.equal(latest.length, 2);
        assert.equal(latest[1].topic, 'A');
        stream.stop();
    });

    test('should create consumer groups', () => {
        const stream = new EventStreamCore();
        stream.start();

        const group = stream.createConsumerGroup('worker-1');

        stream.publish('TASK', { id: 1 });
        stream.publish('TASK', { id: 2 });

        const batch1 = group.read(10);
        assert.equal(batch1.length, 2);

        group.ack(batch1[1].sequence);

        stream.publish('TASK', { id: 3 });
        const batch2 = group.read(10);
        assert.equal(batch2.length, 1);
        assert.equal(batch2[0].payload.id, 3);
        stream.stop();
    });

    test('should track stats', () => {
        const stream = new EventStreamCore();
        stream.start();

        stream.publish('X', {});
        stream.publish('Y', {});
        stream.publish('X', {});

        const stats = stream.getStats();
        assert.equal(stats.totalEvents, 3);
        assert.equal(stats.topicCounts.X, 2);
        assert.equal(stats.topicCounts.Y, 1);
        stream.stop();
    });
});

describe('WorkerSwarm', () => {
    test('should initialize with minimum workers', () => {
        const swarm = new WorkerSwarm({ minWorkers: 3 });
        swarm.initialize();

        assert.equal(swarm.size, 3);
        assert.equal(swarm.getSaturation(), 0);
    });

    test('should spawn and kill workers', () => {
        const swarm = new WorkerSwarm({ maxWorkers: 5 });
        const w1 = swarm.spawn('build');
        const w2 = swarm.spawn('test');

        assert.equal(swarm.size, 2);
        assert.ok(w1.id);
        assert.equal(w1.role, 'build');

        swarm.kill(w1.id, 'test');
        assert.equal(swarm.size, 1);
    });

    test('should not exceed max workers', () => {
        const swarm = new WorkerSwarm({ maxWorkers: 2 });
        swarm.spawn('a');
        swarm.spawn('b');
        const overflow = swarm.spawn('c');

        assert.equal(overflow, null);
        assert.equal(swarm.size, 2);
    });

    test('should assign tasks to workers', () => {
        const swarm = new WorkerSwarm({ minWorkers: 2 });
        swarm.initialize();

        const worker = swarm.assign({ id: 'task-1', type: 'build' });
        assert.ok(worker);
        assert.equal(worker.state, 'working');
        assert.equal(swarm.getSaturation(), 0.5);
    });

    test('should complete tasks and update metrics', () => {
        const swarm = new WorkerSwarm({ minWorkers: 1 });
        swarm.initialize();

        const worker = swarm.assign({ id: 'task-1', type: 'build' });
        swarm.complete(worker.id, { status: 'success', duration: 1000, taskId: 'task-1' });

        const all = swarm.getAll();
        assert.equal(all[0].state, 'idle');
        assert.equal(all[0].tasksProcessed, 1);
    });

    test('should redistribute workers', () => {
        const swarm = new WorkerSwarm({ minWorkers: 2, maxWorkers: 6, spawnThreshold: 0.5 });
        swarm.initialize();

        // Make all workers busy
        const workers = swarm.getAll();
        for (const w of workers) {
            swarm.assign({ id: `task-${w.id}`, type: 'general' });
        }

        // Redistribute should spawn more
        swarm.redistribute();
        assert.ok(swarm.size > 2);
    });

    test('should provide swarm summary', () => {
        const swarm = new WorkerSwarm({ minWorkers: 3 });
        swarm.initialize();

        const summary = swarm.getSummary();
        assert.equal(summary.total, 3);
        assert.equal(summary.byState.idle, 3);
        assert.equal(summary.saturation, 0);
    });
});

describe('ExecutionPressure', () => {
    test('should instantiate', () => {
        const pressure = new ExecutionPressure();
        assert.ok(pressure);
        assert.equal(pressure.getStats().currentPressure, 0);
    });

    test('should evaluate pressure', () => {
        const pressure = new ExecutionPressure();
        const result = pressure.evaluate();

        assert.ok('level' in result);
        assert.ok('status' in result);
        assert.ok('factors' in result);
        assert.equal(result.status, 'normal');
    });

    test('should track pressure history', () => {
        const pressure = new ExecutionPressure();
        pressure.evaluate();
        pressure.evaluate();
        pressure.evaluate();

        const history = pressure.getHistory();
        assert.equal(history.length, 3);
    });

    test('should respond to event stream pressure', () => {
        const stream = new EventStreamCore();
        stream.start();

        const swarm = new WorkerSwarm({ minWorkers: 2, maxWorkers: 8 });
        swarm.initialize();

        const pressure = new ExecutionPressure({}, {
            eventStream: stream,
            workerSwarm: swarm,
        });
        pressure.start();

        // Simulate failures to increase pressure
        stream.publish('BUILD_FAILED', {});
        stream.publish('BUILD_FAILED', {});
        stream.publish('WORKER_CRASHED', {});

        const stats = pressure.getStats();
        assert.ok(stats.currentPressure > 0);

        pressure.stop();
        stream.stop();
    });

    test('should classify pressure levels', () => {
        const pressure = new ExecutionPressure({
            highPressureThreshold: 0.7,
            criticalPressureThreshold: 0.9,
        });

        // Force pressure level for testing
        pressure.evaluate();
        const result = pressure.getPressure();
        assert.ok(['normal', 'elevated', 'high', 'critical'].includes(result.status));
    });
});

describe('ReflexEngine', () => {
    test('should instantiate with built-in reflexes', () => {
        const reflex = new ReflexEngine();
        assert.ok(reflex);
        assert.equal(reflex.getStats().registeredReflexes, 5);
    });

    test('should trigger worker-crash reflex', async () => {
        const stream = new EventStreamCore();
        stream.start();

        const swarm = new WorkerSwarm({ minWorkers: 2, maxWorkers: 8 });
        swarm.initialize();

        const reflex = new ReflexEngine({}, {
            eventStream: stream,
            workerSwarm: swarm,
        });
        reflex.start();

        // Trigger worker crash
        stream.publish('WORKER_CRASHED', { workerId: 'dead-worker' });

        // Give async recovery time to complete
        await new Promise(r => setTimeout(r, 50));

        const stats = reflex.getStats();
        assert.ok(stats.reflexesTriggered >= 1);
        assert.ok(stats.successfulRecoveries >= 1);

        reflex.stop();
        stream.stop();
    });

    test('should register custom reflexes', async () => {
        const reflex = new ReflexEngine();
        let recovered = false;

        reflex.registerReflex('custom-test', {
            trigger: 'CUSTOM_EVENT',
            recover: async () => {
                recovered = true;
                return { action: 'custom-recovery' };
            },
        });

        const result = await reflex.triggerReflex('custom-test', { data: 'test' });
        assert.ok(recovered);
        assert.equal(result.action, 'custom-recovery');
    });

    test('should handle recovery timeout', async () => {
        const reflex = new ReflexEngine({ recoveryTimeout: 50 });

        reflex.registerReflex('slow-reflex', {
            trigger: 'SLOW',
            recover: async () => {
                await new Promise(r => setTimeout(r, 200));
                return { action: 'too-slow' };
            },
        });

        const result = await reflex.triggerReflex('slow-reflex');
        assert.equal(result, null); // Timed out

        const stats = reflex.getStats();
        assert.equal(stats.failedRecoveries, 1);
    });

    test('should emit reflex events', async () => {
        const reflex = new ReflexEngine();
        const events = [];

        reflex.on('reflex:triggered', (e) => events.push(e));
        reflex.on('reflex:recovered', (e) => events.push(e));

        reflex.registerReflex('emit-test', {
            trigger: 'TEST',
            recover: async () => ({ ok: true }),
        });

        await reflex.triggerReflex('emit-test');

        assert.ok(events.some(e => e.reflex === 'emit-test'));
    });
});
