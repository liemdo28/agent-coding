// llm/context.js - Context builder: assembles relevant project snippets for a prompt
import { readFileSync, existsSync } from 'fs';
import { join, resolve, extname, basename } from 'path';
import { assertPathInWorkspace } from '../core/policy.js';

// Files never allowed in context regardless of query
const FORBIDDEN_CONTEXT_FILES = new Set([
  '.env', '.env.local', '.env.production', '.env.staging',
  '.env.development', '.env.test',
]);
const FORBIDDEN_CONTEXT_PATTERNS = [
  /private[_-]?key/i, /credentials/i, /\.pem$/, /\.key$/, /\.pfx$/, /\.p12$/,
  /id_rsa/, /id_ed25519/, /id_ecdsa/,
];

const CHARS_PER_TOKEN = 4; // rough estimate

function isForbiddenFile(relPath) {
  const b = basename(relPath);
  if (FORBIDDEN_CONTEXT_FILES.has(b)) return true;
  return FORBIDDEN_CONTEXT_PATTERNS.some((re) => re.test(b));
}

/**
 * Score a file for relevance to a query using simple keyword matching.
 * Higher = more relevant.
 */
function scoreFile(filePath, queryTokens) {
  const lower = filePath.toLowerCase();
  let score = 0;
  for (const tok of queryTokens) {
    if (lower.includes(tok)) score += 2;
  }
  // Boost important structural files
  const b = basename(lower);
  if (b === 'package.json' || b === 'readme.md') score += 1;
  return score;
}

function tokenBudget(maxTokens) {
  return maxTokens * CHARS_PER_TOKEN;
}

/**
 * Build a context object for an LLM prompt.
 *
 * @param {string} task - User's question / task
 * @param {string} workspaceRoot - Absolute path to project root
 * @param {object} config - Agent config
 * @returns {object} context
 */
export function buildContext(task, workspaceRoot, config) {
  const root       = resolve(workspaceRoot);
  const maxChars   = tokenBudget(config?.llm?.maxTokens ?? 4096) * 0.6; // leave 40% for answer
  const mapPath    = join(root, '.local-agent', 'project-map.json');
  const summaryPath= join(root, '.local-agent', 'project-summary.md');

  // Load project map
  let projectMap = null;
  if (existsSync(mapPath)) {
    try { projectMap = JSON.parse(readFileSync(mapPath, 'utf8')); } catch { /* ignore */ }
  }

  // Load project summary
  let projectSummary = '';
  if (existsSync(summaryPath)) {
    try { projectSummary = readFileSync(summaryPath, 'utf8').slice(0, 3000); } catch { /* ignore */ }
  }

  if (!projectMap) {
    return {
      task,
      projectSummary: '',
      relevantFiles: [],
      snippets: [],
      constraints: { offlineOnly: true, noInternet: true },
      warning: 'No project scan data found. Run `local-agent scan` first.',
    };
  }

  // Tokenize query for relevance scoring
  const queryTokens = task.toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  // Skip code context for short casual messages (greetings, simple questions)
  // These don't benefit from file snippets and the extra tokens slow inference.
  const CASUAL_PATTERNS = /^(chào|hi|hello|xin chào|oke|ok|cảm ơn|thanks|tạm biệt|bye|giới thiệu|bạn là ai|em là ai)/i;
  const isCasual = task.trim().split(/\s+/).length <= 6 && CASUAL_PATTERNS.test(task.trim());

  if (isCasual) {
    return {
      task,
      projectSummary: projectSummary.slice(0, 500), // just a brief summary
      relevantFiles: [],
      snippets: [],
      constraints: { offlineOnly: true, noInternet: true },
      meta: projectMap.frameworks ? {
        framework: projectMap.frameworks?.[0] ?? 'unknown',
        language: projectMap.languages?.[0] ?? 'unknown',
        packageManager: projectMap.packageManager ?? 'unknown',
        commands: projectMap.commands ?? {},
      } : undefined,
    };
  }

  // Score and sort files
  const scoredFiles = (projectMap.files ?? [])
    .filter((f) => !isForbiddenFile(f.path))
    .map((f) => ({ ...f, score: scoreFile(f.path, queryTokens) }))
    .sort((a, b) => b.score - a.score);

  // Pick top files that fit within char budget
  const snippets = [];
  const relevantFiles = [];
  let usedChars = projectSummary.length;

  for (const file of scoredFiles) {
    if (file.score === 0 && snippets.length >= 3) break; // stop adding zero-score files after 3
    if (snippets.length >= 10) break;

    const absPath = join(root, file.path);

    // Security: verify path stays inside workspace
    try { assertPathInWorkspace(absPath, root); } catch { continue; }

    // Skip forbidden files (double-check absolute path)
    if (isForbiddenFile(file.path)) continue;

    let content = '';
    try { content = readFileSync(absPath, 'utf8'); } catch { continue; }

    const ext = extname(file.path).toLowerCase();
    const maxSnippetChars = Math.min(2000, Math.floor((maxChars - usedChars) / Math.max(1, 5 - snippets.length)));
    if (maxSnippetChars < 100) break;

    const snippet = content.slice(0, maxSnippetChars);
    usedChars += snippet.length;

    snippets.push({ path: file.path, ext, content: snippet, truncated: content.length > maxSnippetChars });
    relevantFiles.push(file.path);
  }

  return {
    task,
    projectSummary,
    relevantFiles,
    snippets,
    constraints: { offlineOnly: true, noInternet: true },
    meta: {
      framework:      projectMap.frameworks?.[0] ?? 'unknown',
      language:       projectMap.languages?.[0]  ?? 'unknown',
      packageManager: projectMap.packageManager  ?? 'unknown',
      commands:       projectMap.commands        ?? {},
    },
  };
}

/**
 * Render a context object into a prompt string to feed the LLM.
 */
export function renderContextPrompt(context) {
  const lines = [];

  lines.push(`## Task\n${context.task}\n`);

  if (context.warning) {
    lines.push(`## Warning\n${context.warning}\n`);
  }

  if (context.meta) {
    const m = context.meta;
    lines.push(
      `## Project Info\n` +
      `- Framework: ${m.framework}\n` +
      `- Language: ${m.language}\n` +
      `- Package manager: ${m.packageManager}\n` +
      (m.commands.build ? `- Build: ${m.commands.build}\n` : '') +
      (m.commands.test  ? `- Test:  ${m.commands.test}\n`  : '') +
      (m.commands.lint  ? `- Lint:  ${m.commands.lint}\n`  : '')
    );
  }

  if (context.projectSummary) {
    lines.push(`## Project Summary\n${context.projectSummary}\n`);
  }

  if (context.snippets.length > 0) {
    lines.push('## Relevant Source Files\n');
    for (const s of context.snippets) {
      const note = s.truncated ? ' (truncated)' : '';
      lines.push(`### ${s.path}${note}\n\`\`\`${s.ext.replace('.', '')}\n${s.content}\n\`\`\`\n`);
    }
  }

  // Language anchor — models tend to follow the most recent instruction;
  // repeating here after the context prevents English drift in code-focused models.
  lines.push('\n---\nTRẢ LỜI BẰNG TIẾNG VIỆT. Xưng "em", gọi người dùng là "sếp".');

  return lines.join('\n');
}
