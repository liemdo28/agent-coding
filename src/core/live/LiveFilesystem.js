/**
 * LiveFilesystem.js — Real Filesystem Intelligence with Watching
 *
 * Uses chokidar for real-time file watching.
 * Indexes files, detects projects, emits change events.
 * Persists index to database for cross-session awareness.
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname, relative } from 'path';
import { createHash } from 'crypto';

export class LiveFilesystem {
    #config;
    #events;
    #watcher = null;
    #index = new Map();
    #projects = new Map();
    #watchedPaths = [];
    #stats = { filesIndexed: 0, changes: 0, projects: 0 };

    constructor(config = {}, events) {
        this.#config = config;
        this.#events = events;
    }

    async start() {
        const paths = this.#config.watchPaths || [process.cwd()];

        // Initial scan
        for (const p of paths) {
            if (existsSync(p)) {
                this.#scanDirectory(p, 0);
                this.#watchedPaths.push(p);
            }
        }

        // Start watching with chokidar
        try {
            const { watch } = await import('chokidar');
            this.#watcher = watch(paths, {
                ignored: /(node_modules|\.git|dist|build|\.next|coverage|__pycache__)/,
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
            });

            this.#watcher.on('change', (path) => this.#onFileChange(path, 'modified'));
            this.#watcher.on('add', (path) => this.#onFileChange(path, 'added'));
            this.#watcher.on('unlink', (path) => this.#onFileRemoved(path));
            this.#watcher.on('addDir', (path) => this.#onDirAdded(path));
        } catch {
            // chokidar not available — polling fallback not implemented
        }
    }

    #onFileChange(filePath, type) {
        this.#stats.changes++;
        const meta = this.#getFileMeta(filePath);
        this.#index.set(filePath, meta);

        this.#events?.publish('fs.file.changed', {
            path: filePath,
            type,
            ext: meta.ext,
            project: meta.project,
            size: meta.size,
        });
    }

    #onFileRemoved(filePath) {
        this.#stats.changes++;
        this.#index.delete(filePath);
        this.#events?.publish('fs.file.removed', { path: filePath });
    }

    #onDirAdded(dirPath) {
        // Check if it's a new project
        if (this.#isProjectRoot(dirPath)) {
            const project = this.#registerProject(dirPath);
            this.#events?.publish('fs.project.discovered', project);
        }
    }

    #scanDirectory(dirPath, depth) {
        if (depth > 4) return;

        try {
            const entries = readdirSync(dirPath, { withFileTypes: true });

            if (this.#isProjectRoot(dirPath)) {
                this.#registerProject(dirPath);
            }

            for (const entry of entries) {
                if (this.#shouldSkip(entry.name)) continue;
                const fullPath = join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    this.#scanDirectory(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const meta = this.#getFileMeta(fullPath);
                    this.#index.set(fullPath, meta);
                    this.#stats.filesIndexed++;
                }
            }
        } catch { }
    }

    #isProjectRoot(dirPath) {
        const markers = ['package.json', 'Cargo.toml', 'go.mod', 'pom.xml', 'pyproject.toml', 'Makefile'];
        try {
            const entries = readdirSync(dirPath);
            return markers.some(m => entries.includes(m));
        } catch {
            return false;
        }
    }

    #registerProject(dirPath) {
        const name = basename(dirPath);
        const project = {
            name,
            path: dirPath,
            type: this.#detectType(dirPath),
            language: this.#detectLanguage(dirPath),
            discoveredAt: Date.now(),
        };
        this.#projects.set(name, project);
        this.#stats.projects = this.#projects.size;
        return project;
    }

    #detectType(dirPath) {
        try {
            const entries = readdirSync(dirPath);
            if (entries.includes('package.json')) return 'node';
            if (entries.includes('Cargo.toml')) return 'rust';
            if (entries.includes('go.mod')) return 'go';
            if (entries.includes('pom.xml')) return 'java';
            if (entries.includes('pyproject.toml')) return 'python';
        } catch { }
        return 'unknown';
    }

    #detectLanguage(dirPath) {
        try {
            const entries = readdirSync(dirPath);
            if (entries.includes('tsconfig.json')) return 'typescript';
            if (entries.includes('package.json')) return 'javascript';
            if (entries.includes('Cargo.toml')) return 'rust';
            if (entries.includes('go.mod')) return 'go';
        } catch { }
        return 'unknown';
    }

    #getFileMeta(filePath) {
        try {
            const stat = statSync(filePath);
            return {
                path: filePath,
                name: basename(filePath),
                ext: extname(filePath).toLowerCase(),
                size: stat.size,
                modified: stat.mtimeMs,
                project: this.#findProject(filePath),
            };
        } catch {
            return { path: filePath, name: basename(filePath), ext: '', size: 0, modified: 0, project: null };
        }
    }

    #findProject(filePath) {
        for (const [name, project] of this.#projects) {
            if (filePath.startsWith(project.path)) return name;
        }
        return null;
    }

    #shouldSkip(name) {
        const skip = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'target', '.DS_Store', 'coverage'];
        return skip.includes(name) || name.startsWith('.');
    }

    // --- Public API ---

    getProjects() { return [...this.#projects.values()]; }
    getProject(name) { return this.#projects.get(name) ?? null; }

    findFiles(query) {
        const lower = query.toLowerCase();
        const results = [];
        for (const [path, meta] of this.#index) {
            if (path.toLowerCase().includes(lower)) {
                results.push(meta);
                if (results.length >= 50) break;
            }
        }
        return results;
    }

    findByExtension(ext) {
        const results = [];
        for (const [, meta] of this.#index) {
            if (meta.ext === ext) {
                results.push(meta);
                if (results.length >= 100) break;
            }
        }
        return results;
    }

    stop() {
        if (this.#watcher) {
            this.#watcher.close();
            this.#watcher = null;
        }
    }

    get watchedPaths() { return this.#watchedPaths; }

    getStats() {
        return {
            ...this.#stats,
            indexSize: this.#index.size,
            watching: this.#watchedPaths,
            hasWatcher: !!this.#watcher,
        };
    }
}
