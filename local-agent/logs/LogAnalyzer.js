// logs/LogAnalyzer.js - Parse and analyze log file content

import { readFileSync } from 'fs';

// ── Regex patterns for common log formats ─────────────────────────────────

const LOG_PATTERNS = [
  // ISO timestamp: 2025-01-01T12:00:00.000Z [LEVEL] message
  /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*\[?(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE)\]?\s*(.*)$/i,

  // Bracket prefix: [ERROR] message
  /^\[?(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\]?\s*[:\-]?\s*(.*)$/i,

  // Common prefix: 2025-01-01 12:00:00 ERROR message
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\s+(.*)$/i,

  // npm/yarn style: npm ERR! message
  /^(npm|yarn|bun|pnpm)\s+(ERR|WARN|info|verbose)\s*[:!]?\s*(.*)$/i,

  // HTTP access log style
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d{3})\s+(\d+|-)/,

  // Vite/dev server style: VITE v5.0.0  ready in 200 ms
  /^(vite|webpack|esbuild|rollup|tsc|eslint|prettier)\s+.*$/i,
];

const ERROR_KEYWORDS = [
  'error', 'fail', 'fatal', 'critical', 'exception',
  'crash', 'panic', 'abort', 'segfault', 'unhandled',
  'cannot', 'unable', 'invalid', 'miss',
];

/**
 * Normalize a log level string.
 */
function normalizeLevel(lvl) {
  const s = String(lvl).toLowerCase().trim();
  if (s === 'warning') return 'warn';
  if (s === 'critical' || s === 'fatal') return 'error';
  return s;
}

/**
 * Try to parse a timestamp string into ISO format.
 */
function parseTimestamp(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* ignore */ }
  return ts; // return raw if parsing fails
}

/**
 * Parse a raw log line into structured data.
 */
function parseLine(line, lineNum) {
  for (const pattern of LOG_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const [, ts, level, ...rest] = match;
      return {
        lineNum,
        raw: line,
        timestamp: ts ? parseTimestamp(ts) : null,
        level: normalizeLevel(level || rest[0]),
        message: rest.join(' ').trim(),
        parsed: true,
      };
    }
  }

  // Fallback: keyword-based detection
  const lower = line.toLowerCase();
  let level = 'info';
  if (ERROR_KEYWORDS.some((k) => lower.includes(k))) {
    level = 'error';
  }

  return { lineNum, raw: line, timestamp: null, level, message: line, parsed: false };
}

/**
 * Parse log file content into structured entries.
 * @param {string} content
 * @param {string} sourcePath
 * @returns {{ entries: LogEntry[], stats: LogStats, errors: LogEntry[], warnings: LogEntry[] }}
 */
export function analyzeLogContent(content, sourcePath = '') {
  const lines        = content.split('\n');
  const entries      = [];
  const errors       = [];
  const warns        = [];
  const byLevel      = {};
  let lastTs         = null;
  let spanMs         = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const entry = parseLine(line, i + 1);
    entries.push(entry);

    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;

    if (entry.level === 'error') errors.push(entry);
    if (entry.level === 'warn')  warns.push(entry);

    if (entry.timestamp) {
      const ms = new Date(entry.timestamp).getTime();
      if (lastTs) spanMs = Math.max(spanMs, ms - lastTs);
      lastTs = ms;
    }
  }

  // Deduplicate error messages
  const errorFingerprints = new Set();
  const uniqueErrors = errors.filter((e) => {
    const fp = e.message.slice(0, 80).trim();
    if (errorFingerprints.has(fp)) return false;
    errorFingerprints.add(fp);
    return true;
  });

  return {
    entries,
    stats: {
      totalLines:      lines.length,
      parsedLines:    entries.filter((e) => e.parsed).length,
      byLevel,
      errorCount:       errors.length,
      warnCount:       warns.length,
      uniqueErrorCount: uniqueErrors.length,
      spanMs,
      source:          sourcePath,
    },
    errors:    uniqueErrors.slice(0, 50),
    warnings:  warns.slice(0, 50),
  };
}

/**
 * Analyze a log file by path.
 */
export function analyzeLogFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const result  = analyzeLogContent(content, filePath);
    return result;
  } catch (err) {
    return {
      entries: [],
      stats: {
        totalLines: 0, errorCount: 0, warnCount: 0,
        uniqueErrorCount: 0, source: filePath,
      },
      errors: [],
      warnings: [],
      error: err.message,
    };
  }
}

/**
 * Cross-file log intelligence: aggregate errors across multiple log files.
 */
export function aggregateLogIntelligence(results) {
  const allErrors = [];
  const allWarns  = [];
  const byFile    = {};
  const byLevel   = {};

  for (const result of results) {
    if (result.error) continue;
    byFile[result.stats.source] = {
      errors: result.errors.length,
      warns:  result.warnings.length,
      lines:  result.stats.totalLines,
    };

    for (const [lvl, cnt] of Object.entries(result.stats.byLevel || {})) {
      byLevel[lvl] = (byLevel[lvl] || 0) + cnt;
    }

    allErrors.push(...result.errors);
    allWarns.push(...result.warnings);
  }

  // Sort files by error count
  const fileRanking = Object.entries(byFile)
    .sort(([, a], [, b]) => b.errors - a.errors)
    .map(([path, data]) => ({ path, ...data }));

  return {
    totalFiles:     results.filter((r) => !r.error).length,
    totalErrors:    allErrors.length,
    totalWarnings:  allWarns.length,
    byLevel,
    byFile:         fileRanking,
    topErrors:      allErrors.slice(0, 20),
    topWarnings:    allWarns.slice(0, 20),
  };
}