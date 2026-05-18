// training/evaluationRunner.js — evaluates model performance on local test cases
// Phase 17: sends test cases to Ollama, scores responses, saves reports

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import http from 'http';

const REPORTS_DIR  = join(homedir(), '.local-agent', 'eval-reports');
const OLLAMA_BASE  = 'http://localhost:11434';

/**
 * Run evaluation of a model against test cases.
 * @param {string} modelName  Ollama model name
 * @param {Array<{ input: string, expected: string, instruction?: string }>} testCases
 * @param {{ timeout?: number }} options
 * @returns {Promise<{ model: string, avgScore: number, passRate: number, testCases: object[], timestamp: string }>}
 */
export async function runEvaluation(modelName, testCases, options = {}) {
  const timeout   = options.timeout ?? 30_000;
  const results   = [];

  for (const tc of testCases) {
    const prompt = tc.instruction ? `${tc.instruction}\n\n${tc.input}` : tc.input;
    let actual   = '';

    try {
      actual = await ollamaGenerate(modelName, prompt, timeout);
    } catch (err) {
      actual = `ERROR: ${err.message}`;
    }

    const score = scoreResponse(tc.expected, actual);
    results.push({
      input:    tc.input.slice(0, 200),
      expected: tc.expected.slice(0, 200),
      actual:   actual.slice(0, 200),
      score,
      passed:   score >= 0.5,
    });
  }

  const avgScore = results.length > 0
    ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const passRate = results.length > 0
    ? results.filter(r => r.passed).length / results.length : 0;

  const report = {
    model:     modelName,
    avgScore:  +avgScore.toFixed(3),
    passRate:  +passRate.toFixed(3),
    testCases: results,
    timestamp: new Date().toISOString(),
  };

  saveReport(report);
  return report;
}

/**
 * Score a model response against the expected answer.
 * Uses token overlap (simple F1-like measure).
 * @param {string} expected
 * @param {string} actual
 * @returns {number} 0–1
 */
export function scoreResponse(expected, actual) {
  if (!expected || !actual) return 0;
  const expTokens = tokenize(expected);
  const actTokens = tokenize(actual);
  const expSet    = new Set(expTokens);
  const actSet    = new Set(actTokens);
  const intersection = [...expSet].filter(t => actSet.has(t)).length;
  const precision  = actSet.size > 0 ? intersection / actSet.size : 0;
  const recall     = expSet.size > 0 ? intersection / expSet.size : 0;
  if (precision + recall === 0) return 0;
  return +((2 * precision * recall) / (precision + recall)).toFixed(3);
}

/**
 * Generate a formatted evaluation report.
 * @param {{ model: string, avgScore: number, passRate: number, testCases: object[], timestamp: string }} results
 * @returns {string}
 */
export function getEvaluationReport(results) {
  return JSON.stringify(results, null, 2);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function saveReport(report) {
  try {
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
    const filename = `eval-${report.model.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.json`;
    writeFileSync(join(REPORTS_DIR, filename), JSON.stringify(report, null, 2), 'utf8');
  } catch { /* non-critical */ }
}

function tokenize(text) {
  return String(text).toLowerCase().split(/\W+/).filter(t => t.length > 2);
}

function ollamaGenerate(model, prompt, timeout) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, prompt, stream: false });
    const req  = http.request({
      hostname: 'localhost',
      port:     11434,
      path:     '/api/generate',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)?.response ?? ''); } catch { resolve(''); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(body);
    req.end();
  });
}
