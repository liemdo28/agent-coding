#!/usr/bin/env node
/**
 * eval/golden-corpus/runner.js
 * Runs the golden corpus tasks against a local LLM (Ollama) or in dry-run mode.
 *
 * Usage:
 *   npm run eval:golden                        # run all 20 tasks
 *   npm run eval:golden -- --limit 5           # first 5 tasks only
 *   npm run eval:golden -- --dry-run           # validate tasks, no LLM
 *   npm run eval:golden -- --model codellama:7b
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname }   from 'path';
import { fileURLToPath }   from 'url';
import { createRequire }   from 'module';
import { runInNewContext }  from 'vm';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const TASKS_DIR  = join(__dirname, 'tasks');
const INDEX_FILE = join(__dirname, 'INDEX.json');
const RESULTS_DIR = join(__dirname, '..', 'results');
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

mkdirSync(RESULTS_DIR, { recursive: true });

// ── Task loader ───────────────────────────────────────────────────────────────

function loadIndex() {
  if (!existsSync(INDEX_FILE)) throw new Error('INDEX.json not found — run generator first');
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function loadTask(taskId) {
  const p = join(TASKS_DIR, `${taskId}.json`);
  if (!existsSync(p)) throw new Error(`Task file not found: ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

// ── Sandbox runner ────────────────────────────────────────────────────────────

function runTestCase(fnCode, input) {
  try {
    const sandbox = { result: undefined, args: input };
    const script  = `
      ${fnCode}
      // extract function name from code
      const _match = ${JSON.stringify(fnCode)}.match(/^(?:function\\s+(\\w+)|(?:const|let|var)\\s+(\\w+)\\s*=|class\\s+(\\w+)\\s*\\{)/m);
      const _name = _match?.[1] || _match?.[2] || _match?.[3];
      if (!_name) throw new Error('Cannot find function name');
      result = eval(_name)(...args);
    `;
    runInNewContext(script, sandbox, { timeout: 3000 });
    return { ok: true, result: sandbox.result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function scoreTask(task, fnCode) {
  const results = task.test_cases.map((tc, i) => {
    const { ok, result, error } = runTestCase(fnCode, tc.input);
    if (!ok) return { case: i, passed: false, reason: error };
    const passed = JSON.stringify(result) === JSON.stringify(tc.expected);
    return {
      case: i,
      passed,
      got:      result,
      expected: tc.expected,
      reason:   passed ? 'ok' : `got ${JSON.stringify(result)}, want ${JSON.stringify(tc.expected)}`,
    };
  });
  const passed = results.filter(r => r.passed).length;
  return { passed, total: results.length, cases: results };
}

// ── Reference baseline (dry-run) ─────────────────────────────────────────────

function runReference(task) {
  return scoreTask(task, task.reference_solution);
}

// ── LLM call ──────────────────────────────────────────────────────────────────

async function llmGenerate(task, model) {
  const prompt = `You are an expert JavaScript developer. Write a complete, working JavaScript function.

Task: ${task.title}

${task.description}

Function signature hint: ${task.function_signature}

Requirements:
- Return ONLY the function code, no explanation
- Use modern JavaScript (ES2022)
- Handle edge cases
- The function must be named exactly as shown in the signature hint

Code:`;

  const body = JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { temperature: 0.0, num_predict: 512 },
  });

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal:  AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return extractCode(data.response ?? '');
  } catch (err) {
    return null;
  }
}

function extractCode(text) {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const flags   = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = (!args[i+1] || args[i+1].startsWith('--')) ? true : args[++i];
    }
  }

  const dryRun = flags['dry-run'] ?? false;
  const model  = flags.model ?? 'qwen2.5-coder:7b';
  const limit  = flags.limit ? parseInt(flags.limit) : null;

  const index = loadIndex();
  const taskIds = (limit ? index.tasks.slice(0, limit) : index.tasks);

  console.log(`\nGolden Corpus Eval — ${dryRun ? 'DRY RUN (reference)' : `LLM: ${model}`}`);
  console.log(`Tasks: ${taskIds.length}  |  OLLAMA: ${OLLAMA_BASE}\n`);
  console.log('─'.repeat(72));

  let totalPassed = 0, totalTasks = taskIds.length, totalCases = 0, totalCasesPassed = 0;
  const results = [];

  for (const taskId of taskIds) {
    const task = loadTask(taskId);
    process.stdout.write(`  ${taskId}  ${task.title.padEnd(45).slice(0,45)}  `);

    let score;
    if (dryRun) {
      score = runReference(task);
    } else {
      const code = await llmGenerate(task, model);
      score = code ? scoreTask(task, code) : { passed: 0, total: task.test_cases.length, cases: [], llm_error: true };
    }

    const allPass = score.passed === score.total;
    const mark    = allPass ? '✓' : score.passed > 0 ? '~' : '✗';
    console.log(`${mark}  ${score.passed}/${score.total} cases  [${task.difficulty}]`);

    if (allPass) totalPassed++;
    totalCases       += score.total;
    totalCasesPassed += score.passed;
    results.push({ task_id: taskId, title: task.title, difficulty: task.difficulty,
                   category: task.category, ...score });
  }

  console.log('─'.repeat(72));
  const taskPct  = Math.round(totalPassed / totalTasks * 100);
  const casePct  = Math.round(totalCasesPassed / totalCases * 100);
  console.log(`\nTasks passed:  ${totalPassed}/${totalTasks}  (${taskPct}%)`);
  console.log(`Cases passed:  ${totalCasesPassed}/${totalCases}  (${casePct}%)`);

  // Breakdown by difficulty
  for (const diff of ['easy','medium','hard']) {
    const sub = results.filter(r => r.difficulty === diff);
    if (!sub.length) continue;
    const p = sub.filter(r => r.passed === r.total).length;
    console.log(`  ${diff.padEnd(8)} ${p}/${sub.length}`);
  }

  // Save results
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
  const outFile = join(RESULTS_DIR, `golden-corpus-${ts}.json`);
  writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: dryRun ? 'reference' : model,
    dry_run: dryRun,
    summary: { tasks_passed: totalPassed, tasks_total: totalTasks,
               task_pass_rate: totalPassed / totalTasks,
               cases_passed: totalCasesPassed, cases_total: totalCases },
    results,
  }, null, 2));
  console.log(`\nResults saved: ${outFile}`);

  if (!dryRun && totalPassed < totalTasks * 0.5) {
    console.log('\nWARN: pass rate < 50% — check model or Ollama connection');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
