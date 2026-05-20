// local-agent/cosmic-engine/CivilizationDynamicsEngine.js
/**
 * Phase 112: AI Organizational Cosmology
 * Models organizational lifecycle: growth, collapse, evolution, civilization dynamics
 */

export class CivilizationEntity {
    constructor(id, type, initialResources = {}) {
        this.id = id;
        this.type = type;
        this.resources = {
            compute: initialResources.compute || 100,
            memory: initialResources.memory || 100,
            network: initialResources.network || 100,
            storage: initialResources.storage || 100
        };
        this.state = 'emerging';
        this.age = 0;
        this.generation = 0;
        this.traits = new Map();
        this.history = [];
        this.fitness = 1.0;
        this.relationships = new Map();
    }

    updateResources(delta) {
        for (const [key, value] of Object.entries(delta)) {
            if (this.resources[key] !== undefined) {
                this.resources[key] = Math.max(0, Math.min(200, this.resources[key] + value));
            }
        }
    }

    setTrait(trait, value) {
        this.traits.set(trait, value);
    }

    getTrait(trait) {
        return this.traits.get(trait) || 0;
    }

    recordState() {
        this.history.push({
            age: this.age,
            state: this.state,
            resources: { ...this.resources },
            fitness: this.fitness,
            traits: Object.fromEntries(this.traits)
        });
    }
}

export class GrowthModel {
    constructor(config = {}) {
        this.config = {
            growthRate: config.growthRate || 0.1,
            carryingCapacity: config.carryingCapacity || 1000,
            saturationThreshold: config.saturationThreshold || 0.8,
            ...config
        };
    }

    calculateGrowth(current, deltaTime = 1) {
        const r = this.config.growthRate;
        const K = this.config.carryingCapacity;

        // Logistic growth model
        const growth = r * current * (1 - current / K);
        const newValue = current + growth * deltaTime;

        return {
            current: newValue,
            growth,
            saturation: current / K,
            carryingCapacity: K
        };
    }

    predictTrajectory(initial, steps = 10) {
        const trajectory = [];
        let current = initial;

        for (let i = 0; i < steps; i++) {
            const result = this.calculateGrowth(current, 1);
            trajectory.push({
                step: i,
                value: result.current,
                saturation: result.saturation
            });
            current = result.current;
        }

        return trajectory;
    }
}

export class CollapseDetector {
    constructor(config = {}) {
        this.config = {
            resourceThreshold: config.resourceThreshold || 20,
            fitnessDeclineRate: config.fitnessDeclineRate || 0.1,
            cascadeFactor: config.cascadeFactor || 0.5,
            historyWindow: config.historyWindow || 10,
            ...config
        };

        this.collapseIndicators = new Map();
    }

    analyze(entity) {
        const indicators = {
            resourceStress: this.calculateResourceStress(entity),
            fitnessDecline: this.calculateFitnessDecline(entity),
            cascadeRisk: this.calculateCascadeRisk(entity),
            recoveryPotential: this.calculateRecoveryPotential(entity),
            collapseProbability: 0
        };

        // Calculate collapse probability
        const factors = [
            indicators.resourceStress,
            indicators.fitnessDecline,
            indicators.cascadeRisk
        ];

        indicators.collapseProbability = this.weightedAverage(factors, [0.4, 0.3, 0.3]);

        // Detect specific collapse patterns
        indicators.patterns = this.detectCollapsePatterns(entity);

        this.collapseIndicators.set(entity.id, indicators);

        return indicators;
    }

    calculateResourceStress(entity) {
        const resources = Object.values(entity.resources);
        const avgResource = resources.reduce((a, b) => a + b, 0) / resources.length;
        const minResource = Math.min(...resources);

        // Stress increases as resources decrease
        const avgStress = 1 - (avgResource / 100);
        const minStress = 1 - (minResource / 100);

        return (avgStress * 0.6 + minStress * 0.4);
    }

