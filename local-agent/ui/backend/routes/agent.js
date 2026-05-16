// routes/agent.js — SSE streaming ask endpoint
import { Router } from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { PROJECT_ROOT } from '../server.js';
import { loadConfig } from '../../../core/config.js';
import { initLogger, logger } from '../../../core/logger.js';
import { runPolicyChecks } from '../../../core/policy.js';
import { LocalLLMAdapter } from '../../../llm/LocalLLMAdapter.js';
import { buildContext, renderContextPrompt } from '../../../llm/context.js';

const router = Router();

const SYSTEM_PROMPT = `You are a local offline AI coding agent.

STRICT RULES — you must follow all of them:
1. Only use the project context provided below. Do not invent files or functions.
2. Do NOT suggest any internet-dependent solutions unless explicitly marked optional.
3. Do NOT request or reference external APIs, cloud services, or CDNs.
4. Do NOT expose, repeat, or output any secrets, passwords, or API keys you see in the context.
5. Produce only practical, locally-runnable commands and code.
6. If you cannot answer from the provided context, say so clearly — do not hallucinate.
7. Prefer local alternatives (local packages, local tools) over remote ones.
8. Keep answers concise and actionable.
9. IMPORTANT: Patches cannot be applied from chat. If you suggest code changes, instruct the user to apply them via the Patches page.`;

// POST /agent/ask  — SSE streaming response
router.post('/agent/ask', async (req, res) => {
  const { question } = req.body ?? {};

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ success: false, error: 'Missing required field: question' });
  }

  // Set up SSE headers
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    initLogger(PROJECT_ROOT, 'info', false);
    const config = loadConfig(PROJECT_ROOT);

    // Policy check
    const policy = runPolicyChecks(PROJECT_ROOT, config);
    if (!policy.passed) {
      send('error', { message: 'Policy check failed — cannot proceed', checks: policy.checks.filter((c) => !c.passed && c.severity === 'FAIL') });
      res.end();
      return;
    }

    // Init LLM adapter
    let adapter;
    try {
      adapter = new LocalLLMAdapter(config.llm);
    } catch (err) {
      send('error', { message: 'LLM config error: ' + err.message });
      res.end();
      return;
    }

    // Check LLM availability
    const avail = await adapter.checkAvailability();
    if (!avail.available) {
      send('error', { message: `Local LLM not reachable at ${config.llm.baseUrl}. Make sure Ollama/LM Studio is running.` });
      res.end();
      return;
    }

    // Build context
    const context = buildContext(question.trim(), PROJECT_ROOT, config);
    send('context', { files: context.relevantFiles ?? [], warning: context.warning ?? null });

    const userPrompt = renderContextPrompt(context);
    logger.fileOnly('info', 'ui: /agent/ask started', { question: question.slice(0, 80) });

    // Stream LLM response
    let fullResponse = '';
    for await (const token of adapter.streamChat(SYSTEM_PROMPT, userPrompt)) {
      fullResponse += token;
      send('token', { token });
    }

    send('done', { complete: true });
    logger.fileOnly('info', 'ui: /agent/ask done', { chars: fullResponse.length });

    // Save log
    const logsDir = join(PROJECT_ROOT, '.local-agent', 'logs');
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = join(logsDir, `ask-${ts}.md`);
    const logContent = [
      `# Ask Log — ${new Date().toISOString()}`,
      '',
      `## Question\n${question}`,
      '',
      `## Context Files\n${(context.relevantFiles ?? []).map((f) => `- ${f}`).join('\n') || '_none_'}`,
      '',
      `## Answer\n${fullResponse}`,
      '',
      `## Config\n- Provider: ${config.llm.provider}\n- Model: ${config.llm.model}`,
    ].join('\n');
    writeFileSync(logPath, logContent, 'utf8');

  } catch (err) {
    logger.fileOnly('error', 'ui: /agent/ask error', { error: err.message });
    send('error', { message: err.message });
  }

  res.end();
});

export default router;
