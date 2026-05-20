const startedAt = Date.now();
const routeStats = new Map();
const counters = {
  requests: 0,
  errors: 0,
  sseConnections: 0,
  jsonWrites: 0,
  jsonWriteErrors: 0,
};

export function recordJsonWrite(ok = true) {
  if (ok) counters.jsonWrites += 1;
  else counters.jsonWriteErrors += 1;
}

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    counters.requests += 1;
    if (res.statusCode >= 500) counters.errors += 1;

    const key = `${req.method} ${req.route?.path ?? req.path}`;
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const stat = routeStats.get(key) ?? { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
    stat.count += 1;
    stat.totalMs += elapsedMs;
    stat.maxMs = Math.max(stat.maxMs, elapsedMs);
    if (res.statusCode >= 500) stat.errors += 1;
    routeStats.set(key, stat);
  });
  next();
}

export function trackSseConnection(req) {
  counters.sseConnections += 1;
  req.on('close', () => {
    counters.sseConnections = Math.max(0, counters.sseConnections - 1);
  });
}

export function snapshotMetrics(extra = {}) {
  const memory = process.memoryUsage();
  const routes = [...routeStats.entries()]
    .map(([route, stat]) => ({
      route,
      count: stat.count,
      errors: stat.errors,
      avgMs: Math.round(stat.totalMs / stat.count),
      maxMs: Math.round(stat.maxMs),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    pid: process.pid,
    cpu: process.cpuUsage(),
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
    },
    counters,
    routes,
    ...extra,
    timestamp: new Date().toISOString(),
  };
}