    calculateFitnessDecline(entity) {
        if (entity.history.length < 2) return 0;

        const recentHistory = entity.history.slice(-this.config.historyWindow);
        if (recentHistory.length < 2) return 0;

        const firstFitness = recentHistory[0].fitness;
        const lastFitness = recentHistory[recentHistory.length - 1].fitness;

        // Decline rate over the window
        const declineRate = (firstFitness - lastFitness) / this.config.historyWindow;
        return Math.min(1, Math.max(0, declineRate * 10));
    }

    calculateCascadeRisk(entity) {
        // How many relationships are stressed
        let stressedRelationships = 0;
        let totalRelationships = 0;

        for (const [partnerId, relationship] of entity.relationships) {
            totalRelationships++;
            if (relationship.stress > 0.5) {
                stressedRelationships++;
            }
        }

        if (totalRelationships === 0) return 0;

        return stressedRelationships / totalRelationships;
    }

    calculateRecoveryPotential(entity) {
        // Positive factors for recovery
        const geneticDiversity = entity.getTrait('diversity') || 0;
        const resourceBuffer = Math.min(...Object.values(entity.resources)) / 100;
        const generationBonus = Math.min(entity.generation * 0.05, 0.5);

        return (geneticDiversity * 0.4 + resourceBuffer * 0.4 + generationBonus * 0.2);
    }

    detectCollapsePatterns(entity) {
        const patterns = [];

        // Check for specific collapse patterns
        if (entity.state === 'declining' && entity.history.length > 5) {
            const recentResources = entity.history.slice(-5).map(h =>
                Object.values(h.resources).reduce((a, b) => a + b, 0) / 4
            );

            // Continuous decline
            const isDeclining = recentResources.every((r, i) =>
                i === 0 || r < recentResources[i - 1]
            );

            if (isDeclining) {
                patterns.push({
                    type: 'continuous_decline',
                    severity: 'high',
                    description: 'Resources declining continuously for 5+ periods'
                });
            }
        }

        // Resource exhaustion
        const exhaustedResources = Object.entries(entity.resources)
            .filter(([_, value]) => value < 10)
            .map(([key]) => key);

        if (exhaustedResources.length > 0) {
            patterns.push({
                type: 'resource_exhaustion',
                severity: 'critical',
                resources: exhaustedResources,
                description: `Critical resource depletion: ${exhaustedResources.join(', ')}`
            });
        }

        return patterns;
    }

    weightedAverage(values, weights) {
        const sum = values.reduce((acc, val, i) => acc + val * weights[i], 0);
        return sum / weights.reduce((a, b) => a + b, 0);
    }
}

export class EvolutionaryAdaptation {
    constructor(config = {}) {
        this.config = {
            mutationRate: config.mutationRate || 0.1,
            crossoverRate: config.crossoverRate || 0.7,
            selectionPressure: config.selectionPressure || 0.3,
            diversityTarget: config.diversityTarget || 0.5,
            ...config
        };

        this.populationHistory = [];
    }

    mutate(entity) {
        const mutations = [];

        for (const [trait, value] of entity.traits) {
            if (Math.random() < this.config.mutationRate) {
                const mutation = (Math.random() - 0.5) * 0.2;
                const newValue = Math.max(0, Math.min(1, value + mutation));
                entity.setTrait(trait, newValue);
                mutations.push({ trait, oldValue: value, newValue });
            }
        }

        return mutations;
    }

    crossover(parent1, parent2) {
        const child = new CivilizationEntity(
            `${parent1.id}-${parent2.id}-child`,
            parent1.type
        );

        child.generation = Math.max(parent1.generation, parent2.generation) + 1;

        // Inherit traits
        for (const [trait, value] of parent1.traits) {
            if (Math.random() < this.config.crossoverRate) {
                child.setTrait(trait, value);
            } else {
                child.setTrait(trait, parent2.getTrait(trait));
            }
        }

        // Initial resources from both parents
        for (const resource of Object.keys(child.resources)) {
            child.resources[resource] = (
                parent1.resources[resource] + parent2.resources[resource]
            ) / 2;
        }

        return child;
    }

