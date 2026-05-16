// qa/ErrorParser.js - parse raw build/test output into structured error objects

// ── Matchers (ordered: most specific first) ─────────────────────────────────

const MATCHERS = [
  // TypeScript tsc errors: "src/foo.ts(12,3): error TS2345: ..."
  {
    id: 'tsc',
    re: /^(.+\.tsx?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/m,
    extract: (m) => ({
      file: m[1], line: +m[2], col: +m[3],
      code: m[4], message: m[5],
      errorType: 'TYPE_ERROR',
    }),
  },
  // Vite build errors: "[vite] Error: ..."  or  "error during build:\n..."
  {
    id: 'vite',
    re: /(?:\[vite\]\s+)?error(?:\s+during\s+build)?[:\s]+(.+)/im,
    extract: (m) => ({ message: m[1].trim(), errorType: 'BUILD_ERROR' }),
  },
  // esbuild: "[ERROR] Could not resolve ..."
  {
    id: 'esbuild',
    re: /\[ERROR\]\s+(.+?)(?:\n\s+(.+?):(\d+):(\d+))?$/m,
    extract: (m) => ({
      message: m[1].trim(),
      file: m[2] ?? null, line: m[3] ? +m[3] : null, col: m[4] ? +m[4] : null,
      errorType: 'BUILD_ERROR',
    }),
  },
  // Node.js module not found: "Cannot find module 'X'"
  {
    id: 'module_not_found',
    re: /Cannot find module '([^']+)'/,
    extract: (m) => ({ module: m[1], message: m[0], errorType: 'IMPORT_ERROR' }),
  },
  // Node.js module not found (require): "MODULE_NOT_FOUND"
  {
    id: 'module_not_found_code',
    re: /code:\s*'MODULE_NOT_FOUND'/,
    extract: (m) => ({ message: m[0], errorType: 'IMPORT_ERROR' }),
  },
  // ESM import error
  {
    id: 'esm_import',
    re: /Named export '(.+?)' not found.*from '(.+?)'/,
    extract: (m) => ({ export: m[1], module: m[2], message: m[0], errorType: 'IMPORT_ERROR' }),
  },
  // Missing env variable pattern
  {
    id: 'env_missing',
    re: /(?:missing|required|undefined)\s+(?:env(?:ironment)?\s+)?(?:variable|var)\s+['"']?([A-Z_][A-Z0-9_]+)['"']?/i,
    extract: (m) => ({ variable: m[1], message: m[0], errorType: 'ENV_ERROR' }),
  },
  // pytest: "FAILED tests/foo.py::test_bar - AssertionError: ..."
  {
    id: 'pytest',
    re: /FAILED\s+(.+?)::(.+?)\s+-\s+(.+)/,
    extract: (m) => ({
      file: m[1], testName: m[2], message: m[3],
      errorType: 'TEST_FAILURE',
    }),
  },
  // Jest / Vitest: "● test name › expected..."
  {
    id: 'jest_vitest',
    re: /●\s+(.+?)\n\s+(.+)/,
    extract: (m) => ({ testName: m[1].trim(), message: m[2].trim(), errorType: 'TEST_FAILURE' }),
  },
  // Vitest FAIL line: "FAIL src/foo.test.ts"
  {
    id: 'vitest_fail',
    re: /^FAIL\s+(.+\.test\.[jt]sx?)$/m,
    extract: (m) => ({ file: m[1], message: `Test file failed: ${m[1]}`, errorType: 'TEST_FAILURE' }),
  },
  // Syntax error (JS/Python/PHP)
  {
    id: 'syntax',
    re: /SyntaxError:\s+(.+)/,
    extract: (m) => ({ message: m[0], detail: m[1], errorType: 'BUILD_ERROR' }),
  },
  // PHP syntax: "Parse error: syntax error in /path/to/file.php on line N"
  {
    id: 'php_syntax',
    re: /Parse error:\s+(.+?)\s+in\s+(.+?)\s+on\s+line\s+(\d+)/,
    extract: (m) => ({
      message: m[1], file: m[2], line: +m[3],
      errorType: 'BUILD_ERROR',
    }),
  },
  // Python traceback: last line of Traceback
  {
    id: 'python_error',
    re: /(?:^|\n)(\w+Error(?:Exception)?:\s*.+)$/m,
    extract: (m) => ({ message: m[1].trim(), errorType: 'RUNTIME_ERROR' }),
  },
  // Auth / permission errors
  {
    id: 'auth',
    re: /(?:unauthorized|403 Forbidden|authentication failed|permission denied)/i,
    extract: (m) => ({ message: m[0], errorType: 'AUTH_ERROR' }),
  },
  // Route / 404
  {
    id: 'route',
    re: /(?:route not found|404 Not Found|Cannot GET|Cannot POST)\s+(.+)/i,
    extract: (m) => ({ path: m[1]?.trim(), message: m[0], errorType: 'ROUTE_ERROR' }),
  },
  // Database errors
  {
    id: 'database',
    re: /(?:SQLITE_|ECONNREFUSED|relation .+ does not exist|table .+ doesn't exist|database.*error)/i,
    extract: (m) => ({ message: m[0], errorType: 'DATABASE_ERROR' }),
  },
  // Generic "Error: ..." fallback
  {
    id: 'generic',
    re: /(?:^|\n)\s*(?:Error|error):\s+(.+)/m,
    extract: (m) => ({ message: m[1]?.trim() ?? m[0], errorType: 'UNKNOWN_ERROR' }),
  },
];

