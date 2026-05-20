/**
 * Phase 29: AI Strategic System - Autonomous Suggestion Engine
 * Generates strategic suggestions for products, architecture, stack, and scaling
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

/**
 * @typedef {Object} Suggestion
 * @property {string} id
 * @property {string} type
 * @property {string} title
 * @property {string} description
 * @property {number} priority
 * @property {number} effort
 * @property {number} impact
 * @property {string[]} benefits
 * @property {string[]} risks
 * @property {string[]} steps
 * @property {string} estimatedTime
 * @property {string} category
 */

/**
 * @typedef {Object} SuggestionReport
 * @property {string} projectId
 * @property {string} analyzedAt
 * @property {Suggestion[]} suggestions
 * @property {Object} categorizedSuggestions
 * @property {number} totalSuggestions
 */

/**
 * Generate strategic suggestions for a project
 * @param {string} projectPath - Path to project
 * @param {Object} context - Analysis context
 * @returns {Promise<SuggestionReport>} Generated suggestions
 */
export async function generateSuggestions(projectPath, context = {}) {
    try {
        // Analyze project context
        const analysis = await analyzeProjectContext(projectPath);

        // Generate suggestions by category
        const suggestions = [];

        // Product suggestions
        const productSuggestions = generateProductSuggestions(analysis, context);
        suggestions.push(...productSuggestions);

        // Architecture migration suggestions
        const architectureSuggestions = generateArchitectureSuggestions(analysis, context);
        suggestions.push(...architectureSuggestions);

        // Stack upgrade suggestions
        const stackSuggestions = generateStackSuggestions(analysis, context);
        suggestions.push(...stackSuggestions);

        // Scaling strategy suggestions
        const scalingSuggestions = generateScalingSuggestions(analysis, context);
        suggestions.push(...scalingSuggestions);

        // Prioritize suggestions
        const prioritizedSuggestions = prioritizeSuggestions(suggestions);

        // Categorize suggestions
        const categorizedSuggestions = categorizeSuggestions(prioritizedSuggestions);

        return {
            projectId: projectPath,
            analyzedAt: new Date().toISOString(),
            suggestions: prioritizedSuggestions,
            categorizedSuggestions,
            totalSuggestions: prioritizedSuggestions.length,
            summary: generateSuggestionSummary(prioritizedSuggestions)
        };
    } catch (err) {
        return { error: err.message, projectId: projectPath, suggestions: [] };
    }
}

/**
 * Prioritize suggestions based on impact, effort, and priority
 * @param {Suggestion[]} suggestions - Unprioritized suggestions
 * @returns {Suggestion[]} Prioritized suggestions
 */