    select(population, fitnessScores) {
        const evaluated = population.map((entity, i) => ({
            entity,
            fitness: fitnessScores.get(entity.id) || entity.fitness
        }));

        // Sort by fitness
        evaluated.sort((a, b) => b.fitness - a.fitness);

        // Apply selection pressure - keep top performers
        const survivalRate = 1 - this.config.selectionPressure;
        const survivors = evaluated.slice(0, Math.ceil(population.length * survivalRate));

        return survivors.map(s => s.entity);
    }

    calculateFitness(entity, environment) {
        let fitness = 0;

        // Resource utilization
        const resourceScore = Object.values(entity.resources)
            .reduce((a, b) => a + b, 0) / (Object.keys(entity.resources).length * 100);
        fitness += resourceScore * 0.3;

        // Trait fitness based on environment
        for (const [trait, value] of entity.traits) {
            const envValue = environment.getTrait(trait) || 0.5;
            const traitFitness = 1 - Math.abs(value - envValue);
            fitness += traitFitness * 0.2;
        }

        // Relationship health
        let relationshipScore = 1;
        for (const [_, rel] of entity.relationships) {
            relationshipScore *= (1 - rel.stress);
        }
        fitness += relationshipScore * 0.2;

        // State-based modifiers
        if (entity.state === 'thriving') fitness *= 1.2;
        if (entity.state === 'declining') fitness *= 0.8;

        return Math.max(0, Math.min(2, fitness));
    }

    measureDiversity(population) {
        if (population.length < 2) return 0;

        let totalDistance = 0;
        let comparisons = 0;

        for (let i = 0; i < population.length; i++) {
            for (let j = i + 1; j < population.length; j++) {
                totalDistance += this.calculateEntityDistance(population[i], population[j]);
                comparisons++;
            }
        }

        return comparisons > 0 ? totalDistance / comparisons : 0;
    }

    calculateEntityDistance(entity1, entity2) {
        let distance = 0;
        let dimensions = 0;

        // Trait distance
        for (const [trait, value1] of entity1.traits) {
            const value2 = entity2.getTrait(trait);
            distance += Math.pow(value1 - value2, 2);
            dimensions++;
        }

        // Resource distance
        for (const resource of Object.keys(entity1.resources)) {
            distance += Math.pow(
                entity1.resources[resource] - entity2.resources[resource],
                2
            );
            dimensions++;
        }

        return Math.sqrt(distance / dimensions);
    }

    evolve(population, environment, generations = 1) {
        const results = [];

        for (let g = 0; g < generations; g++) {
            // Calculate fitness for all entities
            const fitnessScores = new Map();
            for (const entity of population) {
                fitnessScores.set(entity.id, this.calculateFitness(entity, environment));
            }

            // Record population state
            this.populationHistory.push({
                generation: g,
                populationSize: population.length,
                avgFitness: Array.from(fitnessScores.values()).reduce((a, b) => a + b, 0) / population.length,
                diversity: this.measureDiversity(population)
            });

            // Selection
            const survivors = this.select(population, fitnessScores);

            // Create next generation
            const nextGeneration = [...survivors];

            while (nextGeneration.length < population.length) {
                // Tournament selection for parents
                const parent1 = this.tournamentSelect(survivors, fitnessScores, 3);
                const parent2 = this.tournamentSelect(survivors, fitnessScores, 3);

                if (parent1 && parent2) {
                    const child = this.crossover(parent1, parent2);
                    this.mutate(child);
                    nextGeneration.push(child);
                }
            }

            population = nextGeneration;
            results.push({ generation: g, population });
        }

        return results;
    }

    tournamentSelect(population, fitnessScores, tournamentSize) {
        const tournament = [];
        for (let i = 0; i < tournamentSize && i < population.length; i++) {
            tournament.push(population[Math.floor(Math.random() * population.length)]);
        }

        return tournament.reduce((best, current) => {
            const currentFitness = fitnessScores.get(current.id) || current.fitness;
            const bestFitness = fitnessScores.get(best.id) || best.fitness;
            return currentFitness > bestFitness ? current : best;
        });
    }
}

export class EcosystemInterdependencies {
    constructor() {
        this.dependencies = new Map();
        this.resourceFlows = new Map();
        this.cascadeGraph = new Map();
    }