// ── Stack trace extractor ────────────────────────────────────────────────────

function extractStackTrace(text) {
  const lines = text.split('\n');
  const stackLines = [];
  let inStack = false;

  for (const line of lines) {
    if (/^\s+at\s+/.test(line) || /^\s+File\s+"/.test(line)) {
      inStack = true;
      stackLines.push(line.trim());
    } else if (inStack && line.trim() === '') {
      break;
    }
  }
  return stackLines.slice(0, 15); // cap at 15 frames
}

// ── File/line extractor for stack frames ────────────────────────────────────

function extractFileFromStack(stack) {
  for (const frame of stack) {
    // Node.js: "at Object.<anonymous> (/path/to/file.js:12:5)"
    const m = frame.match(/\((.+?):(\d+):\d+\)$/) ||
              frame.match(/at\s+(.+?):(\d+):\d+$/);
    if (m) return { file: m[1], line: +m[2] };
    // Python: '  File "path/file.py", line 42'
    const pm = frame.match(/File\s+"(.+?)",\s+line\s+(\d+)/);
    if (pm) return { file: pm[1], line: +pm[2] };
  }
  return null;
}

// ── Module/package extractor ─────────────────────────────────────────────────

function extractModule(text) {
  const m = text.match(/(?:from|require|import)\s+['"]([^'"]+)['"]/) ||
            text.match(/Cannot find module '([^']+)'/) ||
            text.match(/No module named '([^']+)'/);
  return m ? m[1] : null;
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a block of raw build/test output into an array of structured errors.
 *
 * @param {string} output - Raw stdout + stderr
 * @param {object} [hints] - Optional { command, framework }
 * @returns {ParsedError[]}
 */
export function parseErrors(output, hints = {}) {
  if (!output || !output.trim()) return [];

  const stack = extractStackTrace(output);
  const stackFileInfo = extractFileFromStack(stack);
  const module = extractModule(output);
  const errors = [];
  const seen = new Set();

  for (const matcher of MATCHERS) {
    const globalRe = new RegExp(matcher.re.source, matcher.re.flags.includes('g') ? matcher.re.flags : matcher.re.flags + 'g');
    let m;
    while ((m = globalRe.exec(output)) !== null) {
      const extracted = matcher.extract(m);
      const key = `${extracted.errorType}:${extracted.message?.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      errors.push({
        id:        `${matcher.id}-${errors.length}`,
        errorType: extracted.errorType ?? 'UNKNOWN_ERROR',
        message:   extracted.message   ?? m[0].trim(),
        file:      extracted.file      ?? stackFileInfo?.file ?? null,
        line:      extracted.line      ?? stackFileInfo?.line ?? null,
        col:       extracted.col       ?? null,
        code:      extracted.code      ?? null,
        module:    extracted.module    ?? module ?? null,
        testName:  extracted.testName  ?? null,
        variable:  extracted.variable  ?? null,
        detail:    extracted.detail    ?? null,
        stackTrace: stack,
        framework: hints.framework ?? null,
        command:   hints.command   ?? null,
        raw:       m[0].slice(0, 300),
      });

      // Avoid matching the same position repeatedly for non-global patterns
      if (!matcher.re.flags.includes('g')) break;
    }
  }

  // Deduplicate: if same file+line appears via multiple matchers, keep most specific
  return deduplicateErrors(errors);
}

function deduplicateErrors(errors) {
  const byKey = new Map();
  for (const e of errors) {
    const key = `${e.file}:${e.line}:${e.message?.slice(0, 40)}`;
    const existing = byKey.get(key);
    // Prefer more specific error types over UNKNOWN_ERROR
    if (!existing || existing.errorType === 'UNKNOWN_ERROR') {
      byKey.set(key, e);
    }
  }
  return [...byKey.values()];
}

/**
 * Parse a raw log file (e.g. vite-build.log) passed to `diagnose` command.
 */
export function parseLogFile(content, logPath) {
  // Infer framework hint from filename
  let framework = null;
  if (/vite/.test(logPath))   framework = 'vite';
  if (/next/.test(logPath))   framework = 'next';
  if (/pytest/.test(logPath)) framework = 'python';
  if (/jest/.test(logPath))   framework = 'jest';

  return parseErrors(content, { framework });
}
