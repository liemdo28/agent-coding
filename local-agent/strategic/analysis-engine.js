/**
 * Phase 29: AI Strategic System - Strategic Analysis Engine
 * Analyzes project direction, technical debt, scalability, and business value
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

/**
 * @typedef {Object} StrategicAnalysis
 * @property {string} projectId
 * @property {string} analyzedAt
 * @property {Object} direction
 * @property {Object} technicalDebt
 * @property {Object} scalability
 * @property {Object} businessValue
 * @property {number} overallScore
 * @property {string[]} recommendations
 */

/**
 * @typedef {Object} TechnicalDebtReport
 * @property {number} totalDebt
 * @property {number} debtPerFile
 * @property {string[]} hotspots
 * @property {Object} categories
 * @property {string} estimatedFixCost
 */

/**
 * @typedef {Object} ScalabilityReport
 * @property {string} currentCapacity
 * @property {string[]} bottlenecks
 * @property {string[]} growthTrajectory
 * @property {number} scalabilityScore
 * @property {string[]} recommendations
 */

/**
 * @typedef {Object} BusinessValueReport
 * @property {number} impactScore
 * @property {number} roiEstimation
 * @property {string[]} valueDrivers
 * @property {string[]} riskFactors
 * @property {number} priority
 */

const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp'];
const COMPLEXITY_WEIGHTS = { '.js': 1, '.ts': 1, '.jsx': 1.2, '.tsx': 1.2, '.py': 1.5, '.java': 2, '.go': 1.3, '.rs': 1.4, '.cpp': 2.5 };

/**
 * Analyze strategic direction of a project
 * @param {string} projectPath - Path to project
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Strategic direction analysis
 */
export async function analyzeStrategicDirection(projectPath, options = {}) {
    try {
        const { scanDepth = 3, maxFiles = 1000 } = options;

        // Analyze codebase structure
        const structure = await analyzeProjectStructure(projectPath, { scanDepth, maxFiles });

        // Analyze dependencies and architecture
        const archAnalysis = await analyzeArchitecture(projectPath, structure);

        // Analyze roadmap alignment (if roadmap exists)
        const roadmapAnalysis = await analyzeRoadmap(projectPath);

        // Analyze market fit based on features and tech stack
        const marketFit = analyzeMarketFit(structure, archAnalysis);

        // Calculate overall strategic direction score
        const directionScore = calculateDirectionScore(archAnalysis, roadmapAnalysis, marketFit);

        return {
            projectId: projectPath,
            analyzedAt: new Date().toISOString(),
            structure: {
                totalFiles: structure.totalFiles,
                languages: structure.languages,
                architecturePattern: structure.architecturePattern,
                complexity: structure.complexity,
                size: structure.size
            },
            direction: {
                score: directionScore,
                alignment: roadmapAnalysis?.alignment || 'unknown',
                marketFit: marketFit,
                innovationLevel: archAnalysis.innovationLevel,
                maturity: archAnalysis.maturity
            },
            recommendations: generateDirectionRecommendations(archAnalysis, marketFit, directionScore)
        };
    } catch (err) {
        return { error: err.message, projectId: projectPath };
    }
}

/**
 * Assess technical debt in a project
 * @param {string} projectPath - Path to project
 * @param {Object} options - Assessment options
 * @returns {Promise<TechnicalDebtReport>} Technical debt assessment
 */
export async function assessTechnicalDebt(projectPath, options = {}) {
    try {
        const { scanDepth = 3, complexityThreshold = 15 } = options;

        // Scan all code files
        const files = await scanCodeFiles(projectPath, { scanDepth });

        // Analyze each file for debt indicators
        const debtAnalysis = await analyzeDebtIndicators(files);

        // Categorize debt by type
        const categories = categorizeDebt(debtAnalysis);

        // Calculate total debt
        const totalDebt = calculateTotalDebt(debtAnalysis);

        // Find hotspots (files with highest debt)
        const hotspots = findDebtHotspots(debtAnalysis);

        // Estimate fix cost
        const estimatedFixCost = estimateFixCost(totalDebt, hotspots);

        return {
            projectId: projectPath,
            analyzedAt: new Date().toISOString(),
            totalDebt,
            debtPerFile: files.length > 0 ? (totalDebt / files.length).toFixed(2) : 0,
            hotspots,
            categories,
            estimatedFixCost,
            complexityThreshold,
            summary: generateDebtSummary(debtAnalysis, categories)
        };
    } catch (err) {
        return { error: err.message, projectId: projectPath };
    }
}