export function prioritizeSuggestions(suggestions) {
    // Calculate priority score for each suggestion
    const scored = suggestions.map(suggestion => {
        const impactScore = suggestion.impact * 2;
        const effortScore = (10 - suggestion.effort) * 1.5;
        const priorityScore = suggestion.priority * 1;
        const totalScore = impactScore + effortScore + priorityScore;

        return {
            ...suggestion,
            totalScore,
            scoreBreakdown: { impactScore, effortScore, priorityScore }
        };
    });

    // Sort by total score descending
    return scored.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Analyze project context for suggestion generation
 * @param {string} projectPath - Path to project
 * @returns {Promise<Object>} Project analysis context
 */
async function analyzeProjectContext(projectPath) {
    const context = {
        languages: {},
        frameworks: [],
        architecture: 'unknown',
        size: 'small',
        hasTests: false,
        hasCI: false,
        hasTypeScript: false,
        hasBackend: false,
        hasDatabase: false,
        hasAPI: false,
        hasAuth: false,
        hasCache: false,
        isMonolith: true,
        fileCount: 0
    };

    try {
        const files = await scanProjectFiles(projectPath);
        context.fileCount = files.length;

        for (const file of files) {
            const ext = extname(file);

            // Count languages
            if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
                context.languages[ext] = (context.languages[ext] || 0) + 1;
            }

            // Try to read package.json for framework detection
            if (file.endsWith('package.json')) {
                try {
                    const content = await readFile(file, 'utf-8');
                    const pkg = JSON.parse(content);
                    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                    // Detect frameworks
                    if (deps.react) context.frameworks.push('react');
                    if (deps.vue) context.frameworks.push('vue');
                    if (deps.angular) context.frameworks.push('angular');
                    if (deps.next) context.frameworks.push('next');
                    if (deps.nuxt) context.frameworks.push('nuxt');
                    if (deps.express) { context.frameworks.push('express'); context.hasBackend = true; }
                    if (deps.fastify) { context.frameworks.push('fastify'); context.hasBackend = true; }
                    if (deps.koa) { context.frameworks.push('koa'); context.hasBackend = true; }
                    if (deps.django) { context.frameworks.push('django'); context.hasBackend = true; }
                    if (deps.flask) { context.frameworks.push('flask'); context.hasBackend = true; }

                    // Detect features
                    if (deps['@prisma/client'] || deps.mongoose || deps.sequelize) context.hasDatabase = true;
                    if (deps.jwt || deps['passport']) context.hasAuth = true;
                    if (deps.redis || deps['memcached']) context.hasCache = true;
                    if (deps.jest || deps.mocha || deps.vitest) context.hasTests = true;
                    if (deps['@types/node'] || pkg.compilerOptions?.strict) context.hasTypeScript = true;

                    // Detect architecture
                    if (deps.docker) context.isMonolith = false;
                } catch (e) {
                    // Skip invalid JSON
                }
            }

            // Detect CI/CD
            if (file.includes('.github/workflows') || file.includes('.gitlab-ci') || file.includes('Jenkinsfile')) {
                context.hasCI = true;
            }

            // Detect API
            if (file.includes('routes') || file.includes('api') || file.includes('endpoints')) {
                context.hasAPI = true;
            }
        }

        // Determine project size
        if (context.fileCount > 500) context.size = 'large';
        else if (context.fileCount > 100) context.size = 'medium';

        // Determine architecture
        if (context.frameworks.includes('next') || context.frameworks.includes('nuxt')) {
            context.architecture = 'ssr';
        } else if (context.hasBackend && Object.keys(context.languages).some(l => ['.jsx', '.tsx'].includes(l))) {
            context.architecture = 'fullstack';
        } else if (context.hasBackend) {
            context.architecture = 'backend-api';
        } else {
            context.architecture = 'frontend';
        }

    } catch (err) {
        // Return default context on error
    }

    return context;
}

async function scanProjectFiles(dirPath, depth = 0, maxDepth = 3) {
    const files = [];

    if (depth > maxDepth) return files;

    try {
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

            const fullPath = join(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await scanProjectFiles(fullPath, depth + 1, maxDepth);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }
    } catch (err) {
        // Skip inaccessible directories
    }

    return files;
}

/**
 * Generate product suggestions
 */
