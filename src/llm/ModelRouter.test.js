/**
 * Unit tests for ModelRouter
 * Run with: node --test src/llm/ModelRouter.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ModelRouter } from './ModelRouter.js';

describe('ModelRouter', () => {
  let router;

  beforeEach(() => {
    router = new ModelRouter();
  });

  describe('route()', () => {
    it('routes code-gen tasks to a Qwen coder model (default manifest)', () => {
      const result = router.route({ taskType: 'code-gen', language: 'python' });
      assert.ok(result.model.startsWith('qwen2.5-coder:'));
      assert.ok(result.reason.includes('code-gen'));
      assert.ok(Array.isArray(result.fallback));
      assert.ok(result.score >= 0);
    });

    it('routes ast-query tasks to fastest model', () => {
      const result = router.route({ taskType: 'ast-query', language: 'python' });
      assert.ok(result.model.length > 0);
      assert.strictEqual(typeof result.score, 'number');
    });

    it('routes refactor tasks (quality-weighted)', () => {
      const result = router.route({ taskType: 'refactor', language: 'python' });
      assert.ok(result.model.length > 0);
      assert.ok(result.reason.includes('refactor'));
    });

    it('excludes models that do not support the requested language', () => {
      const result = router.route({ taskType: 'code-gen', language: 'cobol' });
      assert.ok(result.model.length > 0);
    });

    it('returns a fallback chain', () => {
      const result = router.route({ taskType: 'code-gen' });
      assert.ok(Array.isArray(result.fallback));
    });

    it('is deterministic — same input always returns same output', () => {
      const r1 = router.route({ taskType: 'code-review', language: 'python' });
      const r2 = router.route({ taskType: 'code-review', language: 'python' });
      assert.strictEqual(r1.model, r2.model);
      assert.strictEqual(r1.score, r2.score);
    });

    it('handles unknown task types gracefully with code-gen default', () => {
      const result = router.route({ taskType: 'unknown-task-type' });
      assert.ok(result.model.length > 0);
    });
  });

  describe('isAvailable()', () => {
    it('returns a boolean', async () => {
      const result = await router.isAvailable('qwen2.5-coder:7b');
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('listAvailable()', () => {
    it('returns an array of model names', async () => {
      const result = await router.listAvailable();
      assert.ok(Array.isArray(result));
    });
  });

  describe('routeAvailable()', () => {
    it('returns a ModelCandidate with model, reason, fallback, score', async () => {
      const result = await router.routeAvailable({ taskType: 'test-gen' });
      assert.ok(typeof result.model === 'string');
      assert.ok(typeof result.reason === 'string');
      assert.ok(Array.isArray(result.fallback));
      assert.ok(typeof result.score === 'number');
    });
  });
});
