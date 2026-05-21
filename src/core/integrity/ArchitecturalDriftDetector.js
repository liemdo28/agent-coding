/**
 * ArchitecturalDriftDetector.js — Tracks architectural changes over time
 *
 * Detects when the codebase diverges from its known architecture:
 * - New modules added without being registered
 * - Modules deleted without cleanup
 * - Architecture topology changes
 * - Dependency graph mutations
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import fg from 'fast-glob';

export class ArchitecturalDriftDetector {
    #root;
    #baseline = null;
    #baselinePath;
    #history = [];
    #changeLog = [];

    constructor(root, baselinePath = null) {
        this.#root = root;
        this.#baselinePath = baselinePath || join(root, '.integrity', 'baseline.json');
    }

    /**
     * Capture current architecture state as baseline.
     */
    captureBaseline() {
        this.#baseline = this.#buildSnapshot();
        this.#saveBaseline();
        return this.#baseline;
    }

    /**
     * Compare current state against baseline — detect drift.
     */
    detectDrift() {
        if (!this.#baseline) {
            return { hasBaseline: false, message: 'No baseline captured. Run captureBaseline() first.' };
        }

        const current = this.#buildSnapshot();
        const drift = this.#computeDrift(this.#baseline, current);

        // Record in history
        this.#history.push({
            timestamp: Date.now(),
            drift,
        });

        // Keep only last 50 entries
        if (this.#history.length > 50) {
            this.#history = this.#history.slice(-50);
        }

        return {
            hasBaseline: true,
            drift,
            summary: this.#summarizeDrift(drift),
            entropy: this.#calculateEntropy(drift),
            recommendations: this.#generateRecommendations(drift),
            history: this.#history,
        };
    }

    /**
     * Get architecture snapshot of current codebase.
     */
    #buildSnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            modules: this.#enumerateModules(),
            dependencies: this.#extractDependencies(),
            surface: this.#extractPublicSurface(),
            scripts: this.#extractScripts(),
        };

        // Add hash for quick comparison
        snapshot.hash = this.#simpleHash(JSON.stringify(snapshot));

        return snapshot;
    }

    #enumerateModules() {
        const modules = [];
        // Scan src/core/ recursively for all .js files
        const jsFiles = fg.sync(['src/core/**/*.js'], {
            cwd: this.#root,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        });

        for (const file of jsFiles) {
            if (file.endsWith('/index.js')) continue; // Skip index files for module enumeration
            const name = file.replace(/.*\//, '').replace('.js', '');
            modules.push({
                name,
                path: file,
                dir: file.replace(/\/[^/]+\.js$/, ''),
            });
        }

        return modules;
    }

    #extractDependencies() {
        const deps = {};
        const jsFiles = fg.sync(['src/core/**/*.js'], {
            cwd: this.#root,
            ignore: ['**/node_modules/**'],
        });

        const importRe = /(?:import\s+.*?\s+from\s+['"])(\.{1,2}\/[^'"]+)['"]/g;

        for (const file of jsFiles) {
            const fullPath = join(this.#root, file);
            let content;
            try {
                content = readFileSync(fullPath, 'utf8');
            } catch {
                continue;
            }

            let match;
            importRe.lastIndex = 0;
            while ((match = importRe.exec(content)) !== null) {
                const module = file.replace('src/core/', '').replace(/\.js$/, '');
                if (!deps[module]) deps[module] = [];
                deps[module].push(match[1]);
            }
        }

        return deps;
    }

    #extractPublicSurface() {
        const surface = {};
        const indexFiles = fg.sync(['src/core/**/index.js'], { cwd: this.#root });

        for (const file of indexFiles) {
            const fullPath = join(this.#root, file);
            let content;
            try {
                content = readFileSync(fullPath, 'utf8');
            } catch {
                continue;
            }

            const module = file.replace('src/core/', '').replace('/index.js', '');
            const exportRe = /export\s+\{\s*(\w+)/g;
            const exports = [];
            let match;
            while ((match = exportRe.exec(content)) !== null) {
                exports.push(match[1]);
            }
            surface[module] = exports;
        }

        return surface;
    }

    #extractScripts() {
        const pkgPath = join(this.#root, 'package.json');
        if (!existsSync(pkgPath)) return {};
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return {
            bin: Object.keys(pkg.bin || {}),
            scripts: Object.keys(pkg.scripts || {}),
        };
    }

    #computeDrift(baseline, current) {
        const added = current.modules.filter(
            m => !baseline.modules.find(b => b.path === m.path)
        );
        const removed = baseline.modules.filter(
            m => !current.modules.find(c => c.path === m.path)
        );

        const scriptBinAdded = current.scripts.bin.filter(
            b => !baseline.scripts.bin.includes(b)
        );
        const scriptBinRemoved = baseline.scripts.bin.filter(
            b => !current.scripts.bin.includes(b)
        );

        const scriptAdded = current.scripts.scripts.filter(
            s => !baseline.scripts.scripts.includes(s)
        );
        const scriptRemoved = baseline.scripts.scripts.filter(
            s => !current.scripts.scripts.includes(s)
        );

        const surfaceChanges = this.#diffSurface(baseline.surface, current.surface);

        return {
            added: { modules: added, scripts: { bin: scriptBinAdded, scripts: scriptAdded } },
            removed: { modules: removed, scripts: { bin: scriptBinRemoved, scripts: scriptRemoved } },
            surfaceChanges,
            structuralChange: added.length + removed.length > 0,
        };
    }

    #diffSurface(baseline, current) {
        const changes = [];
        const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

        for (const key of allKeys) {
            const b = baseline[key] || [];
            const c = current[key] || [];
            const removedExports = b.filter(e => !c.includes(e));
            const addedExports = c.filter(e => !b.includes(e));
            if (removedExports.length || addedExports.length) {
                changes.push({ module: key, removedExports, addedExports });
            }
        }

        return changes;
    }

    #summarizeDrift(drift) {
        const parts = [];
        if (drift.added.modules.length) {
            parts.push(`+${drift.added.modules.length} modules added`);
        }
        if (drift.removed.modules.length) {
            parts.push(`-${drift.removed.modules.length} modules removed`);
        }
        if (drift.removed.scripts.bin.length) {
            parts.push(`-${drift.removed.scripts.bin.length} bin entries removed`);
        }
        if (drift.removed.scripts.scripts.length) {
            parts.push(`-${drift.removed.scripts.scripts.length} scripts removed`);
        }
        if (drift.added.scripts.bin.length) {
            parts.push(`+${drift.added.scripts.bin.length} bin entries added`);
        }
        if (drift.added.scripts.scripts.length) {
            parts.push(`+${drift.added.scripts.scripts.length} scripts added`);
        }
        if (drift.surfaceChanges.length) {
            parts.push(`${drift.surfaceChanges.length} surface changes`);
        }
        return parts.length ? parts.join(', ') : 'No drift detected';
    }

    #calculateEntropy(drift) {
        // Entropy: measure of architectural instability
        let score = 0;
        score += drift.removed.modules.length * 3; // Deletions are expensive
        score += drift.added.modules.length * 1;
        score += drift.removed.scripts.bin.length * 2;
        score += drift.removed.scripts.scripts.length * 2;
        score += drift.added.scripts.bin.length;
        score += drift.added.scripts.scripts.length;
        score += drift.surfaceChanges.length * 2;
        return Math.min(100, score);
    }

    #generateRecommendations(drift) {
        const recs = [];

        for (const mod of drift.removed.modules) {
            recs.push({
                priority: 'high',
                action: 'cleanup',
                target: mod.path,
                reason: 'Module was deleted — verify all references are cleaned up',
                type: 'orphan_cleanup',
            });
        }

        for (const script of drift.removed.scripts.bin) {
            recs.push({
                priority: 'high',
                action: 'cleanup',
                target: `bin:${script}`,
                reason: 'Bin entry references deleted file',
                type: 'stale_reference',
            });
        }

        for (const script of drift.removed.scripts.scripts) {
            recs.push({
                priority: 'medium',
                action: 'review',
                target: `script:${script}`,
                reason: 'Script references deleted or moved path',
                type: 'dead_script',
            });
        }

        return recs;
    }

    #saveBaseline() {
        try {
            const dir = join(this.#root, '.integrity');
            const { existsSync, mkdirSync } = require('fs');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(this.#baselinePath, JSON.stringify(this.#baseline, null, 2));
        } catch {
            // Non-critical — baseline is in memory
        }
    }

    #simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}
