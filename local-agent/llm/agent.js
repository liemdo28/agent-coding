// llm/agent.js - top-level ask command handler
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join }          from 'path';
import { loadConfig }    from '../core/config.js';
import { initLogger, logger } from '../core/logger.js';
import { runPolicyChecks }    from '../core/policy.js';
import { LocalLLMAdapter }    from './LocalLLMAdapter.js';
import { buildContext, renderContextPrompt } from './context.js';
import { buildPersonaPrompt } from './persona/index.js';
import { parseContentRequest, runAutoContentPipeline } from '../project-context/AutoContextPipeline.js';
import { globalMemory } from '../memory/GlobalMemoryManager.js';

// System prompt injected into every LLM request — enforces offline guardrails
const SYSTEM_PROMPT = buildPersonaPrompt('vi') + `QUYỀN HẠN KỸ THUẬT — tuân thủ tuyệt đối:
1. Chỉ dùng ngữ cảnh project được cung cấp bên dưới. Không bịa file hoặc function.
2. KHÔNG đề xuất giải pháp cần internet, trừ khi được đánh dấu tùy chọn.
3. KHÔNG tham chiếu API bên ngoài, cloud service, hay CDN.
4. KHÔNG lộ, lặp lại, hay in ra bất kỳ secret, password, hay API key nào.
5. Chỉ đưa ra lệnh và code chạy được trên máy local.
6. Nếu không trả lời được từ ngữ cảnh → nói thẳng, không hallucinate.
7. Ưu tiên giải pháp local (package local, tool local) hơn remote.
8. Câu trả lời ngắn gọn và có thể hành động ngay.`;

/**
 * Main entry point for the `local-agent ask` command.
 *
 * @param {string} question - User's question
 * @param {string} workspaceRoot - Absolute path to the project
 */
export async function askAgent(question, workspaceRoot) {
  // Lazy import chalk/ora so we don't require them at module load time
  const chalk = (await import('chalk')).default;
  const ora   = (await import('ora')).default;

  const config = loadConfig(workspaceRoot);
  initLogger(workspaceRoot, 'info', false);

  // ── Policy gate ───────────────────────────────────────────────────────────
  const policy = runPolicyChecks(workspaceRoot, config);
  if (!policy.passed) {
    console.error(chalk.red('✗ Policy check failed — cannot proceed.'));
    policy.checks
      .filter((c) => c.passed === false && c.severity === 'FAIL')
      .forEach((c) => console.error(chalk.red(`  ✗ ${c.name}: ${c.message}`)));
    process.exit(1);
  }

  // ── LLM availability check ────────────────────────────────────────────────
  const spinner = ora('Connecting to local LLM...').start();
  let adapter;
  try {
    adapter = new LocalLLMAdapter(config.llm);
  } catch (err) {
    spinner.fail(chalk.red('LLM config error: ' + err.message));
    process.exit(1);
  }

  const avail = await adapter.checkAvailability();
  if (!avail.available) {
    spinner.fail(chalk.red(`Local LLM not reachable at ${config.llm.baseUrl}`));
    console.error(chalk.gray(`  Reason: ${avail.reason}`));
    console.error(chalk.yellow('\n  Make sure Ollama / LM Studio / llama.cpp is running locally.'));
    console.error(chalk.yellow(`  For Ollama: ollama serve   then   ollama pull ${config.llm.model}`));
    process.exit(1);
  }
  if (!avail.modelReady) {
    spinner.warn(chalk.yellow(`Model "${config.llm.model}" not found — ${avail.reason}`));
  } else {
    spinner.succeed(chalk.green(`LLM ready: ${config.llm.provider} / ${config.llm.model}`));
  }

  // ── Build context ─────────────────────────────────────────────────────────
  const autoReq = parseContentRequest(question);
  if (autoReq) {
    ctxSpinner.succeed(chalk.green(`Auto-Context request detected: Generating ${autoReq.type} for ${autoReq.alias}`));
    console.log('\n' + chalk.bold.cyan('Answer:\n'));
    let fullResponse = '';
    try {
      fullResponse = await runAutoContentPipeline(
        autoReq.type,
        autoReq.alias,
        adapter,
        (token) => {
          process.stdout.write(token);
        },
        config
      );
      process.stdout.write('\n\n');
    } catch (err) {
      console.error('\n' + chalk.red('Auto-Context Error: ' + err.message));
      process.exit(1);
    }

    // Save conversation log
    const logsDir = join(workspaceRoot, '.local-agent', 'logs');
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    const ts      = new Date().toISOString().replace(/[:.]/g, '-');
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
    console.log(chalk.gray(`  Log saved: ${logPath}`));
    
    // Log to global memory
    globalMemory.logPrompt(question, fullResponse);
    globalMemory.logTask(`Generate content ${autoReq.type} for ${autoReq.alias}`, 'success');
    return;
  }

  const context = buildContext(question, workspaceRoot, config);
  if (context.warning) ctxSpinner.warn(chalk.yellow(context.warning));
  else ctxSpinner.succeed(
    chalk.green(`Context ready — ${context.snippets.length} file(s) loaded`)
  );

  const userPrompt = renderContextPrompt(context);
  logger.info('ask: context built', { files: context.relevantFiles, question });

  // ── Stream LLM response ───────────────────────────────────────────────────
  console.log('\n' + chalk.bold.cyan('Answer:\n'));

  let fullResponse = '';
  try {
    for await (const token of adapter.streamChat(SYSTEM_PROMPT, userPrompt)) {
      process.stdout.write(token);
      fullResponse += token;
    }
    process.stdout.write('\n\n');
  } catch (err) {
    console.error('\n' + chalk.red('LLM error: ' + err.message));
    logger.error('ask: LLM stream failed', { error: err.message });
    process.exit(1);
  }

  // ── Save conversation log ─────────────────────────────────────────────────
  const logsDir = join(workspaceRoot, '.local-agent', 'logs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

  const ts      = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = join(logsDir, `ask-${ts}.md`);
  const logContent = [
    `# Ask Log — ${new Date().toISOString()}`,
    '',
    `## Question\n${question}`,
    '',
    `## Context Files\n${context.relevantFiles.map((f) => `- ${f}`).join('\n') || '_none_'}`,
    '',
    `## Answer\n${fullResponse}`,
    '',
    `## Config\n- Provider: ${config.llm.provider}\n- Model: ${config.llm.model}`,
  ].join('\n');

  writeFileSync(logPath, logContent, 'utf8');
  logger.info('ask: log saved', { path: logPath });
  console.log(chalk.gray(`  Log saved: ${logPath}`));

  // Log to global memory
  globalMemory.logPrompt(question, fullResponse);
  globalMemory.logTask(`Ask: ${question.slice(0, 50)}`, 'success');
}