    addDependency(from, to, strength = 1) {
        if (!this.dependencies.has(from)) {
            this.dependencies.set(from, new Map());
        }
        this.dependencies.get(from).set(to, { strength });

        // Build cascade graph
        if (!this.cascadeGraph.has(from)) {
            this.cascadeGraph.set(from, []);
        }
        this.cascadeGraph.get(from).push(to);
    }

    getDependencies(entityId) {
        return this.dependencies.get(entityId) || new Map();
    }

    simulateResourceFlow(from, to, amount) {
        const flow = {
            from,
            to,
            amount,
            efficiency: 0.95,
            latency: 1
        };

        const flowId = `${from}-${to}-${Date.now()}`;
        this.resourceFlows.set(flowId, flow);

        return flow;
    }

    analyzeCascade(entityId, shockMagnitude = 0.5) {
        const affected = new Set([entityId]);
        const cascade = [];
        const queue = [entityId];

        while (queue.length > 0) {
            const current = queue.shift();
            const dependents = this.cascadeGraph.get(current) || [];

            for (const dependent of dependents) {
                if (!affected.has(dependent)) {
                    affected.add(dependent);
                    queue.push(dependent);

                    const dependency = this.dependencies.get(current)?.get(dependent);
                    const strength = dependency?.strength || 1;

                    cascade.push({
                        entity: dependent,
                        shock: shockMagnitude * strength,
                        distance: affected.size - 1
                    });
                }
            }
        }

        return {
            totalAffected: affected.size,
            cascade,
            criticalEntities: cascade.filter(c => c.shock > 0.7).map(c => c.entity)
        };
    }

    identifyKeystoneEntities() {
        const keystone = [];

        // An entity is keystone if removing it causes cascade
        for (const [entityId] of this.dependencies) {
            let dependents = 0;

            for (const [from, deps] of this.dependencies) {
                if (deps.has(entityId)) dependents++;
            }

            if (dependents > 3) {
                keystone.push({
                    entity: entityId,
                    dependentCount: dependents,
                    criticality: dependents / this.dependencies.size
                });
            }
        }

        return keystone.sort((a, b) => b.criticality - a.criticality);
    }
}

export class CivilizationStateTracker {
    constructor() {
        this.states = new Map();
        this.transitions = [];
        this.stateMetrics = {
            thriving: 0,
            stable: 0,
            emerging: 0,
            declining: 0,
            collapsed: 0
        };
    }

    updateState(entity) {
        const oldState = entity.state;
        const newState = this.calculateState(entity);

        if (oldState !== newState) {
            this.transitions.push({
                entityId: entity.id,
                from: oldState,
                to: newState,
                timestamp: Date.now(),
                resources: { ...entity.resources }
            });
            entity.state = newState;
        }

        this.states.set(entity.id, newState);
        this.updateMetrics();

        return { oldState, newState, changed: oldState !== newState };
    }

    calculateState(entity) {
        const avgResource = Object.values(entity.resources)
            .reduce((a, b) => a + b, 0) / Object.keys(entity.resources).length;
        const fitness = entity.fitness;

        if (avgResource < 10 || fitness < 0.2) return 'collapsed';
        if (avgResource < 30 || fitness < 0.4) return 'declining';
        if (avgResource > 80 && fitness > 0.8) return 'thriving';
        if (avgResource > 50 && fitness > 0.6) return 'stable';
        return 'emerging';
    }

    updateMetrics() {
        this.stateMetrics = {
            thriving: 0,
            stable: 0,
            emerging: 0,
            declining: 0,
            collapsed: 0
        };

        for (const [_, state] of this.states) {
            this.stateMetrics[state]++;
        }
    }

    getMetrics() {
        return {
            ...this.stateMetrics,
            totalEntities: this.states.size,
            recentTransitions: this.transitions.slice(-10)
        };
    }
}

export class CivilizationDynamicsEngine {
    constructor(config = {}) {
        this.growthModel = new GrowthModel(config.growth);
        this.collapseDetector = new CollapseDetector(config.collapse);
        this.evolutionaryAdaptation = new EvolutionaryAdaptation(config.evolution);
        this.ecosystem = new EcosystemInterdependencies();
        this.stateTracker = new CivilizationStateTracker();

        this.entities = new Map();
        this.environment = new CivilizationEntity('environment', 'environment');
        this.time = 0;
    }

