// routes/runner.js — npm script runner with SSE streaming + activity log
import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, unlinkSync, readdirSync, createReadStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { gzipSync } from 'zlib';
import { ALLOWED_SCRIPTS } from '../../shared/commands.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Project root is two levels up from routes/
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');

const router = Router();

// ── In-memory job store ────────────────────────────────────────────────────────
const jobs = new Map();
// Map<jobId, { script, label, pid, status, lines[], startedAt, endedAt, exitCode, listeners[] }>

// Helper: path to today's activity log
const _todayLogPath = () => {
  const d = new Date().toISOString().slice(0, 10);
  return join(PROJECT_ROOT, 'logs', 'activity', `activity-${d}.log`);
};

// Restore jobs from today's activity log on startup (B2)
(function restoreJobsFromLog() {
  try {
    const logPath = _todayLogPath();
    if (!existsSync(logPath)) return;
    const lines = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!entry.jobId || entry.jobId === 'rejected') continue;
        if (!jobs.has(entry.jobId)) {
          jobs.set(entry.jobId, {
            jobId: entry.jobId, script: entry.script, label: entry.label,
            status: entry.status === 'started' ? 'completed' : entry.status,
            startedAt: entry.ts, endedAt: null, exitCode: entry.exitCode ?? null,
            lines: [], listeners: [], pid: null,
          });
        } else {
          // Update with latest entry for this jobId
          const job = jobs.get(entry.jobId);
          if (entry.status !== 'started') {
            job.status = entry.status;
            job.exitCode = entry.exitCode ?? job.exitCode;
          }
        }
      } catch { /* skip malformed lines */ }
    }
    console.log(`[runner] Restored ${jobs.size} jobs from today's activity log`);
  } catch { /* non-fatal */ }
}());

function activityLogPath() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = join(PROJECT_ROOT, 'logs', 'activity');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `activity-${today}.log`);
}

function appendActivityLog(entry) {
  try {
    appendFileSync(activityLogPath(), JSON.stringify(entry) + '\n', 'utf8');
  } catch { /* best-effort */ }
}

function makeJobId() {
  return randomBytes(6).toString('hex');
}