/**
 * Evaluate scalability of a project
 * @param {string} projectPath - Path to project
 * @param {Object} options - Evaluation options
 * @returns {Promise<ScalabilityReport>} Scalability evaluation
 */
export async function evaluateScalability(projectPath, options = {}) {
    try {
        // Analyze architecture for scalability patterns
        const archPatterns = await analyzeScalabilityPatterns(projectPath);

        // Analyze data layer
        const dataLayer = await analyzeDataLayer(projectPath);

        // Analyze caching strategy
        const caching = await analyzeCachingStrategy(projectPath);

        // Analyze concurrency patterns
        const concurrency = await analyzeConcurrencyPatterns(projectPath);

        // Calculate scalability score
        const scalabilityScore = calculateScalabilityScore(archPatterns, dataLayer, caching, concurrency);

        // Identify bottlenecks
        const bottlenecks = identifyScalabilityBottlenecks(archPatterns, dataLayer, caching, concurrency);

        // Determine growth trajectory
        const growthTrajectory = determineGrowthTrajectory(scalabilityScore, bottlenecks);

        return {
            projectId: projectPath,
            analyzedAt: new Date().toISOString(),
            currentCapacity: scalabilityScore > 70 ? 'high' : scalabilityScore > 40 ? 'medium' : 'low',
            bottlenecks,
            growthTrajectory,
            scalabilityScore,
            architecture: archPatterns,
            dataLayer,
            caching,
            concurrency,
            recommendations: generateScalabilityRecommendations(scalabilityScore, bottlenecks)
        };
    } catch (err) {
        return { error: err.message, projectId: projectPath };
    }
}

/**
 * Measure business value of a project
 * @param {string} projectPath - Path to project
 * @param {Object} options - Measurement options
 * @returns {Promise<BusinessValueReport>} Business value measurement
 */
export async function measureBusinessValue(projectPath, options = {}) {
    try {
        // Analyze core business logic
        const businessLogic = await analyzeBusinessLogic(projectPath);

        // Analyze user-facing features
        const features = await analyzeFeatures(projectPath);

        // Analyze integration points
        const integrations = await analyzeIntegrations(projectPath);

        // Calculate impact score
        const impactScore = calculateImpactScore(businessLogic, features, integrations);

        // Estimate ROI
        const roiEstimation = estimateROI(impactScore, businessLogic, integrations);

        // Identify value drivers
        const valueDrivers = identifyValueDrivers(businessLogic, features, integrations);

        // Identify risk factors
        const riskFactors = identifyRiskFactors(projectPath, businessLogic, integrations);

        return {
            projectId: projectPath,
            analyzedAt: new Date().toISOString(),
            impactScore,
            roiEstimation,
            valueDrivers,
            riskFactors,
            priority: calculatePriority(impactScore, roiEstimation),
            businessLogic,
            features,
            integrations,
            recommendations: generateValueRecommendations(impactScore, valueDrivers, riskFactors)
        };
    } catch (err) {
        return { error: err.message, projectId: projectPath };
    }
}

// Helper functions

async function analyzeProjectStructure(projectPath, options) {
    const { scanDepth, maxFiles } = options;
    const structure = {
        totalFiles: 0,
        languages: {},
        architecturePattern: 'modular',
        complexity: 0,
        size: 0
    };

    try {
        const files = await scanCodeFiles(projectPath, { scanDepth, maxFiles });
        structure.totalFiles = files.length;

        for (const file of files) {
            const ext = extname(file.path);
            structure.languages[ext] = (structure.languages[ext] || 0) + 1;
            structure.complexity += (file.complexity || 0) * (COMPLEXITY_WEIGHTS[ext] || 1);
            structure.size += file.size || 0;
        }

        // Determine architecture pattern
        structure.architecturePattern = inferArchitecturePattern(structure);

        return structure;
    } catch (err) {
        return structure;
    }
}

async function scanCodeFiles(dirPath, options) {
    const { scanDepth = 3, maxFiles = 1000 } = options;
    const files = [];

    async function scan(currentPath, depth) {
        if (depth > scanDepth || files.length >= maxFiles) return;

        try {
            const entries = await readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) break;
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

                const fullPath = join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    await scan(fullPath, depth + 1);
                } else if (entry.isFile() && CODE_EXTENSIONS.includes(extname(entry.name))) {
                    try {
                        const stats = await stat(fullPath);
                        files.push({
                            path: fullPath,
                            size: stats.size,
                            extension: extname(entry.name)
                        });
                    } catch (e) {
                        // Skip files that can't be accessed
                    }
                }
            }
        } catch (err) {
            // Skip directories that can't be read
        }
    }

    await scan(dirPath, 0);
    return files;
}

