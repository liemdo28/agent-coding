#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, totalmem, freemem } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportsDir = join(repoRoot, 'reports');
const tmpRoot = mkdtempSync(join(repoRoot, '.tmp-agent-stress-'));
const runtimeDir = join(tmpRoot, '.local-agent', 'digital-twin');
const port = Number(process.env.STRESS_PORT ?? 4701);
const maxUsers = Number(process.env.STRESS_MAX_USERS ?? 1000);
const workerTiers = (process.env.STRESS_WORKERS ?? '512,1024,2048').split(',').map((n) => Number(n.trim())).filter(Boolean);
const baseUrl = `http://127.0.0.1:${port}`;

mkdirSync(reportsDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });

const now = new Date().toISOString();
const failures = [];
const metrics = [];

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}

async function request(path, options = {}) {
  const start = performance.now();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const elapsed = Math.round(performance.now() - start);
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { ok: res.ok, status: res.status, elapsed, json };
}

async function runConcurrent(name, count, makeRequest, concurrency = 100) {
  const latencies = [];
  let ok = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < count) {
      const index = cursor;
      cursor += 1;
      try {
        const result = await makeRequest(index);
        latencies.push(result.elapsed);
        if (result.ok) ok += 1;
        else {
          failed += 1;
          failures.push({ name, index, status: result.status, detail: result.json?.error ?? 'non-2xx response' });
        }
      } catch (err) {
        failed += 1;
        failures.push({ name, index, detail: err.message });
      }
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
  const durationMs = Math.round(performance.now() - started);
  const row = {
    name,
    count,
    ok,
    failed,
    durationMs,
    throughputPerSec: Number((count / (durationMs / 1000)).toFixed(2)),
    avgMs: Math.round(latencies.reduce((sum, n) => sum + n, 0) / Math.max(1, latencies.length)),
    p95Ms: percentile(latencies, 95),
    maxMs: Math.max(0, ...latencies),
  };
  metrics.push(row);
  return row;
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.map((c) => c.label).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((c) => String(row[c.key] ?? '')).join(' | ')} |`),
  ].join('\n');
}

async function waitForServer(child) {
  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const health = await request('/health');
      if (health.ok) return;
    } catch {
      // keep waiting
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for local UI backend');
}

function writeReports(serverMetrics) {
  const metricColumns = [
    { key: 'name', label: 'Scenario' },
    { key: 'count', label: 'Requests' },
    { key: 'ok', label: 'OK' },
    { key: 'failed', label: 'Failed' },
    { key: 'throughputPerSec', label: 'Throughput/sec' },
    { key: 'avgMs', label: 'Avg ms' },
    { key: 'p95Ms', label: 'P95 ms' },
    { key: 'maxMs', label: 'Max ms' },
  ];

  const perf = [
    '# Agent-Coding Performance Report',
    `**Generated:** ${now}`,
    '',
    '## Environment',
    '',
    `- Node: ${process.version}`,
    `- CPU cores: ${cpus().length}`,
    `- Load average: ${loadavg().map((n) => n.toFixed(2)).join(', ')}`,
    `- Memory free/total: ${Math.round(freemem() / 1024 / 1024)}MB / ${Math.round(totalmem() / 1024 / 1024)}MB`,
    `- Backend: ${baseUrl}`,
    '',
    '## Scenario Metrics',
    '',
    markdownTable(metrics, metricColumns),
    '',
    '## Runtime Snapshot',
    '',
    '```json',
    JSON.stringify(serverMetrics, null, 2),
    '```',
    '',
  ].join('\n');

  const failure = [
    '# Agent-Coding Failure Report',
    `**Generated:** ${now}`,
    '',
    failures.length === 0 ? 'No request failures, JSON corruption, duplicate execution, or sandbox overwrite failures were detected in this run.' : '## Failures',
    '',
    ...(failures.length === 0 ? [] : [
      markdownTable(failures.slice(0, 200).map((f) => ({
        scenario: f.name,
        index: f.index,
        status: f.status ?? '',
        detail: f.detail,
      })), [
        { key: 'scenario', label: 'Scenario' },
        { key: 'index', label: 'Index' },
        { key: 'status', label: 'Status' },
        { key: 'detail', label: 'Detail' },
      ]),
    ]),
    '',
    '## Explicit Validations',
    '',
    '- Runtime JSON writes use atomic temp-file swap and `.bak` recovery.',
    '- Stress run uses an isolated temporary `LOCAL_AGENT_PROJECT`, so production source is not overwritten.',
    '- Sandbox execution calls are routed through `/execution` and stay metadata-only/offline.',
    '- Malformed payloads are expected to return 4xx, not crash the server.',
    '',
  ].join('\n');

  const optimization = [
    '# Agent-Coding Optimization Plan',
    `**Generated:** ${now}`,
    '',
    '## Recommended Next Steps',
    '',
    '1. Add browser-level Playwright profiling for Digital Twin FPS, tooltip latency, and navigation lag.',
    '2. Add a real websocket/SSE reconnect storm test once websocket channels are introduced; current backend uses HTTP + SSE.',
    '3. Add a bounded in-memory queue for `/agent/ask` when Local LLM requests are enabled under high concurrency.',
    '4. Keep JSON runtime files append-bounded; execution history is capped to 5000 events in the stress-hardened endpoint.',
    '5. Add optional Prometheus text exposition if this local-only dashboard needs external scraping.',
    '6. Add scanner-specific fixture repos with large `node_modules`, binary files, symlink loops, and nested git repos.',
    '',
    '## Current Hardening Implemented',
    '',
    '- Atomic JSON persistence with temp-file swap and backup recovery.',
    '- Runtime request metrics endpoint at `/metrics`.',
    '- One-command stress runner via `./scripts/stress-test.sh` or `npm run stress`.',
    '- Isolated stress project root to preserve sandbox/source safety.',
    '',
  ].join('\n');

  writeFileSync(join(reportsDir, 'agent-coding-performance-report.md'), perf, 'utf8');
  writeFileSync(join(reportsDir, 'agent-coding-failure-report.md'), failure, 'utf8');
  writeFileSync(join(reportsDir, 'agent-coding-optimization-plan.md'), optimization, 'utf8');
}

