// routes/agent.js — SSE streaming ask endpoint
import { Router }                               from 'express';
import { existsSync, mkdirSync, writeFileSync,
         readFileSync }                         from 'fs';
import { join, resolve }                        from 'path';
import { PROJECT_ROOT }                         from '../server.js';
import { writeJsonAtomic }                      from '../lib/runtime-json.js';
import { recordJsonWrite, trackSseConnection }  from '../lib/runtime-metrics.js';
import { loadConfig }                           from '../../../core/config.js';
import { initLogger, logger }                   from '../../../core/logger.js';
import { runPolicyChecks }                      from '../../../core/policy.js';
import { LocalLLMAdapter }                      from '../../../llm/LocalLLMAdapter.js';
import { buildContext, renderContextPrompt }    from '../../../llm/context.js';
import { buildPersonaPrompt }                   from '../../../llm/persona/index.js';
import { parseContentRequest, runAutoContentPipeline } from '../../project-context/AutoContextPipeline.js';
import { ProjectContextEngine } from '../../project-context/ProjectContextEngine.js';
import { aiMemorySystem } from '../../../ai-memory/AIMemorySystem.js';

const router = Router();

const SYSTEM_PROMPT = buildPersonaPrompt('vi') + `QUYỀN HẠN KỸ THUẬT — tuân thủ tuyệt đối:
1. Chỉ dùng ngữ cảnh project được cung cấp bên dưới. Không bịa file hoặc function.
2. KHÔNG đề xuất giải pháp cần internet, trừ khi được đánh dấu tùy chọn.
3. KHÔNG tham chiếu API bên ngoài, cloud service, hay CDN.
4. KHÔNG lộ, lặp lại, hay in ra bất kỳ secret, password, hay API key nào.
5. Chỉ đưa ra lệnh và code chạy được trên máy local.
6. Nếu không trả lời được từ ngữ cảnh → nói thẳng, không hallucinate.
7. Ưu tiên giải pháp local (package local, tool local) hơn remote.
8. Câu trả lời ngắn gọn và có thể hành động ngay.
9. QUAN TRỌNG: Không thể áp patch từ chat. Nếu đề xuất thay đổi code → hướng dẫn sếp dùng trang Patches.`;

// ── helpers ───────────────────────────────────────────────────────────────────

function persistToSession(sessionId, question, fullResponse) {
  if (!sessionId) return;
  try {
    const dir  = join(PROJECT_ROOT, '.local-agent', 'chat-history');
    const path = join(dir, `session-${sessionId}.json`);
    if (!existsSync(path)) return;

    const session = JSON.parse(readFileSync(path, 'utf8'));
    const now = new Date().toISOString();
    session.messages.push({ role: 'user',  text: question,      ts: now });
    session.messages.push({ role: 'agent', text: fullResponse,  ts: now });

    // Auto-title on first exchange
    if (session.title === 'Phiên mới' && session.messages.length === 2) {
      session.title = question.slice(0, 60) + (question.length > 60 ? '…' : '');
    }
    session.updatedAt = now;
    writeJsonAtomic(path, session);
    recordJsonWrite(true);
  } catch (e) {
    recordJsonWrite(false);
    // Non-fatal — session persistence failed but we don't interrupt the user
    logger.fileOnly('warn', 'agent: failed to persist session', { sessionId, error: e.message });
  }
}

// ── POST /agent/ask  — SSE streaming response ─────────────────────────────────

