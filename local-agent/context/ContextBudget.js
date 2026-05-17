// context/ContextBudget.js - Token budget management for context building
import { readFileSync, existsSync } from 'fs';
import { relative } from 'path';

export const DEFAULT_BUDGET = {
  maxTokens:    8000,
  fileTokens:   6000,
  systemTokens: 1000,
  taskTokens:    500,
  memoryTokens:  500,
};

export function estimateTokens(text) {
  return Math.ceil((text ?? '').length / 4);
}

const BINARY_EXTS = new Set(['.png','.jpg','.jpeg','.gif','.svg','.ico','.woff','.woff2','.ttf','.eot','.mp4','.mp3','.pdf','.zip','.gz','.tar','.bin','.exe','.lock']);
const TEXT_EXTS   = new Set(['.js','.ts','.jsx','.tsx','.py','.rb','.go','.rs','.java','.c','.cpp','.h','.css','.scss','.html','.json','.yaml','.yml','.md','.txt','.sh','.env','.toml','.xml']);

function isBinary(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTS.has(ext)) return true;
  if (TEXT_EXTS.has(ext)) return false;
  // unknown extension: check first 512 bytes for null bytes
  try {
    const buf = Buffer.alloc(512);
    const fd  = require('fs').openSync(filePath, 'r');
    const bytesRead = require('fs').readSync(fd, buf, 0, 512, 0);
    require('fs').closeSync(fd);
    return buf.slice(0, bytesRead).includes(0);
  } catch { return false; }
}

export function formatFileForContext(filePath, workspaceRoot, maxLines = 150) {
  if (!existsSync(filePath)) return null;
  if (isBinary(filePath))   return null;
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines   = content.split('\n');
    const snippet = lines.length > maxLines
      ? lines.slice(0, maxLines).join('\n') + `\n// ... (${lines.length - maxLines} more lines truncated)`
      : content;
    const relPath = relative(workspaceRoot, filePath);
    return `// File: ${relPath}\n${snippet}`;
  } catch { return null; }
}

export function fitFilesToBudget(rankedFiles, budget, workspaceRoot) {
  const limit     = budget?.fileTokens ?? DEFAULT_BUDGET.fileTokens;
  const selected  = [];
  const skipped   = [];
  let   total     = 0;

  for (const filePath of rankedFiles) {
    const formatted = formatFileForContext(filePath, workspaceRoot);
    if (!formatted) { skipped.push(filePath); continue; }
    const tokens = estimateTokens(formatted);
    if (total + tokens > limit) { skipped.push(filePath); continue; }
    selected.push({ filePath, content: formatted, tokens });
    total += tokens;
  }

  return {
    selectedFiles: selected,
    totalTokens:   total,
    truncated:     skipped.length > 0,
    skippedFiles:  skipped,
  };
}
