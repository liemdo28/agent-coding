// qa/BuildRunner.js - run build commands through the sandbox and capture output

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createSandbox } from '../sandbox/sandbox.js';
import { parseErrors }   from './ErrorParser.js';

// Detect build command from project map or config
function detectBuildCommand(workspaceRoot, config) {
  const mapPath = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (existsSync(mapPath)) {
    try {
      const map = JSON.parse(readFileSync(mapPath, 'utf8'));
      if (map.commands?.build) return splitCommand(map.commands.build);
    } catch { /* ignore */ }
  }
  return ['npm', ['run', 'build']];
}

function detectLintCommand(workspaceRoot) {
  const mapPath = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (existsSync(mapPath)) {
    try {
      const map = JSON.parse(readFileSync(mapPath, 'utf8'));
      if (map.commands?.lint) return splitCommand(map.commands.lint);
    } catch { /* ignore */ }
  }
  return null;
}

function detectTypecheckCommand(workspaceRoot) {
  if (existsSync(join(workspaceRoot, 'tsconfig.json'))) {
    return ['npx', ['tsc', '--noEmit']];
  }
  return null;
}

function splitCommand(cmdString) {
  const parts = cmdString.trim().split(/\s+/);
  return [parts[0], parts.slice(1)];
}

/**
 * Run the build command for a project.
 *
 * @param {string} workspaceRoot
 * @param {object} config
 * @param {object} [options] - { command?: string, args?: string[] }
 * @returns {Promise<BuildResult>}
 */
export async function runBuild(workspaceRoot, config, options = {}) {
  const sandbox = createSandbox(workspaceRoot, config);
  const [cmd, args] = options.command
    ? splitCommand(options.command)
    : detectBuildCommand(workspaceRoot, config);

  const startMs = Date.now();
  let result;
  try {
    result = await sandbox.runCommand(cmd, args, { cwd: workspaceRoot });
  } catch (err) {
    return {
      phase:     'build',
      command:   [cmd, ...args].join(' '),
      success:   false,
      exitCode:  null,
      stdout:    '',
      stderr:    err.message,
      durationMs: Date.now() - startMs,
      errors:    parseErrors(err.message, { command: cmd, framework: 'unknown' }),
      timedOut:  false,
    };
  }

  const rawOutput = result.stdout + '\n' + result.stderr;
  const errors = result.success ? [] : parseErrors(rawOutput, { command: cmd });

  return {
    phase:     'build',
    command:   [cmd, ...args].join(' '),
    success:   result.success,
    exitCode:  result.exitCode,
    stdout:    result.stdout,
    stderr:    result.stderr,
    durationMs: Date.now() - startMs,
    errors,
    timedOut:  result.timedOut,
  };
}

/**
 * Run lint and typecheck as static build checks.
 */
export async function runStaticChecks(workspaceRoot, config) {
  const sandbox = createSandbox(workspaceRoot, config);
  const results = [];

  // Lint
  const lintCmd = detectLintCommand(workspaceRoot);
  if (lintCmd) {
    const [cmd, args] = lintCmd;
    const startMs = Date.now();
    try {
      const r = await sandbox.runCommand(cmd, args, { cwd: workspaceRoot });
      const rawOutput = r.stdout + '\n' + r.stderr;
      results.push({
        phase:     'lint',
        command:   [cmd, ...args].join(' '),
        success:   r.success,
        exitCode:  r.exitCode,
        stdout:    r.stdout,
        stderr:    r.stderr,
        durationMs: Date.now() - startMs,
        errors:    r.success ? [] : parseErrors(rawOutput, { command: cmd }),
        timedOut:  r.timedOut,
      });
    } catch (err) {
      results.push({ phase: 'lint', command: [cmd, ...args].join(' '),
        success: false, errors: [], stderr: err.message, durationMs: Date.now() - startMs });
    }
  }

  // Typecheck
  const tcCmd = detectTypecheckCommand(workspaceRoot);
  if (tcCmd) {
    const [cmd, args] = tcCmd;
    const startMs = Date.now();
    try {
      const r = await sandbox.runCommand(cmd, args, { cwd: workspaceRoot });
      const rawOutput = r.stdout + '\n' + r.stderr;
      results.push({
        phase:     'typecheck',
        command:   [cmd, ...args].join(' '),
        success:   r.success,
        exitCode:  r.exitCode,
        stdout:    r.stdout,
        stderr:    r.stderr,
        durationMs: Date.now() - startMs,
        errors:    r.success ? [] : parseErrors(rawOutput, { command: cmd }),
        timedOut:  r.timedOut,
      });
    } catch (err) {
      results.push({ phase: 'typecheck', command: [cmd, ...args].join(' '),
        success: false, errors: [], stderr: err.message, durationMs: Date.now() - startMs });
    }
  }

  return results;
}