async function analyzeArchitecture(projectPath, structure) {
    // Analyze package.json for dependencies
    let dependencies = {};
    let innovationLevel = 'moderate';
    let maturity = 'stable';

    try {
        const pkgPath = join(projectPath, 'package.json');
        const pkgContent = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgContent);
        dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

        // Assess innovation level based on dependencies
        const modernDeps = ['react', 'vue', 'angular', 'next', 'nuxt', 'svelte'];
        const modernCount = modernDeps.filter(d => dependencies[d]).length;
        innovationLevel = modernCount > 2 ? 'cutting-edge' : modernCount > 0 ? 'modern' : 'traditional';

        // Assess maturity
        const legacyDeps = ['jquery', 'backbone', 'angularjs', 'underscore'];
        const legacyCount = legacyDeps.filter(d => dependencies[d]).length;
        maturity = legacyCount > 1 ? 'legacy' : legacyCount > 0 ? 'transitioning' : 'modern';
    } catch (err) {
        // Package.json not found or invalid
    }

    return {
        dependencies,
        innovationLevel,
        maturity,
        architecturePattern: structure.architecturePattern,
        serviceCount: Object.keys(dependencies).length
    };
}

async function analyzeRoadmap(projectPath) {
    // Look for roadmap files
    const roadmapPaths = ['roadmap.md', 'ROADMAP.md', 'TODO.md', 'CHANGELOG.md'];

    for (const roadmapPath of roadmapPaths) {
        try {
            const fullPath = join(projectPath, roadmapPath);
            const content = await readFile(fullPath, 'utf-8');
            return {
                alignment: 'aligned',
                exists: true,
                path: roadmapPath,
                length: content.length
            };
        } catch (err) {
            // Try next path
        }
    }

    return { alignment: 'unknown', exists: false };
}

function analyzeMarketFit(structure, archAnalysis) {
    const languageCount = Object.keys(structure.languages).length;
    const totalFiles = structure.totalFiles;

    // Determine market fit based on tech stack
    let fit = 'niche';
    if (structure.languages['.js'] || structure.languages['.ts']) {
        fit = 'mainstream';
    }
    if (structure.languages['.py']) {
        fit = structure.languages['.py'] > 10 ? 'enterprise' : 'mainstream';
    }

    return {
        marketSegment: fit,
        techStackRelevance: archAnalysis.maturity === 'modern' ? 'high' : 'medium',
        trendAlignment: archAnalysis.innovationLevel === 'cutting-edge' ? 'leading' : 'following'
    };
}

function calculateDirectionScore(archAnalysis, roadmapAnalysis, marketFit) {
    let score = 50; // Base score

    // Innovation bonus
    if (archAnalysis.innovationLevel === 'cutting-edge') score += 20;
    else if (archAnalysis.innovationLevel === 'modern') score += 10;

    // Maturity bonus
    if (archAnalysis.maturity === 'modern') score += 15;
    else if (archAnalysis.maturity === 'transitioning') score += 5;

    // Roadmap bonus
    if (roadmapAnalysis?.alignment === 'aligned') score += 10;

    // Market fit bonus
    if (marketFit.trendAlignment === 'leading') score += 5;

    return Math.min(100, score);
}

function generateDirectionRecommendations(archAnalysis, marketFit, directionScore) {
    const recommendations = [];

    if (archAnalysis.maturity === 'legacy') {
        recommendations.push('Consider modernizing the tech stack to improve maintainability and hiring prospects');
    }

    if (archAnalysis.innovationLevel === 'traditional') {
        recommendations.push('Evaluate modern frameworks and tools to stay competitive');
    }

    if (directionScore < 60) {
        recommendations.push('Conduct a comprehensive architecture review to identify improvement opportunities');
    }

    if (marketFit.trendAlignment === 'following') {
        recommendations.push('Monitor industry trends and consider adopting emerging technologies strategically');
    }

    return recommendations;
}

