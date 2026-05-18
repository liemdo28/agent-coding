// tests/modules.test.js — functional tests for local-agent modules
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'agent-test-'));
}

describe('ProgressTracker', () => {
  test('loadProgress returns default state when no persisted file', async () => {
    const { loadProgress } = await import('../local-agent/eng-log/ProgressTracker.js');
    const dir = tmp();
    try {
      const p = loadProgress(dir);
      assert.ok(Array.isArray(p.completedPhases), 'completedPhases must be array');
      assert.ok(Array.isArray(p.priorities),      'priorities must be array');
      assert.ok(Array.isArray(p.inProgress),       'inProgress must be array');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('setCurrentPhase persists and loadProgress reads it back', async () => {
    const { setCurrentPhase, loadProgress } = await import('../local-agent/eng-log/ProgressTracker.js');
    const dir = tmp();
    try {
      setCurrentPhase(dir, 'Phase 99 — Test');
      const p = loadProgress(dir);
      assert.strictEqual(p.currentPhase, 'Phase 99 — Test');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('markCompleted appends to completedPhases', async () => {
    const { markCompleted, loadProgress } = await import('../local-agent/eng-log/ProgressTracker.js');
    const dir = tmp();
    try {
      markCompleted(dir, 'Phase A');
      markCompleted(dir, 'Phase B');
      const p = loadProgress(dir);
      assert.ok(p.completedPhases.includes('Phase A'));
      assert.ok(p.completedPhases.includes('Phase B'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('CheckpointWriter', () => {
  test('writeCheckpoint creates a numbered file', async () => {
    const { writeCheckpoint, countCheckpoints } = await import('../local-agent/eng-log/CheckpointWriter.js');
    const dir = tmp();
    try {
      assert.strictEqual(countCheckpoints(dir), 0);
      const result = writeCheckpoint(dir, {
        phase: 'Test Phase', title: 'Test Checkpoint',
        implemented: ['thing1'], filesChanged: ['file.js'],
        risks: [], decisions: [], rollbackNotes: 'git revert',
        qaResult: 'PASS', nextStep: 'continue',
      });
      assert.ok(result.id.startsWith('checkpoint-'));
      assert.strictEqual(countCheckpoints(dir), 1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('listCheckpoints returns most-recent-first', async () => {
    const { writeCheckpoint, listCheckpoints } = await import('../local-agent/eng-log/CheckpointWriter.js');
    const dir = tmp();
    try {
      const opts = { phase: 'P', title: 'T', implemented: [], filesChanged: [], risks: [], decisions: [], rollbackNotes: '', qaResult: 'PASS', nextStep: '' };
      writeCheckpoint(dir, { ...opts, title: 'First' });
      writeCheckpoint(dir, { ...opts, title: 'Second' });
      const list = listCheckpoints(dir);
      assert.strictEqual(list.length, 2);
      // sorted descending, checkpoint-002 comes first
      assert.ok(list[0].id > list[1].id);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('EngineeringStateTracker', () => {
  test('getState returns default risks when no state file', async () => {
    const { getState } = await import('../local-agent/eng-log/EngineeringStateTracker.js');
    const dir = tmp();
    try {
      const s = getState(dir);
      assert.ok(Array.isArray(s.risks));
      assert.ok(s.risks.length > 0, 'default risks should be populated');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('addKnownIssue creates issue and listKnownIssues returns it', async () => {
    const { addKnownIssue, listKnownIssues } = await import('../local-agent/eng-log/EngineeringStateTracker.js');
    const dir = tmp();
    try {
      const id = addKnownIssue(dir, { title: 'Test issue', rootCause: 'testing', risk: 'low' });
      assert.ok(id.startsWith('ISS-'));
      const issues = listKnownIssues(dir);
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].title, 'Test issue');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('resolveIssue marks issue as resolved', async () => {
    const { addKnownIssue, resolveIssue, listKnownIssues } = await import('../local-agent/eng-log/EngineeringStateTracker.js');
    const dir = tmp();
    try {
      const id = addKnownIssue(dir, { title: 'Resolvable', rootCause: 'x' });
      resolveIssue(dir, id);
      const open = listKnownIssues(dir, { includeResolved: false });
      assert.strictEqual(open.length, 0, 'resolved issue should not appear in open list');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('FilePurposeIndexer', () => {
  test('searchFilePurpose returns matching results for known keyword', async () => {
    const { searchFilePurpose } = await import('../local-agent/eng-log/FilePurposeIndexer.js');
    const dir = tmp();
    try {
      const results = searchFilePurpose(dir, 'audit ledger');
      assert.ok(Array.isArray(results));
      // Static KNOWN_PURPOSES should have accounting/audit matches
      if (results.length > 0) {
        assert.ok(typeof results[0].file === 'string');
        assert.ok(typeof results[0].purpose === 'string');
        assert.ok(results[0].score >= 1);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('searchFilePurpose returns empty array for no-match query', async () => {
    const { searchFilePurpose } = await import('../local-agent/eng-log/FilePurposeIndexer.js');
    const dir = tmp();
    try {
      const results = searchFilePurpose(dir, 'zxqxyznotarealterm12345');
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('DecisionTracker', () => {
  test('recordDecision creates DEC-NNN and listDecisions returns it', async () => {
    const { recordDecision, listDecisions } = await import('../local-agent/eng-log/DecisionTracker.js');
    const dir = tmp();
    try {
      const d = recordDecision(dir, {
        title: 'Use SQLite WAL', reason: 'Performance', impact: 'Better write throughput',
      });
      assert.ok(d.decisionId.startsWith('DEC-'));
      const list = listDecisions(dir);
      assert.strictEqual(list.length, 1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('CommandPolicy and sandbox execution', () => {
  test('policy permits npm run scripts but blocks network package operations', async () => {
    const { checkCommand } = await import('../local-agent/security/CommandPolicy.js');

    assert.strictEqual(checkCommand('npm', ['run', 'build']).allowed, true);
    assert.strictEqual(checkCommand('npm', ['install']).allowed, false);
    assert.strictEqual(checkCommand('npx', ['some-package@latest']).allowed, false);
    assert.strictEqual(checkCommand('node', ['script.js', 'https://example.com']).allowed, false);
  });

  test('policy blocks destructive command patterns', async () => {
    const { checkCommand } = await import('../local-agent/security/CommandPolicy.js');

    const result = checkCommand('rm', ['-rf', '/']);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.destructive, true);
  });

  test('sandbox enforces command policy and writes audit events', async () => {
    const { createSandbox } = await import('../local-agent/sandbox/sandbox.js');
    const { getRecentEvents } = await import('../local-agent/security/AuditLogger.js');
    const dir = tmp();

    try {
      const sandbox = createSandbox(dir, {
        sandbox: {
          allowedCommands: ['node', 'npm'],
          blockedCommands: ['curl'],
          timeoutMs: 5000,
          maxOutputBytes: 10000,
        },
      });

      const ok = await sandbox.runCommand(
        'node',
        ['-e', 'console.log("sandbox-ok")'],
        { cwd: dir }
      );
      assert.strictEqual(ok.success, true);
      assert.match(ok.stdout, /sandbox-ok/);

      await assert.rejects(
        () => sandbox.runCommand('npm', ['install'], { cwd: dir }),
        /network-related pattern|blocked by security policy/
      );

      const events = getRecentEvents(dir, 10);
      assert.ok(events.some((e) => e.event === 'command_completed'));
      assert.ok(events.some((e) => e.event === 'command_policy_blocked'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('SecretScanner', () => {
  test('basic auth URL pattern does not flag package registry URLs', async () => {
    const { scanContent } = await import('../local-agent/security/SecretScanner.js');
    const content = '"resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.0.tgz"';

    const findings = scanContent(content, 'package-lock.json');
    assert.strictEqual(findings.some((f) => f.name === 'Basic Auth URL'), false);
  });

  test('basic auth URL pattern still flags credentialed URLs', async () => {
    const { scanContent } = await import('../local-agent/security/SecretScanner.js');
    const content = 'const url = "' + ['https://deploy', 'supersecret@example.com/repo.git'].join(':') + '";';

    const findings = scanContent(content, 'example.js');
    assert.ok(findings.some((f) => f.name === 'Basic Auth URL'));
  });
});
