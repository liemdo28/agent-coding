/**
 * StrategicEngine.js — Autonomous Strategic AI
 *
 * AI autonomously proposes:
 * - Architecture redesign
 * - Dependency cleanup
 * - Scaling strategy
 * - Performance optimization
 * - Technical debt reduction
 * - Security improvements
 *
 * Uses project intelligence + memory + timeline to generate proposals.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class StrategicEngine extends EventEmitter {
    #config;
    #memory;
    #intelligence;
    #timeline;
    #nervousSystem;
    #proposals = [];
    #maxProposals;
    #stats = {
        proposalsGenerated: 0,
        proposalsAccepted: 0,
        proposalsRejected: 0,
        analysesRun: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            maxProposals: config.maxProposals || 100,
            minConfidence: config.minConfidence || 0.6,
            ...config,
        };
        this.#memory = deps.memory;
        this.#intelligence = deps.intelligence;
        this.#timeline = deps.timeline;
        this.#nervousSystem = deps.nervousSystem;
        this.#maxProposals = this.#config.maxProposals;
    }

    /**
     * Run a full strategic analysis for a project.
     * @param {object} projectProfile - From ProjectIntelligence.analyze()
     * @returns {object} Strategic analysis with proposals
     */
    async analyze(projectProfile) {
        this.#stats.analysesRun++;
        const proposals = [];

        // Run all strategy analyzers
        const analyzers = [
            this.#analyzeArchitecture.bind(this),
            this.#analyzeDependencies.bind(this),
            this.#analyzePerformance.bind(this),
            this.#analyzeScaling.bind(this),
            this.#analyzeTechnicalDebt.bind(this),
            this.#analyzeSecurity.bind(this),
        ];

        for (const analyzer of analyzers) {
            try {
                const result = await analyzer(projectProfile);
                if (result.length > 0) {
                    proposals.push(...result);
                }
            } catch {
                // Analyzer failed — continue
            }
        }

        // Score and rank proposals
        const ranked = proposals
            .filter(p => p.confidence >= this.#config.minConfidence)
            .sort((a, b) => b.impact - a.impact || b.confidence - a.confidence);

        // Store proposals
        for (const proposal of ranked) {
            this.#storeProposal(proposal);
        }

        const analysis = {
            id: randomUUID(),
            project: projectProfile.name,
            timestamp: Date.now(),
            proposals: ranked,
            summary: this.#generateStrategicSummary(ranked, projectProfile),
        };

        this.emit('analysis:complete', analysis);
        return analysis;
    }

    /**
     * Get pending proposals for a project.
     */
    getProposals(project, status = 'pending') {
        return this.#proposals
            .filter(p => (!project || p.project === project) && p.status === status)
            .sort((a, b) => b.impact - a.impact);
    }

    /**
     * Accept a proposal (mark for implementation).
     */
    acceptProposal(proposalId) {
        const proposal = this.#proposals.find(p => p.id === proposalId);
        if (proposal) {
            proposal.status = 'accepted';
            proposal.acceptedAt = Date.now();
            this.#stats.proposalsAccepted++;
            this.emit('proposal:accepted', proposal);
        }
        return proposal;
    }

    /**
     * Reject a proposal.
     */
    rejectProposal(proposalId, reason) {
        const proposal = this.#proposals.find(p => p.id === proposalId);
        if (proposal) {
            proposal.status = 'rejected';
            proposal.rejectedAt = Date.now();
            proposal.rejectionReason = reason;
            this.#stats.proposalsRejected++;
            this.emit('proposal:rejected', proposal);
        }
        return proposal;
    }

    /**
     * Generate optimization recommendations based on runtime data.
     */
    async generateOptimizations() {
        const recommendations = [];

        // Check nervous system for performance issues
        if (this.#nervousSystem) {
            const health = this.#nervousSystem.assessHealth();
            if (health.status !== 'healthy') {
                for (const risk of health.risks) {
                    recommendations.push({
                        type: 'runtime-optimization',
                        category: risk.type,
                        description: `Address ${risk.type} issue (severity: ${risk.severity})`,
                        priority: risk.severity === 'high' ? 'critical' : 'medium',
                    });
                }
            }
        }

        // Check timeline for recurring failures
        if (this.#timeline) {
            const trends = this.#timeline.getTrends(3600000); // Last hour
            if (trends.failureRate > 0.2) {
                recommendations.push({
                    type: 'reliability',
                    category: 'failure-rate',
                    description: `High failure rate (${Math.round(trends.failureRate * 100)}%) — investigate root causes`,
                    priority: 'high',
                });
            }
        }

        return recommendations;
    }

    // --- Strategy Analyzers ---

    async #analyzeArchitecture(profile) {
        const proposals = [];
        const patterns = profile.architecture?.patterns || [];
        const fileCount = profile.architecture?.graph?.fileCount || 0;

        // Large project without clear architecture
        if (fileCount > 50 && patterns.length < 2) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'architecture-redesign',
                title: 'Introduce clear architectural patterns',
                description: `Project has ${fileCount} files but lacks clear architecture. Consider adopting modular or layered architecture.`,
                impact: 0.8,
                effort: 'high',
                confidence: 0.7,
                category: 'architecture',
            }));
        }

        // No tests detected
        if (!profile.architecture?.hasTests) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'testing-strategy',
                title: 'Add test infrastructure',
                description: 'No test directory detected. Add unit and integration tests for reliability.',
                impact: 0.7,
                effort: 'medium',
                confidence: 0.9,
                category: 'quality',
            }));
        }

        // No CI detected
        if (!profile.architecture?.hasCI) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'ci-setup',
                title: 'Set up CI/CD pipeline',
                description: 'No CI configuration found. Automate testing and deployment.',
                impact: 0.6,
                effort: 'medium',
                confidence: 0.85,
                category: 'devops',
            }));
        }

        return proposals;
    }

    async #analyzeDependencies(profile) {
        const proposals = [];
        const prodDeps = profile.dependencies?.production || [];
        const devDeps = profile.dependencies?.development || [];

        // Too many dependencies
        if (prodDeps.length > 50) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'dependency-cleanup',
                title: 'Reduce dependency count',
                description: `${prodDeps.length} production dependencies detected. Audit and remove unused packages.`,
                impact: 0.5,
                effort: 'medium',
                confidence: 0.75,
                category: 'maintenance',
            }));
        }

        // No TypeScript in a large project
        if (!devDeps.includes('typescript') && prodDeps.length > 20) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'typescript-migration',
                title: 'Consider TypeScript migration',
                description: 'Large project without TypeScript. Type safety would reduce runtime errors.',
                impact: 0.7,
                effort: 'high',
                confidence: 0.65,
                category: 'quality',
            }));
        }

        return proposals;
    }

    async #analyzePerformance(profile) {
        const proposals = [];
        const frameworks = profile.stack?.frameworks || [];

        // No bundler in a frontend project
        if ((frameworks.includes('React') || frameworks.includes('Vue')) && !profile.stack?.tools?.includes('Bundler')) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'performance-bundler',
                title: 'Add build optimization',
                description: 'Frontend framework detected without bundler. Add Vite or esbuild for faster builds.',
                impact: 0.6,
                effort: 'low',
                confidence: 0.8,
                category: 'performance',
            }));
        }

        return proposals;
    }

    async #analyzeScaling(profile) {
        const proposals = [];

        // Check if project has database but no connection pooling signals
        const deps = [...(profile.dependencies?.production || [])];
        const hasDB = deps.some(d => ['pg', 'mysql2', 'mongoose', 'prisma', '@prisma/client'].includes(d));
        const hasPool = deps.some(d => ['pg-pool', 'generic-pool'].includes(d));

        if (hasDB && !hasPool && !deps.includes('prisma')) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'scaling-db-pool',
                title: 'Add database connection pooling',
                description: 'Database dependency detected without explicit pooling. Add connection pooling for scalability.',
                impact: 0.6,
                effort: 'low',
                confidence: 0.7,
                category: 'scaling',
            }));
        }

        return proposals;
    }

    async #analyzeTechnicalDebt(profile) {
        const proposals = [];

        // Check for outdated patterns
        if (profile.stack?.type === 'commonjs' && profile.stack?.runtime === 'node') {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'esm-migration',
                title: 'Migrate to ES Modules',
                description: 'Project uses CommonJS. Consider migrating to ESM for better tree-shaking and modern tooling.',
                impact: 0.4,
                effort: 'medium',
                confidence: 0.7,
                category: 'modernization',
            }));
        }

        return proposals;
    }

    async #analyzeSecurity(profile) {
        const proposals = [];
        const deps = profile.dependencies?.production || [];

        // Check for known security-sensitive patterns
        if (deps.includes('express') && !deps.includes('helmet')) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'security-headers',
                title: 'Add security headers (helmet)',
                description: 'Express detected without helmet. Add security headers to protect against common attacks.',
                impact: 0.7,
                effort: 'low',
                confidence: 0.9,
                category: 'security',
            }));
        }

        if (deps.includes('express') && !deps.includes('express-rate-limit') && !deps.includes('rate-limiter-flexible')) {
            proposals.push(this.#createProposal({
                project: profile.name,
                type: 'rate-limiting',
                title: 'Add rate limiting',
                description: 'API server without rate limiting. Add protection against abuse.',
                impact: 0.6,
                effort: 'low',
                confidence: 0.85,
                category: 'security',
            }));
        }

        return proposals;
    }

    // --- Helpers ---

    #createProposal(data) {
        return {
            id: randomUUID(),
            createdAt: Date.now(),
            status: 'pending',
            ...data,
        };
    }

    #storeProposal(proposal) {
        this.#proposals.push(proposal);
        this.#stats.proposalsGenerated++;

        if (this.#proposals.length > this.#maxProposals) {
            // Remove oldest rejected proposals first
            const rejected = this.#proposals.filter(p => p.status === 'rejected');
            if (rejected.length > 0) {
                this.#proposals = this.#proposals.filter(p => p.status !== 'rejected').concat(rejected.slice(-10));
            } else {
                this.#proposals = this.#proposals.slice(-this.#maxProposals);
            }
        }

        this.emit('proposal:created', proposal);
    }

    #generateStrategicSummary(proposals, profile) {
        if (proposals.length === 0) {
            return `Project "${profile.name}" is in good shape. No strategic improvements needed at this time.`;
        }

        const categories = [...new Set(proposals.map(p => p.category))];
        const highImpact = proposals.filter(p => p.impact >= 0.7);

        return [
            `Strategic analysis for "${profile.name}":`,
            `${proposals.length} improvement(s) identified across ${categories.length} category(ies).`,
            highImpact.length > 0 ? `${highImpact.length} high-impact proposal(s) available.` : '',
            `Categories: ${categories.join(', ')}`,
        ].filter(Boolean).join(' ');
    }

    getStats() {
        return { ...this.#stats, pendingProposals: this.#proposals.filter(p => p.status === 'pending').length };
    }
}
