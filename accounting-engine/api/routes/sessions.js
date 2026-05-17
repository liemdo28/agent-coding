// api/routes/sessions.js
import { Router } from 'express';

export function sessionsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit  ?? 50,  10), 200);
      const offset = parseInt(req.query.offset ?? 0, 10);
      const status = req.query.status ?? null;
      const where  = status ? 'WHERE status = ?' : '';
      const args   = status ? [status, limit, offset] : [limit, offset];
      const rows   = db.prepare(
        `SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`
      ).all(...args);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:session_id', (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(req.params.session_id);
      if (!row) return res.status(404).json({ error: 'not found' });
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:session_id/metrics', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit ?? 1000, 10), 5000);
      const rows  = db.prepare(
        'SELECT * FROM resource_metrics WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
      ).all(req.params.session_id, limit);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
