/**
 * Unit tests for TreeSitterAdapter
 * Run with: node --test src/parser/TreeSitterAdapter.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TreeSitterAdapter } from './TreeSitterAdapter.js';

describe('TreeSitterAdapter', () => {
  let adapter;

  before(() => {
    adapter = new TreeSitterAdapter();
  });

  describe('parse() — Python', () => {
    it('parses Python code and returns a ParseResult', () => {
      const code = 'def hello(): return "world"';
      const result = adapter.parse(code, 'python');
      assert.strictEqual(result.language, 'python');
      assert.strictEqual(result.code, code);
      assert.ok(result.stats);
    });

    it('extracts symbols from Python code', () => {
      const code = [
        'class MyClass:',
        '    def method(self):',
        '        pass',
        'def my_function():',
        '    pass',
      ].join('\n');
      const result = adapter.parse(code, 'python');
      const symbols = adapter.getSymbols(result);
      const names = symbols.map(s => s.name);
      assert.ok(names.includes('MyClass') || names.some(n => n.includes('MyClass')));
      assert.ok(names.some(n => n.includes('my_function') || n.includes('method')));
    });

    it('extracts function definitions from Python', () => {
      const code = 'def two_sum(nums, target):\n    pass';
      const result = adapter.parse(code, 'python');
      const symbols = adapter.getSymbols(result);
      assert.ok(symbols.length >= 1);
    });

    it('extracts imports from Python', () => {
      const code = 'import os\nfrom sys import path';
      const result = adapter.parse(code, 'python');
      const symbols = adapter.getSymbols(result);
      assert.ok(symbols.some(s => s.kind === 'import'));
    });
  });

  describe('parse() — JavaScript', () => {
    it('parses JavaScript code and returns a ParseResult', () => {
      const code = 'function hello() { return "world"; }';
      const result = adapter.parse(code, 'javascript');
      assert.strictEqual(result.language, 'javascript');
    });

    it('extracts class declarations from JavaScript', () => {
      const code = 'class MyClass {\n  constructor() {}\n  method() {}\n}';
      const result = adapter.parse(code, 'javascript');
      const symbols = adapter.getSymbols(result);
      const names = symbols.map(s => s.name);
      assert.ok(names.some(n => n.includes('MyClass') || n.includes('method')));
    });

    it('extracts imports from JavaScript ES modules', () => {
      const code = 'import { useState } from "react"';
      const result = adapter.parse(code, 'javascript');
      const symbols = adapter.getSymbols(result);
      assert.ok(symbols.some(s => s.kind === 'import'));
    });
  });

  describe('parse() — Go', () => {
    it('parses Go code and extracts function declarations', () => {
      const code = 'package main\n\nfunc main() {}\n\nfunc add(a int, b int) int { return a + b }';
      const result = adapter.parse(code, 'go');
      assert.strictEqual(result.language, 'go');
      const symbols = adapter.getSymbols(result);
      const names = symbols.map(s => s.name);
      assert.ok(names.some(n => n.includes('main') || n.includes('add')));
    });
  });

  describe('parse() — Rust', () => {
    it('parses Rust code and extracts function items', () => {
      const code = 'fn main() {\n    println!("Hello");\n}\n\nstruct Point { x: i32, y: i32 }';
      const result = adapter.parse(code, 'rust');
      const symbols = adapter.getSymbols(result);
      const names = symbols.map(s => s.name);
      assert.ok(names.some(n => n.includes('main') || n.includes('Point')));
    });
  });

  describe('getLanguage()', () => {
    it('detects Python from file extension', () => {
      assert.strictEqual(adapter.getLanguage('foo.py'), 'python');
    });

    it('detects JavaScript from file extension', () => {
      assert.strictEqual(adapter.getLanguage('foo.js'), 'javascript');
      assert.strictEqual(adapter.getLanguage('foo.jsx'), 'javascript');
    });

    it('detects TypeScript from file extension', () => {
      assert.strictEqual(adapter.getLanguage('foo.ts'), 'typescript');
      assert.strictEqual(adapter.getLanguage('foo.tsx'), 'typescript');
    });

    it('detects Go from file extension', () => {
      assert.strictEqual(adapter.getLanguage('foo.go'), 'go');
    });

    it('detects Rust from file extension', () => {
      assert.strictEqual(adapter.getLanguage('foo.rs'), 'rust');
    });

    it('detects Java from file extension', () => {
      assert.strictEqual(adapter.getLanguage('foo.java'), 'java');
    });

    it('returns null for unknown extensions', () => {
      assert.strictEqual(adapter.getLanguage('foo.xyz'), null);
    });
  });

  describe('query()', () => {
    it('runs a function query on Python code', () => {
      const code = 'def foo(): pass\ndef bar(): pass';
      const result = adapter.parse(code, 'python');
      const matches = adapter.query(result, '(function_definition) @func');
      assert.ok(Array.isArray(matches));
    });

    it('runs a class query on Python code', () => {
      const code = 'class Foo: pass';
      const result = adapter.parse(code, 'python');
      const matches = adapter.query(result, '(class_definition) @class');
      assert.ok(Array.isArray(matches));
    });
  });

  describe('parseIncrementally()', () => {
    it('falls back to full parse when incremental is not available', () => {
      const result = adapter.parseIncrementally(null, 'def foo(): pass', 'python');
      assert.ok(result.language, 'python');
      assert.ok(result.stats);
    });
  });
});