// ── POST /api/run ─────────────────────────────────────────────────────────────
router.post('/api/run', (req, res) => {
  const { script, label } = req.body ?? {};
  if (!script || typeof script !== 'string') {
    return res.status(400).json({ success: false, error: 'script is required' });
  }
  // Basic validation — no shell injection
  if (!/^[\w:@/-]+$/.test(script)) {
    return res.status(400).json({ success: false, error: 'Invalid script name' });
  }

  // Whitelist enforcement — only known scripts allowed (Part A)
  if (!ALLOWED_SCRIPTS.includes(script)) {
    appendActivityLog({ ts: new Date().toISOString(), script, label: script, jobId: 'rejected', status: 'rejected', reason: 'not in whitelist' });
    return res.status(403).json({ success: false, error: 'Lệnh không được phép', script });
  }

  const jobId = makeJobId();
  const scriptLabel = label || script;
  const startedAt = new Date().toISOString();

  const job = {
    jobId,
    script,
    label: scriptLabel,
    status: 'running',
    lines: [],
    startedAt,
    endedAt: null,
    exitCode: null,
    listeners: [],
    pid: null,
  };
  jobs.set(jobId, job);

  // Append started entry
  appendActivityLog({ ts: startedAt, script, label: scriptLabel, jobId, status: 'started' });

  // Spawn npm run <script> [args...]
  const extraArgs = Array.isArray(req.body?.args) ? req.body.args.map(String) : [];
  const spawnArgs = ['run', script, ...extraArgs];
  const child = spawn('npm', spawnArgs, {
    cwd: PROJECT_ROOT,
    shell: false,
    env: { ...process.env },
  });
  job.pid = child.pid;

  function broadcast(line) {
    job.lines.push(line);
    for (const cb of job.listeners) {
      try { cb(line); } catch { /* ignore closed connections */ }
    }
  }

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  let stdoutBuf = '';
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk;
    const parts = stdoutBuf.split('\n');
    stdoutBuf = parts.pop();
    for (const line of parts) broadcast(line);
  });

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk;
    const parts = stderrBuf.split('\n');
    stderrBuf = parts.pop();
    for (const line of parts) broadcast('[stderr] ' + line);
  });

  child.on('close', (code) => {
    // flush remaining buffers
    if (stdoutBuf) broadcast(stdoutBuf);
    if (stderrBuf) broadcast('[stderr] ' + stderrBuf);

    const endedAt = new Date().toISOString();
    job.endedAt = endedAt;
    job.exitCode = code;
    job.status = code === 0 ? 'completed' : (code === null ? 'stopped' : 'failed');
    job.pid = null;

    // Notify all listeners of done
    broadcast(`\n[Job ${jobId} ${job.status} — exit ${code ?? 'N/A'}]`);
    for (const cb of job.listeners) {
      try { cb(null); } catch { /* done */ }
    }
    job.listeners = [];

    const durationMs = new Date(endedAt) - new Date(startedAt);
    appendActivityLog({
      ts: endedAt,
      script,
      label: scriptLabel,
      jobId,
      status: job.status,
      exitCode: code,
      durationMs,
    });
  });

  child.on('error', (err) => {
    broadcast(`[error] ${err.message}`);
    job.status = 'failed';
    job.exitCode = -1;
    job.endedAt = new Date().toISOString();
    for (const cb of job.listeners) {
      try { cb(null); } catch { /* done */ }
    }
    job.listeners = [];
    appendActivityLog({
      ts: job.endedAt,
      script,
      label: scriptLabel,
      jobId,
      status: 'failed',
      exitCode: -1,
      durationMs: new Date(job.endedAt) - new Date(startedAt),
    });
  });

  res.json({ success: true, jobId });
});

// ── GET /api/run/:jobId/stream — SSE ─────────────────────────────────────────
router.get('/api/run/:jobId/stream', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Send all buffered lines so far
  for (const line of job.lines) {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  }

  if (job.status !== 'running') {
    res.write(`data: ${JSON.stringify({ done: true, status: job.status, exitCode: job.exitCode })}\n\n`);
    res.end();
    return;
  }

  // Register listener for future lines
  const listener = (line) => {
    if (line === null) {
      res.write(`data: ${JSON.stringify({ done: true, status: job.status, exitCode: job.exitCode })}\n\n`);
      res.end();
    } else {
      res.write(`data: ${JSON.stringify({ line })}\n\n`);
    }
  };
  job.listeners.push(listener);

  // Keepalive ping
  const ping = setInterval(() => {
    if (job.status !== 'running') { clearInterval(ping); return; }
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(ping);
    const idx = job.listeners.indexOf(listener);
    if (idx !== -1) job.listeners.splice(idx, 1);
  });
});

// ── POST /api/run/:jobId/stop ─────────────────────────────────────────────────
router.post('/api/run/:jobId/stop', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  if (job.status !== 'running' || !job.pid) {
    return res.json({ success: true, message: 'Job already done' });
  }
  try {
    process.kill(job.pid, 'SIGTERM');
    job.status = 'stopped';
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
  res.json({ success: true, jobId: job.jobId, status: 'stopped' });
});

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
router.get('/api/jobs', (_req, res) => {
  const list = Array.from(jobs.values())
    .map(({ jobId, script, label, status, startedAt, endedAt, exitCode }) => ({
      jobId, script, label, status, startedAt, endedAt, exitCode,
    }))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 50);
  res.json({ success: true, data: list });
});

