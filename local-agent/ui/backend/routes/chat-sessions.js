// routes/chat-sessions.js — CRUD for persistent chat sessions
// Sessions stored as JSON in <PROJECT_ROOT>/.local-agent/chat-history/
// Each file: session-{id}.json  →  { id, title, createdAt, updatedAt, messages[] }

import { Router }                                     from 'express';
import { randomUUID }                                 from 'crypto';
import { existsSync, mkdirSync, readdirSync,
         readFileSync, unlinkSync }                   from 'fs';
import { join }                                       from 'path';
import { PROJECT_ROOT }                               from '../server.js';
import { enqueueJsonWrite, readJsonSafe, writeJsonAtomic } from '../lib/runtime-json.js';
import { recordJsonWrite }                            from '../lib/runtime-metrics.js';

const router = Router();
let sessionIndex = null;

// ── helpers ──────────────────────────────────────────────────────────────────

function sessionsDir() {
  const dir = join(PROJECT_ROOT, '.local-agent', 'chat-history');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionPath(id) {
  return join(sessionsDir(), `session-${id}.json`);
}

function readSession(id) {
  const p = sessionPath(id);
  if (!existsSync(p)) return null;
  return readJsonSafe(p, null);
}

function writeSession(session) {
  session.updatedAt = new Date().toISOString();
  try {
    writeJsonAtomic(sessionPath(session.id), session);
    recordJsonWrite(true);
  } catch (err) {
    recordJsonWrite(false);
    throw err;
  }
}

function listSessions() {
  if (sessionIndex) {
    return [...sessionIndex.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  const dir = sessionsDir();
  const sessions = readdirSync(dir)
    .filter((f) => f.startsWith('session-') && f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  sessionIndex = new Map(sessions.map((session) => [session.id, session]));
  return sessions;
}

function indexSession(session) {
  if (!sessionIndex) listSessions();
  sessionIndex.set(session.id, {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages ?? [],
  });
}

function unindexSession(id) {
  if (!sessionIndex) listSessions();
  sessionIndex.delete(id);
}

// ── GET /api/chat/sessions — list all ────────────────────────────────────────

router.get('/chat/sessions', (_req, res) => {
  const sessions = listSessions().map(({ id, title, createdAt, updatedAt, messages }) => ({
    id,
    title,
    createdAt,
    updatedAt,
    messageCount: messages?.length ?? 0,
    lastMessage:  messages?.at(-1)?.text?.slice(0, 80) ?? '',
  }));
  res.json({ sessions });
});

// ── POST /api/chat/sessions — create new ─────────────────────────────────────

router.post('/chat/sessions', (req, res) => {
  const id      = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const now     = new Date().toISOString();
  const session = {
    id,
    title:     req.body?.title ?? 'Phiên mới',
    createdAt: now,
    updatedAt: now,
    messages:  [],
  };
  writeSession(session);
  indexSession(session);
  res.json({ sessionId: id, session });
});

// ── GET /api/chat/sessions/:id — fetch full session ───────────────────────────

router.get('/chat/sessions/:id', (req, res) => {
  const session = readSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

// ── PATCH /api/chat/sessions/:id — update title ───────────────────────────────

router.patch('/chat/sessions/:id', (req, res) => {
  const session = readSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (req.body?.title) session.title = req.body.title.slice(0, 80);
  writeSession(session);
  indexSession(session);
  res.json({ ok: true, session });
});

// ── DELETE /api/chat/sessions/:id ─────────────────────────────────────────────

router.delete('/chat/sessions/:id', (req, res) => {
  const p = sessionPath(req.params.id);
  if (!existsSync(p)) return res.status(404).json({ error: 'Session not found' });
  unlinkSync(p);
  unindexSession(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/chat/sessions/:id/export — markdown download ────────────────────

router.get('/chat/sessions/:id/export', (req, res) => {
  const session = readSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const lines = [
    `# ${session.title}`,
    ``,
    `**Tạo:** ${new Date(session.createdAt).toLocaleString('vi-VN')}`,
    `**Cập nhật:** ${new Date(session.updatedAt).toLocaleString('vi-VN')}`,
    ``,
    `---`,
    ``,
  ];
  for (const msg of session.messages ?? []) {
    const who  = msg.role === 'user' ? '**Sếp**' : '**Mi**';
    const time = msg.ts ? `_${new Date(msg.ts).toLocaleTimeString('vi-VN')}_` : '';
    lines.push(`${who} ${time}`);
    lines.push('');
    lines.push(msg.text ?? '');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="chat-${session.id}.md"`);
  res.send(lines.join('\n'));
});

// ── POST /api/chat/sessions/:id/messages — append message pair ───────────────
// Called by agent route after streaming completes to persist the exchange.

router.post('/chat/sessions/:id/messages', async (req, res, next) => {
  const session = readSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { userText, agentText } = req.body ?? {};
  if (!userText || !agentText) return res.status(400).json({ error: 'Missing userText or agentText' });

  try {
    await enqueueJsonWrite(sessionPath(req.params.id), (current) => {
      const now = new Date().toISOString();
      const nextSession = current ?? session;
      nextSession.messages = Array.isArray(nextSession.messages) ? nextSession.messages : [];
      nextSession.messages.push({ role: 'user',  text: userText,  ts: now });
      nextSession.messages.push({ role: 'agent', text: agentText, ts: now });
      if (nextSession.title === 'Phiên mới' && nextSession.messages.length === 2) {
        nextSession.title = userText.slice(0, 60) + (userText.length > 60 ? '…' : '');
      }
      nextSession.updatedAt = now;
      return nextSession;
    }, session);
    recordJsonWrite(true);
    const latest = readSession(req.params.id);
    if (latest) indexSession(latest);
    res.json({ ok: true });
  } catch (err) {
    recordJsonWrite(false);
    next(err);
  }
});

export default router;
