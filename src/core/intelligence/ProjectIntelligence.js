/**
 * ProjectIntelligence.js — AI understands project architecture
 *
 * Parses: README, package.json, dependency graph, architecture
 * Produces: project profile with stack, purpose, features, dependencies
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import { randomUUID } from 'crypto';

export class ProjectIntelligence {
    #config;
    #memory;
    #semantic;
    #parsers;

    constructor(config = {}, deps = {}) {
        this.#config = config;
        this.#memory = deps.memory;
        this.#semantic = deps.semantic;
        this.#parsers = {
            'readme': this.#parseReadme.bind(this),
            'package-json': this.#parsePackageJson.bind(this),
            'dependency-graph': this.#parseDependencyGraph.bind(this),
            'architecture': this.#parseArchitecture.bind(this),
        };
    }

    /**
     * Analyze a project directory and build a full intelligence profile.
     * @param {string} projectPath
     * @returns {Promise<object>} project profile
     */
    async analyze(projectPath) {
        const profile = {
            id: randomUUID(),
            path: projectPath,
            name: basename(projectPath),
            analyzedAt: Date.now(),
            stack: {},
            purpose: null,
            features: [],
            dependencies: { production: [], development: [] },
            architecture: {},
            health: {},
        };

        // Run all configured parsers
        const parserNames = this.#config.parsers || Object.keys(this.#parsers);
        for (const name of parserNames) {
            const parser = this.#parsers[name];
            if (parser) {
                try {
                    const result = await parser(projectPath);
                    this.#mergeIntoProfile(profile, result);
                } catch {
                    // Parser failed — continue with others
                }
            }
        }

        // Store in memory for future reference
        if (this.#memory) {
            await this.#memory.setProjectMemory(projectPath, 'profile', profile);
        }

        // Index in semantic search
        if (this.#semantic) {
            await this.#semantic.index({
                id: profile.id,
                type: 'project',
                path: projectPath,
                content: this.#profileToText(profile),
                metadata: { name: profile.name, stack: profile.stack },
            });
        }

        return profile;
    }

    /**
     * Enrich a task with project intelligence context.
     * @param {object} task
     * @returns {Promise<object>} enriched task
     */
    async enrichTask(task) {
        const enriched = { ...task, id: task.id || randomUUID() };

        if (task.project && this.#memory) {
            const profile = await this.#memory.getProjectMemory(task.project, 'profile');
            if (profile) {
                enriched.context = {
                    stack: profile.stack,
                    architecture: profile.architecture,
                    recentIssues: profile.health?.recentIssues || [],
                };
            }
        }

        return enriched;
    }

    // --- Parsers ---

    #parseReadme(projectPath) {
        const readmePaths = ['README.md', 'readme.md', 'README.txt', 'README'];
        let content = null;

        for (const name of readmePaths) {
            const p = join(projectPath, name);
            if (existsSync(p)) {
                content = readFileSync(p, 'utf8');
                break;
            }
        }

        if (!content) return {};

        // Extract purpose from first paragraph
        const lines = content.split('\n').filter(l => l.trim());
        const title = lines.find(l => l.startsWith('#'))?.replace(/^#+\s*/, '') || null;
        const description = lines.find(l => !l.startsWith('#') && l.length > 20) || null;

        // Extract features from bullet lists
        const features = [];
        const featureRegex = /^[-*]\s+(.+)/gm;
        let match;
        while ((match = featureRegex.exec(content)) !== null) {
            if (features.length < 20) {
                features.push(match[1].trim());
            }
        }

        return {
            purpose: description,
            title,
            features,
        };
    }

    #parsePackageJson(projectPath) {
        const pkgPath = join(projectPath, 'package.json');
        if (!existsSync(pkgPath)) return {};

        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        const stack = {
            runtime: 'node',
            type: pkg.type || 'commonjs',
            name: pkg.name,
            version: pkg.version,
        };

        // Detect frameworks
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const frameworks = [];
        const frameworkMap = {
            'react': 'React',
            'vue': 'Vue',
            'angular': 'Angular',
            'express': 'Express',
            'fastify': 'Fastify',
            'next': 'Next.js',
            'nuxt': 'Nuxt',
            'svelte': 'Svelte',
            'electron': 'Electron',
        };

        for (const [dep, name] of Object.entries(frameworkMap)) {
            if (allDeps[dep]) frameworks.push(name);
        }
        stack.frameworks = frameworks;

        // Detect tools
        const tools = [];
        if (allDeps['typescript']) tools.push('TypeScript');
        if (allDeps['jest'] || allDeps['vitest'] || allDeps['mocha']) tools.push('Testing');
        if (allDeps['eslint']) tools.push('ESLint');
        if (allDeps['prettier']) tools.push('Prettier');
        if (allDeps['webpack'] || allDeps['vite'] || allDeps['esbuild']) tools.push('Bundler');
        stack.tools = tools;

        return {
            stack,
            purpose: pkg.description || null,
            dependencies: {
                production: Object.keys(pkg.dependencies || {}),
                development: Object.keys(pkg.devDependencies || {}),
            },
            scripts: Object.keys(pkg.scripts || {}),
        };
    }

    #parseDependencyGraph(projectPath) {
        // Build a simple dependency graph from imports
        const graph = { nodes: [], edges: [] };
        const srcDir = join(projectPath, 'src');

        if (!existsSync(srcDir)) return { architecture: { graph } };

        const files = this.#walkDir(srcDir, ['.js', '.ts', '.mjs']);
        const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;

        for (const file of files.slice(0, 100)) { // Cap at 100 files
            const relative = file.replace(projectPath + '/', '');
            graph.nodes.push(relative);

            try {
                const content = readFileSync(file, 'utf8');
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    const dep = match[1];
                    if (dep.startsWith('.')) {
                        graph.edges.push({ from: relative, to: dep });
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        return { architecture: { graph, fileCount: files.length } };
    }

    #parseArchitecture(projectPath) {
        // Detect architecture patterns from directory structure
        const patterns = [];
        const dirs = this.#listTopDirs(projectPath);

        const architectureSignals = {
            'src': 'source-organized',
            'lib': 'library-pattern',
            'api': 'api-layer',
            'routes': 'route-based',
            'controllers': 'mvc',
            'models': 'mvc',
            'views': 'mvc',
            'components': 'component-based',
            'services': 'service-layer',
            'middleware': 'middleware-pattern',
            'plugins': 'plugin-architecture',
            'modules': 'modular',
            'core': 'core-pattern',
            'utils': 'utility-layer',
            'hooks': 'hooks-pattern',
            'store': 'state-management',
        };

        for (const dir of dirs) {
            const signal = architectureSignals[dir.toLowerCase()];
            if (signal && !patterns.includes(signal)) {
                patterns.push(signal);
            }
        }

        return {
            architecture: {
                patterns,
                topLevelDirs: dirs,
                hasTests: dirs.some(d => ['test', 'tests', '__tests__', 'spec'].includes(d.toLowerCase())),
                hasDocs: dirs.some(d => ['docs', 'doc', 'documentation'].includes(d.toLowerCase())),
                hasCI: existsSync(join(projectPath, '.github')) || existsSync(join(projectPath, '.gitlab-ci.yml')),
            },
        };
    }

    // --- Helpers ---

    #mergeIntoProfile(profile, data) {
        if (data.stack) Object.assign(profile.stack, data.stack);
        if (data.purpose && !profile.purpose) profile.purpose = data.purpose;
        if (data.features) profile.features.push(...data.features);
        if (data.dependencies) {
            if (data.dependencies.production) profile.dependencies.production = data.dependencies.production;
            if (data.dependencies.development) profile.dependencies.development = data.dependencies.development;
        }
        if (data.architecture) Object.assign(profile.architecture, data.architecture);
        if (data.scripts) profile.scripts = data.scripts;
    }

    #profileToText(profile) {
        const parts = [
            `Project: ${profile.name}`,
            profile.purpose ? `Purpose: ${profile.purpose}` : '',
            profile.stack.frameworks?.length ? `Frameworks: ${profile.stack.frameworks.join(', ')}` : '',
            profile.features.length ? `Features: ${profile.features.slice(0, 10).join(', ')}` : '',
            profile.architecture.patterns?.length ? `Architecture: ${profile.architecture.patterns.join(', ')}` : '',
        ];
        return parts.filter(Boolean).join('\n');
    }

    #walkDir(dir, extensions, maxDepth = 5, depth = 0) {
        if (depth >= maxDepth) return [];
        const results = [];

        try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                if (entry.startsWith('.') || entry === 'node_modules') continue;
                const full = join(dir, entry);
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    results.push(...this.#walkDir(full, extensions, maxDepth, depth + 1));
                } else if (extensions.includes(extname(entry))) {
                    results.push(full);
                }
            }
        } catch {
            // Permission denied or similar
        }

        return results;
    }

    #listTopDirs(projectPath) {
        try {
            return readdirSync(projectPath)
                .filter(entry => {
                    if (entry.startsWith('.') || entry === 'node_modules') return false;
                    return statSync(join(projectPath, entry)).isDirectory();
                });
        } catch {
            return [];
        }
    }
}