// ── GET /api/activity-log ─────────────────────────────────────────────────────
router.get('/api/activity-log', (req, res) => {
  try {
    const { date } = req.query;
    let targetDate = date;
    if (!targetDate) targetDate = new Date().toISOString().slice(0, 10);

    const logFile = join(PROJECT_ROOT, 'logs', 'activity', `activity-${targetDate}.log`);
    if (!existsSync(logFile)) {
      return res.json({ success: true, data: [] });
    }

    const raw = readFileSync(logFile, 'utf8');
    const entries = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);

    // B4: include summary stats
    const summary = {
      total: entries.length,
      completed: entries.filter(e => e.status === 'completed').length,
      failed: entries.filter(e => e.status === 'failed').length,
      mostUsed: (() => {
        const counts = {};
        entries.forEach(e => { if (e.script) counts[e.script] = (counts[e.script] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([script, count]) => ({ script, count }));
      })(),
    };

    res.json({ success: true, data: entries, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/activity-log/rotate — compress logs older than 7 days (B4) ──────
router.post('/activity-log/rotate', (_req, res) => {
  try {
    const logDir = join(PROJECT_ROOT, 'logs', 'activity');
    if (!existsSync(logDir)) return res.json({ rotated: 0, message: '0 file(s) compressed' });
    const files = readdirSync(logDir).filter(f => f.startsWith('activity-') && f.endsWith('.log'));
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    let rotated = 0;
    for (const file of files) {
      const dateStr = file.replace('activity-', '').replace('.log', '');
      if (new Date(dateStr) < cutoff) {
        const src = join(logDir, file);
        const dst = src + '.gz';
        try {
          const content = readFileSync(src);
          const compressed = gzipSync(content);
          writeFileSync(dst, compressed);
          unlinkSync(src);
          rotated++;
        } catch { /* skip files that can't be compressed */ }
      }
    }
    res.json({ rotated, message: `${rotated} file(s) compressed` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/activity-log/export ──────────────────────────────────────────────
router.get('/api/activity-log/export', (req, res) => {
  try {
    const { date } = req.query;
    let targetDate = date;
    if (!targetDate) targetDate = new Date().toISOString().slice(0, 10);

    const logFile = join(PROJECT_ROOT, 'logs', 'activity', `activity-${targetDate}.log`);
    if (!existsSync(logFile)) {
      return res.status(404).json({ success: false, error: 'Log file not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="activity-${targetDate}.log"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    createReadStream(logFile).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/health ───────────────────────────────────────────────────────────
router.get('/api/health', (_req, res) => {
  try {
    // KB stats
    let kbDocs = 0;
    let kbChunks = 0;
    const statsFile = join(PROJECT_ROOT, 'kb', 'stats.json');
    if (existsSync(statsFile)) {
      try {
        const kbStats = JSON.parse(readFileSync(statsFile, 'utf8'));
        kbDocs   = kbStats?.total?.documents ?? 0;
        kbChunks = kbStats?.total?.chunks ?? 0;
      } catch { /* ignore */ }
    }

    // Memory stats
    const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const uptimeSec = Math.round(process.uptime());

    // Recent job stats
    const recentJobs = Array.from(jobs.values()).filter(
      (j) => j.startedAt && new Date(j.startedAt) > new Date(Date.now() - 24 * 3600 * 1000)
    );
    const passed = recentJobs.filter((j) => j.exitCode === 0).length;
    const failed = recentJobs.filter((j) => j.exitCode !== 0 && j.exitCode !== null).length;

    // B3: lastIngest from stats.json
    let lastIngest = null;
    try {
      if (existsSync(statsFile)) {
        const kbStats = JSON.parse(readFileSync(statsFile, 'utf8'));
        lastIngest = kbStats?.generatedAt ?? null;
      }
    } catch { /* ignore */ }

    // B3: activity log analysis
    let hasRecentError = false;
    let lastActivityEntry = null;
    try {
      const logPath = _todayLogPath();
      if (existsSync(logPath)) {
        const lines = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).slice(-20);
        const recent = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        hasRecentError = recent.slice(-10).some(e => e.status === 'failed');
        lastActivityEntry = recent[recent.length - 1] ?? null;
      }
    } catch { /* ignore */ }

    res.json({
      success: true,
      data: {
        kb: { docs: kbDocs, chunks: kbChunks },
        tests: { pass: passed, fail: failed },
        system: { uptime: uptimeSec, memMB },
        timestamp: new Date().toISOString(),
        lastIngest,
        offlineGuard: true,
        hasRecentError,
        lastActivityEntry,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/kpi-stats ────────────────────────────────────────────────────────
router.get('/api/kpi-stats', (req, res) => {
  try {
    const logDir = join(PROJECT_ROOT, 'logs', 'activity');
    if (!existsSync(logDir)) return res.json({ byDay: [], byScript: [], totalRuns: 0, totalCompleted: 0, totalFailed: 0, avgDurationMs: 0 });

    const files = readdirSync(logDir)
      .filter(f => f.startsWith('activity-') && f.endsWith('.log'))
      .sort();

    const byDay = {};
    const byScript = {};
    let totalRuns = 0, totalCompleted = 0, totalFailed = 0, totalDuration = 0, durationCount = 0;

    for (const file of files) {
      const date = file.replace('activity-', '').replace('.log', '');
      const lines = readFileSync(join(logDir, file), 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          if (e.status === 'started' || e.status === 'rejected') continue;
          if (!byDay[date]) byDay[date] = { date, total: 0, completed: 0, failed: 0 };
          byDay[date].total++;
          totalRuns++;
          if (e.status === 'completed') { byDay[date].completed++; totalCompleted++; }
          if (e.status === 'failed')    { byDay[date].failed++;    totalFailed++; }
          if (e.durationMs) { totalDuration += e.durationMs; durationCount++; }
          if (e.script) {
            if (!byScript[e.script]) byScript[e.script] = { script: e.script, label: e.label || e.script, count: 0, completed: 0, failed: 0 };
            byScript[e.script].count++;
            if (e.status === 'completed') byScript[e.script].completed++;
            if (e.status === 'failed')    byScript[e.script].failed++;
          }
        } catch { /* skip malformed lines */ }
      }
    }

    const byScriptArr = Object.values(byScript)
      .map(s => ({ ...s, successRate: s.count > 0 ? s.completed / s.count : 0 }))
      .sort((a, b) => b.count - a.count);

    res.json({
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      byScript: byScriptArr,
      totalRuns,
      totalCompleted,
      totalFailed,
      avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/corp-dispatches ──────────────────────────────────────────────────
router.get('/api/corp-dispatches', (req, res) => {
  try {
    const dir = join(PROJECT_ROOT, '.local-agent', 'command-center');
    if (!existsSync(dir)) {
      return res.json({ dispatches: [], summary: { total: 0, byDivision: {}, byPriority: {}, byDevStatus: {}, byQAStatus: {} } });
    }

    const files = readdirSync(dir)
      .filter(f => f.startsWith('dispatch-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 100);

    const dispatches = [];
    for (const file of files) {
      try {
        const d = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        dispatches.push(d);
      } catch { /* skip malformed */ }
    }

    const byDivision = {};
    const byPriority = {};
    const byDevStatus = {};
    const byQAStatus = {};

    for (const d of dispatches) {
      const div       = d.company?.id             ?? 'unknown';
      const pri       = d.task?.priority           ?? 'normal';
      const devStatus = d.execution?.dev?.status   ?? 'unknown';
      const qaStatus  = d.execution?.qa?.status    ?? 'unknown';

      byDivision[div]        = (byDivision[div]        ?? 0) + 1;
      byPriority[pri]        = (byPriority[pri]        ?? 0) + 1;
      byDevStatus[devStatus] = (byDevStatus[devStatus] ?? 0) + 1;
      byQAStatus[qaStatus]   = (byQAStatus[qaStatus]   ?? 0) + 1;
    }

    res.json({ dispatches, summary: { total: dispatches.length, byDivision, byPriority, byDevStatus, byQAStatus } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
