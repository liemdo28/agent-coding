/**
 * ProjectDNA.js — Project Health, Risk & Intelligence Profile
 *
 * Every project gets a complete DNA profile:
 * - Health score (0-1)
 * - Risk score (0-1)
 * - Architecture profile
 * - Business profile
 * - Knowledge density
 * - Technical debt estimate
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ProjectDNA extends EventEmitter {
    #profiles = new Map();
    #config;
    #stats = {
        profilesGenerated: 0,
        assessmentsRun: 0,
    };

    constructor(config = {}) {
        super();
        this.#config = config;
    }

    /**
     * Generate a full DNA profile for a project.
     * @param {object} projectData - From WorkspaceGraph or ProjectIntelligence
     * @returns {object} Complete DNA profile
     */
    generateProfile(projectData) {
        this.#stats.profilesGenerated++;

        const profile = {
            id: randomUUID(),
            project: projectData.name,
            path: projectData.path,
            generatedAt: Date.now(),
            health: this.#assessHealth(projectData),
            risk: this.#assessRisk(projectData),
            architecture: this.#assessArchitecture(projectData),
            business: this.#assessBusiness(projectData),
            knowledgeDensity: this.#assessKnowledgeDensity(projectData),
            technicalDebt: this.#assessTechnicalDebt(projectData),
            maturity: this.#assessMaturity(projectData),
            summary: '',
        };

        profile.summary = this.#generateSummary(profile);
        this.#profiles.set(projectData.name, profile);

        this.emit('profile:generated', profile);
        return profile;
    }

    /**
     * Get a stored profile.
     */
    getProfile(projectName) {
        return this.#profiles.get(projectName) || null;
    }

    /**
     * Compare two projects.
     */
    compare(projectA, projectB) {
        const a = this.#profiles.get(projectA);
        const b = this.#profiles.get(projectB);
        if (!a || !b) return null;

        return {
            health: { a: a.health.score, b: b.health.score, diff: a.health.score - b.health.score },
            risk: { a: a.risk.score, b: b.risk.score, diff: a.risk.score - b.risk.score },
            maturity: { a: a.maturity.level, b: b.maturity.level },
            technicalDebt: { a: a.technicalDebt.score, b: b.technicalDebt.score },
        };
    }

    /**
     * Get projects ranked by health.
     */
    rankByHealth() {
        return [...this.#profiles.values()]
            .sort((a, b) => b.health.score - a.health.score)
            .map(p => ({ project: p.project, health: p.health.score, risk: p.risk.score }));
    }

    /**
     * Get projects ranked by risk (highest risk first).
     */
    rankByRisk() {
        return [...this.#profiles.values()]
            .sort((a, b) => b.risk.score - a.risk.score)
            .map(p => ({ project: p.project, risk: p.risk.score, factors: p.risk.factors }));
    }

    // --- Assessment Engines ---

    #assessHealth(data) {
        let score = 0.5;
        const factors = [];

        // Has tests
        if (data.files?.some(f => f.includes('test') || f.includes('spec'))) {
            score += 0.15;
            factors.push({ factor: 'has-tests', impact: 0.15 });
        } else {
            factors.push({ factor: 'no-tests', impact: -0.1 });
            score -= 0.1;
        }

        // Has CI
        if (data.files?.includes('.github') || data.files?.includes('.gitlab-ci.yml')) {
            score += 0.1;
            factors.push({ factor: 'has-ci', impact: 0.1 });
        }

        // Has docs
        if (data.files?.some(f => f.toLowerCase().includes('readme') || f === 'docs')) {
            score += 0.1;
            factors.push({ factor: 'has-docs', impact: 0.1 });
        }

        // Active status
        if (data.status === 'active') {
            score += 0.15;
            factors.push({ factor: 'active', impact: 0.15 });
        } else if (data.status === 'dead') {
            score -= 0.3;
            factors.push({ factor: 'dead', impact: -0.3 });
        }

        // Reasonable dependency count
        const depCount = data.dependencies?.length || 0;
        if (depCount > 0 && depCount < 50) {
            score += 0.05;
        } else if (depCount > 100) {
            score -= 0.1;
            factors.push({ factor: 'too-many-deps', impact: -0.1, count: depCount });
        }

        score = Math.max(0, Math.min(1, score));
        return { score: Math.round(score * 100) / 100, factors };
    }

    #assessRisk(data) {
        let score = 0.2; // Base risk
        const factors = [];

        // No tests = high risk
        if (!data.files?.some(f => f.includes('test') || f.includes('spec'))) {
            score += 0.2;
            factors.push('no-tests');
        }

        // Dead project = risk
        if (data.status === 'dead' || data.status === 'inactive') {
            score += 0.15;
            factors.push('inactive-project');
        }

        // Too many dependencies
        if ((data.dependencies?.length || 0) > 80) {
            score += 0.15;
            factors.push('dependency-bloat');
        }

        // No TypeScript in large project
        if (data.language === 'javascript' && (data.dependencies?.length || 0) > 30) {
            score += 0.1;
            factors.push('no-type-safety');
        }

        // No security headers for backend
        if (data.type === 'backend' && data.dependencies && !data.dependencies.includes('helmet')) {
            score += 0.1;
            factors.push('no-security-headers');
        }

        score = Math.max(0, Math.min(1, score));
        return { score: Math.round(score * 100) / 100, factors };
    }

    #assessArchitecture(data) {
        const patterns = [];
        const issues = [];

        if (data.type === 'monorepo') patterns.push('monorepo');
        if (data.type === 'frontend') patterns.push('spa');
        if (data.type === 'backend') patterns.push('api-server');

        if (data.frameworks?.length > 2) {
            issues.push('multiple-frameworks');
        }

        const depCount = data.dependencies?.length || 0;
        if (depCount > 100) issues.push('dependency-bloat');

        return {
            patterns,
            issues,
            type: data.type,
            frameworks: data.frameworks || [],
            language: data.language,
            complexity: depCount > 50 ? 'high' : depCount > 20 ? 'medium' : 'low',
        };
    }

    #assessBusiness(data) {
        const profile = {
            purpose: data.description || null,
            type: 'unknown',
            criticality: 'medium',
        };

        // Infer from frameworks
        if (data.frameworks?.includes('Next.js') || data.frameworks?.includes('Nuxt')) {
            profile.type = 'web-application';
        } else if (data.frameworks?.includes('Express') || data.frameworks?.includes('Fastify')) {
            profile.type = 'api-service';
        } else if (data.frameworks?.includes('Electron')) {
            profile.type = 'desktop-app';
        }

        // Infer criticality from dependencies
        if (data.dependencies?.some(d => ['stripe', 'paypal', 'braintree'].includes(d))) {
            profile.criticality = 'high';
            profile.hasPayments = true;
        }
        if (data.dependencies?.some(d => ['passport', 'next-auth', 'auth0'].includes(d))) {
            profile.hasAuth = true;
        }

        return profile;
    }

    #assessKnowledgeDensity(data) {
        let density = 0;

        if (data.files?.some(f => f.toLowerCase().includes('readme'))) density += 0.2;
        if (data.files?.some(f => f === 'docs' || f === 'documentation')) density += 0.2;
        if (data.files?.some(f => f === 'CHANGELOG.md' || f === 'CHANGES.md')) density += 0.15;
        if (data.files?.some(f => f === 'CONTRIBUTING.md')) density += 0.15;
        if (data.files?.some(f => f.includes('.md'))) density += 0.1;
        if (data.metrics?.scripts?.length > 5) density += 0.1;
        if (data.description) density += 0.1;

        return { score: Math.min(1, Math.round(density * 100) / 100) };
    }

    #assessTechnicalDebt(data) {
        let score = 0;
        const indicators = [];

        if (data.language === 'javascript' && (data.dependencies?.length || 0) > 20) {
            score += 0.2;
            indicators.push('no-typescript');
        }

        if (!data.files?.some(f => f.includes('test'))) {
            score += 0.25;
            indicators.push('no-tests');
        }

        if ((data.dependencies?.length || 0) > 80) {
            score += 0.15;
            indicators.push('dependency-bloat');
        }

        if (data.status === 'inactive') {
            score += 0.1;
            indicators.push('unmaintained');
        }

        return { score: Math.min(1, Math.round(score * 100) / 100), indicators };
    }

    #assessMaturity(data) {
        let level = 'prototype';

        const hasTests = data.files?.some(f => f.includes('test'));
        const hasDocs = data.files?.some(f => f.toLowerCase().includes('readme'));
        const hasCI = data.files?.some(f => f.includes('.github') || f.includes('ci'));
        const isActive = data.status === 'active';

        if (hasTests && hasDocs && hasCI && isActive) level = 'production';
        else if (hasTests && hasDocs && isActive) level = 'mature';
        else if (hasDocs && isActive) level = 'growing';
        else if (isActive) level = 'early';

        return { level, hasTests: !!hasTests, hasDocs: !!hasDocs, hasCI: !!hasCI };
    }

    #generateSummary(profile) {
        const parts = [
            `${profile.project}: ${profile.maturity.level} ${profile.architecture.type}`,
            `Health: ${Math.round(profile.health.score * 100)}%`,
            `Risk: ${Math.round(profile.risk.score * 100)}%`,
            profile.business.purpose ? `Purpose: ${profile.business.purpose}` : '',
        ];
        return parts.filter(Boolean).join(' | ');
    }

    getStats() {
        return { ...this.#stats, storedProfiles: this.#profiles.size };
    }
}
