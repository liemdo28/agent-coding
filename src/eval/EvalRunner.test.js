/**
 * Unit tests for EvalRunner
 * Run with: node --test src/eval/EvalRunner.test.js
 */

import { before, describe, it } from 'node:test';
import assert from 'node:assert';
import { EvalRunner } from './EvalRunner.js';

describe('EvalRunner', () => {
  let runner;

  before(() => {
    runner = new EvalRunner({ resultsDir: '/tmp/eval-test-results' });
  });

  describe('runSecurityChecks()', () => {
    it('returns score 0 when code contains forbidden patterns', () => {
      const result = runner.runSecurityChecks('import requests; requests.get("http://evil.com")', 'python');
      assert.strictEqual(result.score, 0);
      assert.ok(result.violations.length > 0);
      const fail = result.violations.find(v => v.severity === 'fail');
      assert.ok(fail);
    });

    it('returns score 1 for clean code', () => {
      const result = runner.runSecurityChecks('def hello(): return "world"', 'python');
      assert.strictEqual(result.score, 1);
      assert.strictEqual(result.violations.length, 0);
    });

    it('flags subprocess as warn severity', () => {
      const result = runner.runSecurityChecks('import subprocess\nsubprocess.run(["ls"])', 'python');
      const warn = result.violations.find(v => v.severity === 'warn');
      assert.ok(warn);
      assert.strictEqual(result.score, 0.9);
    });

    it('allows non-Python security rules to pass for non-Python code', () => {
      const result = runner.runSecurityChecks('const x = 1;', 'javascript');
      // No network calls are possible in JS by default, so should pass
      assert.strictEqual(result.score, 1);
    });
  });

  describe('runQualityChecks()', () => {
    it('returns quality score for clean code', () => {
      const code = 'def hello():\n    return "world"';
      const result = runner.runQualityChecks(code, 'python');
      assert.ok(result.score >= 0.9);
    });

    it('flags TODO comments as warnings', () => {
      const code = 'def hello():\n    # TODO: fix this later\n    pass';
      const result = runner.runQualityChecks(code, 'python');
      assert.ok(result.violations.some(v => v.rule === 'no-todo'));
    });

    it('flags long lines (>120 chars)', () => {
      const code = 'x = "' + 'a'.repeat(130) + '"';
      const result = runner.runQualityChecks(code, 'python');
      assert.ok(result.violations.some(v => v.rule === 'line-length'));
    });

    it('returns a violations array', () => {
      const result = runner.runQualityChecks('def foo(): pass', 'python');
      assert.ok(Array.isArray(result.violations));
    });
  });

  describe('evaluate()', () => {
    it('returns a complete EvalResult structure', async () => {
      const code = 'def add(a, b): return a + b';
      const result = await runner.evaluate(code, { language: 'python', benchmark: 'test' });
      assert.ok(result.benchmark);
      assert.ok(result.timestamp);
      assert.ok(typeof result.functional === 'object');
      assert.ok(typeof result.quality === 'object');
      assert.ok(typeof result.security === 'object');
      assert.ok(typeof result.overall === 'number');
    });

    it('blocks code with eval() — security violation prevents execution', async () => {
      const code = 'def bad(): exec("print(1)")';
      const result = await runner.evaluate(code, {
        language: 'python',
        testCode: 'bad()',
      });
      // Security violations should block functional test
      assert.strictEqual(result.functional.passed, 0);
      assert.strictEqual(result.functional.failed, 0); // not run
    });
  });

  describe('runBenchmark()', () => {
    it('returns aggregated results for multiple problems', async () => {
      const problems = [
        {
          task_id: 'test_001',
          generatedCode: 'def add(a, b): return a + b',
          test: 'assert add(1, 2) == 3',
        },
        {
          task_id: 'test_002',
          generatedCode: 'def sub(a, b): return a - b',
          test: 'assert sub(5, 3) == 2',
        },
      ];
      const result = await runner.runBenchmark({ problems, language: 'python', benchmark: 'custom' });
      assert.ok(result.functional);
      assert.strictEqual(result.functional.passed + result.functional.failed, problems.length);
    });
  });
});
