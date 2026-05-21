/**
 * WorkspaceGraph.js — Global Workspace Intelligence
 *
 * Recursively understands the entire workspace:
 * - Detects git repos, monorepos, dead repos, active repos
 * - Maps language stacks, shared dependencies
 * - Builds a topology graph of all projects
 *
 * AI can answer: "which projects use websocket?", "what repos are dead?"
 */

import { EventEmitter } from 'events';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';

export class WorkspaceGraph extends EventEmitter {
    #config;
    #graph = { nodes: [], edges: [], metadata: {} };
    #projects = new Map();
    #stats = {
        projectsDiscovered: 0,
        scansCompleted: 0,
        lastScanAt: null,
    };

    constructor(config = {}) {
        super();
        this.#config = {
            maxDepth: config.maxDepth || 3,
            ignoreDirs: config.ignoreDirs || ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv'],
            ...config,
        };
    }

    /**
     * Scan a workspace root and build the project graph.
     * @param {string} rootPath - Workspace root directory
     * @returns {object} Workspace graph
     */
    async scan(rootPath) {
        this.#stats.scansCompleted++;
        this.#stats.lastScanAt = Date.now();
        this.#projects.clear();
        this.#graph = { nodes: [], edges: [], metadata: { root: rootPath, scannedAt: Date.now() } };

        const entries = this.#listDirs(rootPath);

        for (const entry of entries) {
            const fullPath = join(rootPath, entry);
            const project = this.#analyzeProject(fullPath);
            if (project) {
                this.#projects.set(project.path, project);
                this.#graph.nodes.push(project);
                this.#stats.projectsDiscovered++;
            }
        }

        // Build dependency edges
        this.#buildEdges();

        this.emit('scan:complete', { projects: this.#projects.size, root: rootPath });
        return this.getGraph();
    }

    /**
     * Get the full workspace graph.
     */
    getGraph() {
        return {
            ...this.#graph,
            summary: {
                totalProjects: this.#graph.nodes.length,
                byLanguage: this.#groupBy('language'),
                byStatus: this.#groupBy('status'),
                byType: this.#groupBy('type'),
                sharedDependencies: this.#findSharedDeps(),
            },
        };
    }

    /**
     * Get a specific project by path or name.
     */
    getProject(nameOrPath) {
        for (const [path, project] of this.#projects) {
            if (path === nameOrPath || project.name === nameOrPath) {
                return project;
            }
        }
        return null;
    }

    /**
     * Query projects by criteria.
     * @param {object} query - { language?, framework?, hasDep?, status?, type? }
     */
    query(query = {}) {
        let results = [...this.#projects.values()];

        if (query.language) results = results.filter(p => p.language === query.language);
        if (query.framework) results = results.filter(p => p.frameworks?.includes(query.framework));
        if (query.hasDep) results = results.filter(p => p.dependencies?.includes(query.hasDep));
        if (query.status) results = results.filter(p => p.status === query.status);
        if (query.type) results = results.filter(p => p.type === query.type);
        if (query.hasFile) results = results.filter(p => p.files?.includes(query.hasFile));

        return results;
    }

    /**
     * Find projects using a specific dependency.
     */
    findByDependency(dep) {
        return this.query({ hasDep: dep });
    }

    /**
     * Find dead/inactive projects.
     */
    findDeadProjects() {
        return this.query({ status: 'dead' });
    }

    /**
     * Find duplicated dependencies across projects.
     */
    findDuplicatedDeps() {
        const depMap = new Map();
        for (const project of this.#projects.values()) {
            for (const dep of project.dependencies || []) {
                if (!depMap.has(dep)) depMap.set(dep, []);
                depMap.get(dep).push(project.name);
            }
        }
        return [...depMap.entries()]
            .filter(([, projects]) => projects.length > 1)
            .map(([dep, projects]) => ({ dep, usedBy: projects, count: projects.length }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Get dependency relationships between projects.
     */
    getProjectDependencies(projectName) {
        return this.#graph.edges.filter(e => e.from === projectName || e.to === projectName);
    }

    // --- Internal ---

    #analyzeProject(dirPath) {
        const name = basename(dirPath);
        const hasGit = existsSync(join(dirPath, '.git'));
        const hasPkgJson = existsSync(join(dirPath, 'package.json'));
        const hasPySetup = existsSync(join(dirPath, 'setup.py')) || existsSync(join(dirPath, 'pyproject.toml'));
        const hasCargo = existsSync(join(dirPath, 'Cargo.toml'));
        const hasGoMod = existsSync(join(dirPath, 'go.mod'));

        // Must be a recognizable project
        if (!hasGit && !hasPkgJson && !hasPySetup && !hasCargo && !hasGoMod) return null;

        const project = {
            id: randomUUID(),
            name,
            path: dirPath,
            language: this.#detectLanguage(dirPath, { hasPkgJson, hasPySetup, hasCargo, hasGoMod }),
            type: 'unknown',
            frameworks: [],
            dependencies: [],
            status: 'unknown',
            hasGit,
            files: this.#listTopFiles(dirPath),
            metrics: {},
        };

        // Parse package.json for Node projects
        if (hasPkgJson) {
            this.#enrichFromPackageJson(project, dirPath);
        }

        // Detect project type
        project.type = this.#detectProjectType(project);

        // Detect status (active/dead)
        project.status = this.#detectStatus(project, dirPath);

        return project;
    }

    #enrichFromPackageJson(project, dirPath) {
        try {
            const pkg = JSON.parse(readFileSync(join(dirPath, 'package.json'), 'utf8'));
            const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
            project.dependencies = allDeps;
            project.metrics.depCount = allDeps.length;

            // Detect frameworks
            const frameworkMap = {
                'react': 'React', 'next': 'Next.js', 'vue': 'Vue', 'nuxt': 'Nuxt',
                'angular': 'Angular', 'svelte': 'Svelte', 'express': 'Express',
                'fastify': 'Fastify', 'nest': 'NestJS', 'electron': 'Electron',
            };
            for (const [dep, name] of Object.entries(frameworkMap)) {
                if (allDeps.includes(dep)) project.frameworks.push(name);
            }

            // Detect monorepo
            if (pkg.workspaces || existsSync(join(dirPath, 'lerna.json')) || existsSync(join(dirPath, 'pnpm-workspace.yaml'))) {
                project.type = 'monorepo';
            }

            project.metrics.scripts = Object.keys(pkg.scripts || {});
            project.description = pkg.description;
        } catch { /* ignore parse errors */ }
    }

    #detectLanguage(dirPath, flags) {
        if (flags.hasCargo) return 'rust';
        if (flags.hasGoMod) return 'go';
        if (flags.hasPySetup) return 'python';
        if (flags.hasPkgJson) {
            if (existsSync(join(dirPath, 'tsconfig.json'))) return 'typescript';
            return 'javascript';
        }
        return 'unknown';
    }

    #detectProjectType(project) {
        if (project.type === 'monorepo') return 'monorepo';
        if (project.frameworks.some(f => ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt'].includes(f))) return 'frontend';
        if (project.frameworks.some(f => ['Express', 'Fastify', 'NestJS'].includes(f))) return 'backend';
        if (project.dependencies.includes('electron')) return 'desktop';
        if (project.files?.includes('Dockerfile')) return 'service';
        return 'library';
    }

    #detectStatus(project, dirPath) {
        // Check git activity
        if (project.hasGit) {
            try {
                const headPath = join(dirPath, '.git', 'HEAD');
                if (existsSync(headPath)) {
                    const stat = statSync(headPath);
                    const daysSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
                    if (daysSinceModified > 180) return 'dead';
                    if (daysSinceModified > 60) return 'inactive';
                    return 'active';
                }
            } catch { /* ignore */ }
        }
        return 'unknown';
    }

    #buildEdges() {
        const projectNames = new Set([...this.#projects.values()].map(p => p.name));

        for (const project of this.#projects.values()) {
            // Check if any dependency matches another project name
            for (const dep of project.dependencies || []) {
                if (projectNames.has(dep) && dep !== project.name) {
                    this.#graph.edges.push({
                        from: project.name,
                        to: dep,
                        type: 'depends-on',
                    });
                }
            }
        }
    }

    #findSharedDeps() {
        const depCount = new Map();
        for (const project of this.#projects.values()) {
            for (const dep of project.dependencies || []) {
                depCount.set(dep, (depCount.get(dep) || 0) + 1);
            }
        }
        return [...depCount.entries()]
            .filter(([, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([dep, count]) => ({ dep, count }));
    }

    #groupBy(field) {
        const groups = {};
        for (const project of this.#projects.values()) {
            const value = project[field] || 'unknown';
            groups[value] = (groups[value] || 0) + 1;
        }
        return groups;
    }

    #listDirs(dirPath) {
        try {
            return readdirSync(dirPath).filter(entry => {
                if (entry.startsWith('.') || this.#config.ignoreDirs.includes(entry)) return false;
                const full = join(dirPath, entry);
                try { return statSync(full).isDirectory(); } catch { return false; }
            });
        } catch { return []; }
    }

    #listTopFiles(dirPath) {
        try {
            return readdirSync(dirPath).filter(entry => {
                const full = join(dirPath, entry);
                try { return statSync(full).isFile(); } catch { return false; }
            }).slice(0, 30);
        } catch { return []; }
    }

    getStats() {
        return { ...this.#stats, currentProjects: this.#projects.size };
    }
}
