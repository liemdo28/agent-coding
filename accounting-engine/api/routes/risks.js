// api/routes/risks.js
import { Router } from 'express';

export function risksRouter(db) {
  const router = Router();

  // High-risk summary: high-risk patches, pending approvals, recent rollbacks
  router.get('/', (_req, res) => {
    try {
      const highRisk = db.prepare(`
        SELECT * FROM patch_ledger
        WHERE risk_level = 'high'
        ORDER BY created_at DESC LIMIT 100
      `).all().map(_parsePatch);

      const pendingApproval = db.prepare(`
        SELECT * FROM patch_ledger
        WHERE approval_status = 'pending' AND risk_level = 'high'
        ORDER BY created_at DESC
      `).all().map(_parsePatch);

      const recentRollbacks = db.prepare(`
        SELECT * FROM patch_ledger
        WHERE status = 'rolled_back'
        ORDER BY rolled_back_at DESC LIMIT 50
      `).all().map(_parsePatch);

      const summary = db.prepare(`
        SELECT
          SUM(CASE WHEN risk_level='high' THEN 1 ELSE 0 END)                   AS high_risk_total,
          SUM(CASE WHEN approval_status='pending' AND risk_level='high' THEN 1 ELSE 0 END) AS pending_approvals,
          SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END)                AS total_rollbacks
        FROM patch_ledger
      `).get();

      res.json({ summary, high_risk_patches: highRisk, pending_approvals: pendingApproval, recent_rollbacks: recentRollbacks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Risk distribution breakdown
  router.get('/breakdown', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT risk_level, status, approval_status, COUNT(*) AS count
        FROM patch_ledger
        GROUP BY risk_level, status, approval_status
        ORDER BY risk_level, count DESC
      `).all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function _parsePatch(r) {
  return {
    ...r,
    affected_modules: JSON.parse(r.affected_modules ?? '[]'),
    files_changed:    JSON.parse(r.files_changed    ?? '[]'),
  };
}