    createEntity(id, type, resources) {
        const entity = new CivilizationEntity(id, type, resources);
        this.entities.set(id, entity);
        return entity;
    }

    addRelationship(fromId, toId, strength = 1) {
        const from = this.entities.get(fromId);
        const to = this.entities.get(toId);

        if (from && to) {
            from.relationships.set(toId, { strength, stress: 0 });
            to.relationships.set(fromId, { strength, stress: 0 });
            this.ecosystem.addDependency(fromId, toId, strength);
        }
    }

    async simulatePeriod(deltaTime = 1) {
        const events = [];

        for (const [id, entity] of this.entities) {
            // Update growth
            const growthResult = this.growthModel.calculateGrowth(
                entity.getTrait('population') || 100,
                deltaTime
            );
            entity.setTrait('population', growthResult.current);

            // Update resources based on growth
            const resourceGrowth = (growthResult.growth / 100) * deltaTime;
            entity.updateResources({
                compute: resourceGrowth * 10,
                memory: resourceGrowth * 8,
                network: resourceGrowth * 5,
                storage: resourceGrowth * 12
            });

            // Analyze collapse risk
            const collapseRisk = this.collapseDetector.analyze(entity);

            if (collapseRisk.collapseProbability > 0.7) {
                events.push({
                    type: 'collapse_warning',
                    entity: id,
                    probability: collapseRisk.collapseProbability,
                    patterns: collapseRisk.patterns
                });
            }

            // Update state
            const stateChange = this.stateTracker.updateState(entity);
            if (stateChange.changed) {
                events.push({
                    type: 'state_transition',
                    ...stateChange
                });
            }

            // Record history
            entity.recordState();
            entity.age += deltaTime;
        }

        this.time += deltaTime;

        return {
            time: this.time,
            entityCount: this.entities.size,
            stateMetrics: this.stateTracker.getMetrics(),
            events
        };
    }

    analyzeGrowthPattern(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return null;

        const history = entity.history.slice(-20);
        if (history.length < 2) return null;

        // Calculate growth metrics
        const populations = history.map(h => h.fitness || 0);
        const growthRates = [];

        for (let i = 1; i < populations.length; i++) {
            growthRates.push(populations[i] - populations[i - 1]);
        }

        const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;

        // Predict trajectory
        const trajectory = this.growthModel.predictTrajectory(
            populations[populations.length - 1] || 1,
            10
        );

        return {
            entityId,
            currentPopulation: populations[populations.length - 1],
            avgGrowthRate,
            trajectory,
            collapseRisk: this.collapseDetector.analyze(entity),
            state: entity.state
        };
    }

    simulateEvolution(generations = 10) {
        const population = Array.from(this.entities.values());

        const results = this.evolutionaryAdaptation.evolve(
            population,
            this.environment,
            generations
        );

        // Update entities with evolved population
        for (const result of results) {
            for (const entity of result.population) {
                this.entities.set(entity.id, entity);
            }
        }

        return {
            generations,
            populationHistory: this.evolutionaryAdaptation.populationHistory,
            finalDiversity: this.evolutionaryAdaptation.measureDiversity(population)
        };
    }

    getEcosystemStatus() {
        return {
            entities: Array.from(this.entities.values()).map(e => ({
                id: e.id,
                type: e.type,
                state: e.state,
                resources: e.resources,
                fitness: e.fitness,
                age: e.age
            })),
            stateMetrics: this.stateTracker.getMetrics(),
            keystoneEntities: this.ecosystem.identifyKeystoneEntities(),
            interdependencies: Array.from(this.ecosystem.dependencies.entries()).map(([from, deps]) => ({
                from,
                to: Array.from(deps.keys())
            }))
        };
    }

    analyzeCascade(entityId, shockMagnitude = 0.5) {
        return this.ecosystem.analyzeCascade(entityId, shockMagnitude);
    }
}

export default CivilizationDynamicsEngine;