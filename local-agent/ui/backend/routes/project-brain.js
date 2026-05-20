// routes/project-brain.js — Express router for AI Project Brain endpoints
import { Router } from 'express';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectBrainEngine } from '../../../project-brain/ProjectBrainEngine.js';

const router = Router();
const brainEngine = new ProjectBrainEngine();

// GET /api/project-brain/analyze/:alias
router.get('/analyze/:alias', async (req, res) => {
  const { alias } = req.params;
  const useLLM = req.query.llm !== 'false';
  try {
    const result = await brainEngine.analyzeProject(alias, { useLLM });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/project-brain/document/:alias
router.post('/document/:alias', async (req, res) => {
  const { alias } = req.params;
  const useLLM = req.query.llm !== 'false';
  try {
    const result = await brainEngine.generateDocs(alias, { useLLM });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/project-brain/docs/:alias
router.get('/docs/:alias', async (req, res) => {
  const { alias } = req.params;
  const { file } = req.query;
  try {
    const projectPath = brainEngine.contextEngine.resolveProjectPath(alias);
    if (!projectPath) {
      return res.status(404).json({ success: false, error: `Project alias "${alias}" not found.` });
    }

    const docsDir = join(projectPath, '.local-agent', 'brain', 'docs');
    if (!existsSync(docsDir)) {
      return res.json({ success: true, files: [], message: 'No documentation generated yet.' });
    }

    if (file) {
      const filePath = join(docsDir, file);
      // Security check: prevent directory traversal
      if (!filePath.startsWith(docsDir)) {
        return res.status(403).json({ success: false, error: 'Forbidden file access' });
      }
      if (!existsSync(filePath)) {
        return res.status(404).json({ success: false, error: `File "${file}" not found.` });
      }
      const content = readFileSync(filePath, 'utf8');
      return res.json({ success: true, file, content });
    }

    const files = readdirSync(docsDir).filter(f => f.endsWith('.md'));
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
