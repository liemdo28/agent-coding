// api/server.js - Express API bound ONLY to 127.0.0.1:8844 (never 0.0.0.0)
import express         from 'express';
import cors            from 'cors';
import { openDatabase } from '../core/DatabaseManager.js';
import { statsRouter }    from './routes/stats.js';
import { qaRouter }       from './routes/qa.js';
import { patchesRouter }  from './routes/patches.js';
import { sessionsRouter } from './routes/sessions.js';
import { modelsRouter }   from './routes/models.js';
import { costsRouter }    from './routes/costs.js';
import { risksRouter }    from './routes/risks.js';

const HOST = '127.0.0.1';   // POLICY: local-only, never 0.0.0.0
const PORT = 8844;

export function createApp(db) {
  const app = express();

  app.use(cors({ origin: (origin, cb) => cb(null, !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) }));
  app.use(express.json());

  // Security: reject any request that isn't from localhost
  app.use((req, res, next) => {
    const remoteAddr = req.socket.remoteAddress;
    if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && remoteAddr !== '::ffff:127.0.0.1') {
      return res.status(403).json({ error: 'forbidden: local access only' });
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/stats',    statsRouter(db));
  app.use('/qa',       qaRouter(db));
  app.use('/patches',  patchesRouter(db));
  app.use('/sessions', sessionsRouter(db));
  app.use('/models',   modelsRouter(db));
  app.use('/costs',    costsRouter(db));
  app.use('/risks',    risksRouter(db));

  // 404 handler
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('[API]', err.message);
    res.status(500).json({ error: err.message });
  });

  return app;
}

// Run directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const db  = openDatabase();
  const app = createApp(db);
  app.listen(PORT, HOST, () => {
    console.log(`[API] listening on http://127.0.0.1:${PORT}`);
  });
}
