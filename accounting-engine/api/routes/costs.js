// api/routes/costs.js
import { Router } from 'express';

export function costsRouter(db) {
  const router = Router();

  // Cost breakdown by project + grand total
  router.get('/', (_req, res) => {
    try {
      const byProject = db.prepare(`
        SELECT
          project_name,
          COUNT(*)                  AS total_runs,
          SUM(total_cost_cents)     AS total_cost_cents,
          AVG(total_cost_cents)     AS avg_cost_cents,
          AVG(fix_time_minutes)     AS avg_fix_minutes
        FROM qa_runs
        WHERE completed_at IS NOT NULL
        GROUP BY project_name
        ORDER BY total_cost_cents DESC
      `).all();
      const grand = db.prepare(`
        SELECT
          COUNT(*)              AS total_runs,
          SUM(total_cost_cents) AS total_cost_cents,
          AVG(total_cost_cents) AS avg_cost_cents
        FROM qa_runs WHERE completed_at IS NOT NULL
      `).get();
      res.json({ by_project: byProject, grand_total: grand });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Recurring bug cost — issues that keep reappearing
  router.get('/recurring', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT
          repeated_issue_key,
          COUNT(*)                AS occurrences,
          SUM(fix_time_minutes)   AS total_fix_minutes,
          SUM(total_cost_cents)   AS total_cost_cents,
          AVG(total_cost_cents)   AS avg_cost_cents
        FROM qa_runs
        WHERE repeated_issue_key IS NOT NULL AND completed_at IS NOT NULL
        GROUP BY repeated_issue_key
        ORDER BY total_cost_cents DESC
        LIMIT 50
      `).all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
