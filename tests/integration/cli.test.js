// tests/integration/cli.test.js — CLI smoke integration tests
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CLI  = join(ROOT, 'bin/local-agent.js');

function runCLI(args, { timeout = 10000 } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd:      ROOT,
    encoding: 'utf8',
    timeout,
  });
}

describe('local-agent CLI', () => {
  test('CLI entry point exists', () => {
    assert.ok(existsSync(CLI), `${CLI} must exist`);
  });

  test('--version prints version and exits 0', () => {
    const r = runCLI(['--version']);
    assert.strictEqual(r.status, 0, `--version must exit 0, got: ${r.stderr}`);
    assert.match(r.stdout, /\d+\.\d+\.\d+/, '--version must print a semver string');
  });

  test('--help exits 0 and lists commands', () => {
    const r = runCLI(['--help']);
    assert.strictEqual(r.status, 0, `--help must exit 0, got: ${r.stderr}`);
    assert.ok(
      r.stdout.includes('logs') || r.stdout.includes('local-agent'),
      '--help output must mention CLI commands',
    );
  });

  test('logs --help exits 0', () => {
    const r = runCLI(['logs', '--help']);
    assert.strictEqual(r.status, 0, `logs --help must exit 0, got: ${r.stderr}`);
    assert.ok(r.stdout.includes('latest') || r.stdout.includes('update'));
  });

  test('unknown command exits non-zero', () => {
    const r = runCLI(['definitely-not-a-real-command-xyz']);
    // Commander exits 1 for unknown commands
    assert.notStrictEqual(r.status, 0, 'Unknown command must exit non-zero');
  });
});