router.post('/agent/ask', async (req, res) => {
  const { question, sessionId } = req.body ?? {};

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ success: false, error: 'Missing required field: question' });
  }

  // Set up SSE headers
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  trackSseConnection(req);

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

    // Intercept with Auto-Context Pipeline if request matches
    const autoReq = parseContentRequest(question.trim());
    if (autoReq) {
      send('context', { files: [`Auto-Context: resolving ${autoReq.alias}`], warning: null });
      logger.fileOnly('info', 'ui: /agent/ask auto-context matched', { type: autoReq.type, alias: autoReq.alias });
      
      let fullResponse = '';
      try {
        fullResponse = await runAutoContentPipeline(
          autoReq.type,
          autoReq.alias,
          adapter,
          (token) => {
            send('token', { token });
          },
          config
        );
      } catch (err) {
        send('error', { message: err.message });
        res.end();
        return;
      }

      send('done', { complete: true });
      logger.fileOnly('info', 'ui: /agent/ask auto-context complete', { chars: fullResponse.length });
      
      persistToSession(sessionId, question.trim(), fullResponse);
      
      const logsDir = join(PROJECT_ROOT, '.local-agent', 'logs');
      if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const logPath = join(logsDir, `ask-${ts}.md`);
      const logContent = [
        `# Ask Log (Auto-Context) — ${new Date().toISOString()}`,
        '',
        `## Question\n${question}`,
        '',
        `## Project Context\n- Alias: ${autoReq.alias}\n- Type: ${autoReq.type}`,
        '',
        `## Answer\n${fullResponse}`,
      ].join('\n');
      writeFileSync(logPath, logContent, 'utf8');
      res.end();
      return;
    }

    // Build context
    const context = buildContext(question.trim(), PROJECT_ROOT, config);
    send('context', { files: context.relevantFiles ?? [], warning: context.warning ?? null });

    // Retrieve historical memory and fixes
    const memoryContext = aiMemorySystem.buildContext(question.trim(), PROJECT_ROOT);
    let memoryPromptSection = '';
    
    if ((memoryContext.relevantPrompts && memoryContext.relevantPrompts.length > 0) || 
        (memoryContext.similarFixes && memoryContext.similarFixes.length > 0) || 
        (memoryContext.semanticMatches && memoryContext.semanticMatches.length > 0)) {
      
      memoryPromptSection = '\n## Historical Memory & Fixes Context\n';
      if (memoryContext.relevantPrompts && memoryContext.relevantPrompts.length > 0) {
        memoryPromptSection += '\n### Relevant Previous Prompts:\n';
        for (const p of memoryContext.relevantPrompts) {
          memoryPromptSection += `- Prompt: "${p.prompt}"\n`;
        }
      }
      if (memoryContext.similarFixes && memoryContext.similarFixes.length > 0) {
        memoryPromptSection += '\n### Similar Successful Fixes:\n';
        for (const f of memoryContext.similarFixes) {
          memoryPromptSection += `- Issue: "${f.issue}"\n  Fix: \`\`\`\n${f.fix}\n\`\`\`\n`;
        }
      }
      if (memoryContext.semanticMatches && memoryContext.semanticMatches.length > 0) {
        memoryPromptSection += '\n### Semantic Memory Matches:\n';
        for (const m of memoryContext.semanticMatches) {
          memoryPromptSection += `- Key: ${m.key} -> Value: ${m.value}\n`;
        }
      }
      memoryPromptSection += '\n';
    }

    let userPrompt = memoryPromptSection + renderContextPrompt(context);

    // Contextual project awareness check
    const lowerQuestion = question.toLowerCase();
    const keywords = {
      'rawwwebsite': ['rawwwebsite', 'raw-website', 'raw_website', 'rawwebsite'],
      'dashboard': ['dashboard', 'dash', 'dash-bakudanramen', 'bakudanramen'],
      'ai': ['ai-project', 'agent-coding', 'local-agent', 'ai project']
    };

    let referencedAlias = null;
    for (const [alias, synonyms] of Object.entries(keywords)) {
      if (synonyms.some(syn => lowerQuestion.includes(syn))) {
        referencedAlias = alias;
        break;
      }
    }

    if (referencedAlias) {
      try {
        const engine = new ProjectContextEngine();
        const projContext = await engine.buildContext(referencedAlias);
        if (projContext && projContext.found) {
          const projectInfoPrompt = [
            '',
            '## Referenced Project Context Details',
            `- Name/Alias: ${projContext.alias}`,
            `- Absolute Path: ${projContext.resolvedPath}`,
            `- Primary Language: ${projContext.language}`,
            `- Tech Stack: ${(projContext.techStack || []).join(', ')}`,
            `- Dependencies: ${(projContext.dependencies || []).join(', ')}`,
            `- Key Features: ${(projContext.features || []).join(', ')}`,
            '- README Content Preview:',
            projContext.readme ? projContext.readme.slice(0, 3000) : '_No README content available._',
            ''
          ].join('\n');
          userPrompt = projectInfoPrompt + '\n' + userPrompt;
          logger.fileOnly('info', 'ui: injected project context for alias', { alias: referencedAlias });
        }
      } catch (err) {
        logger.fileOnly('warn', 'ui: failed to inject project context', { error: err.message });
      }
    }

    logger.fileOnly('info', 'ui: /agent/ask started', { question: question.slice(0, 80) });

    // Stream LLM response
    let fullResponse = '';
    for await (const token of adapter.streamChat(SYSTEM_PROMPT, userPrompt)) {
      fullResponse += token;
      send('token', { token });
    }

    send('done', { complete: true });
    logger.fileOnly('info', 'ui: /agent/ask done', { chars: fullResponse.length });

    // Store in AI memory system
    aiMemorySystem.storePrompt(question.trim(), fullResponse);

    // Persist exchange to session file (non-blocking, non-fatal)
    persistToSession(sessionId, question.trim(), fullResponse);

    // Save raw ask log
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
