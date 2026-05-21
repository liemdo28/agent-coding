/**
 * ThinkingEngine.js — AI Cognition Core
 *
 * Implements the full reasoning pipeline:
 * Observe → Analyze → Reason → Plan → Simulate → Execute → Validate → Reflect → Learn
 *
 * Features:
 * - Reasoning graphs (step-by-step logical chains)
 * - Thought trees (hypothesis branching)
 * - Confidence estimation per action
 * - Rollback prediction
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * @typedef {'observe'|'analyze'|'reason'|'plan'|'simulate'|'execute'|'validate'|'reflect'|'learn'} CognitionPhase
 */

/**
 * @typedef {object} ThoughtNode
 * @property {string} id
 * @property {string} hypothesis
 * @property {number} confidence
 * @property {ThoughtNode[]} children
 * @property {string} status - 'pending'|'testing'|'validated'|'rejected'
 */

export class ThinkingEngine extends EventEmitter {
    #config;
    #memory;
    #observability;
    #activeReasoningChains = new Map();
    #stats = {
        totalThoughts: 0,
        completedChains: 0,
        averageConfidence: 0,
        hypothesesGenerated: 0,
        hypothesesValidated: 0,
        hypothesesRejected: 0,
    };

    /** @type {CognitionPhase[]} */
    static PHASES = ['observe', 'analyze', 'reason', 'plan', 'simulate', 'execute', 'validate', 'reflect', 'learn'];

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            maxDepth: config.maxDepth || 5,
            confidenceThreshold: config.confidenceThreshold || 0.7,
            maxHypotheses: config.maxHypotheses || 4,
            simulationEnabled: config.simulationEnabled !== false,
            ...config,
        };
        this.#memory = deps.memory;
        this.#observability = deps.observability;
    }

    /**
     * Execute a full reasoning chain for a given problem.
     * @param {object} problem - { description, context, constraints }
     * @returns {Promise<object>} reasoning result with plan and confidence
     */
    async reason(problem) {
        const chainId = randomUUID();
        const chain = {
            id: chainId,
            problem,
            startedAt: Date.now(),
            phases: [],
            thoughtTree: null,
            finalPlan: null,
            confidence: 0,
        };

        this.#activeReasoningChains.set(chainId, chain);
        this.#stats.totalThoughts++;
        this.emit('reasoning:start', { chainId, problem: problem.description });

        try {
            // Phase 1: OBSERVE — gather raw signals
            const observations = await this.#observe(problem);
            chain.phases.push({ phase: 'observe', result: observations, timestamp: Date.now() });
            this.emit('reasoning:phase', { chainId, phase: 'observe', result: observations });

            // Phase 2: ANALYZE — structure the observations
            const analysis = await this.#analyze(observations, problem);
            chain.phases.push({ phase: 'analyze', result: analysis, timestamp: Date.now() });
            this.emit('reasoning:phase', { chainId, phase: 'analyze', result: analysis });

            // Phase 3: REASON — generate hypotheses (thought tree)
            const thoughtTree = await this.#generateThoughtTree(analysis, problem);
            chain.thoughtTree = thoughtTree;
            chain.phases.push({ phase: 'reason', result: { hypotheses: thoughtTree.children.length }, timestamp: Date.now() });
            this.emit('reasoning:phase', { chainId, phase: 'reason', result: thoughtTree });

            // Phase 4: PLAN — select best hypothesis and build execution plan
            const plan = await this.#plan(thoughtTree, analysis);
            chain.phases.push({ phase: 'plan', result: plan, timestamp: Date.now() });
            this.emit('reasoning:phase', { chainId, phase: 'plan', result: plan });

            // Phase 5: SIMULATE — predict outcomes
            let simulation = null;
            if (this.#config.simulationEnabled) {
                simulation = await this.#simulate(plan, problem);
                chain.phases.push({ phase: 'simulate', result: simulation, timestamp: Date.now() });
                this.emit('reasoning:phase', { chainId, phase: 'simulate', result: simulation });
            }

            // Phase 6: Compute final confidence
            const confidence = this.#computeConfidence(plan, simulation, analysis);
            chain.confidence = confidence;
            chain.finalPlan = plan;

            // Phase 7: REFLECT — what did we learn?
            const reflection = this.#reflect(chain);
            chain.phases.push({ phase: 'reflect', result: reflection, timestamp: Date.now() });
            this.emit('reasoning:phase', { chainId, phase: 'reflect', result: reflection });

            // Phase 8: LEARN — persist insights
            await this.#learn(chain);
            chain.phases.push({ phase: 'learn', result: { persisted: true }, timestamp: Date.now() });

            this.#stats.completedChains++;
            this.#updateAverageConfidence(confidence.overall);

            const result = {
                chainId,
                plan: plan.steps,
                confidence,
                thoughtTree: this.#serializeThoughtTree(thoughtTree),
                phases: chain.phases.map(p => ({ phase: p.phase, timestamp: p.timestamp })),
                duration: Date.now() - chain.startedAt,
            };

            this.emit('reasoning:complete', result);
            this.#observability?.record('cognition.reasoning.complete', {
                chainId,
                confidence: confidence.overall,
                duration: result.duration,
            });

            return result;
        } catch (error) {
            this.emit('reasoning:error', { chainId, error: error.message });
            throw error;
        } finally {
            this.#activeReasoningChains.delete(chainId);
        }
    }

    /**
     * Generate a thought tree for a specific analysis.
     * Returns the tree structure for visualization.
     */
    async generateThoughtTree(analysis, problem) {
        return this.#generateThoughtTree(analysis, problem);
    }

    /**
     * Estimate confidence for a proposed action.
     * @param {object} action - { type, target, parameters }
     * @returns {object} { confidence, risk, rollback_probability }
     */
    estimateConfidence(action) {
        const baseConfidence = this.#getBaseConfidence(action.type);
        const contextModifier = action.context ? 0.1 : -0.1;
        const historyModifier = action.previousSuccess ? 0.15 : 0;

        const confidence = Math.min(1, Math.max(0, baseConfidence + contextModifier + historyModifier));
        const risk = 1 - confidence;
        const rollbackProbability = risk * 0.6; // 60% of risk translates to rollback need

        return {
            confidence: Math.round(confidence * 100) / 100,
            risk: Math.round(risk * 100) / 100,
            rollback_probability: Math.round(rollbackProbability * 100) / 100,
        };
    }

    // --- Internal Cognition Phases ---

    async #observe(problem) {
        const observations = {
            type: this.#classifyProblem(problem),
            signals: [],
            context: problem.context || {},
        };

        // Extract signals from problem description
        if (problem.description) {
            observations.signals.push(...this.#extractSignals(problem.description));
        }

        // Check memory for related past observations
        if (this.#memory && problem.project) {
            const history = await this.#memory.getContext(problem.project, observations.type);
            observations.history = history;
        }

        return observations;
    }

    async #analyze(observations, problem) {
        const analysis = {
            problemType: observations.type,
            complexity: this.#estimateComplexity(observations),
            relatedPatterns: [],
            constraints: problem.constraints || [],
            dependencies: [],
        };

        // Check for known failure patterns
        if (this.#memory) {
            const patterns = await this.#memory.getFailurePatterns(observations.type);
            analysis.relatedPatterns = patterns.slice(0, 5);
        }

        // Identify dependencies
        if (observations.signals.length > 0) {
            analysis.dependencies = this.#identifyDependencies(observations.signals);
        }

        return analysis;
    }

    async #generateThoughtTree(analysis, problem) {
        const root = {
            id: randomUUID(),
            hypothesis: problem.description,
            confidence: 0,
            children: [],
            status: 'pending',
            depth: 0,
        };

        // Generate hypotheses based on problem type
        const hypotheses = this.#generateHypotheses(analysis, problem);
        this.#stats.hypothesesGenerated += hypotheses.length;

        for (const hyp of hypotheses.slice(0, this.#config.maxHypotheses)) {
            const node = {
                id: randomUUID(),
                hypothesis: hyp.description,
                confidence: hyp.confidence,
                children: [],
                status: 'testing',
                depth: 1,
                approach: hyp.approach,
                estimatedEffort: hyp.effort,
            };

            // Generate sub-hypotheses for complex problems
            if (analysis.complexity > 0.6 && node.confidence < 0.9) {
                const subHypotheses = this.#refineHypothesis(node, analysis);
                node.children = subHypotheses;
            }

            root.children.push(node);
        }

        // Score and rank
        root.children.sort((a, b) => b.confidence - a.confidence);
        if (root.children.length > 0) {
            root.children[0].status = 'validated';
            this.#stats.hypothesesValidated++;
            root.children.slice(1).forEach(c => {
                if (c.confidence < this.#config.confidenceThreshold) {
                    c.status = 'rejected';
                    this.#stats.hypothesesRejected++;
                }
            });
        }

        return root;
    }

    async #plan(thoughtTree, analysis) {
        const bestHypothesis = thoughtTree.children[0];
        if (!bestHypothesis) {
            return { steps: [], confidence: 0, approach: 'none' };
        }

        const steps = this.#buildExecutionSteps(bestHypothesis, analysis);

        return {
            approach: bestHypothesis.approach || 'direct',
            hypothesis: bestHypothesis.hypothesis,
            steps,
            estimatedDuration: steps.reduce((sum, s) => sum + (s.estimatedMs || 1000), 0),
            rollbackPlan: this.#buildRollbackPlan(steps),
        };
    }

    async #simulate(plan, problem) {
        // Simulate execution without side effects
        const simulation = {
            predictedOutcome: 'success',
            risks: [],
            sideEffects: [],
            estimatedDuration: plan.estimatedDuration,
        };

        for (const step of plan.steps) {
            const risk = this.#assessStepRisk(step);
            if (risk.level > 0.5) {
                simulation.risks.push({ step: step.description, ...risk });
            }
            if (risk.sideEffects?.length) {
                simulation.sideEffects.push(...risk.sideEffects);
            }
        }

        if (simulation.risks.length > plan.steps.length * 0.5) {
            simulation.predictedOutcome = 'risky';
        }

        return simulation;
    }

    #reflect(chain) {
        return {
            totalPhases: chain.phases.length,
            confidence: chain.confidence,
            hypothesesExplored: chain.thoughtTree?.children?.length || 0,
            selectedApproach: chain.finalPlan?.approach,
            lessonsLearned: this.#extractLessons(chain),
        };
    }

    async #learn(chain) {
        if (!this.#memory) return;

        // Store successful reasoning patterns
        if (chain.confidence?.overall > 0.8) {
            await this.#memory.setProjectMemory(
                chain.problem.project || '_global',
                `reasoning:${chain.problem.description?.slice(0, 50)}`,
                {
                    approach: chain.finalPlan?.approach,
                    confidence: chain.confidence.overall,
                    timestamp: Date.now(),
                }
            );
        }
    }

    // --- Helpers ---

    #classifyProblem(problem) {
        const desc = (problem.description || '').toLowerCase();
        if (desc.includes('build') || desc.includes('compile')) return 'build';
        if (desc.includes('test') || desc.includes('spec')) return 'test';
        if (desc.includes('deploy') || desc.includes('release')) return 'deploy';
        if (desc.includes('fix') || desc.includes('bug') || desc.includes('error')) return 'fix';
        if (desc.includes('refactor') || desc.includes('clean')) return 'refactor';
        if (desc.includes('feature') || desc.includes('add') || desc.includes('implement')) return 'feature';
        if (desc.includes('performance') || desc.includes('optimize')) return 'optimize';
        return 'general';
    }

    #extractSignals(description) {
        const signals = [];
        const patterns = [
            { regex: /error[:\s]+(.+)/i, type: 'error' },
            { regex: /failed?\s+(?:to\s+)?(.+)/i, type: 'failure' },
            { regex: /(?:next\.?js|react|vue|angular|express)/i, type: 'framework' },
            { regex: /(?:npm|yarn|pnpm)\s+(.+)/i, type: 'package-manager' },
            { regex: /(?:typescript|ts)\s*(.+)?/i, type: 'language' },
            { regex: /(?:websocket|ws|socket)/i, type: 'protocol' },
            { regex: /(?:postgres|mysql|sqlite|mongo)/i, type: 'database' },
            { regex: /(?:auth|login|session|jwt|oauth)/i, type: 'auth' },
        ];

        for (const { regex, type } of patterns) {
            const match = description.match(regex);
            if (match) {
                signals.push({ type, value: match[1] || match[0], raw: match[0] });
            }
        }

        return signals;
    }

    #estimateComplexity(observations) {
        let complexity = 0.3; // base
        if (observations.signals.length > 3) complexity += 0.2;
        if (observations.history?.recentExecutions?.length > 5) complexity += 0.1;
        if (observations.type === 'deploy') complexity += 0.2;
        if (observations.type === 'refactor') complexity += 0.15;
        return Math.min(1, complexity);
    }

    #identifyDependencies(signals) {
        return signals
            .filter(s => ['framework', 'database', 'protocol'].includes(s.type))
            .map(s => ({ type: s.type, value: s.value }));
    }

    #generateHypotheses(analysis, problem) {
        const hypotheses = [];
        const type = analysis.problemType;

        const strategies = {
            build: [
                { description: 'Dependency resolution issue', approach: 'dependency-fix', confidence: 0.7, effort: 'low' },
                { description: 'Configuration mismatch', approach: 'config-fix', confidence: 0.6, effort: 'low' },
                { description: 'Source code compilation error', approach: 'code-fix', confidence: 0.5, effort: 'medium' },
            ],
            fix: [
                { description: 'Known pattern match from history', approach: 'pattern-match', confidence: 0.8, effort: 'low' },
                { description: 'Root cause in dependency chain', approach: 'dependency-trace', confidence: 0.6, effort: 'medium' },
                { description: 'Logic error requiring refactor', approach: 'refactor', confidence: 0.4, effort: 'high' },
            ],
            test: [
                { description: 'Test environment misconfiguration', approach: 'env-fix', confidence: 0.7, effort: 'low' },
                { description: 'Assertion logic incorrect', approach: 'assertion-fix', confidence: 0.5, effort: 'medium' },
            ],
            deploy: [
                { description: 'Environment variable missing', approach: 'env-config', confidence: 0.7, effort: 'low' },
                { description: 'Build artifact issue', approach: 'rebuild', confidence: 0.6, effort: 'medium' },
                { description: 'Infrastructure configuration', approach: 'infra-fix', confidence: 0.5, effort: 'high' },
            ],
            general: [
                { description: 'Direct implementation', approach: 'direct', confidence: 0.6, effort: 'medium' },
                { description: 'Incremental approach', approach: 'incremental', confidence: 0.7, effort: 'medium' },
            ],
        };

        const typeStrategies = strategies[type] || strategies.general;
        hypotheses.push(...typeStrategies);

        // Boost confidence if we have matching patterns from memory
        if (analysis.relatedPatterns.length > 0) {
            hypotheses[0].confidence = Math.min(1, hypotheses[0].confidence + 0.15);
        }

        return hypotheses;
    }

    #refineHypothesis(node, analysis) {
        // Generate sub-hypotheses for deeper exploration
        return [
            {
                id: randomUUID(),
                hypothesis: `${node.hypothesis} — verify preconditions`,
                confidence: node.confidence * 0.9,
                children: [],
                status: 'pending',
                depth: 2,
            },
            {
                id: randomUUID(),
                hypothesis: `${node.hypothesis} — check side effects`,
                confidence: node.confidence * 0.8,
                children: [],
                status: 'pending',
                depth: 2,
            },
        ];
    }

    #buildExecutionSteps(hypothesis, analysis) {
        const steps = [];
        const approach = hypothesis.approach;

        // Common pre-steps
        steps.push({
            id: randomUUID(),
            description: 'Validate environment and prerequisites',
            type: 'validate',
            estimatedMs: 500,
            critical: true,
        });

        // Approach-specific steps
        switch (approach) {
            case 'dependency-fix':
                steps.push(
                    { id: randomUUID(), description: 'Analyze dependency tree', type: 'analyze', estimatedMs: 2000 },
                    { id: randomUUID(), description: 'Identify conflicting versions', type: 'diagnose', estimatedMs: 1000 },
                    { id: randomUUID(), description: 'Generate resolution patch', type: 'patch', estimatedMs: 1500 },
                    { id: randomUUID(), description: 'Apply and verify fix', type: 'execute', estimatedMs: 3000 },
                );
                break;
            case 'pattern-match':
                steps.push(
                    { id: randomUUID(), description: 'Match against known patterns', type: 'match', estimatedMs: 500 },
                    { id: randomUUID(), description: 'Apply known fix', type: 'execute', estimatedMs: 2000 },
                );
                break;
            case 'config-fix':
                steps.push(
                    { id: randomUUID(), description: 'Scan configuration files', type: 'scan', estimatedMs: 1000 },
                    { id: randomUUID(), description: 'Detect misconfiguration', type: 'diagnose', estimatedMs: 1000 },
                    { id: randomUUID(), description: 'Apply configuration fix', type: 'execute', estimatedMs: 1500 },
                );
                break;
            default:
                steps.push(
                    { id: randomUUID(), description: `Execute ${approach} strategy`, type: 'execute', estimatedMs: 5000 },
                );
        }

        // Common post-steps
        steps.push({
            id: randomUUID(),
            description: 'Validate result and run tests',
            type: 'validate',
            estimatedMs: 3000,
            critical: true,
        });

        return steps;
    }

    #buildRollbackPlan(steps) {
        return steps
            .filter(s => s.type === 'execute' || s.type === 'patch')
            .map(s => ({
                stepId: s.id,
                rollbackAction: `Revert: ${s.description}`,
                automated: true,
            }));
    }

    #assessStepRisk(step) {
        const riskMap = {
            validate: { level: 0.1, sideEffects: [] },
            analyze: { level: 0.1, sideEffects: [] },
            diagnose: { level: 0.1, sideEffects: [] },
            scan: { level: 0.1, sideEffects: [] },
            match: { level: 0.1, sideEffects: [] },
            patch: { level: 0.5, sideEffects: ['file modification'] },
            execute: { level: 0.4, sideEffects: ['state change'] },
        };
        return riskMap[step.type] || { level: 0.3, sideEffects: [] };
    }

    #computeConfidence(plan, simulation, analysis) {
        let overall = 0.5;

        // Plan quality
        if (plan.steps.length > 0) overall += 0.2;
        if (plan.rollbackPlan.length > 0) overall += 0.1;

        // Simulation results
        if (simulation) {
            if (simulation.predictedOutcome === 'success') overall += 0.15;
            if (simulation.risks.length === 0) overall += 0.1;
            overall -= simulation.risks.length * 0.05;
        }

        // Historical patterns
        if (analysis.relatedPatterns.length > 0) overall += 0.1;

        overall = Math.min(1, Math.max(0, overall));

        return {
            overall: Math.round(overall * 100) / 100,
            risk: Math.round((1 - overall) * 100) / 100,
            rollback_probability: Math.round((1 - overall) * 0.6 * 100) / 100,
        };
    }

    #extractLessons(chain) {
        const lessons = [];
        if (chain.confidence?.overall > 0.8) {
            lessons.push('High confidence approach — reuse pattern');
        }
        if (chain.thoughtTree?.children?.length > 2) {
            lessons.push('Multiple hypotheses explored — complex problem');
        }
        return lessons;
    }

    #getBaseConfidence(actionType) {
        const map = {
            build: 0.75,
            test: 0.8,
            lint: 0.9,
            deploy: 0.6,
            fix: 0.65,
            refactor: 0.6,
            feature: 0.55,
        };
        return map[actionType] || 0.5;
    }

    #serializeThoughtTree(tree) {
        if (!tree) return null;
        return {
            id: tree.id,
            hypothesis: tree.hypothesis,
            confidence: tree.confidence,
            status: tree.status,
            children: tree.children.map(c => this.#serializeThoughtTree(c)),
        };
    }

    #updateAverageConfidence(newConfidence) {
        const total = this.#stats.completedChains;
        this.#stats.averageConfidence =
            (this.#stats.averageConfidence * (total - 1) + newConfidence) / total;
    }

    getStats() {
        return { ...this.#stats, activeChains: this.#activeReasoningChains.size };
    }

    getActiveChains() {
        return Array.from(this.#activeReasoningChains.values()).map(c => ({
            id: c.id,
            problem: c.problem.description,
            phases: c.phases.length,
            startedAt: c.startedAt,
        }));
    }
}
