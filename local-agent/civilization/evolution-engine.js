/**
 * Phase 30: AI Civilization Core - Evolution Engine
 * AI improves prompts, architecture, routing, planning, execution continuously
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * @typedef {Object} EvolutionEntry
 * @property {string} id
 * @property {string} type
 * @property {string} originalPrompt
 * @property {string} evolvedPrompt
 * @property {number} originalScore
 * @property {number} evolvedScore
 * @property {number} improvement
 * @property {string[]} techniques
 * @property {string} createdAt
 * @property {number} iterations
 */

/**
 * @typedef {Object} EvolutionStats
 * @property {number} totalEvolutions
 * @property {number} successfulEvolutions
 * @property {number} averageImprovement
 * @property {Object} byType
 */

const DEFAULT_EVOLUTION_DB_PATH = join(homedir(), '.local-agent', 'evolution');
const EVOLUTION_CACHE = new Map();

/**
 * Initialize evolution engine
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Initialization result
 */
export async function initializeEvolutionEngine(options = {}) {
    const dbPath = options.dbPath || DEFAULT_EVOLUTION_DB_PATH;

    try {
        await mkdir(dbPath, { recursive: true });
        await loadEvolutionCache(dbPath);

        return {
            success: true,
            dbPath,
            entriesLoaded: EVOLUTION_CACHE.size,
            initializedAt: new Date().toISOString()
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Load evolution cache from disk
 */
async function loadEvolutionCache(dbPath) {
    try {
        const files = await readdir(dbPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = await readFile(join(dbPath, file), 'utf-8');
                    const entry = JSON.parse(content);
                    EVOLUTION_CACHE.set(entry.id, entry);
                } catch (e) {
                    // Skip corrupted entries
                }
            }
        }
    } catch (err) {
        // Directory doesn't exist yet
    }
}

/**
 * Evolve a prompt based on outcomes
 * @param {string} promptId - Prompt identifier
 * @param {Object} outcome - Execution outcome
 * @param {Object} options - Evolution options
 * @returns {Promise<Object>} Evolution result
 */
export async function evolvePrompt(promptId, outcome, options = {}) {
    const {
        techniques = ['simplification', 'clarification', 'context-enrichment'],
        maxIterations = 5
    } = options;

    try {
        // Get current prompt
        const currentEntry = EVOLUTION_CACHE.get(promptId);
        const currentPrompt = currentEntry?.evolvedPrompt || currentEntry?.originalPrompt || promptId;
        const currentScore = outcome.score || 0.5;

        // Apply evolution techniques
        const evolvedPrompt = applyEvolutionTechniques(currentPrompt, outcome, techniques);

        // Calculate improvement
        const improvement = currentScore > 0 ? (outcome.score - currentScore) / currentScore : 0;

        // Create evolution entry
        const entry = {
            id: promptId,
            type: 'prompt',
            originalPrompt: currentEntry?.originalPrompt || currentPrompt,
            evolvedPrompt,
            originalScore: currentScore,
            evolvedScore: outcome.score || 0.5,
            improvement,
            techniquesUsed: techniques,
            outcome: {
                success: outcome.success,
                errors: outcome.errors,
                feedback: outcome.feedback
            },
            createdAt: new Date().toISOString(),
            iterations: (currentEntry?.iterations || 0) + 1
        };

        EVOLUTION_CACHE.set(promptId, entry);

        // Persist to disk
        await writeFile(
            join(DEFAULT_EVOLUTION_DB_PATH, `${promptId.replace(/[^a-z0-9]/gi, '_')}.json`),
            JSON.stringify(entry, null, 2)
        );

        return {
            success: true,
            promptId,
            evolvedPrompt,
            improvement,
            iterations: entry.iterations,
            techniquesUsed: techniques
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Apply evolution techniques to a prompt
 */
function applyEvolutionTechniques(prompt, outcome, techniques) {
    let evolved = prompt;

    for (const technique of techniques) {
        switch (technique) {
            case 'simplification':
                evolved = simplifyPrompt(evolved, outcome);
                break;
            case 'clarification':
                evolved = clarifyPrompt(evolved, outcome);
                break;
            case 'context-enrichment':
                evolved = enrichContext(evolved, outcome);
                break;
            case 'constraint-injection':
                evolved = injectConstraints(evolved, outcome);
                break;
            case 'example-augmentation':
                evolved = addExamples(evolved, outcome);
                break;
        }
    }

    return evolved;
}

/**
 * Simplify a prompt
 */
function simplifyPrompt(prompt, outcome) {
    // If too complex, simplify
    if (outcome.errors?.some(e => e.includes('too complex'))) {
        const sentences = prompt.split('.');
        if (sentences.length > 3) {
            return sentences.slice(0, 3).join('.') + '.';
        }
    }
    return prompt;
}

/**
 * Clarify a prompt
 */
function clarifyPrompt(prompt, outcome) {
    // Add clarification if ambiguous
    if (outcome.feedback?.includes('unclear')) {
        return prompt + '\n\nPlease provide clear, specific output.';
    }
    // Add format specification if needed
    if (outcome.errors?.some(e => e.includes('format'))) {
        return prompt + '\n\nFormat: JSON with clearly labeled fields.';
    }
    return prompt;
}

/**
 * Enrich context
 */
function enrichContext(prompt, outcome) {
    // Add context if missing
    if (outcome.errors?.some(e => e.includes('context'))) {
        return `Context: This is part of a larger codebase.\n\n${prompt}`;
    }
    // Add technical context
    if (outcome.feedback?.includes('technical')) {
        return `Technical Context: JavaScript/TypeScript project.\n\n${prompt}`;
    }
    return prompt;
}

/**
 * Inject constraints
 */
function injectConstraints(prompt, outcome) {
    // Add constraints based on errors
    if (outcome.errors?.some(e => e.includes('performance'))) {
        return `${prompt}\n\nConstraints: Optimize for performance.`;
    }
    if (outcome.errors?.some(e => e.includes('error'))) {
        return `${prompt}\n\nConstraints: Handle all error cases gracefully.`;
    }
    return prompt;
}

/**
 * Add examples
 */
function addExamples(prompt, outcome) {
    // Add example if response is wrong
    if (outcome.errors?.some(e => e.includes('expected'))) {
        return `${prompt}\n\nExample format:\nInput: ...\nOutput: ...`;
    }
    return prompt;
}

/**
 * Evolve architecture based on system performance
 * @param {Object} system - System to evolve
 * @param {Object} context - Evolution context
 * @returns {Promise<Object>} Evolution result
 */
export async function evolveArchitecture(system, context = {}) {
    const {
        performanceMetrics = {},
        bottlenecks = [],
        patterns = []
    } = context;

    try {
        const evolution = {
            id: `arch-${Date.now()}`,
            type: 'architecture',
            originalSystem: system,
            evolvedSystem: {},
            changes: [],
            createdAt: new Date().toISOString()
        };

        // Analyze bottlenecks and suggest changes
        for (const bottleneck of bottlenecks) {
            const change = suggestArchitectureChange(bottleneck, patterns);
            if (change) {
                evolution.changes.push(change);
                evolution.evolvedSystem = applyChange(system, change);
            }
        }

        // Persist evolution
        await writeFile(
            join(DEFAULT_EVOLUTION_DB_PATH, `${evolution.id}.json`),
            JSON.stringify(evolution, null, 2)
        );

        EVOLUTION_CACHE.set(evolution.id, evolution);

        return {
            success: true,
            evolutionId: evolution.id,
            changes: evolution.changes,
            evolvedSystem: evolution.evolvedSystem
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Suggest architecture change based on bottleneck
 */
function suggestArchitectureChange(bottleneck, patterns) {
    const bottleneckTypes = {
        'database': {
            suggestion: 'Add caching layer',
            component: 'cache',
            pattern: 'cache-aside'
        },
        'api': {
            suggestion: 'Implement API gateway',
            component: 'gateway',
            pattern: 'facade'
        },
        'state': {
            suggestion: 'Implement state management',
            component: 'state-store',
            pattern: 'flux'
        },
        'communication': {
            suggestion: 'Add message queue',
            component: 'queue',
            pattern: 'pub-sub'
        }
    };

    const type = Object.keys(bottleneckTypes).find(k =>
        bottleneck.toLowerCase().includes(k)
    );

    if (type) {
        return bottleneckTypes[type];
    }

    return null;
}

/**
 * Apply a change to a system
 */
function applyChange(system, change) {
    return {
        ...system,
        components: [
            ...(system.components || []),
            {
                name: change.component,
                pattern: change.pattern,
                addedAt: new Date().toISOString()
            }
        ]
    };
}

/**
 * Suggest improvements based on context
 * @param {Object} context - Context for improvement suggestions
 * @returns {Promise<Object[]>} Suggested improvements
 */
export async function suggestImprovements(context = {}) {
    const {
        type = 'general',
        metrics = {},
        recentErrors = [],
        patterns = []
    } = context;

    const suggestions = [];

    // Analyze patterns for improvement opportunities
    const patternAnalysis = analyzePatterns(patterns);
    suggestions.push(...patternAnalysis);

    // Analyze metrics for optimization opportunities
    const metricAnalysis = analyzeMetrics(metrics);
    suggestions.push(...metricAnalysis);

    // Analyze errors for prevention opportunities
    const errorAnalysis = analyzeErrors(recentErrors);
    suggestions.push(...errorAnalysis);

    // Prioritize suggestions
    const prioritized = suggestions.sort((a, b) => {
        const scoreA = a.priority * a.impact;
        const scoreB = b.priority * b.impact;
        return scoreB - scoreA;
    });

    return prioritized;
}

/**
 * Analyze patterns for improvements
 */
function analyzePatterns(patterns) {
    const suggestions = [];

    for (const pattern of patterns) {
        if (pattern.type === 'monolith' && pattern.size === 'large') {
            suggestions.push({
                type: 'architecture',
                title: 'Consider microservices extraction',
                description: 'Large monolith detected. Consider extracting bounded contexts.',
                priority: 7,
                impact: 9,
                effort: 8,
                rationale: 'Microservices can improve scalability and team autonomy.'
            });
        }

        if (pattern.type === 'tight-coupling') {
            suggestions.push({
                type: 'refactoring',
                title: 'Reduce coupling',
                description: 'Tight coupling detected between components.',
                priority: 6,
                impact: 7,
                effort: 5,
                rationale: 'Loose coupling improves maintainability and testability.'
            });
        }

        if (pattern.type === 'god-object') {
            suggestions.push({
                type: 'refactoring',
                title: 'Split large files',
                description: 'Large files with many responsibilities detected.',
                priority: 5,
                impact: 6,
                effort: 4,
                rationale: 'Single responsibility principle improves code clarity.'
            });
        }
    }

    return suggestions;
}

/**
 * Analyze metrics for improvements
 */
function analyzeMetrics(metrics) {
    const suggestions = [];

    if (metrics.latency > 1000) {
        suggestions.push({
            type: 'performance',
            title: 'Reduce latency',
            description: `High latency detected: ${metrics.latency}ms`,
            priority: 8,
            impact: 8,
            effort: 6,
            rationale: 'Lower latency improves user experience.',
            recommendations: ['Add caching', 'Optimize queries', 'Use CDN']
        });
    }

    if (metrics.errorRate > 0.05) {
        suggestions.push({
            type: 'reliability',
            title: 'Reduce error rate',
            description: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
            priority: 9,
            impact: 9,
            effort: 5,
            rationale: 'Lower error rate improves reliability.',
            recommendations: ['Add error handling', 'Implement retries', 'Add monitoring']
        });
    }

    if (metrics.memoryUsage > 0.8) {
        suggestions.push({
            type: 'performance',
            title: 'Optimize memory usage',
            description: `High memory usage: ${(metrics.memoryUsage * 100).toFixed(0)}%`,
            priority: 7,
            impact: 7,
            effort: 4,
            rationale: 'Lower memory usage improves scalability.',
            recommendations: ['Implement lazy loading', 'Use streaming', 'Add garbage collection hints']
        });
    }

    return suggestions;
}

/**
 * Analyze errors for improvements
 */
function analyzeErrors(errors) {
    const suggestions = [];
    const errorCounts = {};

    // Count error types
    for (const error of errors) {
        const type = categorizeError(error);
        errorCounts[type] = (errorCounts[type] || 0) + 1;
    }

    // Generate suggestions based on error patterns
    if (errorCounts.database > 5) {
        suggestions.push({
            type: 'stability',
            title: 'Fix database issues',
            description: `${errorCounts.database} database errors detected.`,
            priority: 9,
            impact: 9,
            effort: 6,
            rationale: 'Database errors can cause system-wide failures.'
        });
    }

    if (errorCounts.auth > 3) {
        suggestions.push({
            type: 'security',
            title: 'Fix authentication issues',
            description: `${errorCounts.auth} authentication errors detected.`,
            priority: 8,
            impact: 8,
            effort: 4,
            rationale: 'Auth issues can expose security vulnerabilities.'
        });
    }

    if (errorCounts.validation > 10) {
        suggestions.push({
            type: 'robustness',
            title: 'Improve input validation',
            description: `${errorCounts.validation} validation errors detected.`,
            priority: 6,
            impact: 6,
            effort: 3,
            rationale: 'Better validation prevents errors at source.'
        });
    }

    return suggestions;
}

/**
 * Categorize an error
 */
function categorizeError(error) {
    const errorStr = error.toLowerCase();

    if (errorStr.includes('database') || errorStr.includes('sql') || errorStr.includes('query')) {
        return 'database';
    }
    if (errorStr.includes('auth') || errorStr.includes('token') || errorStr.includes('permission')) {
        return 'auth';
    }
    if (errorStr.includes('validation') || errorStr.includes('invalid')) {
        return 'validation';
    }
    if (errorStr.includes('timeout') || errorStr.includes('connection')) {
        return 'network';
    }
    if (errorStr.includes('memory') || errorStr.includes('heap')) {
        return 'memory';
    }

    return 'general';
}

/**
 * Get evolution statistics
 * @returns {Promise<EvolutionStats>} Evolution statistics
 */
export async function getEvolutionStats() {
    const stats = {
        totalEvolutions: EVOLUTION_CACHE.size,
        successfulEvolutions: 0,
        averageImprovement: 0,
        byType: {},
        topImprovements: [],
        recentEvolutions: []
    };

    let totalImprovement = 0;
    let improvementsWithValue = 0;

    for (const [id, entry] of EVOLUTION_CACHE) {
        // Count by type
        const type = entry.type || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;

        // Count successful evolutions
        if (entry.improvement > 0) {
            stats.successfulEvolutions++;
            totalImprovement += entry.improvement;
            improvementsWithValue++;
        }

        // Track top improvements
        if (entry.improvement > 0) {
            stats.topImprovements.push({
                id,
                improvement: entry.improvement,
                type: entry.type
            });
        }

        // Track recent evolutions
        stats.recentEvolutions.push({
            id,
            type: entry.type,
            improvement: entry.improvement,
            createdAt: entry.createdAt
        });
    }

    // Calculate average improvement
    if (improvementsWithValue > 0) {
        stats.averageImprovement = totalImprovement / improvementsWithValue;
    }

    // Sort and limit arrays
    stats.topImprovements.sort((a, b) => b.improvement - a.improvement);
    stats.topImprovements = stats.topImprovements.slice(0, 10);
    stats.recentEvolutions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    stats.recentEvolutions = stats.recentEvolutions.slice(0, 10);

    return stats;
}

/**
 * Evolve routing logic based on outcomes
 * @param {Object} routingRules - Current routing rules
 * @param {Object} outcomes - Routing outcomes
 * @returns {Promise<Object>} Evolved routing rules
 */
export async function evolveRouting(routingRules, outcomes) {
    const evolvedRules = { ...routingRules };

    // Analyze outcomes
    for (const [route, outcome] of Object.entries(outcomes)) {
        if (outcome.successRate > 0.9) {
            // Increase weight for successful routes
            evolvedRules[route] = {
                ...evolvedRules[route],
                weight: Math.min(1, (evolvedRules[route]?.weight || 0.5) * 1.1)
            };
        } else if (outcome.successRate < 0.5) {
            // Decrease weight or disable failing routes
            evolvedRules[route] = {
                ...evolvedRules[route],
                weight: Math.max(0.1, (evolvedRules[route]?.weight || 0.5) * 0.8),
                disabled: outcome.successRate < 0.3
            };
        }
    }

    // Normalize weights
    const totalWeight = Object.values(evolvedRules)
        .filter(r => !r.disabled)
        .reduce((sum, r) => sum + r.weight, 0);

    for (const route of Object.keys(evolvedRules)) {
        if (!evolvedRules[route].disabled) {
            evolvedRules[route].weight /= totalWeight;
        }
    }

    return evolvedRules;
}

/**
 * Evolve planning strategies based on results
 * @param {Object} strategy - Current planning strategy
 * @param {Object} results - Planning results
 * @returns {Promise<Object>} Evolved strategy
 */
export async function evolvePlanningStrategy(strategy, results) {
    const evolved = { ...strategy };

    // Adjust strategy based on success
    if (results.successRate > 0.8) {
        // Successful strategy - continue with minor tweaks
        evolved.adaptability = Math.min(1, (evolved.adaptability || 0.5) + 0.05);
        evolved.riskTolerance = Math.min(1, (evolved.riskTolerance || 0.5) + 0.02);
    } else if (results.successRate < 0.5) {
        // Failing strategy - make conservative adjustments
        evolved.adaptability = Math.max(0, (evolved.adaptability || 0.5) - 0.1);
        evolved.riskTolerance = Math.max(0, (evolved.riskTolerance || 0.5) - 0.1);
    }

    // Adjust based on specific patterns
    if (results.overEngineering) {
        evolved.preferSimplicity = true;
    }
    if (results.underEstimating) {
        evolved.timeBuffer = (evolved.timeBuffer || 1.2) * 1.2;
    }

    return evolved;
}

export default {
    initializeEvolutionEngine,
    evolvePrompt,
    evolveArchitecture,
    suggestImprovements,
    getEvolutionStats,
    evolveRouting,
    evolvePlanningStrategy
};