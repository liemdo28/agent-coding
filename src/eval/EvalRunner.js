/**
 * EvalRunner — multi-tier evaluation engine for agent-generated code.
 *
 * Tier 1: Functional correctness (pass@k on benchmark datasets)
 * Tier 2: Code quality scoring (lint, complexity, naming)
 * Tier 3: Security validation (static analysis before sandbox execution)
 *
 * Usage:
 *   import { EvalRunner } from './EvalRunner.js';
 *   const runner = new EvalRunner({ sandbox, offlineGuard });
 *   const result = await runner.evaluate(code, { language: 'python', benchmark: 'humaneval' });
 *   console.log(result.functional.passAt1, result.overall);
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const SANDBOX_DIR = '/tmp/eval_sandbox';

const SECURITY_RULES = [
  { id: 'no-eval',     pattern: /\beval\s*\(/,          severity: 'fail', message: 'eval() is forbidden' },
  { id: 'no-exec',     pattern: /\bexec\s*\(/,          severity: 'fail', message: 'exec() is forbidden' },
  { id: 'no-subprocess', pattern: /\bsubprocess\b/,     severity: 'warn', message: 'subprocess may enable system access' },
  { id: 'no-os-system', pattern: /\bos\.system\b/,      severity: 'fail', message: 'os.system() is forbidden' },
  { id: 'no-requests',  pattern: /\brequests?\b/,       severity: 'fail', message: 'HTTP requests are forbidden offline' },
  { id: 'no-urllib',   pattern: /\burllib\b/,          severity: 'fail', message: 'urllib is forbidden offline' },
  { id: 'no-httplib',  pattern: /\bhttplib\b/,         severity: 'fail', message: 'httplib is forbidden offline' },
  { id: 'no-socket',   pattern: /\bsocket\b/,           severity: 'fail', message: 'socket is forbidden offline' },
];

/**
 * @typedef {Object} EvalResult
 * @property {string} benchmark
 * @property {string} timestamp
 * @property {{ passAt1: number, passAt3: number, passed: number, failed: number }} functional
 * @property {{ score: number, violations: Violation[] }} quality
 * @property {{ score: number, violations: SecurityViolation[] }} security
 * @property {number} overall
 */

/**
 * @typedef {Object} Violation
 * @property {string} rule
 * @property {string} message
 * @property {string} severity
 * @property {number} [line]
 */

/**
 * @typedef {Object} SecurityViolation
 * @property {string} rule
 * @property {string} message
 * @property {string} severity
 */

export class EvalRunner {
  /**
   * @param {{ sandbox?: object, offlineGuard?: object, resultsDir?: string }} [options]
   */
  constructor({ sandbox = null, offlineGuard = null, resultsDir = join(ROOT, 'eval', 'results') } = {}) {
    this.sandbox = sandbox;
    this.offlineGuard = offlineGuard;
    this.resultsDir = resultsDir;
    this._ensureResultsDir();
  }

