// context/AdvancedContextEngine.js - Orchestrates smart context selection for LLM prompts
import { existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { detectEntrypoints, detectConfigFiles } from './EntrypointDetector.js';
import { traceImports }                         from './ImportTracer.js';
import { rankFiles, extractKeywords, detectErrorFiles } from './FileRanker.js';
import { fitFilesToBudget, estimateTokens, DEFAULT_BUDGET } from './ContextBudget.js';

function loadProjectMap(workspaceRoot) {
  const p = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function getAllProjectFiles(workspaceRoot, projectMap) {
  if (projectMap?.files?.length) return projectMap.files.map((f) => join(workspaceRoot, f.path));
  // fallback: glob
  try {
    const { globSync } = require('fast-glob');
    return globSync(['**/*.{js,ts,jsx,tsx,py,json,md}'], {
      cwd: workspaceRoot, absolute: true,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.local-agent/**'],
    });
  } catch { return []; }
}

export async function buildContext(task, workspaceRoot, config = {}) {
  const budget     = { ...DEFAULT_BUDGET, ...(config.contextBudget ?? {}) };
  const projectMap = loadProjectMap(workspaceRoot);
  const allFiles   = getAllProjectFiles(workspaceRoot, projectMap);

  const keywords    = extractKeywords(task);
  const errorFiles  = detectErrorFiles(task, workspaceRoot);
  const entrypoints = detectEntrypoints(workspaceRoot);
  const configFiles = detectConfigFiles(workspaceRoot);

  // Trace imports from the first 3 entrypoints (keep it fast)
  const importedFiles = new Set();
  for (const ep of entrypoints.slice(0, 3)) {
    const traced = traceImports(ep, workspaceRoot, 2);
    traced.forEach((f) => importedFiles.add(f));
  }

  const ranked = rankFiles(allFiles, task, {
    keywords,
    errorFiles,
    entrypoints: [...entrypoints, ...configFiles],
    importGraph: null,
  });

  const { selectedFiles, totalTokens, truncated, skippedFiles } = fitFilesToBudget(ranked, budget, workspaceRoot);

  return {
    files: selectedFiles.map((f) => ({
      path:    f.filePath,
      relPath: relative(workspaceRoot, f.filePath),
      content: f.content,
      tokens:  f.tokens,
    })),
    totalTokens,
    truncated,
    skippedCount: skippedFiles.length,
    keywords,
    entrypoints: entrypoints.map((e) => relative(workspaceRoot, e)),
    budget,
  };
}

export function explainContext(contextResult) {
  const { files, totalTokens, truncated, keywords, skippedCount } = contextResult;
  const lines = [
    `## Context Files Selected (${files.length} files, ~${totalTokens} tokens)`,
    keywords.length ? `**Keywords matched**: ${keywords.join(', ')}` : '',
    truncated ? `*${skippedCount} files skipped due to token budget.*` : '',
    '',
    ...files.map((f) => `- \`${f.relPath}\` (~${f.tokens} tokens)`),
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function renderPromptContext(contextResult) {
  if (!contextResult?.files?.length) return '';
  const parts = contextResult.files.map((f) => f.content);
  return `<context>\n${parts.join('\n\n')}\n</context>`;
}

export function getContextSummary(contextResult) {
  return {
    fileCount:   contextResult.files.length,
    totalTokens: contextResult.totalTokens,
    truncated:   contextResult.truncated,
    topFiles:    contextResult.files.slice(0, 5).map((f) => f.relPath),
  };
}
