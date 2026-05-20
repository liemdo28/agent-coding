// routes/indexer.js — Express Router for Global Indexer API
import { Router } from 'express';
import { GlobalFileIndexer } from '../../../global-indexer/GlobalFileIndexer.js';
import { logger } from '../../../core/logger.js';

const router = Router();

// GET /indexer/stats
router.get('/indexer/stats', (req, res) => {
  try {
    const indexer = new GlobalFileIndexer();
    const index = indexer.loadIndex();
    if (!index) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: indexer.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /indexer/scan
router.post('/indexer/scan', async (req, res) => {
  try {
    const indexer = new GlobalFileIndexer();
    // Run asynchronously to prevent API timeout
    indexer.scan().catch((err) => {
      logger.error('UI indexer scan failed async', { error: err.message });
    });
    res.json({ success: true, message: 'Scan started in background' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /indexer/search
router.get('/indexer/search', (req, res) => {
  try {
    const query = req.query.q || '';
    const indexer = new GlobalFileIndexer();
    const index = indexer.loadIndex();
    if (!index) {
      return res.json({ success: true, data: [] });
    }
    const results = indexer.searchProjects(query);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