function generateProductSuggestions(analysis, context) {
    const suggestions = [];

    // Suggest feature flags if not present
    if (!context.frameworks.includes('next')) {
        suggestions.push({
            id: 'product-feature-flags',
            type: 'product',
            title: 'Implement Feature Flags System',
            description: 'Add feature flags to enable gradual rollouts, A/B testing, and quick rollbacks.',
            priority: 7,
            effort: 4,
            impact: 8,
            benefits: ['Gradual feature rollout', 'A/B testing capability', 'Quick rollback', 'Reduced risk'],
            risks: ['Added complexity', 'Technical debt if not maintained'],
            steps: ['Choose feature flag provider', 'Implement flag evaluation', 'Add admin UI', 'Integrate with CI/CD'],
            estimatedTime: '2-3 weeks',
            category: 'product'
        });
    }

    // Suggest analytics if not present
    if (!analysis.hasBackend && analysis.size !== 'small') {
        suggestions.push({
            id: 'product-analytics',
            type: 'product',
            title: 'Add Product Analytics',
            description: 'Implement product analytics to understand user behavior and measure feature adoption.',
            priority: 6,
            effort: 3,
            impact: 7,
            benefits: ['User behavior insights', 'Feature adoption metrics', 'Data-driven decisions'],
            risks: ['Privacy concerns', 'Performance overhead'],
            steps: ['Choose analytics provider', 'Implement tracking', 'Create dashboards', 'Define KPIs'],
            estimatedTime: '1-2 weeks',
            category: 'product'
        });
    }

    // Suggest notifications if not present
    if (!context.hasBackend) {
        suggestions.push({
            id: 'product-notifications',
            type: 'product',
            title: 'Add Push Notifications',
            description: 'Implement push notifications for re-engagement and important updates.',
            priority: 5,
            effort: 4,
            impact: 6,
            benefits: ['User re-engagement', 'Real-time updates', 'Better UX'],
            risks: ['User opt-out', 'Notification fatigue'],
            steps: ['Choose push provider', 'Implement service worker', 'Add notification UI', 'Create permission flow'],
            estimatedTime: '2-3 weeks',
            category: 'product'
        });
    }

    return suggestions;
}

/**
 * Generate architecture migration suggestions
 */
function generateArchitectureSuggestions(analysis, context) {
    const suggestions = [];

    // Suggest microservices for large monoliths
    if (context.isMonolith && context.size === 'large') {
        suggestions.push({
            id: 'arch-microservices',
            type: 'architecture',
            title: 'Consider Microservices Architecture',
            description: 'Large monolith projects benefit from microservices for independent scaling and deployment.',
            priority: 6,
            effort: 9,
            impact: 9,
            benefits: ['Independent scaling', 'Faster deployments', 'Team autonomy', 'Technology flexibility'],
            risks: ['Increased complexity', 'Network latency', 'Data consistency challenges'],
            steps: ['Identify bounded contexts', 'Extract first service', 'Set up API gateway', 'Implement service mesh'],
            estimatedTime: '3-6 months',
            category: 'architecture'
        });
    }

    // Suggest modular architecture for non-TypeScript projects
    if (!context.hasTypeScript && context.fileCount > 50) {
        suggestions.push({
            id: 'arch-typescript',
            type: 'architecture',
            title: 'Migrate to TypeScript',
            description: 'TypeScript provides better type safety, IDE support, and maintainability.',
            priority: 7,
            effort: 6,
            impact: 8,
            benefits: ['Type safety', 'Better IDE support', 'Easier refactoring', 'Documentation'],
            risks: ['Migration effort', 'Learning curve', 'Build time increase'],
            steps: ['Add TypeScript config', 'Rename files to .ts/.tsx', 'Fix type errors', 'Enable strict mode'],
            estimatedTime: '2-4 weeks',
            category: 'architecture'
        });
    }

    // Suggest API layer for projects without clear API
    if (!context.hasAPI && context.hasBackend) {
        suggestions.push({
            id: 'arch-api-layer',
            type: 'architecture',
            title: 'Add API Gateway Layer',
            description: 'Centralize API management with gateway for auth, rate limiting, and documentation.',
            priority: 6,
            effort: 5,
            impact: 7,
            benefits: ['Centralized auth', 'Rate limiting', 'API documentation', 'Monitoring'],
            risks: ['Single point of failure', 'Additional infrastructure'],
            steps: ['Choose API gateway', 'Configure routes', 'Add authentication', 'Set up monitoring'],
            estimatedTime: '1-2 weeks',
            category: 'architecture'
        });
    }

    // Suggest event-driven for backend projects
    if (context.hasBackend && context.size !== 'small') {
        suggestions.push({
            id: 'arch-event-driven',
            type: 'architecture',
            title: 'Implement Event-Driven Architecture',
            description: 'Decouple services with event sourcing and message queues for better scalability.',
            priority: 5,
            effort: 7,
            impact: 8,
            benefits: ['Loose coupling', 'Better scalability', 'Audit trail', 'Replay capability'],
            risks: ['Eventual consistency', 'Complexity increase'],
            steps: ['Choose message broker', 'Design event schema', 'Implement publishers', 'Add subscribers'],
            estimatedTime: '2-3 weeks',
            category: 'architecture'
        });
    }

    return suggestions;
}

