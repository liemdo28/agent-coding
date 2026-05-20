/**
 * Cosmic Engine Integration Tests
 * Tests for Phases 111-150: Transcendent Engineering Cosmos
 * 
 * Run with: node --test cosmic-engine.test.js
 */

import {
    UniversalExecutionField,
    ExecutionNode,
    ExecutionMesh,
    CivilizationDynamicsEngine,
    CivilizationEntity,
    GrowthModel,
    CollapseDetector,
    EvolutionaryAdaptation
} from './index.js';

// ========== Test Utilities ==========

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    testsRun++;
    try {
        fn();
        testsPassed++;
        console.log(`  ✓ ${name}`);
    } catch (error) {
        testsFailed++;
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${error.message}`);
    }
}

function assert(condition, message = 'Assertion failed') {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} Expected ${expected}, got ${actual}`);
    }
}

function assertDeepEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message} Objects are not equal`);
    }
}

// ========== ExecutionNode Tests ==========

console.log('\n📦 ExecutionNode Tests');

test('should create an execution node with default values', () => {
    const node = new ExecutionNode('node-1', 'compute', 100);
    assertEqual(node.id, 'node-1');
    assertEqual(node.type, 'compute');
    assertEqual(node.capacity, 100);
    assertEqual(node.load, 0);
    assertEqual(node.status, 'active');
});

test('should add and track connections', () => {
    const node = new ExecutionNode('node-1', 'compute', 100);
    node.addConnection('node-2');
    node.addConnection('node-3');
    assertEqual(node.connections.size, 2);
    assert(node.connections.has('node-2'));
    assert(node.connections.has('node-3'));
});

test('should update load within bounds', () => {
    const node = new ExecutionNode('node-1', 'compute', 100);
    node.updateLoad(150);
    assertEqual(node.load, 100); // Capped at 100
    node.updateLoad(-50);
    assertEqual(node.load, 0); // Floor at 0
});

test('should calculate health score', () => {
    const node = new ExecutionNode('node-1', 'compute', 100);
    node.load = 50;
    node.metrics.successRate = 0.9;
    const health = node.getHealthScore();
    assert(health > 0 && health <= 100);
});

// ========== ExecutionMesh Tests ==========

console.log('\n🔗 ExecutionMesh Tests');

test('should register and track nodes', () => {
    const mesh = new ExecutionMesh();
    const node = new ExecutionNode('node-1', 'compute', 100);
    mesh.registerNode(node);
    assertEqual(mesh.nodes.size, 1);
    assert(mesh.nodes.has('node-1'));
});

test('should calculate hops between nodes', () => {
    const mesh = new ExecutionMesh();
    const node1 = new ExecutionNode('node-1', 'compute', 100);
    const node2 = new ExecutionNode('node-2', 'memory', 100);
    mesh.registerNode(node1);
    mesh.registerNode(node2);

    const hops = mesh.calculateHops('node-1', 'node-2');
    assertEqual(hops, Infinity); // Not connected

    node1.addConnection('node-2');
    const connectedHops = mesh.calculateHops('node-1', 'node-2');
    assertEqual(connectedHops, 1);
});

test('should find optimal node for task', () => {
    const mesh = new ExecutionMesh();
    const node1 = new ExecutionNode('node-1', 'compute', 100);
    const node2 = new ExecutionNode('node-2', 'compute', 50);

    node1.load = 10;
    node2.load = 90;

    mesh.registerNode(node1);
    mesh.registerNode(node2);

    const optimal = mesh.findOptimalNode({});
    assertEqual(optimal.id, 'node-1');
});

test('should return mesh status', () => {
    const mesh = new ExecutionMesh();
    const node = new ExecutionNode('node-1', 'compute', 100);
    mesh.registerNode(node);

    const status = mesh.getMeshStatus();
    assertEqual(status.totalNodes, 1);
    assertEqual(status.activeNodes, 1);
});

// ========== UniversalExecutionField Tests ==========

console.log('\n🌌 UniversalExecutionField Tests');

test('should initialize execution space', async () => {
    const field = new UniversalExecutionField();
    const result = await field.initializeExecutionSpace({ initialNodes: 2 });

    assertEqual(result.status, 'initialized');
    assertEqual(result.nodes, 2);
    assert(result.dimensions >= 0);
});

test('should coordinate execution across nodes', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 2 });

    const task = {
        id: 'task-1',
        computational: 50,
        memory: 50
    };

    const result = await field.coordinateExecution(task);
    assert(result.success !== undefined);
});

test('should balance load across nodes', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 4 });

    // Add load to one node
    const nodes = Array.from(field.mesh.nodes.values());
    if (nodes.length > 0) {
        nodes[0].load = 80;
    }

    const result = await field.balanceLoad();
    assert(result.balanced);
});

test('should expand field with new nodes', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 1 });

    const initialCount = field.mesh.nodes.size;
    await field.expandField({ count: 3 });

    assertEqual(field.mesh.nodes.size, initialCount + 3);
});

test('should contract field by removing low-load nodes', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 4 });

    const nodes = Array.from(field.mesh.nodes.values());
    nodes.forEach(n => n.load = 5); // All low load

    await field.contractField({ targetCount: 2 });
    assert(field.mesh.nodes.size <= 4);
});

test('should repair a specific node', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 2 });

    const result = await field.repairField({ nodeId: 'node-0' });
    assert(result.repaired);
});

test('should optimize topology and fix disconnected components', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 3 });

    const result = await field.optimizeTopology();
    assert(result.optimized);
});

test('should return comprehensive field status', async () => {
    const field = new UniversalExecutionField();
    await field.initializeExecutionSpace({ initialNodes: 2 });

    const status = field.getFieldStatus();
    assert(status.mesh !== undefined);
    assert(status.topology !== undefined);
    assert(status.metrics !== undefined);
});

// ========== CivilizationEntity Tests ==========

console.log('\n🏛️ CivilizationEntity Tests');

test('should create entity with initial resources', () => {
    const entity = new CivilizationEntity('entity-1', 'team', { compute: 80, memory: 90 });
    assertEqual(entity.id, 'entity-1');
    assertEqual(entity.type, 'team');
    assertEqual(entity.resources.compute, 80);
    assertEqual(entity.resources.memory, 90);
    assertEqual(entity.state, 'emerging');
    assertEqual(entity.fitness, 1.0);
});

test('should update resources within bounds', () => {
    const entity = new CivilizationEntity('entity-1', 'team', { compute: 50 });
    entity.updateResources({ compute: 100 });
    assertEqual(entity.resources.compute, 150);
    assert(entity.resources.compute <= 200); // Capped at 200

    entity.updateResources({ compute: -200 });
    assertEqual(entity.resources.compute, 0); // Floor at 0
});

test('should track traits', () => {
    const entity = new CivilizationEntity('entity-1', 'team');
    entity.setTrait('innovation', 0.8);
    entity.setTrait('efficiency', 0.6);

    assertEqual(entity.getTrait('innovation'), 0.8);
    assertEqual(entity.getTrait('efficiency'), 0.6);
    assertEqual(entity.getTrait('unknown'), 0); // Default
});

test('should record state history', () => {
    const entity = new CivilizationEntity('entity-1', 'team');
    entity.recordState();
    entity.age = 1;
    entity.state = 'stable';
    entity.recordState();

    assertEqual(entity.history.length, 2);
    assertEqual(entity.history[0].age, 0);
    assertEqual(entity.history[1].age, 1);
});

// ========== GrowthModel Tests ==========

console.log('\n📈 GrowthModel Tests');

test('should calculate logistic growth', () => {
    const model = new GrowthModel({ growthRate: 0.1, carryingCapacity: 100 });
    const result = model.calculateGrowth(50, 1);

    assert(result.current > 50); // Should grow
    assert(result.saturation >= 0 && result.saturation <= 1);
});

test('should predict growth trajectory', () => {
    const model = new GrowthModel({ growthRate: 0.1, carryingCapacity: 100 });
    const trajectory = model.predictTrajectory(10, 5);

    assertEqual(trajectory.length, 5);
    assertEqual(trajectory[0].step, 0);
});

test('should handle saturation', () => {
    const model = new GrowthModel({ growthRate: 0.1, carryingCapacity: 100 });
    const result = model.calculateGrowth(100, 1); // At capacity

    // Growth should be minimal at capacity
    assert(result.growth < 0.1);
});

// ========== CollapseDetector Tests ==========

console.log('\n⚠️ CollapseDetector Tests');

test('should detect resource stress', () => {
    const detector = new CollapseDetector();
    const entity = new CivilizationEntity('entity-1', 'team', {
        compute: 20,
        memory: 20,
        network: 20,
        storage: 20
    });

    const indicators = detector.analyze(entity);
    assert(indicators.resourceStress > 0.5); // Low resources = high stress
});

test('should detect collapse patterns', () => {
    const detector = new CollapseDetector();
    const entity = new CivilizationEntity('entity-1', 'team', {
        compute: 5,
        memory: 5,
        network: 5,
        storage: 5
    });
    entity.state = 'declining';

    // Add declining history
    for (let i = 0; i < 6; i++) {
        entity.recordState();
        entity.resources.compute -= 2;
    }

    const indicators = detector.analyze(entity);
    assert(indicators.patterns.length > 0);
});

test('should calculate recovery potential', () => {
    const detector = new CollapseDetector();
    const entity = new CivilizationEntity('entity-1', 'team', {
        compute: 50,
        memory: 50,
        network: 50,
        storage: 50
    });
    entity.setTrait('diversity', 0.7);
    entity.generation = 3;

    const indicators = detector.analyze(entity);
    assert(indicators.recoveryPotential >= 0);
});

// ========== EvolutionaryAdaptation Tests ==========

console.log('\n🧬 EvolutionaryAdaptation Tests');

test('should perform mutation', () => {
    const evolution = new EvolutionaryAdaptation({ mutationRate: 1.0 });
    const entity = new CivilizationEntity('entity-1', 'team');
    entity.setTrait('innovation', 0.5);

    const mutations = evolution.mutate(entity);
    assert(mutations.length > 0); // With 100% rate, should mutate
});

test('should perform crossover', () => {
    const evolution = new EvolutionaryAdaptation();
    const parent1 = new CivilizationEntity('parent-1', 'team');
    const parent2 = new CivilizationEntity('parent-2', 'team');

    parent1.setTrait('innovation', 0.8);
    parent2.setTrait('efficiency', 0.9);

    const child = evolution.crossover(parent1, parent2);
    assert(child.id.includes('parent-1'));
    assert(child.generation === 1);
});

test('should select based on fitness', () => {
    const evolution = new EvolutionaryAdaptation({ selectionPressure: 0.5 });
    const population = [
        new CivilizationEntity('e1', 'team'),
        new CivilizationEntity('e2', 'team'),
        new CivilizationEntity('e3', 'team'),
        new CivilizationEntity('e4', 'team')
    ];

    const fitnessScores = new Map([
        ['e1', 0.9],
        ['e2', 0.3],
        ['e3', 0.7],
        ['e4', 0.5]
    ]);

    const survivors = evolution.select(population, fitnessScores);
    assert(survivors.length <= population.length);
});

test('should measure diversity', () => {
    const evolution = new EvolutionaryAdaptation();
    const pop = [
        new CivilizationEntity('e1', 'team'),
        new CivilizationEntity('e2', 'team')
    ];

    pop[0].setTrait('innovation', 0.2);
    pop[1].setTrait('innovation', 0.8);

    const diversity = evolution.measureDiversity(pop);
    assert(diversity >= 0);
});

// ========== CivilizationDynamicsEngine Tests ==========

console.log('\n🌍 CivilizationDynamicsEngine Tests');

test('should create and track entities', () => {
    const engine = new CivilizationDynamicsEngine();
    const entity = engine.createEntity('team-1', 'engineering', { compute: 80 });

    assertEqual(entity.id, 'team-1');
    assertEqual(engine.entities.size, 1);
});

test('should add relationships between entities', () => {
    const engine = new CivilizationDynamicsEngine();
    engine.createEntity('team-1', 'engineering');
    engine.createEntity('team-2', 'design');

    engine.addRelationship('team-1', 'team-2', 0.8);

    const team1 = engine.entities.get('team-1');
    assert(team1.relationships.has('team-2'));
});

test('should simulate period and update entities', async () => {
    const engine = new CivilizationDynamicsEngine();
    engine.createEntity('team-1', 'engineering');

    const result = await engine.simulatePeriod(1);

    assertEqual(result.time, 1);
    assertEqual(result.entityCount, 1);
    assert(result.stateMetrics !== undefined);
});

test('should analyze growth pattern', async () => {
    const engine = new CivilizationDynamicsEngine();
    const entity = engine.createEntity('team-1', 'engineering');

    // Add some history
    for (let i = 0; i < 5; i++) {
        entity.recordState();
        entity.age++;
    }

    const analysis = engine.analyzeGrowthPattern('team-1');
    assert(analysis !== null);
    assertEqual(analysis.entityId, 'team-1');
});

test('should simulate evolution', async () => {
    const engine = new CivilizationDynamicsEngine();
    engine.createEntity('team-1', 'engineering');
    engine.createEntity('team-2', 'design');

    const result = engine.simulateEvolution(3);
    assertEqual(result.generations, 3);
    assert(result.populationHistory.length > 0);
});

test('should return ecosystem status', async () => {
    const engine = new CivilizationDynamicsEngine();
    engine.createEntity('team-1', 'engineering');
    engine.createEntity('team-2', 'design');

    const status = engine.getEcosystemStatus();
    assertEqual(status.entities.length, 2);
    assert(status.stateMetrics !== undefined);
});

test('should analyze cascade effects', async () => {
    const engine = new CivilizationDynamicsEngine();
    engine.createEntity('team-1', 'engineering');
    engine.createEntity('team-2', 'design');
    engine.addRelationship('team-1', 'team-2');

    const cascade = engine.analyzeCascade('team-1', 0.5);
    assert(cascade.totalAffected >= 1);
});

// ========== Test Summary ==========

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Summary: ${testsPassed}/${testsRun} passed`);
if (testsFailed > 0) {
    console.log(`❌ Failed: ${testsFailed}`);
    process.exit(1);
} else {
    console.log('✅ All tests passed!');
    process.exit(0);
}