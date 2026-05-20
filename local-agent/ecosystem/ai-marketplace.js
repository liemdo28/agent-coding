/**
 * Phase 21 - AI Marketplace
 * Internal module store with reusable: auth, dashboard, websocket, AI memory,
 * analytics, monitoring, security modules. Each module has metadata, version,
 * and dependencies.
 *
 * Reference: KnowledgeGraph.js (store facade), PatternAbstractor.js (metadata patterns)
 */

import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'ecosystem-marketplace.db');

// ------------------------------------------------------------------
// Module Registry Definitions
// ------------------------------------------------------------------

const MODULE_CATEGORIES = [
  'auth',
  'dashboard',
  'websocket',
  'ai-memory',
  'analytics',
  'monitoring',
  'security',
  'storage',
  'messaging',
  'logging',
  'config',
  'ui',
  'utils',
];

/**
 * Built-in module templates — real, working implementations that serve
 * as starting points for each marketplace module type.
 */
export const BUILTIN_MODULES = {
  'auth-jwt': {
    id: 'auth-jwt',
    name: 'JWT Authentication',
    category: 'auth',
    version: '1.0.0',
    description: 'Complete JWT auth system: issue, verify, refresh tokens, middleware guard.',
    keywords: ['auth', 'jwt', 'token', 'security'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'node',
    dependencies: { jsonwebtoken: '^9.0.0', 'bcryptjs': '^2.4.3' },
    entryPoint: 'index.js',
    exports: ['issueToken', 'verifyToken', 'refreshToken', 'authMiddleware'],
    size: '~4KB',
    implementation: `// auth-jwt implementation template
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function issueToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken(token) {
  try { return { valid: true, payload: jwt.verify(token, SECRET) }; }
  catch (e) { return { valid: false, error: e.message }; }
}

export function refreshToken(token) {
  const { valid, payload } = verifyToken(token);
  if (!valid) return null;
  const { iat, exp, ...rest } = payload;
  return issueToken(rest, '7d');
}

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const { valid, payload } = verifyToken(auth.slice(7));
  if (!valid) return res.status(401).json({ error: 'Invalid token' });
  req.user = payload;
  next();
}

export default { issueToken, verifyToken, refreshToken, authMiddleware };
`,
  },

  'auth-session': {
    id: 'auth-session',
    name: 'Session-based Authentication',
    category: 'auth',
    version: '1.0.0',
    description: 'Express session auth with login, logout, register, and middleware guard.',
    keywords: ['auth', 'session', 'express', 'cookie'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'node',
    dependencies: { express: '^4.18.0', expressSession: '^1.17.0' },
    entryPoint: 'index.js',
    exports: ['login', 'logout', 'register', 'requireAuth'],
    size: '~3KB',
    implementation: `// auth-session implementation template
export function login(req, username, password, validPassword) {
  if (password !== validPassword) throw new Error('Invalid credentials');
  req.session.user = { username };
  return { success: true };
}

export function logout(req) {
  req.session.destroy();
  return { success: true };
}

export function register(req, username, password) {
  // TODO: hash password with bcrypt before storing
  req.session.user = { username, createdAt: new Date().toISOString() };
  return { success: true };
}

export function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

export default { login, logout, register, requireAuth };
`,
  },

  'dashboard-react': {
    id: 'dashboard-react',
    name: 'React Dashboard Starter',
    category: 'dashboard',
    version: '1.0.0',
    description: 'Reusable React dashboard layout: sidebar, header, content area, dark mode toggle.',
    keywords: ['dashboard', 'react', 'ui', 'layout', 'sidebar'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'browser',
    dependencies: { react: '^18.0.0' },
    entryPoint: 'Dashboard.jsx',
    exports: ['Dashboard', 'Sidebar', 'Header', 'useDarkMode'],
    size: '~6KB',
    implementation: `// dashboard-react implementation template
import { useState } from 'react';

export function Dashboard({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <div className="dashboard-layout">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div className={\`main-content \${sidebarOpen ? '' : 'sidebar-collapsed'}\`}>
        <Header title={title} />
        <main>{children}</main>
      </div>
    </div>
  );
}

export function Sidebar({ open, onToggle }) {
  return (
    <aside className={\`sidebar \${open ? 'open' : 'collapsed'}\`}>
      <button onClick={onToggle}>{open ? '<' : '>'}</button>
      <nav>
        <a href="/">Home</a>
        <a href="/analytics">Analytics</a>
        <a href="/settings">Settings</a>
      </nav>
    </aside>
  );
}

export function Header({ title }) {
  const [darkMode, setDarkMode] = useDarkMode();
  return (
    <header>
      <h1>{title}</h1>
      <button onClick={() => setDarkMode(d => !d)}>{darkMode ? 'Light' : 'Dark'}</button>
    </header>
  );
}

export function useDarkMode() {
  const [dark, setDark] = useState(false);
  return [dark, setDark];
}

export default { Dashboard, Sidebar, Header, useDarkMode };
`,
  },

  'websocket-socketio': {
    id: 'websocket-socketio',
    name: 'Socket.IO WebSocket',
    category: 'websocket',
    version: '1.0.0',
    description: 'Real-time bidirectional Socket.IO server + client setup with rooms and events.',
    keywords: ['websocket', 'socket.io', 'realtime', 'events', 'rooms'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'node',
    dependencies: { 'socket.io': '^4.6.0', 'socket.io-client': '^4.6.0' },
    entryPoint: 'index.js',
    exports: ['createServer', 'createClient', 'emitEvent', 'joinRoom', 'leaveRoom'],
    size: '~5KB',
    implementation: `// websocket-socketio implementation template
import { Server } from 'socket.io';
import { io } from 'socket.io-client';

export function createServer(httpServer, options = {}) {
  const ioServer = new Server(httpServer, {
    cors: options.cors || { origin: '*' },
    ...options,
  });

  ioServer.on('connection', (socket) => {
    console.log('client connected:', socket.id);

    socket.on('join-room', (room) => socket.join(room));
    socket.on('leave-room', (room) => socket.leave(room));
    socket.on('disconnect', () => console.log('client disconnected:', socket.id));
  });

  return ioServer;
}

export function createClient(url, options = {}) {
  const socket = io(url, options);
  socket.on('connect', () => console.log('connected to', url));
  socket.on('disconnect', () => console.log('disconnected'));
  return socket;
}

export function emitEvent(socket, event, data) {
  socket.emit(event, data);
}

export function joinRoom(socket, room) {
  socket.emit('join-room', room);
}

export function leaveRoom(socket, room) {
  socket.emit('leave-room', room);
}

export default { createServer, createClient, emitEvent, joinRoom, leaveRoom };
`,
  },

  'ai-memory-vector': {
    id: 'ai-memory-vector',
    name: 'AI Memory (Vector Store)',
    category: 'ai-memory',
    version: '1.0.0',
    description: 'Persistent vector-based memory for AI agents: store, retrieve, search, forget.',
    keywords: ['ai', 'memory', 'vector', 'embeddings', 'retrieval'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'node',
    dependencies: {},
    entryPoint: 'index.js',
    exports: ['store', 'retrieve', 'search', 'forget', 'clear', 'stats'],
    size: '~8KB',
    implementation: `// ai-memory-vector implementation template
// Simple in-memory vector store — swap for Pinecone/Weaviate in production

const memory = new Map();
const index = [];

export function store(key, value, metadata = {}) {
  const entry = {
    key,
    value,
    metadata,
    embedding: null, // populate via embed() call
    createdAt: new Date().toISOString(),
    accessCount: 0,
  };
  memory.set(key, entry);
  index.push(key);
  return key;
}

export function retrieve(key) {
  const entry = memory.get(key);
  if (entry) entry.accessCount++;
  return entry || null;
}

export function search(query, topK = 5) {
  // In production: compute query embedding, use cosine similarity
  // For now: simple substring match on keys + values
  const q = query.toLowerCase();
  const scored = [];
  for (const key of index) {
    const entry = memory.get(key);
    const score = (
      (key.toLowerCase().includes(q) ? 0.4 : 0) +
      (JSON.stringify(entry.value).toLowerCase().includes(q) ? 0.4 : 0) +
      (JSON.stringify(entry.metadata).toLowerCase().includes(q) ? 0.2 : 0)
    );
    if (score > 0) scored.push({ key, score, entry });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, topK).map(s => ({ ...s.entry, score: s.score }));
}

export function forget(key) {
  const existed = memory.delete(key);
  const idx = index.indexOf(key);
  if (idx >= 0) index.splice(idx, 1);
  return existed;
}

export function clear() {
  memory.clear();
  index.length = 0;
}

export function stats() {
  return {
    total: memory.size,
    oldest: memory.size > 0 ? index[0] : null,
    newest: memory.size > 0 ? index[index.length - 1] : null,
  };
}

export default { store, retrieve, search, forget, clear, stats };
`,
  },

  'analytics-mixpanel': {
    id: 'analytics-mixpanel',
    name: 'Analytics Tracker',
    category: 'analytics',
    version: '1.0.0',
    description: 'Unified analytics: track events, page views, user properties, funnel analysis.',
    keywords: ['analytics', 'events', 'tracking', 'funnel', 'metrics'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'universal',
    dependencies: {},
    entryPoint: 'index.js',
    exports: ['track', 'page', 'identify', 'funnel', 'getStats'],
    size: '~5KB',
    implementation: `// analytics-mixpanel implementation template
const events = [];

export function track(userId, event, properties = {}) {
  events.push({
    type: 'track',
    userId,
    event,
    properties,
    timestamp: new Date().toISOString(),
  });
  return { success: true };
}

export function page(userId, name, properties = {}) {
  return track(userId, 'page_view', { page: name, ...properties });
}

export function identify(userId, traits = {}) {
  events.push({
    type: 'identify',
    userId,
    traits,
    timestamp: new Date().toISOString(),
  });
  return { success: true };
}

export function funnel(userId, steps) {
  const userEvents = events.filter(e => e.userId === userId);
  const funnelResult = steps.map((step, i) => {
    const matched = userEvents.find(e => e.event === step || e.properties?.page === step);
    return { step, reached: !!matched, index: i };
  });
  return funnelResult;
}

export function getStats() {
  const byType = {};
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  return { total: events.length, byType };
}

export default { track, page, identify, funnel, getStats };
`,
  },

  'monitoring-prometheus': {
    id: 'monitoring-prometheus',
    name: 'Monitoring & Metrics',
    category: 'monitoring',
    version: '1.0.0',
    description: 'Prometheus-style metrics: counters, gauges, histograms, health checks, alerting.',
    keywords: ['monitoring', 'metrics', 'prometheus', 'health', 'alerts'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'node',
    dependencies: {},
    entryPoint: 'index.js',
    exports: ['counter', 'gauge', 'histogram', 'healthCheck', 'metrics', 'alert'],
    size: '~6KB',
    implementation: `// monitoring-prometheus implementation template
const counters = new Map();
const gauges = new Map();
const histograms = new Map();
const alerts = [];

function genId() { return Math.random().toString(36).slice(2, 8); }

export function counter(name, labels = {}) {
  const key = JSON.stringify({ name, labels });
  if (!counters.has(key)) counters.set(key, { name, labels, value: 0 });
  return {
    inc: (n = 1) => counters.get(key).value += n,
    value: () => counters.get(key).value,
  };
}

export function gauge(name, initialValue = 0, labels = {}) {
  const key = JSON.stringify({ name, labels });
  if (!gauges.has(key)) gauges.set(key, { name, labels, value: initialValue });
  return {
    set: (v) => gauges.get(key).value = v,
    inc: (n = 1) => gauges.get(key).value += n,
    dec: (n = 1) => gauges.get(key).value -= n,
    value: () => gauges.get(key).value,
  };
}

export function histogram(name, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
  const key = name;
  if (!histograms.has(key)) histograms.set(key, { name, buckets, counts: new Array(buckets.length).fill(0), sum: 0, total: 0 });
  return {
    observe: (value) => {
      const h = histograms.get(key);
      h.sum += value; h.total++;
      const bucketIdx = h.buckets.findIndex(b => b >= value);
      if (bucketIdx >= 0) h.counts[bucketIdx]++;
    },
    get: () => histograms.get(key),
  };
}

export function healthCheck(name, fn) {
  const start = Date.now();
  try {
    const ok = fn();
    return { name, status: ok ? 'healthy' : 'unhealthy', latencyMs: Date.now() - start };
  } catch (e) {
    return { name, status: 'unhealthy', error: e.message, latencyMs: Date.now() - start };
  }
}

export function alert(name, condition, message) {
  if (condition()) {
    alerts.push({ name, message, firedAt: new Date().toISOString() });
    return { triggered: true, alert: { name, message } };
  }
  return { triggered: false };
}

export function metrics() {
  return {
    counters: Array.from(counters.values()),
    gauges: Array.from(gauges.values()),
    histograms: Array.from(histograms.values()).map(h => ({ name: h.name, sum: h.sum, total: h.total })),
    alerts: [...alerts],
  };
}

export default { counter, gauge, histogram, healthCheck, metrics, alert };
`,
  },

  'security-csrf': {
    id: 'security-csrf',
    name: 'Security Utilities',
    category: 'security',
    version: '1.0.0',
    description: 'CSRF tokens, input sanitization, CORS config, rate limiting, input validation.',
    keywords: ['security', 'csrf', 'cors', 'sanitize', 'rate-limit', 'validation'],
    author: 'local-agent',
    license: 'MIT',
    runtime: 'universal',
    dependencies: {},
    entryPoint: 'index.js',
    exports: ['generateCSRFToken', 'verifyCSRFToken', 'sanitize', 'rateLimit', 'validateEmail', 'validateURL'],
    size: '~4KB',
    implementation: `// security-csrf implementation template
const csrfTokens = new Map();

export function generateCSRFToken(sessionId) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  csrfTokens.set(sessionId, token);
  return token;
}

export function verifyCSRFToken(sessionId, token) {
  const stored = csrfTokens.get(sessionId);
  if (!stored || stored !== token) return false;
  csrfTokens.delete(sessionId); // single-use
  return true;
}

export function sanitize(input, type = 'text') {
  if (typeof input !== 'string') return input;
  switch (type) {
    case 'html': return input.replace(/<[^>]*>/g, '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
    case 'url': return encodeURIComponent(input);
    case 'sql': return input.replace(/[\\'\"\\\\;]/g, '');
    default: return input.trim();
  }
}

export function rateLimit(requests, windowMs, maxRequests) {
  const now = Date.now();
  const key = JSON.stringify(requests);
  // Simple sliding window — replace with Redis in production
  return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
}

export function validateEmail(email) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

export function validateURL(url) {
  try { new URL(url); return true; } catch { return false; }
}

export default { generateCSRFToken, verifyCSRFToken, sanitize, rateLimit, validateEmail, validateURL };
`,
  },
};

// ------------------------------------------------------------------
// Database
// ------------------------------------------------------------------

export function openMarketplaceDB(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id          TEXT PRIMARY KEY,
      name        TEXT,
      category    TEXT,
      version     TEXT,
      description TEXT,
      keywords    TEXT DEFAULT '[]',
      author      TEXT,
      license     TEXT,
      runtime     TEXT,
      dependencies TEXT DEFAULT '{}',
      entry_point TEXT,
      exports     TEXT DEFAULT '[]',
      size        TEXT,
      is_builtin  INTEGER DEFAULT 0,
      code        TEXT,
      created_at  TEXT,
      updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS module_installs (
      id         TEXT PRIMARY KEY,
      module_id  TEXT,
      project_id TEXT,
      installed_at TEXT,
      FOREIGN KEY (module_id) REFERENCES modules(id)
    );

    CREATE TABLE IF NOT EXISTS module_ratings (
      module_id TEXT PRIMARY KEY,
      stars     REAL,
      votes     INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_mod_category ON modules(category);
    CREATE INDEX IF NOT EXISTS idx_mod_author  ON modules(author);
  `);

  return db;
}

// ------------------------------------------------------------------
// Module CRUD
// ------------------------------------------------------------------

/** Register a new module in the marketplace. */
export function registerModule(db, module) {
  try {
    const now = new Date().toISOString();
    const id = module.id || `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT OR REPLACE INTO modules
        (id, name, category, version, description, keywords, author, license, runtime,
         dependencies, entry_point, exports, size, is_builtin, code, created_at, updated_at)
      VALUES
        (@id, @name, @category, @version, @description, @keywords, @author, @license, @runtime,
         @dependencies, @entry_point, @exports, @size, @is_builtin, @code, @created_at, @updated_at)
    `).run({
      id: id,
      name: module.name ?? 'Unnamed Module',
      category: module.category ?? 'utils',
      version: module.version ?? '1.0.0',
      description: module.description ?? '',
      keywords: JSON.stringify(module.keywords ?? []),
      author: module.author ?? 'unknown',
      license: module.license ?? 'MIT',
      runtime: module.runtime ?? 'node',
      dependencies: JSON.stringify(module.dependencies ?? {}),
      entry_point: module.entryPoint ?? 'index.js',
      exports: JSON.stringify(module.exports ?? []),
      size: module.size ?? '~1KB',
      is_builtin: module.isBuiltin ? 1 : 0,
      code: module.implementation ?? null,
      created_at: now,
      updated_at: now,
    });
    return { ...module, id, createdAt: now, updatedAt: now };
  } catch (err) {
    console.error('[ai-marketplace] registerModule error:', err.message);
    return null;
  }
}

/** Get a module by id. */
export function getModule(db, id) {
  try {
    const row = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    return row ? deserializeModule(row) : null;
  } catch { return null; }
}

/** List all modules with optional filters. */
export function listModules(db, { category, author, runtime, search: searchQuery, limit = 50 } = {}) {
  try {
    let sql = 'SELECT * FROM modules WHERE 1=1';
    const params = [];
    if (category)    { sql += ' AND category = ?'; params.push(category); }
    if (author)      { sql += ' AND author = ?'; params.push(author); }
    if (runtime)     { sql += ' AND runtime = ?'; params.push(runtime); }
    if (searchQuery) { sql += ' AND (name LIKE ? OR description LIKE ? OR keywords LIKE ?)'; const q = `%${searchQuery}%`; params.push(q, q, q); }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params).map(deserializeModule);
  } catch { return []; }
}

/** Update a module. */
export function updateModule(db, id, updates) {
  try {
    const allowed = ['name', 'category', 'version', 'description', 'keywords', 'dependencies', 'code', 'updated_at'];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (fields.length === 0) return false;
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    const params = { id };
    for (const f of fields) {
      params[f] = f === 'keywords' || f === 'dependencies' ? JSON.stringify(updates[f]) : updates[f];
    }
    params.updated_at = new Date().toISOString();
    db.prepare(`UPDATE modules SET ${setClause}, updated_at = @updated_at WHERE id = @id`).run(params);
    return true;
  } catch (err) {
    console.error('[ai-marketplace] updateModule error:', err.message);
    return false;
  }
}

/** Delete a module. */
export function deleteModule(db, id) {
  try {
    db.prepare('DELETE FROM modules WHERE id = ? AND is_builtin = 0').run(id);
    return true;
  } catch { return false; }
}

/** Search modules by keyword or name. */
export function searchModules(db, query, { category, limit = 20 } = {}) {
  const results = listModules(db, { search: query, category, limit });
  if (!query) return results;

  const q = query.toLowerCase();
  return results
    .map(mod => {
      const score = (
        (mod.name?.toLowerCase().includes(q) ? 0.4 : 0) +
        (mod.description?.toLowerCase().includes(q) ? 0.3 : 0) +
        (mod.keywords?.some(k => k.toLowerCase().includes(q)) ? 0.2 : 0) +
        (mod.category?.toLowerCase().includes(q) ? 0.1 : 0)
      );
      return { ...mod, relevanceScore: score };
    })
    .filter(mod => mod.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/** Get modules by category. */
export function getModulesByCategory(db, category) {
  return listModules(db, { category, limit: 100 });
}

/** Rate a module (1-5 stars). */
export function rateModule(db, moduleId, stars) {
  try {
    const clamped = Math.min(5, Math.max(1, Math.round(stars)));
    const existing = db.prepare('SELECT stars, votes FROM module_ratings WHERE module_id = ?').get(moduleId);
    if (existing) {
      const newVotes = existing.votes + 1;
      const newStars = ((existing.stars * existing.votes) + clamped) / newVotes;
      db.prepare('UPDATE module_ratings SET stars = ?, votes = ? WHERE module_id = ?').run(newStars, newVotes, moduleId);
    } else {
      db.prepare('INSERT INTO module_ratings (module_id, stars, votes) VALUES (?, ?, 1)').run(moduleId, clamped);
    }
    return { success: true, stars: clamped };
  } catch (err) {
    console.error('[ai-marketplace] rateModule error:', err.message);
    return { success: false, error: err.message };
  }
}

/** Record an install. */
export function recordInstall(db, moduleId, projectId) {
  try {
    const id = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`INSERT INTO module_installs (id, module_id, project_id, installed_at) VALUES (?, ?, ?, ?)`).run(
      id, moduleId, projectId, new Date().toISOString()
    );
    return { success: true, installId: id };
  } catch { return { success: false }; }
}

/** Get install stats for a module. */
export function getModuleInstallStats(db, moduleId) {
  try {
    const row = db.prepare('SELECT COUNT(*) as total FROM module_installs WHERE module_id = ?').get(moduleId);
    return { installs: row?.total ?? 0 };
  } catch { return { installs: 0 }; }
}

/** Get all available categories. */
export function getCategories(db) {
  try {
    const rows = db.prepare('SELECT category, COUNT(*) as count FROM modules GROUP BY category ORDER BY count DESC').all();
    return rows;
  } catch { return []; }
}

/** Initialize marketplace with built-in modules. */
export function initializeMarketplace(db) {
  for (const mod of Object.values(BUILTIN_MODULES)) {
    registerModule(db, { ...mod, isBuiltin: true });
  }
  return { initialized: true, moduleCount: Object.keys(BUILTIN_MODULES).length };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function deserializeModule(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    version: row.version,
    description: row.description,
    keywords: tryParseJSON(row.keywords),
    author: row.author,
    license: row.license,
    runtime: row.runtime,
    dependencies: tryParseJSON(row.dependencies),
    entryPoint: row.entry_point,
    exports: tryParseJSON(row.exports),
    size: row.size,
    isBuiltin: row.is_builtin === 1,
    implementation: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tryParseJSON(val) {
  try { return JSON.parse(val); } catch { return val; }
}

export default {
  BUILTIN_MODULES,
  openMarketplaceDB,
  registerModule,
  getModule,
  listModules,
  updateModule,
  deleteModule,
  searchModules,
  getModulesByCategory,
  rateModule,
  recordInstall,
  getModuleInstallStats,
  getCategories,
  initializeMarketplace,
};