/**
 * Generate stack upgrade suggestions
 */
function generateStackSuggestions(analysis, context) {
    const suggestions = [];

    // Suggest testing framework if missing
    if (!context.hasTests) {
        suggestions.push({
            id: 'stack-testing',
            type: 'stack',
            title: 'Add Testing Framework',
            description: 'Implement comprehensive testing (unit, integration, e2e) for code quality.',
            priority: 8,
            effort: 5,
            impact: 9,
            benefits: ['Bug prevention', 'Confidence for refactoring', 'Documentation', 'Regression detection'],
            risks: ['Test maintenance burden', 'Flaky tests'],
            steps: ['Choose test framework', 'Write unit tests', 'Add integration tests', 'Set up CI'],
            estimatedTime: '2-3 weeks',
            category: 'stack'
        });
    }

    // Suggest CI/CD if missing
    if (!context.hasCI && context.fileCount > 10) {
        suggestions.push({
            id: 'stack-cicd',
            type: 'stack',
            title: 'Set Up CI/CD Pipeline',
            description: 'Automate build, test, and deployment processes for faster, safer releases.',
            priority: 8,
            effort: 4,
            impact: 9,
            benefits: ['Faster releases', 'Consistent quality', 'Less manual work', 'Rollback capability'],
            risks: ['Pipeline complexity', 'Secret management'],
            steps: ['Choose CI provider', 'Configure build', 'Add tests to pipeline', 'Set up deployments'],
            estimatedTime: '1-2 weeks',
            category: 'stack'
        });
    }

    // Suggest caching for backend projects
    if (context.hasBackend && !context.hasCache) {
        suggestions.push({
            id: 'stack-caching',
            type: 'stack',
            title: 'Add Caching Layer',
            description: 'Implement Redis or Memcached for improved performance.',
            priority: 7,
            effort: 4,
            impact: 8,
            benefits: ['Faster responses', 'Reduced database load', 'Better scalability'],
            risks: ['Stale data', 'Cache invalidation complexity'],
            steps: ['Set up Redis', 'Identify cache candidates', 'Implement caching', 'Add invalidation'],
            estimatedTime: '1-2 weeks',
            category: 'stack'
        });
    }

    // Suggest monitoring for production projects
    if (context.hasBackend && context.size !== 'small') {
        suggestions.push({
            id: 'stack-monitoring',
            type: 'stack',
            title: 'Implement Monitoring and Observability',
            description: 'Add logging, metrics, and tracing for production visibility.',
            priority: 7,
            effort: 5,
            impact: 9,
            benefits: ['Faster debugging', 'Performance visibility', 'Proactive alerting', 'SLA tracking'],
            risks: ['Cost increase', 'Alert fatigue'],
            steps: ['Choose APM tool', 'Add logging', 'Set up metrics', 'Configure alerting'],
            estimatedTime: '1-2 weeks',
            category: 'stack'
        });
    }

    // Suggest containerization
    if (!context.isMonolith && context.hasBackend) {
        suggestions.push({
            id: 'stack-docker',
            type: 'stack',
            title: 'Containerize Application',
            description: 'Package application in Docker for consistent environments and easy deployment.',
            priority: 6,
            effort: 4,
            impact: 7,
            benefits: ['Consistent environments', 'Easy deployment', 'Resource isolation', 'Scaling'],
            risks: ['Container overhead', 'Learning curve'],
            steps: ['Create Dockerfile', 'Set up docker-compose', 'Configure networking', 'Add to CI/CD'],
            estimatedTime: '3-5 days',
            category: 'stack'
        });
    }

    return suggestions;
}

/**
 * Generate scaling strategy suggestions
 */
