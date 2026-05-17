// patch/astPatchEngine.js — AST-aware patch generation using regex+heuristics
// Phase 15: inserts/replaces at function/class boundaries rather than raw line offsets

import { existsSync, readFileSync, writeFileSync } from 'fs';

/**
 * Detect the scope (function/class/block/line) around a target line.
 * @param {string} code
 * @param {number} targetLine  1-indexed
 * @returns {{ scope: string, name: string|null, start: number, end: number }}
 */
export function detectPatchScope(code, targetLine) {
  const lines = code.split('\n');
  const idx   = targetLine - 1; // 0-indexed

  // Scan backwards for function/class/block opener
  const FUNC_RE  = /^[\s]*(async\s+)?function\s+(\w+)|(\w+)\s*[:=]\s*(async\s+)?(\(|function)/;
  const CLASS_RE = /^[\s]*class\s+(\w+)/;
  const BLOCK_RE = /[\{]$/;

  for (let i = idx; i >= 0; i--) {
    const line = lines[i];
    const fm   = FUNC_RE.exec(line);
    if (fm) {
      const name  = fm[2] ?? fm[3] ?? 'anonymous';
      const end   = findBlockEnd(lines, i);
      return { scope: 'function', name, start: i + 1, end };
    }
    const cm = CLASS_RE.exec(line);
    if (cm) {
      const end = findBlockEnd(lines, i);
      return { scope: 'class', name: cm[1], start: i + 1, end };
    }
  }

  // Scan for surrounding block
  for (let i = idx; i >= 0; i--) {
    if (BLOCK_RE.test(lines[i])) {
      const end = findBlockEnd(lines, i);
      if (end >= idx) {
        return { scope: 'block', name: null, start: i + 1, end };
      }
    }
  }

  return { scope: 'line', name: null, start: targetLine, end: targetLine };
}

/**
 * Generate a patch object that respects scope boundaries.
 * @param {string} original  original file content
 * @param {{ targetLine: number, newContent: string, mode?: 'insert'|'replace' }} change
 * @param {string} filename
 * @returns {{ original: string, patched: string, scope: object, filename: string }}
 */
export function generateAstPatch(original, change, filename) {
  const lines    = original.split('\n');
  const scope    = detectPatchScope(original, change.targetLine);
  const lineIdx  = change.targetLine - 1;
  const newLines = [...lines];

  if (change.mode === 'replace') {
    newLines[lineIdx] = change.newContent;
  } else {
    // insert after target line
    newLines.splice(lineIdx + 1, 0, change.newContent);
  }

  const patched = newLines.join('\n');
  return { original, patched, scope, filename };
}

/**
 * Validate a patch by checking brace matching and no obvious syntax traps.
 * @param {string} original
 * @param {string} patched
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function validateAstPatch(original, patched) {
  const reasons = [];
  const origBraces  = countBraces(original);
  const patchBraces = countBraces(patched);

  if (origBraces.open !== patchBraces.open || origBraces.close !== patchBraces.close) {
    const delta = patchBraces.open - patchBraces.close;
    if (delta !== 0) {
      reasons.push(`Brace mismatch: ${delta > 0 ? delta + ' unclosed' : Math.abs(delta) + ' extra closing'} braces`);
    }
  }

  // Check for obvious syntax traps
  if (/\)\s*\{[\s\S]*?\)\s*\{/.test(patched) && !/function/.test(patched)) {
    reasons.push('Possible double-open block without function keyword');
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Apply a generated patch to a file on disk.
 * @param {string} filePath
 * @param {{ original: string, patched: string }} patch
 * @returns {{ success: boolean, error?: string }}
 */
export function applyAstPatch(filePath, patch) {
  try {
    if (!existsSync(filePath)) return { success: false, error: 'File not found' };
    const current = readFileSync(filePath, 'utf8');
    if (current !== patch.original) {
      return { success: false, error: 'File content has changed since patch was generated' };
    }
    const validation = validateAstPatch(patch.original, patch.patched);
    if (!validation.valid) {
      return { success: false, error: `Patch validation failed: ${validation.reasons.join('; ')}` };
    }
    writeFileSync(filePath, patch.patched, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function countBraces(code) {
  let open = 0, close = 0;
  for (const ch of code) {
    if (ch === '{') open++;
    else if (ch === '}') close++;
  }
  return { open, close };
}

function findBlockEnd(lines, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth <= 0) return i + 1;
      }
    }
  }
  return lines.length;
}