async function analyzeDebtIndicators(files) {
    const debtAnalysis = [];

    for (const file of files) {
        try {
            const content = await readFile(file.path, 'utf-8');
            const debt = {
                path: file.path,
                size: file.size,
                extension: file.extension,
                issues: []
            };

            // Check for common debt indicators
            if (content.length > 500) {
                debt.issues.push({ type: 'large-file', severity: 'medium', value: content.length });
            }

            // Count TODO/FIXME comments
            const todoMatches = content.match(/\b(TODO|FIXME|HACK|XXX)\b/gi) || [];
            if (todoMatches.length > 0) {
                debt.issues.push({ type: 'todos', severity: 'low', value: todoMatches.length });
            }

            // Check for magic numbers
            const magicNumbers = content.match(/(?<![["'])\b\d{3,}\b(?!["'])/g) || [];
            if (magicNumbers.length > 5) {
                debt.issues.push({ type: 'magic-numbers', severity: 'low', value: magicNumbers.length });
            }

            // Check for deep nesting (simplified)
            const nestingScore = estimateNestingDepth(content);
            if (nestingScore > 4) {
                debt.issues.push({ type: 'deep-nesting', severity: 'high', value: nestingScore });
            }

            // Check for long functions (heuristic)
            const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>/g) || [];
            if (functionMatches.length > 10) {
                debt.issues.push({ type: 'many-functions', severity: 'medium', value: functionMatches.length });
            }

            debt.totalScore = calculateFileDebtScore(debt.issues);
            if (debt.totalScore > 0) {
                debtAnalysis.push(debt);
            }
        } catch (err) {
            // Skip files that can't be read
        }
    }

    return debtAnalysis;
}

function estimateNestingDepth(content) {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
        if (char === '{') {
            currentDepth++;
            maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === '}') {
            currentDepth = Math.max(0, currentDepth - 1);
        }
    }

    return maxDepth;
}

function calculateFileDebtScore(issues) {
    return issues.reduce((score, issue) => {
        switch (issue.severity) {
            case 'high': return score + 10;
            case 'medium': return score + 5;
            case 'low': return score + 2;
            default: return score;
        }
    }, 0);
}

function categorizeDebt(debtAnalysis) {
    const categories = {
        'code-complexity': { count: 0, score: 0 },
        'technical-todos': { count: 0, score: 0 },
        'code-style': { count: 0, score: 0 },
        'architecture': { count: 0, score: 0 }
    };

    for (const file of debtAnalysis) {
        for (const issue of file.issues) {
            switch (issue.type) {
                case 'large-file':
                case 'many-functions':
                case 'deep-nesting':
                    categories['code-complexity'].count++;
                    categories['code-complexity'].score += issue.value;
                    break;
                case 'todos':
                    categories['technical-todos'].count++;
                    categories['technical-todos'].score += issue.value;
                    break;
                case 'magic-numbers':
                    categories['code-style'].count++;
                    categories['code-style'].score += issue.value;
                    break;
            }
        }
    }

    return categories;
}

function calculateTotalDebt(debtAnalysis) {
    return debtAnalysis.reduce((total, file) => total + (file.totalScore || 0), 0);
}

function findDebtHotspots(debtAnalysis) {
    return debtAnalysis
        .filter(f => f.totalScore > 10)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10)
        .map(f => ({
            path: f.path,
            score: f.totalScore,
            issueCount: f.issues.length
        }));
}

function estimateFixCost(totalDebt, hotspots) {
    const avgFixCostPerPoint = 30; // minutes
    const estimatedHours = Math.round((totalDebt * avgFixCostPerPoint) / 60);
    return `${estimatedHours} hours`;
}

function generateDebtSummary(debtAnalysis, categories) {
    const totalFiles = debtAnalysis.length;
    const highSeverityFiles = debtAnalysis.filter(f => f.issues.some(i => i.severity === 'high')).length;

    return {
        totalFilesWithDebt: totalFiles,
        highSeverityFiles,
        primaryCategory: Object.entries(categories)
            .sort((a, b) => b[1].count - a[1].count)[0]?.[0] || 'unknown'
    };
}

async function analyzeScalabilityPatterns(projectPath) {
    const patterns = {
        hasMicroservices: false,
        hasCaching: false,
        hasAsyncProcessing: false,
        hasLoadBalancing: false,
        hasDatabaseSharding: false
    };

    try {
        const files = await scanCodeFiles(projectPath, { scanDepth: 2, maxFiles: 100 });

        for (const file of files) {
            try {
                const content = await readFile(file.path, 'utf-8');

                if (content.includes('microservice') || content.includes('docker-compose')) {
                    patterns.hasMicroservices = true;
                }
                if (content.includes('cache') || content.includes('redis') || content.includes('memcached')) {
                    patterns.hasCaching = true;
                }
                if (content.includes('async') || content.includes('queue') || content.includes('worker')) {
                    patterns.hasAsyncProcessing = true;
                }
                if (content.includes('cluster') || content.includes('pm2')) {
                    patterns.hasLoadBalancing = true;
                }
                if (content.includes('shard') || content.includes('partition')) {
                    patterns.hasDatabaseSharding = true;
                }
            } catch (err) {
                // Skip unreadable files
            }
        }
    } catch (err) {
        // Handle scan errors
    }

    return patterns;
}

async function analyzeDataLayer(projectPath) {
    const dataLayer = {
        hasORM: false,
        hasMigrations: false,
        hasIndexes: false,
        databaseType: 'unknown'
    };

    try {
        const files = await scanCodeFiles(projectPath, { scanDepth: 2, maxFiles: 50 });

        for (const file of files) {
            try {
                const content = await readFile(file.path, 'utf-8');
                const lowerContent = content.toLowerCase();

                if (lowerContent.includes('sequelize') || lowerContent.includes('prisma') || lowerContent.includes('typeorm')) {
                    dataLayer.hasORM = true;
                }
                if (lowerContent.includes('migration') || lowerContent.includes('alembic')) {
                    dataLayer.hasMigrations = true;
                }
                if (lowerContent.includes('createindex') || lowerContent.includes('addindex')) {
                    dataLayer.hasIndexes = true;
                }
                if (lowerContent.includes('postgresql') || lowerContent.includes('postgres')) {
                    dataLayer.databaseType = 'postgresql';
                } else if (lowerContent.includes('mongodb') || lowerContent.includes('mongoose')) {
                    dataLayer.databaseType = 'mongodb';
                } else if (lowerContent.includes('mysql')) {
                    dataLayer.databaseType = 'mysql';
                }
            } catch (err) {
                // Skip unreadable files
            }
        }
    } catch (err) {
        // Handle scan errors
    }

    return dataLayer;
}

async function analyzeCachingStrategy(projectPath) {
    return {
        hasInMemoryCache: false,
        hasCDN: false,
        hasCacheInvalidation: false,
        cacheStrategy: 'none'
    };
}

async function analyzeConcurrencyPatterns(projectPath) {
    return {
        hasWorkerThreads: false,
        hasChildProcesses: false,
        hasAsyncAwait: false,
        concurrencyModel: 'single-threaded'
    };
}

function calculateScalabilityScore(archPatterns, dataLayer, caching, concurrency) {
    let score = 0;

    // Architecture patterns (40 points)
    if (archPatterns.hasMicroservices) score += 15;
    if (archPatterns.hasAsyncProcessing) score += 15;
    if (archPatterns.hasCaching) score += 10;

    // Data layer (30 points)
    if (dataLayer.hasORM) score += 10;
    if (dataLayer.hasMigrations) score += 10;
    if (dataLayer.hasIndexes) score += 10;

    // Caching (20 points)
    if (caching.hasInMemoryCache) score += 10;
    if (caching.hasCDN) score += 10;

    // Concurrency (10 points)
    if (concurrency.hasWorkerThreads || concurrency.hasChildProcesses) score += 10;
    else if (concurrency.hasAsyncAwait) score += 5;

    return Math.min(100, score);
}

function identifyScalabilityBottlenecks(archPatterns, dataLayer, caching, concurrency) {
    const bottlenecks = [];

    if (!archPatterns.hasCaching) {
        bottlenecks.push({ type: 'caching', severity: 'high', message: 'No caching layer detected' });
    }
    if (!archPatterns.hasAsyncProcessing) {
        bottlenecks.push({ type: 'async', severity: 'medium', message: 'Synchronous processing may limit throughput' });
    }
    if (!dataLayer.hasIndexes) {
        bottlenecks.push({ type: 'database', severity: 'high', message: 'Missing database indexes may cause slow queries' });
    }
    if (!concurrency.hasAsyncAwait) {
        bottlenecks.push({ type: 'concurrency', severity: 'medium', message: 'Limited async/await usage may block event loop' });
    }

    return bottlenecks;
}

function determineGrowthTrajectory(scalabilityScore, bottlenecks) {
    if (scalabilityScore > 70 && bottlenecks.length === 0) {
        return ['prepared', 'scalable', 'enterprise-ready'];
    } else if (scalabilityScore > 50) {
        return ['moderate', 'scalable-with-upgrades', 'needs-optimization'];
    } else {
        return ['limited', 'growth-constrained', 'requires-architecture-changes'];
    }
}

function generateScalabilityRecommendations(scalabilityScore, bottlenecks) {
    const recommendations = [];

    if (scalabilityScore < 50) {
        recommendations.push('Consider implementing a caching layer (Redis/Memcached)');
        recommendations.push('Add database indexes for frequently queried columns');
        recommendations.push('Implement async/await patterns for non-blocking operations');
    }

    for (const bottleneck of bottlenecks) {
        if (bottleneck.severity === 'high') {
            recommendations.push(`Critical: Address ${bottleneck.type} bottleneck - ${bottleneck.message}`);
        }
    }

    if (scalabilityScore > 70) {
        recommendations.push('Architecture is well-prepared for growth');
    }

    return recommendations;
}

async function analyzeBusinessLogic(projectPath) {
    return {
        hasAuthentication: false,
        hasPaymentProcessing: false,
        hasDataExport: false,
        hasReporting: false,
        hasNotifications: false,
        hasSearch: false,
        complexityScore: 0
    };
}

async function analyzeFeatures(projectPath) {
    return {
        totalFeatures: 0,
        coreFeatures: [],
        niceToHaveFeatures: [],
        missingFeatures: []
    };
}

async function analyzeIntegrations(projectPath) {
    return {
        hasAPIs: false,
        hasWebhooks: false,
        hasThirdParty: false,
        integrationCount: 0
    };
}

function calculateImpactScore(businessLogic, features, integrations) {
    let score = 50;

    if (businessLogic.hasAuthentication) score += 10;
    if (businessLogic.hasPaymentProcessing) score += 20;
    if (businessLogic.hasDataExport) score += 5;
    if (businessLogic.hasReporting) score += 10;
    if (businessLogic.hasNotifications) score += 5;
    if (businessLogic.hasSearch) score += 5;

    if (integrations.hasAPIs) score += 10;
    if (integrations.hasWebhooks) score += 5;
    if (integrations.hasThirdParty) score += 5;

    return Math.min(100, score);
}

function estimateROI(impactScore, businessLogic, integrations) {
    const baseROI = impactScore * 10; // Simple estimation
    const complexityFactor = businessLogic.complexityScore > 50 ? 0.7 : 1;
    const integrationFactor = integrations.integrationCount > 5 ? 1.3 : 1;

    return Math.round(baseROI * complexityFactor * integrationFactor);
}

function identifyValueDrivers(businessLogic, features, integrations) {
    const drivers = [];

    if (businessLogic.hasPaymentProcessing) {
        drivers.push('Revenue-generating payment processing');
    }
    if (businessLogic.hasAuthentication) {
        drivers.push('Secure user authentication enables multi-tenancy');
    }
    if (businessLogic.hasReporting) {
        drivers.push('Analytics and reporting drive data-driven decisions');
    }
    if (integrations.hasAPIs) {
        drivers.push('API-first architecture enables integrations and partnerships');
    }

    return drivers;
}

function identifyRiskFactors(projectPath, businessLogic, integrations) {
    const risks = [];

    if (!businessLogic.hasAuthentication) {
        risks.push({ type: 'security', severity: 'high', message: 'No authentication system' });
    }
    if (integrations.integrationCount > 10) {
        risks.push({ type: 'complexity', severity: 'medium', message: 'High integration complexity' });
    }

    return risks;
}

function calculatePriority(impactScore, roiEstimation) {
    return Math.round((impactScore + roiEstimation / 10) / 2);
}

function generateValueRecommendations(impactScore, valueDrivers, riskFactors) {
    const recommendations = [];

    if (riskFactors.length > 0) {
        recommendations.push(`Address ${riskFactors.length} high-priority risks before scaling`);
    }

    if (valueDrivers.length < 3) {
        recommendations.push('Consider adding more core business features to increase value');
    }

    if (impactScore < 50) {
        recommendations.push('Focus on high-impact features first');
    }

    return recommendations;
}

function inferArchitecturePattern(structure) {
    const langs = structure.languages;

    if (langs['.tsx'] || langs['.jsx']) {
        return 'component-based';
    }
    if (langs['.py']) {
        return langs['.py'] > 20 ? 'layered' : 'modular';
    }
    if (langs['.java']) {
        return 'layered';
    }
    if (langs['.go']) {
        return 'microservices';
    }

    return 'modular';
}

export default {
    analyzeStrategicDirection,
    assessTechnicalDebt,
    evaluateScalability,
    measureBusinessValue
};