// qa/TestRunner.js - run test commands through the sandbox and parse results

import { join }      from 'path';
import { existsSync, readFileSync } from 'fs';
import { createSandbox } from '../sandbox/sandbox.js';
import { parseErrors }   from './ErrorParser.js';

function detectTestCommand(workspaceRoot) {
  const mapPath = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (existsSync(mapPath)) {
    try {
      const map = JSON.parse(readFileSync(mapPath, 'utf8'));
      if (map.commands?.test) return splitCommand(map.commands.test);
    } catch { /* ignore */ }
  }

  // Fallbacks by lock file / config presence
  if (existsSync(join(workspaceRoot, 'pytest.ini')) ||
      existsSync(join(workspaceRoot, 'pyproject.toml')))   return ['pytest', ['--tb=short']];
  if (existsSync(join(workspaceRoot, 'jest.config.js')) ||
      existsSync(join(workspaceRoot, 'jest.config.ts')))   return ['npx', ['jest', '--no-coverage']];
  if (existsSync(join(workspaceRoot, 'vitest.config.js')) ||
      existsSync(join(workspaceRoot, 'vitest.config.ts'))) return ['npx', ['vitest', 'run']];

  return ['npm', ['run', 'test', '--', '--passWithNoTests']];
}

function splitCommand(cmdString) {
  const parts = cmdString.trim().split(/\s+/);
  return [parts[0], parts.slice(1)];
}

// ── Result parsers for various test frameworks ────────────────────────────────

function parseSummaryLine(output) {
  // Jest/Vitest: "Tests: 5 passed, 2 failed, 7 total"
  const jestM = output.match(/Tests?:\s+(.*?total)/i);
  if (jestM) {
    const passed = +(output.match(/(\d+)\s+passed/)?.[1] ?? 0);
    const failed = +(output.match(/(\d+)\s+failed/)?.[1] ?? 0);
    const total  = +(output.match(/(\d+)\s+total/)?.[1]  ?? passed + failed);
    return { passed, failed, total };
  }

  // Pytest: "5 passed, 2 failed in 1.23s"
  const pytestM = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+(?:failed|error))?/);
  if (pytestM) {
    const passed = +(pytestM[1] ?? 0);
    const failed = +(pytestM[2] ?? 0);
    return { passed, failed, total: passed + failed };
  }

  return null;
}

/**
 * Run the project's test suite.
 *
 * @param {string} workspaceRoot
 * @param {object} config
 * @param {object} [options] - { command?, timeout? }
 * @returns {Promise<TestResult>}
 */
export async function runTests(workspaceRoot, config, options = {}) {
  const sandbox = createSandbox(workspaceRoot, config);
  const [cmd, args] = options.command
    ? splitCommand(options.command)
    : detectTestCommand(workspaceRoot);

  const timeout = options.timeout ?? config?.sandbox?.timeoutMs ?? 120000;
  const startMs = Date.now();

  let result;
  try {
    result = await sandbox.runCommand(cmd, args, { cwd: workspaceRoot, timeout });
  } catch (err) {
    return {
      phase:     'test',
      command:   [cmd, ...args].join(' '),
      success:   false,
      exitCode:  null,
      stdout:    '',
      stderr:    err.message,
      durationMs: Date.now() - startMs,
      summary:   null,
      errors:    parseErrors(err.message, { command: cmd }),
      timedOut:  false,
    };
  }

  const rawOutput = result.stdout + '\n' + result.stderr;
  const errors    = result.success ? [] : parseErrors(rawOutput, { command: cmd });
  const summary   = parseSummaryLine(rawOutput);

  return {
    phase:     'test',
    command:   [cmd, ...args].join(' '),
    success:   result.success,
    exitCode:  result.exitCode,
    stdout:    result.stdout,
    stderr:    result.stderr,
    durationMs: Date.now() - startMs,
    summary,
    errors,
    timedOut:  result.timedOut,
  };
}
