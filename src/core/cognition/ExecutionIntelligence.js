/**
 * ExecutionIntelligence.js — Log Intelligence & Error Analysis
 *
 * AI understands:
 * - Build logs (npm, webpack, tsc, vite)
 * - Stack traces (Node.js, Python, Java)
 * - Runtime errors (crashes, OOM, timeouts)
 * - Test failures (jest, vitest, mocha, pytest)
 * - WebSocket/network errors
 *
 * Produces:
 * - Structured error analysis
 * - Root cause identification
 * - Patch suggestions
 * - Severity classification
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export class ExecutionIntelligence extends EventEmitter {
    #config;
    #memory;
    #parsers;
    #stats = {
        logsAnalyzed: 0,
        errorsDetected: 0,
        patchesSuggested: 0,
        rootCausesFound: 0,
    };

    constructor(config = {}, deps = {}) {
        super();
        this.#config = {
            maxLogLines: config.maxLogLines || 5000,
            contextLines: config.contextLines || 5,
            ...config,
        };
        this.#memory = deps.memory;

        // Register log parsers
        this.#parsers = [
            { name: 'npm-error', parse: this.#parseNpmError.bind(this) },
            { name: 'typescript-error', parse: this.#parseTypeScriptError.bind(this) },
            { name: 'node-stack-trace', parse: this.#parseNodeStackTrace.bind(this) },
            { name: 'python-traceback', parse: this.#parsePythonTraceback.bind(this) },
            { name: 'webpack-error', parse: this.#parseWebpackError.bind(this) },
            { name: 'test-failure', parse: this.#parseTestFailure.bind(this) },
            { name: 'network-error', parse: this.#parseNetworkError.bind(this) },
            { name: 'memory-error', parse: this.#parseMemoryError.bind(this) },
            { name: 'permission-error', parse: this.#parsePermissionError.bind(this) },
        ];
    }

    /**
     * Analyze raw log output and extract structured intelligence.
     * @param {string} rawLog - Raw log/output text
     * @param {object} context - { project, command, type }
     * @returns {object} Structured analysis
     */
    analyze(rawLog, context = {}) {
        this.#stats.logsAnalyzed++;
        const lines = rawLog.split('\n').slice(0, this.#config.maxLogLines);

        const analysis = {
            id: randomUUID(),
            timestamp: Date.now(),
            context,
            errors: [],
            warnings: [],
            summary: null,
            rootCause: null,
            severity: 'info',
            suggestions: [],
            patchHints: [],
        };

        // Run all parsers
        for (const parser of this.#parsers) {
            try {
                const result = parser.parse(lines, context);
                if (result.errors?.length) {
                    analysis.errors.push(...result.errors);
                }
                if (result.warnings?.length) {
                    analysis.warnings.push(...result.warnings);
                }
                if (result.suggestions?.length) {
                    analysis.suggestions.push(...result.suggestions);
                }
                if (result.patchHints?.length) {
                    analysis.patchHints.push(...result.patchHints);
                }
            } catch {
                // Parser failed — continue
            }
        }

        // Determine severity
        analysis.severity = this.#classifySeverity(analysis);

        // Identify root cause
        if (analysis.errors.length > 0) {
            analysis.rootCause = this.#identifyRootCause(analysis.errors);
            this.#stats.rootCausesFound++;
        }

        // Generate summary
        analysis.summary = this.#generateSummary(analysis);

        // Track stats
        this.#stats.errorsDetected += analysis.errors.length;
        this.#stats.patchesSuggested += analysis.patchHints.length;

        this.emit('analysis:complete', analysis);
        return analysis;
    }

    /**
     * Analyze a build failure specifically.
     * @param {string} buildOutput
     * @param {object} projectProfile - from ProjectIntelligence
     * @returns {object} Build failure analysis with fix suggestions
     */
    analyzeBuildFailure(buildOutput, projectProfile = {}) {
        const base = this.analyze(buildOutput, { type: 'build', project: projectProfile.name });

        // Enhance with project-specific intelligence
        const enhanced = {
            ...base,
            buildTool: this.#detectBuildTool(buildOutput, projectProfile),
            failurePhase: this.#detectBuildPhase(buildOutput),
            affectedFiles: this.#extractAffectedFiles(buildOutput),
            fixStrategy: null,
        };

        // Generate fix strategy
        enhanced.fixStrategy = this.#generateFixStrategy(enhanced);

        return enhanced;
    }

    /**
     * Analyze a test failure.
     * @param {string} testOutput
     * @returns {object} Test failure analysis
     */
    analyzeTestFailure(testOutput) {
        const base = this.analyze(testOutput, { type: 'test' });

        return {
            ...base,
            failedTests: this.#extractFailedTests(testOutput),
            testRunner: this.#detectTestRunner(testOutput),
            coverageImpact: this.#estimateCoverageImpact(base.errors),
        };
    }

    /**
     * Parse a stack trace into structured frames.
     * @param {string} stackTrace
     * @returns {object[]} Parsed frames
     */
    parseStackTrace(stackTrace) {
        const frames = [];
        const nodePattern = /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/g;
        let match;

        while ((match = nodePattern.exec(stackTrace)) !== null) {
            frames.push({
                function: match[1] || '<anonymous>',
                file: match[2],
                line: parseInt(match[3], 10),
                column: parseInt(match[4], 10),
                isInternal: match[2].includes('node_modules') || match[2].startsWith('node:'),
            });
        }

        return frames;
    }

    // --- Log Parsers ---

    #parseNpmError(lines) {
        const errors = [];
        const suggestions = [];
        const patchHints = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // npm ERR!
            if (line.includes('npm ERR!') || line.includes('npm error')) {
                const msg = line.replace(/npm (?:ERR!|error)\s*/, '').trim();
                if (msg) {
                    errors.push({
                        type: 'npm',
                        message: msg,
                        line: i + 1,
                        raw: line,
                    });
                }
            }

            // ERESOLVE
            if (line.includes('ERESOLVE')) {
                errors.push({ type: 'npm-resolve', message: 'Dependency resolution conflict', line: i + 1 });
                suggestions.push('Run `npm install --legacy-peer-deps` or resolve version conflicts');
                patchHints.push({ type: 'command', value: 'npm install --legacy-peer-deps' });
            }

            // Missing module
            if (line.includes("Cannot find module") || line.includes("MODULE_NOT_FOUND")) {
                const modMatch = line.match(/Cannot find module '([^']+)'/);
                const mod = modMatch?.[1] || 'unknown';
                errors.push({ type: 'missing-module', message: `Module not found: ${mod}`, line: i + 1 });
                if (!mod.startsWith('.')) {
                    suggestions.push(`Install missing dependency: npm install ${mod}`);
                    patchHints.push({ type: 'command', value: `npm install ${mod}` });
                }
            }
        }

        return { errors, suggestions, patchHints };
    }

    #parseTypeScriptError(lines) {
        const errors = [];
        const suggestions = [];
        const tsPattern = /(.+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/;

        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(tsPattern);
            if (match) {
                errors.push({
                    type: 'typescript',
                    file: match[1],
                    line: parseInt(match[2], 10),
                    column: parseInt(match[3], 10),
                    code: match[4],
                    message: match[5],
                });

                // Common TS error suggestions
                const code = match[4];
                if (code === 'TS2307') suggestions.push(`Module not found — check import path in ${match[1]}`);
                if (code === 'TS2345') suggestions.push(`Type mismatch — check argument types at ${match[1]}:${match[2]}`);
                if (code === 'TS2339') suggestions.push(`Property does not exist — check type definition`);
            }
        }

        return { errors, suggestions };
    }

    #parseNodeStackTrace(lines) {
        const errors = [];
        const joined = lines.join('\n');

        // Uncaught exceptions
        const uncaughtMatch = joined.match(/(?:Error|TypeError|ReferenceError|SyntaxError):\s*(.+)/);
        if (uncaughtMatch) {
            const frames = this.parseStackTrace(joined);
            const userFrame = frames.find(f => !f.isInternal);

            errors.push({
                type: 'runtime-error',
                errorType: uncaughtMatch[0].split(':')[0],
                message: uncaughtMatch[1],
                file: userFrame?.file,
                line: userFrame?.line,
                frames: frames.slice(0, 5),
            });
        }

        return { errors };
    }

    #parsePythonTraceback(lines) {
        const errors = [];
        const tracebackStart = lines.findIndex(l => l.includes('Traceback (most recent call last)'));

        if (tracebackStart >= 0) {
            const traceLines = lines.slice(tracebackStart);
            const errorLine = traceLines.find(l => /^\w+Error:/.test(l) || /^\w+Exception:/.test(l));

            if (errorLine) {
                errors.push({
                    type: 'python-error',
                    message: errorLine,
                    traceback: traceLines.slice(0, 20).join('\n'),
                });
            }
        }

        return { errors };
    }

    #parseWebpackError(lines) {
        const errors = [];
        const suggestions = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('Module build failed') || line.includes('ModuleBuildError')) {
                errors.push({ type: 'webpack-build', message: line.trim(), line: i + 1 });
            }

            if (line.includes('Module not found: Error: Can\'t resolve')) {
                const modMatch = line.match(/Can't resolve '([^']+)'/);
                errors.push({
                    type: 'webpack-resolve',
                    message: `Cannot resolve module: ${modMatch?.[1] || 'unknown'}`,
                    line: i + 1,
                });
                suggestions.push(`Check webpack aliases or install missing module`);
            }
        }

        return { errors, suggestions };
    }

    #parseTestFailure(lines) {
        const errors = [];
        const warnings = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Jest/Vitest failures
            if (line.includes('● ') || line.includes('FAIL ') || line.includes('✗') || line.includes('✕')) {
                errors.push({ type: 'test-failure', message: line.trim(), line: i + 1 });
            }

            // Assertion errors
            if (line.includes('AssertionError') || line.includes('expect(') || line.includes('Expected:')) {
                errors.push({ type: 'assertion', message: line.trim(), line: i + 1 });
            }

            // Timeout
            if (line.includes('Timeout') || line.includes('exceeded timeout')) {
                warnings.push({ type: 'timeout', message: line.trim(), line: i + 1 });
            }
        }

        return { errors, warnings };
    }

    #parseNetworkError(lines) {
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('ECONNREFUSED') || line.includes('ECONNRESET') || line.includes('ETIMEDOUT')) {
                errors.push({ type: 'network', message: line.trim(), line: i + 1 });
            }

            if (line.includes('WebSocket') && (line.includes('error') || line.includes('close') || line.includes('failed'))) {
                errors.push({ type: 'websocket', message: line.trim(), line: i + 1 });
            }
        }

        return { errors };
    }

    #parseMemoryError(lines) {
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('FATAL ERROR') && line.includes('heap')) {
                errors.push({ type: 'oom', message: 'JavaScript heap out of memory', line: i + 1, severity: 'critical' });
            }

            if (line.includes('MemoryError') || line.includes('OutOfMemoryError')) {
                errors.push({ type: 'oom', message: line.trim(), line: i + 1, severity: 'critical' });
            }
        }

        return { errors };
    }

    #parsePermissionError(lines) {
        const errors = [];
        const suggestions = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('EACCES') || line.includes('Permission denied') || line.includes('EPERM')) {
                errors.push({ type: 'permission', message: line.trim(), line: i + 1 });
                suggestions.push('Check file permissions or run with appropriate access');
            }
        }

        return { errors, suggestions };
    }

    // --- Analysis Helpers ---

    #classifySeverity(analysis) {
        if (analysis.errors.some(e => e.severity === 'critical' || e.type === 'oom')) return 'critical';
        if (analysis.errors.length > 5) return 'high';
        if (analysis.errors.length > 0) return 'medium';
        if (analysis.warnings.length > 0) return 'low';
        return 'info';
    }

    #identifyRootCause(errors) {
        // The first non-internal error is usually the root cause
        const primary = errors[0];
        if (!primary) return null;

        return {
            type: primary.type,
            message: primary.message,
            file: primary.file || null,
            line: primary.line || null,
            confidence: errors.length === 1 ? 0.9 : 0.7,
        };
    }

    #generateSummary(analysis) {
        const parts = [];
        if (analysis.errors.length > 0) {
            parts.push(`${analysis.errors.length} error(s) detected`);
        }
        if (analysis.warnings.length > 0) {
            parts.push(`${analysis.warnings.length} warning(s)`);
        }
        if (analysis.rootCause) {
            parts.push(`Root cause: ${analysis.rootCause.type} — ${analysis.rootCause.message}`);
        }
        if (analysis.suggestions.length > 0) {
            parts.push(`${analysis.suggestions.length} fix suggestion(s) available`);
        }
        return parts.join('. ') || 'No issues detected';
    }

    #detectBuildTool(output, profile) {
        if (output.includes('tsc') || output.includes('typescript')) return 'typescript';
        if (output.includes('webpack')) return 'webpack';
        if (output.includes('vite')) return 'vite';
        if (output.includes('esbuild')) return 'esbuild';
        if (output.includes('next')) return 'next';
        if (profile.stack?.tools?.includes('Bundler')) return 'bundler';
        return 'unknown';
    }

    #detectBuildPhase(output) {
        if (output.includes('Compiling') || output.includes('compile')) return 'compile';
        if (output.includes('Linking') || output.includes('link')) return 'link';
        if (output.includes('Bundle') || output.includes('bundle')) return 'bundle';
        if (output.includes('Type checking') || output.includes('type-check')) return 'type-check';
        if (output.includes('Lint') || output.includes('lint')) return 'lint';
        return 'unknown';
    }

    #extractAffectedFiles(output) {
        const files = new Set();
        const patterns = [
            /(?:in|at|from)\s+([./][\w/.-]+\.[a-z]+)/g,
            /([./][\w/.-]+\.(?:ts|js|tsx|jsx|vue|svelte))(?:\(|:)/g,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(output)) !== null) {
                if (!match[1].includes('node_modules')) {
                    files.add(match[1]);
                }
            }
        }

        return Array.from(files).slice(0, 20);
    }

    #generateFixStrategy(analysis) {
        const strategies = [];

        for (const error of analysis.errors.slice(0, 5)) {
            switch (error.type) {
                case 'npm-resolve':
                    strategies.push({ action: 'resolve-deps', priority: 'high', automated: true });
                    break;
                case 'missing-module':
                    strategies.push({ action: 'install-module', target: error.message, priority: 'high', automated: true });
                    break;
                case 'typescript':
                    strategies.push({ action: 'fix-types', file: error.file, line: error.line, priority: 'medium', automated: false });
                    break;
                case 'webpack-resolve':
                    strategies.push({ action: 'fix-imports', priority: 'medium', automated: false });
                    break;
                default:
                    strategies.push({ action: 'manual-review', error: error.type, priority: 'low', automated: false });
            }
        }

        return {
            steps: strategies,
            automatable: strategies.filter(s => s.automated).length,
            total: strategies.length,
            estimatedTime: strategies.length * 2000,
        };
    }

    #extractFailedTests(output) {
        const failed = [];
        const patterns = [
            /(?:FAIL|✗|✕|●)\s+(.+)/g,
            /(\d+)\s+(?:failing|failed)/g,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(output)) !== null) {
                failed.push(match[1].trim());
            }
        }

        return [...new Set(failed)].slice(0, 20);
    }

    #detectTestRunner(output) {
        if (output.includes('jest') || output.includes('PASS') || output.includes('FAIL')) return 'jest';
        if (output.includes('vitest')) return 'vitest';
        if (output.includes('mocha')) return 'mocha';
        if (output.includes('pytest')) return 'pytest';
        if (output.includes('node --test') || output.includes('# tests')) return 'node-test';
        return 'unknown';
    }

    #estimateCoverageImpact(errors) {
        // Rough estimate based on number of test failures
        const testErrors = errors.filter(e => e.type === 'test-failure' || e.type === 'assertion');
        if (testErrors.length === 0) return 'none';
        if (testErrors.length < 3) return 'low';
        if (testErrors.length < 10) return 'medium';
        return 'high';
    }

    getStats() {
        return { ...this.#stats };
    }
}