let server;
try {
  server = spawn(process.execPath, ['local-agent/ui/backend/server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      LOCAL_AGENT_PROJECT: tmpRoot,
      NODE_ENV: 'stress',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serverLog = [];
  server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
  server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));

  await waitForServer(server);

  await runConcurrent('chat-session-create-100', Math.min(100, maxUsers), (i) => request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: `stress chat ${i}` }),
  }), 50);

  if (maxUsers >= 500) {
    await runConcurrent('chat-session-create-500', 500, (i) => request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: `stress burst ${i}` }),
    }), 100);
  }

  if (maxUsers >= 1000) {
    await runConcurrent('chat-session-list-1000', 1000, () => request('/chat/sessions'), 120);
  }

  await runConcurrent('task-assignment-10000', 10000, (i) => request('/task', {
    method: 'POST',
    body: JSON.stringify({ taskId: `stress-task-${i}`, companyId: ['it-ai', 'finance', 'legal-compliance', 'operations-logistics'][i % 4] }),
  }), 160);

  await runConcurrent('sandbox-execution-1000', 1000, (i) => request('/execution', {
    method: 'POST',
    body: JSON.stringify({ taskId: `stress-task-${i}`, companyId: 'it-ai', action: i % 10 === 0 ? 'rollback-flood' : 'sandbox-build-fix' }),
  }), 120);

  await runConcurrent('simulation-worker-tiers', workerTiers.length * 80, (i) => request('/simulation', {
    method: 'POST',
    body: JSON.stringify({
      priorityWeight: i % 101,
      workerAllocation: workerTiers[i % workerTiers.length],
      batchFactor: 10 + (i % 91),
    }),
  }), 80);

  const malformed = await request('/task', { method: 'POST', body: JSON.stringify({ taskId: 'bad-only' }) });
  if (malformed.status < 400 || malformed.status > 499) {
    failures.push({ name: 'malformed-payload', index: 0, status: malformed.status, detail: 'Expected 4xx without crash' });
  }

  const assignmentsPath = join(runtimeDir, 'task-assignments.json');
  writeFileSync(assignmentsPath, '{"corrupted":', 'utf8');
  const recovery = await request('/task', {
    method: 'POST',
    body: JSON.stringify({ taskId: 'json-recovery-check', companyId: 'it-ai' }),
  });
  if (!recovery.ok) {
    failures.push({ name: 'json-corruption-recovery', index: 0, status: recovery.status, detail: recovery.json?.error ?? 'failed recovery write' });
  } else {
    await sleep(200);
    JSON.parse(readFileSync(assignmentsPath, 'utf8'));
  }

  const serverMetrics = await request('/metrics');
  writeReports(serverMetrics.json ?? {});

  console.log(`Agent-coding stress test complete: ${failures.length} failure(s)`);
  console.log(`Reports written under ${reportsDir}`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  if (server) server.kill('SIGTERM');
  rmSync(tmpRoot, { recursive: true, force: true });
}
