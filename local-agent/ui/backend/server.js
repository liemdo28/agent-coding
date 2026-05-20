// ui/backend/server.js - Express UI server (ES module, binds only to 127.0.0.1)
import express from 'express';
import cors from 'cors';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Resolve project root ──────────────────────────────────────────────────────
function resolveProjectRoot() {
  const argv = process.argv;
  const pFlag = argv.indexOf('--project');
  if (pFlag !== -1 && argv[pFlag + 1]) {
    return resolve(argv[pFlag + 1]);
  }
  if (process.env.LOCAL_AGENT_PROJECT) {
    return resolve(process.env.LOCAL_AGENT_PROJECT);
  }
  return process.cwd();
}

// Expose globally for routes to import
export const PROJECT_ROOT = resolveProjectRoot();

// ── Import routes ─────────────────────────────────────────────────────────────
import projectRouter   from './routes/project.js';
import patchesRouter   from './routes/patches.js';
import qaRouter        from './routes/qa.js';
import reportsRouter   from './routes/reports.js';
import policyRouter    from './routes/policy.js';
import memoryRouter    from './routes/memory.js';
import agentRouter        from './routes/agent.js';
import projectsRouter     from './routes/projects.js';
import runnerRouter       from './routes/runner.js';
import chatSessionsRouter  from './routes/chat-sessions.js';
import allowedPathsRouter  from './routes/allowed-paths.js';
import digitalTwinRouter   from './routes/digital-twin.js';
import indexerRouter       from './routes/indexer.js';
import reasoningRouter     from './routes/reasoning.js';
import agentsRouter        from './routes/agents.js';
import commandcenterRouter from './routes/commandcenter.js';
import projectHealthRouter from './routes/project-health.js';
import { metricsMiddleware, snapshotMetrics } from './lib/runtime-metrics.js';

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

// CORS — localhost only (no external origins allowed)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000',
           'http://localhost:4001', 'http://127.0.0.1:4001'],
  credentials: false,
}));

app.use(express.json({ limit: '1mb' }));
app.use(metricsMiddleware);

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  _res.on('finish', () => {
    const ts = new Date().toISOString();
    process.stdout.write(`${ts} [HTTP] ${req.method} ${req.path} ${_res.statusCode}\n`);
  });
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', offline: true, timestamp: new Date().toISOString(), projectRoot: PROJECT_ROOT });
});

app.get('/metrics', (_req, res) => {
  res.json(snapshotMetrics({ projectRoot: PROJECT_ROOT }));
});

// ── SSE log stream ────────────────────────────────────────────────────────────
app.get('/logs/stream', (req, res) => {
  const logFile = join(PROJECT_ROOT, '.local-agent', 'logs', 'agent.log');

  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  if (!existsSync(logFile)) {
    res.write('data: {"line":"Log file not found — run scan or QA first"}\n\n');
    // Keep alive with periodic ping
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => clearInterval(ping));
    return;
  }

  // Tail last 100 lines first
  const tailLines = [];
  const rl = createInterface({ input: createReadStream(logFile, { encoding: 'utf8' }) });
  rl.on('line', (line) => { tailLines.push(line); if (tailLines.length > 100) tailLines.shift(); });
  rl.on('close', () => {
    for (const l of tailLines) {
      res.write(`data: ${JSON.stringify({ line: l })}\n\n`);
    }

    // Watch for new content using chokidar or simple polling
    let fileSize = statSync(logFile).size;
    const poll = setInterval(() => {
      try {
        const newSize = statSync(logFile).size;
        if (newSize > fileSize) {
          const stream = createReadStream(logFile, { start: fileSize, encoding: 'utf8' });
          let buf = '';
          stream.on('data', (chunk) => { buf += chunk; });
          stream.on('end', () => {
            const lines = buf.split('\n').filter(Boolean);
            for (const l of lines) {
              res.write(`data: ${JSON.stringify({ line: l })}\n\n`);
            }
            fileSize = newSize;
          });
        }
      } catch { /* file may have been deleted */ }
    }, 1000);

    req.on('close', () => clearInterval(poll));
  });
});

// ── Mount routers ─────────────────────────────────────────────────────────────
const apiRouters = [
  projectRouter,
  patchesRouter,
  qaRouter,
  reportsRouter,
  policyRouter,
  memoryRouter,
  agentRouter,
  projectsRouter,
  runnerRouter,
  chatSessionsRouter,
  allowedPathsRouter,
  digitalTwinRouter,
  indexerRouter,
  reasoningRouter,
  agentsRouter,
  commandcenterRouter,
  projectHealthRouter,
];

for (const router of apiRouters) {
  app.use('/', router);
  app.use('/api', router);
}

// ── Serve frontend dist (if built) ────────────────────────────────────────────
const frontendDist = resolve(__dirname, '../frontend/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

// ── 404 / error handlers ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 4001);
// SECURITY: MUST bind to 127.0.0.1 ONLY — never 0.0.0.0
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-agent ui] Server running at http://127.0.0.1:${PORT}`);
  console.log(`[local-agent ui] Project root: ${PROJECT_ROOT}`);
  console.log(`[local-agent ui] Frontend dist: ${existsSync(frontendDist) ? frontendDist : '(not built)'}`);
});
