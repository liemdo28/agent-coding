// rootcause/runtimeAnalyzer.js — classifies runtime failures from logs and error output
// Phase 13: MEMORY_LEAK, INFINITE_LOOP, DEADLOCK, OOM, PORT_CONFLICT, etc.

import { listMemories } from '../memory/engineeringMemory.js';

const ERROR_CLASSIFIERS = [
  {
    type: 'OOM',
    patterns: [/FATAL ERROR.*heap out of memory/i, /JavaScript heap out of memory/i, /Allocation failed/i],
    suggestedFix: 'Increase --max-old-space-size or reduce memory usage',
  },
  {
    type: 'MEMORY_LEAK',
    patterns: [/memory leak/i, /retained objects/i, /heap grew/i],
    suggestedFix: 'Profile with --inspect and check for unreleased event listeners or circular refs',
  },
  {
    type: 'INFINITE_LOOP',
    patterns: [/Maximum call stack size exceeded/i, /stack overflow/i, /too much recursion/i],
    suggestedFix: 'Add a base case or iteration limit to recursive logic',
  },
  {
    type: 'DEADLOCK',
    patterns: [/deadlock/i, /lock timeout/i, /database is locked/i],
    suggestedFix: 'Review transaction ordering or add timeout to lock acquisition',
  },
  {
    type: 'UNHANDLED_REJECTION',
    patterns: [/UnhandledPromiseRejection/i, /unhandledRejection/i],
    suggestedFix: 'Add .catch() or try/catch around async operations',
  },
  {
    type: 'SEGFAULT',
    patterns: [/Segmentation fault/i, /SIGSEGV/i, /core dumped/i],
    suggestedFix: 'Check native addon versions or use --abort-on-uncaught-exception',
  },
  {
    type: 'PORT_CONFLICT',
    patterns: [/EADDRINUSE/i, /address already in use/i, /port.*in use/i],
    suggestedFix: 'Kill the conflicting process or change PORT env variable',
  },
  {
    type: 'MISSING_FILE',
    patterns: [/ENOENT/i, /no such file or directory/i, /Cannot find module/i],
    suggestedFix: 'Check file path, ensure dependencies are installed (npm install)',
  },
];

/**
 * Classify a runtime error from its text output.
 * @param {string} errorText
 * @returns {{ type: string, confidence: number, evidence: string[], suggestedFix: string }}
 */
export function analyzeRuntimeError(errorText) {
  if (!errorText) return { type: 'UNKNOWN', confidence: 0, evidence: [], suggestedFix: 'No error text provided' };

  let bestMatch = null;
  let bestCount = 0;

  for (const classifier of ERROR_CLASSIFIERS) {
    const evidence = [];
    for (const pattern of classifier.patterns) {
      const match = errorText.match(pattern);
      if (match) evidence.push(match[0]);
    }
    if (evidence.length > bestCount) {
      bestCount = evidence.length;
      bestMatch = { ...classifier, evidence };
    }
  }

  if (!bestMatch) {
    return { type: 'UNKNOWN', confidence: 0.1, evidence: [], suggestedFix: 'Review logs manually' };
  }

  return {
    type:         bestMatch.type,
    confidence:   Math.min(1, 0.5 + bestMatch.evidence.length * 0.2),
    evidence:     bestMatch.evidence,
    suggestedFix: bestMatch.suggestedFix,
  };
}

/**
 * Parse a Node.js stack trace into structured frames.
 * @param {string} stack
 * @returns {Array<{ file: string, line: number, col: number, fn: string }>}
 */
export function parseStackTrace(stack) {
  if (!stack) return [];
  const frames = [];
  const re     = /at\s+([^\s(]+)\s+\((.+?):(\d+):(\d+)\)|at\s+(.+?):(\d+):(\d+)/g;
  let m;
  while ((m = re.exec(stack)) !== null) {
    if (m[2]) {
      frames.push({ fn: m[1], file: m[2], line: +m[3], col: +m[4] });
    } else {
      frames.push({ fn: '<anonymous>', file: m[5], line: +m[6], col: +m[7] });
    }
  }
  return frames;
}

/**
 * Find similar past errors from engineering memory.
 * @param {import('better-sqlite3').Database} db
 * @param {string} errorType
 * @returns {object[]}
 */
export function correlateWithHistory(db, errorType) {
  try {
    return listMemories(db, { type: 'ERROR_FIX', limit: 50 })
      .filter(m => {
        const content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content ?? '';
        return content.includes(errorType);
      })
      .slice(0, 5);
  } catch (err) {
    console.error('[runtimeAnalyzer] correlateWithHistory error:', err.message);
    return [];
  }
}