  _ensureResultsDir() {
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Run a complete evaluation on generated code.
   * @param {string} code — generated code to evaluate
   * @param {{ language: string, benchmark?: string, testCode?: string }} context
   * @returns {Promise<EvalResult>}
   */
  async evaluate(code, { language = 'python', benchmark = 'custom', testCode = '' } = {}) {
    const timestamp = new Date().toISOString();

    // Tier 3: Security first (before execution)
    const securityResult = this.runSecurityChecks(code, language);

    // Tier 2: Quality checks
    const qualityResult = this.runQualityChecks(code, language);

    // Tier 1: Functional (only if sandbox is available and no hard security violations)
    let functionalResult = { passAt1: 0, passAt3: 0, passed: 0, failed: 0 };
    if (!securityResult.violations.some(v => v.severity === 'fail') && testCode) {
      functionalResult = await this.runFunctionalTest(code, testCode, language);
    }

    // Overall: weighted average
    const overall = this._computeOverall(functionalResult, qualityResult, securityResult);

    return {
      benchmark,
      timestamp,
      functional: functionalResult,
      quality: qualityResult,
      security: securityResult,
      overall,
    };
  }

  /**
   * Run a benchmark dataset (HumanEval, MBPP, etc.) and return aggregated scores.
   * @param {BenchmarkSpec} spec
   * @returns {Promise<EvalResult>}
   */
  async runBenchmark(spec) {
    const { problems, language = 'python', benchmark = 'humaneval' } = spec;
    const timestamp = new Date().toISOString();

    const results = [];
    for (const problem of problems) {
      const result = await this.evaluate(problem.generatedCode || '', {
        language,
        benchmark,
        testCode: problem.test,
      });
      results.push({ taskId: problem.task_id, ...result });
    }

    const passed = results.filter(r => r.functional.passed > 0).length;
    const total = results.length;
    const passAt1 = total > 0 ? passed / total : 0;

    return {
      benchmark,
      timestamp,
      functional: {
        passAt1,
        passAt3: passAt1, // simplified — actual pass@3 needs multiple attempts
        passed,
        failed: total - passed,
      },
      quality: this._aggregateQuality(results),
      security: this._aggregateSecurity(results),
      overall: this._computeOverallFromResults(results),
    };
  }

  /**
   * Run pass@k evaluation (k attempts per problem).
   * @param {Problem[]} problems
   * @param {number} k
   * @param {(prompt: string) => Promise<string>} generateFn — LLM generate function
   * @param {string} language
   * @returns {Promise<number>} pass@k score
   */
  async passAtK(problems, k, generateFn, language = 'python') {
    let totalPassed = 0;

    for (const problem of problems) {
      for (let attempt = 0; attempt < k; attempt++) {
        const response = await generateFn(problem.prompt);
        const code = this._extractCode(response, language);
        const result = await this.runFunctionalTest(code, problem.test, language);
        if (result.passed > 0) {
          totalPassed++;
          break; // passed — move to next problem
        }
      }
    }

    return problems.length > 0 ? totalPassed / problems.length : 0;
  }

  // ─── Tier 1: Functional ────────────────────────────────────────────────────

  /**
   * Run functional test by combining code + test and executing.
   * @param {string} code
   * @param {string} testCode
   * @param {string} language
   * @returns {Promise<{passed: number, failed: number, passAt1: number}>}
   */
  async runFunctionalTest(code, testCode, language = 'python') {
    if (!code || !testCode) return { passed: 0, failed: 0, passAt1: 0 };

    try {
      const combined = this._combineCode(code, testCode, language);
      const result = this._execute(code, combined, language);
      const passed = result.exitCode === 0 ? 1 : 0;
      return { passed, failed: passed ? 0 : 1, passAt1: passed };
    } catch (err) {
      return { passed: 0, failed: 1, passAt1: 0 };
    }
  }

  _combineCode(code, testCode, language) {
    switch (language) {
      case 'python':
        return `${code}\n\n# Tests\n${testCode}`;
      case 'javascript':
        return `${code}\n\n// Tests\n${testCode}`;
      default:
        return `${code}\n\n${testCode}`;
    }
  }

  _execute(code, combinedCode, language) {
    const { execSync } = require('child_process');
    const uuid = Date.now().toString(36);
    const sandboxPath = join(SANDBOX_DIR, `eval_${uuid}`);
    mkdirSync(sandboxPath, { recursive: true });

    const ext = language === 'python' ? 'py' : language === 'javascript' ? 'js' : 'txt';
    const filePath = join(sandboxPath, `test.${ext}`);
    writeFileSync(filePath, combinedCode);

    try {
      let cmd;
      switch (language) {
        case 'python':
          cmd = `python3 "${filePath}" 2>&1`;
          break;
        case 'javascript':
          cmd = `node "${filePath}" 2>&1`;
          break;
        default:
          cmd = `python3 "${filePath}" 2>&1`;
      }

      const output = execSync(cmd, { timeout: 10000, encoding: 'utf8', cwd: sandboxPath });
      return { exitCode: 0, stdout: output, stderr: '' };
    } catch (err) {
      return { exitCode: err.status || 1, stdout: err.stdout || '', stderr: err.stderr || err.message };
    } finally {
      // Cleanup is async — best effort
      try {
        const { rmSync } = require('fs');
        rmSync(sandboxPath, { recursive: true, force: true });
      } catch {}
    }
  }

  // ─── Tier 2: Quality ───────────────────────────────────────────────────────

  /**
   * @returns {{ score: number, violations: Violation[] }}
   */
  runQualityChecks(code, language = 'python') {
    const violations = /** @type {Violation[]} */ ([]);
    const lines = code.split('\n');

    // Simple quality checks (no external lint tools required)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // TODO marker check
      if (/^[^#]*\bTODO\b/.test(trimmed) && !trimmed.startsWith('//')) {
        violations.push({ rule: 'no-todo', message: 'TODO comment found in code', severity: 'warn', line: i + 1 });
      }

      // Long lines (>120 chars)
      if (line.length > 120) {
        violations.push({ rule: 'line-length', message: `Line exceeds 120 characters (${line.length})`, severity: 'warn', line: i + 1 });
      }

      // Indentation consistency
      if (/^ +/.test(trimmed) && /^\t/.test(line)) {
        violations.push({ rule: 'mixed-indentation', message: 'Mixed spaces and tabs', severity: 'warn', line: i + 1 });
      }
    }

    // Compute quality score
    const maxViolations = 10;
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warnCount = violations.filter(v => v.severity === 'warn').length;
    const score = Math.max(0, 1 - (errorCount / maxViolations) - (warnCount / (maxViolations * 2)));

    return { score: Math.round(score * 100) / 100, violations };
  }

  // ─── Tier 3: Security ──────────────────────────────────────────────────────

  /**
   * @returns {{ score: number, violations: SecurityViolation[] }}
   */
  runSecurityChecks(code, language = 'python') {
    const violations = /** @type {SecurityViolation[]} */ ([]);

    for (const rule of SECURITY_RULES) {
      // For Python-specific rules, only check Python code
      if (['no-requests', 'no-urllib', 'no-httplib'].includes(rule.id) && language !== 'python') {
        continue;
      }
      if (rule.pattern.test(code)) {
        violations.push({ rule: rule.id, message: rule.message, severity: rule.severity });
      }
    }

    const failCount = violations.filter(v => v.severity === 'fail').length;
    const warnCount = violations.filter(v => v.severity === 'warn').length;
    const score = failCount > 0 ? 0 : Math.max(0, 1 - warnCount * 0.1);

    return { score: Math.round(score * 100) / 100, violations };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  _computeOverall(functional, quality, security) {
    const functionalWeight = 0.5;
    const qualityWeight = 0.25;
    const securityWeight = 0.25;

    const functionalScore = functional.passAt1 || 0;
    const overall = functionalWeight * functionalScore
      + qualityWeight * quality.score
      + securityWeight * security.score;

    return Math.round(overall * 100) / 100;
  }

  _computeOverallFromResults(results) {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + (r.overall || 0), 0);
    return Math.round((sum / results.length) * 100) / 100;
  }

  _aggregateQuality(results) {
    const scores = results.map(r => r.quality?.score || 0).filter(s => s > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const allViolations = results.flatMap(r => r.quality?.violations || []);
    return { score: Math.round(avg * 100) / 100, violations: allViolations };
  }

  _aggregateSecurity(results) {
    const scores = results.map(r => r.security?.score || 0).filter(s => s > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const allViolations = results.flatMap(r => r.security?.violations || []);
    return { score: Math.round(avg * 100) / 100, violations: allViolations };
  }

  _extractCode(response, language) {
    const pattern = language === 'python'
      ? /```python\n?([\s\S]*?)```/
      : language === 'javascript'
      ? /```javascript\n?([\s\S]*?)```/
      : /```\n?([\s\S]*?)```/;
    const match = response.match(pattern);
    return match ? match[1].trim() : response.trim();
  }
}

export default EvalRunner;