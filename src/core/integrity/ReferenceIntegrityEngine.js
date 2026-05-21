/**
 * ReferenceIntegrityEngine.js — Detects orphaned and stale references
 *
 * Continuously scans:
 * - Dead import paths in source files
 * - Orphaned test references
 * - Broken package.json scripts
 * - Dangling event routes
 * - Ghost swarm bindings
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import fg from 'fast-glob';

export class ReferenceIntegrityEngine {
    #root;
    #issues = [];
    #lastScan = 0;
    #scanIntervalMs;

    constructor(root, scanIntervalMs = 300000) {
        this.#root = root;
        this.#scanIntervalMs = scanIntervalMs;
    }

    /**
     * Run a full integrity scan and return all detected issues.
     */
    async scan() {
        this.#issues = [];
        const scanStart = Date.now();

        await Promise.all([
            this.#scanPackageScripts(),
            this.#scanImportReferences(),
            this.#scanTestReferences(),
            this.#scanIndexExports(),
        ]);

        this.#lastScan = scanStart;
        return this.getReport();
    }

    /**
     * Scan package.json scripts for dead paths.
     */
    async #scanPackageScripts() {
        const pkgPath = join(this.#root, 'package.json');
        if (!existsSync(pkgPath)) return;

        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        // Check bin entries
        for (const [name, binPath] of Object.entries(pkg.bin || {})) {
            const fullPath = join(this.#root, binPath);
            if (!existsSync(fullPath)) {
                this.#addIssue({
                    type: 'orphan_bin',
                    severity: 'high',
                    name,
                    expected: binPath,
                    suggestion: `Remove bin.${name} from package.json`,
                    category: 'package_integrity',
                });
            }
        }

        // Check script paths (heuristic: look for node/path patterns)
        for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts || {})) {
            if (typeof scriptCmd !== 'string') continue;

            // Match node accounting-engine/... or cd accounting-engine/...
            const deletedPaths = scriptCmd.match(/(?:node|cd|npm)\s+([\w-]+(?:(?:\/[\w-]+)+)?(?:\/\S+)?)/g) || [];
            for (const match of deletedPaths) {
                const pathMatch = match.match(/(?:node|cd|npm)\s+([\S]+)/);
                if (!pathMatch) continue;

                let checkPath = pathMatch[1];
                if (!checkPath.startsWith('/')) {
                    checkPath = join(this.#root, checkPath);
                }
                if (!existsSync(checkPath)) {
                    this.#addIssue({
                        type: 'dead_script_path',
                        severity: 'high',
                        script: scriptName,
                        cmd: scriptCmd,
                        missingPath: checkPath,
                        suggestion: `Review or remove script "${scriptName}"`,
                        category: 'package_integrity',
                    });
                }
            }
        }
    }

    /**
     * Scan source files for invalid import paths.
     */
    async #scanImportReferences() {
        const jsFiles = await fg(['src/**/*.js', 'tests/**/*.js'], {
            cwd: this.#root,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        });

        const importRe = /(?:import\s+.*?\s+from\s+['"])(\.\.?\/[^'"]+)['"]/g;
        const dynamicImportRe = /(?:import\s*\()['"](\.\.?\/[^'"]+)['"]/g;

        for (const file of jsFiles) {
            const fullPath = join(this.#root, file);
            let content;
            try {
                content = readFileSync(fullPath, 'utf8');
            } catch {
                continue;
            }

            for (const re of [importRe, dynamicImportRe]) {
                let match;
                re.lastIndex = 0;
                while ((match = re.exec(content)) !== null) {
                    const importPath = match[1];
                    const resolved = join(join(this.#root, file), '..', importPath);

                    // Normalize (handle .js extensions)
                    let checkPath = resolved;
                    if (!checkPath.endsWith('.js') && !existsSync(checkPath)) {
                        checkPath = resolved + '.js';
                    }

                    // Also try index.js
                    if (!existsSync(checkPath)) {
                        const indexPath = join(resolved, 'index.js');
                        if (!existsSync(indexPath)) {
                            // It's a dead reference
                            this.#addIssue({
                                type: 'orphan_import',
                                severity: 'medium',
                                file,
                                importPath,
                                resolved: relative(this.#root, checkPath),
                                suggestion: `Verify import path "${importPath}" in ${file}`,
                                category: 'import_integrity',
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * Scan test files for references to deleted modules.
     */
    async #scanTestReferences() {
        const testFiles = await fg(['tests/**/*.js'], {
            cwd: this.#root,
            ignore: ['**/integration/**'],
        });

        const existsRe = /existsSync\(join\(ROOT,\s*['"]([^'"]+)['"]\)\)/g;
        const importRe = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

        for (const file of testFiles) {
            const fullPath = join(this.#root, file);
            let content;
            try {
                content = readFileSync(fullPath, 'utf8');
            } catch {
                continue;
            }

            for (const re of [existsRe, importRe]) {
                let match;
                re.lastIndex = 0;
                while ((match = re.exec(content)) !== null) {
                    const refPath = match[1];
                    if (refPath.startsWith('http') || refPath.startsWith('#')) continue;

                    const isExistsCheck = re === existsRe;
                    let checkPath = refPath;
                    if (!refPath.startsWith('/')) {
                        checkPath = join(this.#root, refPath);
                    }

                    if (!existsSync(checkPath)) {
                        this.#addIssue({
                            type: isExistsCheck ? 'orphan_test_file' : 'orphan_test_import',
                            severity: 'high',
                            testFile: file,
                            reference: refPath,
                            suggestion: `Update or remove reference to "${refPath}" in ${file}`,
                            category: 'test_integrity',
                        });
                    }
                }
            }
        }
    }

    /**
     * Scan index.js files for exports of non-existent modules.
     */
    async #scanIndexExports() {
        const indexFiles = await fg(['src/**/index.js', 'src/**/index.ts'], {
            cwd: this.#root,
            ignore: ['**/node_modules/**'],
        });

        const exportRe = /export\s*\{[^}]*}\s*from\s+['"]([^'"]+)['"]/g;

        for (const file of indexFiles) {
            const fullPath = join(this.#root, file);
            let content;
            try {
                content = readFileSync(fullPath, 'utf8');
            } catch {
                continue;
            }

            let match;
            exportRe.lastIndex = 0;
            while ((match = exportRe.exec(content)) !== null) {
                const exportPath = match[1];
                let checkPath = join(join(this.#root, file), '..', exportPath);
                if (!checkPath.endsWith('.js') && !existsSync(checkPath)) {
                    checkPath += '.js';
                }
                if (!existsSync(checkPath)) {
                    this.#addIssue({
                        type: 'orphan_export',
                        severity: 'medium',
                        indexFile: file,
                        exportPath,
                        suggestion: `Verify export "${exportPath}" in ${file}`,
                        category: 'export_integrity',
                    });
                }
            }
        }
    }

    #addIssue(issue) {
        this.#issues.push({
            id: `INT-${String(this.#issues.length + 1).padStart(4, '0')}`,
            timestamp: Date.now(),
            ...issue,
        });
    }

    /**
     * Get current integrity report.
     */
    getReport() {
        const bySeverity = {};
        const byCategory = {};

        for (const issue of this.#issues) {
            bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
            byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
        }

        const score = this.#calculateScore();

        return {
            timestamp: Date.now(),
            lastScan: this.#lastScan,
            totalIssues: this.#issues.length,
            score, // 0-100
            grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D',
            bySeverity,
            byCategory,
            issues: this.#issues,
        };
    }

    #calculateScore() {
        if (this.#issues.length === 0) return 100;
        const critical = this.#issues.filter(i => i.severity === 'critical').length;
        const high = this.#issues.filter(i => i.severity === 'high').length;
        const medium = this.#issues.filter(i => i.severity === 'medium').length;
        const low = this.#issues.filter(i => i.severity === 'low').length;
        const total = critical * 20 + high * 10 + medium * 5 + low * 2;
        return Math.max(0, 100 - total);
    }

    /**
     * Quick check if system has significant integrity issues.
     */
    isHealthy() {
        return this.#issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0;
    }
}
