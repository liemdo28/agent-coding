// llm/agent.js - top-level ask command handler
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join }          from 'path';
import { loadConfig }    from '../core/config.js';
import { initLogger, logger } from '../core/logger.js';
import { runPolicyChecks }    from '../core/policy.js';
import { LocalLLMAdapter }    from './LocalLLMAdapter.js';
import { buildContext, renderContextPrompt } from './context.js';

// System prompt injected into every LLM request — enforces offline guardrails
const SYSTEM_PROMPT = `You are a local offline AI coding agent.

STRICT RULES — you must follow all of them:
1. Only use the project context provided below. Do not invent files or functions.
2. Do NOT suggest any internet-dependent solutions unless explicitly marked optional.
3. Do NOT request or reference external APIs, cloud services, or CDNs.
4. Do NOT expose, repeat, or output any secrets, passwords, or API keys you see in the context.
5. Produce only practical, locally-runnable commands and code.
6. If you cannot answer from the provided context, say so clearly — do not hallucinate.
7. Prefer local alternatives (local packages, local tools) over remote ones.
8. Keep answers concise and actionable.`;

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
  const ctxSpinner = ora('Building context from project...').start();
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
}