function generateScalingSuggestions(analysis, context) {
    const suggestions = [];

    // Suggest horizontal scaling for large projects
    if (context.size === 'large' && context.hasBackend) {
        suggestions.push({
            id: 'scale-horizontal',
            type: 'scaling',
            title: 'Enable Horizontal Scaling',
            description: 'Configure load balancer and stateless services for horizontal scaling.',
            priority: 7,
            effort: 6,
            impact: 9,
            benefits: ['Handle more traffic', 'Better reliability', 'Rolling deployments'],
            risks: ['Session management', 'State synchronization'],
            steps: ['Make services stateless', 'Set up load balancer', 'Configure health checks', 'Add auto-scaling'],
            estimatedTime: '1-2 weeks',
            category: 'scaling'
        });
    }

    // Suggest database optimization
    if (context.hasDatabase && context.size !== 'small') {
        suggestions.push({
            id: 'scale-database',
            type: 'scaling',
            title: 'Optimize Database Layer',
            description: 'Add read replicas, connection pooling, and query optimization.',
            priority: 7,
            effort: 5,
            impact: 8,
            benefits: ['Better read performance', 'Connection efficiency', 'Reduced latency'],
            risks: ['Replication lag', 'Added complexity'],
            steps: ['Add connection pooling', 'Create read replicas', 'Optimize slow queries', 'Add indexes'],
            estimatedTime: '1-2 weeks',
            category: 'scaling'
        });
    }

    // Suggest CDN for frontend projects
    if (!context.hasBackend && context.size !== 'small') {
        suggestions.push({
            id: 'scale-cdn',
            type: 'scaling',
            title: 'Add CDN for Static Assets',
            description: 'Use CDN for faster asset delivery globally.',
            priority: 6,
            effort: 3,
            impact: 7,
            benefits: ['Faster loading', 'Reduced server load', 'Better global coverage'],
            risks: ['Cache invalidation', 'Additional cost'],
            steps: ['Choose CDN provider', 'Configure origin', 'Update asset URLs', 'Set up caching'],
            estimatedTime: '2-3 days',
            category: 'scaling'
        });
    }

    // Suggest edge computing for global applications
    if (context.frameworks.includes('next') || context.frameworks.includes('nuxt')) {
        suggestions.push({
            id: 'scale-edge',
            type: 'scaling',
            title: 'Implement Edge Computing',
            description: 'Move compute closer to users with edge functions for lower latency.',
            priority: 5,
            effort: 6,
            impact: 7,
            benefits: ['Lower latency', 'Better global performance', 'Reduced costs'],
            risks: ['Limited runtime', 'Debugging challenges'],
            steps: ['Choose edge platform', 'Identify edge candidates', 'Deploy edge functions', 'Test performance'],
            estimatedTime: '1-2 weeks',
            category: 'scaling'
        });
    }

    return suggestions;
}

/**
 * Categorize suggestions by type
 */
function categorizeSuggestions(suggestions) {
    const categories = {
        product: [],
        architecture: [],
        stack: [],
        scaling: []
    };

    for (const suggestion of suggestions) {
        if (categories[suggestion.category]) {
            categories[suggestion.category].push(suggestion);
        }
    }

    return categories;
}

/**
 * Generate a summary of suggestions
 */
function generateSuggestionSummary(suggestions) {
    const quickWins = suggestions.filter(s => s.effort <= 3 && s.impact >= 7);
    const highPriority = suggestions.filter(s => s.priority >= 7);
    const highEffort = suggestions.filter(s => s.effort >= 7);

    return {
        total: suggestions.length,
        quickWins: quickWins.length,
        highPriority: highPriority.length,
        highEffort: highEffort.length,
        topSuggestion: suggestions[0]?.title || null,
        recommendation: quickWins.length > 0
            ? `Start with ${quickWins.length} quick win(s) for immediate impact.`
            : 'Focus on high-priority items based on your current constraints.'
    };
}

export default {
    generateSuggestions,
    prioritizeSuggestions
};