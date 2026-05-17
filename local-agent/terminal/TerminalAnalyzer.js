// terminal/TerminalAnalyzer.js — parse and classify local terminal history
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

const DANGEROUS = [
  /rm\s+-rf\s+\/(?!\w)/,           // rm -rf /
  /rm\s+-rf\s+~\b/,               // rm -rf ~
  />\s*\/dev\/(sd[a-z]|nvme)/,    // write to raw disk
  /dd\s+.*of=\/dev\/(sd[a-z]|nvme)/,
  /chmod\s+-R\s+777\s+\//,
  /mkfs\./,
  /:()\{:\|:&\};:/,               // fork bomb
];

const FAILURE_PATTERNS = [
  { re: /command not found/i,        type: 'missing_command' },
  { re: /permission denied/i,        type: 'permission' },
  { re: /ENOENT|no such file/i,      type: 'missing_file' },
  { re: /EADDRINUSE/i,               type: 'port_in_use' },
  { re: /ENOMEM|out of memory/i,     type: 'oom' },
  { re: /SyntaxError|TypeError/i,    type: 'runtime_error' },
  { re: /cannot find module/i,       type: 'missing_module' },
  { re: /error TS\d+/i,             type: 'typescript_error' },
  { re: /npm ERR!|yarn error/i,      type: 'package_manager' },
  { re: /failed to compile/i,        type: 'build_fail' },
  { re: /tests? failed/i,            type: 'test_fail' },
];

const NEXT_CMD_SUGGESTIONS = {
  missing_module: ['npm install', 'yarn install', 'pnpm install'],
  build_fail:     ['local-agent build', 'local-agent diagnose <logfile>'],
  test_fail:      ['local-agent qa', 'local-agent test'],
  port_in_use:    ['lsof -i :<port>', 'kill $(lsof -t -i:<port>)'],
  permission:     ['ls -la <path>', 'chmod +x <file>'],
  missing_file:   ['ls <dir>', 'local-agent scan'],
  oom:            ['local-agent resources', 'free -h'],
};

/**
 * Load shell history from common locations.
 * @param {string} shellHistFile — absolute path or null (auto-detect)
 * @returns {string[]} raw history lines
 */
export function loadHistory(shellHistFile) {
  const candidates = [
    shellHistFile,
    join(homedir(), '.bash_history'),
    join(homedir(), '.zsh_history'),
    join(homedir(), '.local/share/fish/fish_history'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, 'utf8')
          .split('\n')
          .map((l) => l.replace(/^:\s*\d+:\d+;/, '').trim()) // strip zsh timestamps
          .filter(Boolean);
      } catch { continue; }
    }
  }
  return [];
}

/**
 * Classify a command or output line.
 * @param {string} line
 * @returns {{ type: string, dangerous: boolean, suggestion?: string[] }}
 */
export function classifyLine(line) {
  const dangerous = DANGEROUS.some((r) => r.test(line));
  for (const { re, type } of FAILURE_PATTERNS) {
    if (re.test(line)) {
      return { type, dangerous, suggestion: NEXT_CMD_SUGGESTIONS[type] ?? [] };
    }
  }
  return { type: 'ok', dangerous };
}

/**
 * Analyze the last N history lines for patterns.
 * @param {string[]} lines
 * @param {{ limit?: number }} opts
 * @returns {AnalysisResult}
 */
export function analyzeHistory(lines, { limit = 50 } = {}) {
  const recent     = lines.slice(-limit);
  const classified = recent.map((l) => ({ cmd: l, ...classifyLine(l) }));
  const failures   = classified.filter((c) => c.type !== 'ok');
  const dangerous  = classified.filter((c) => c.dangerous);
  const suggestions = [...new Set(failures.flatMap((f) => f.suggestion ?? []))].slice(0, 5);

  // Build session summary: consecutive build/test/run groups
  const buildCmds = classified.filter((c) =>
    /^(npm|yarn|pnpm|node|make|cargo|go build|python)/i.test(c.cmd));

  return {
    total:      recent.length,
    failures:   failures.length,
    dangerous:  dangerous.length,
    failureTypes: countBy(failures, 'type'),
    recentFails: failures.slice(-5),
    dangerousCmds: dangerous.map((d) => d.cmd),
    suggestions,
    buildCmds: buildCmds.slice(-10).map((c) => c.cmd),
  };
}

/**
 * Summarize a build/test session from history.
 * @param {string[]} lines
 * @returns {string}
 */
export function summarizeSession(lines) {
  const recent   = lines.slice(-100);
  const errors   = recent.filter((l) => FAILURE_PATTERNS.some(({ re }) => re.test(l)));
  const successes = recent.filter((l) => /success|passed|built in|done in/i.test(l));
  const builds   = recent.filter((l) => /^(npm|yarn|pnpm|make|cargo)\s+(run|build|test)/i.test(l));

  const parts = [];
  if (builds.length)    parts.push(`Commands run: ${builds.slice(-5).join(' → ')}`);
  if (successes.length) parts.push(`Successes: ${successes.length}`);
  if (errors.length)    parts.push(`Errors: ${errors.slice(-3).join('; ')}`);

  return parts.length ? parts.join('\n') : 'No significant build activity in recent history.';
}

function countBy(arr, key) {
  const out = {};
  for (const item of arr) out[item[key]] = (out[item[key]] ?? 0) + 1;
  return out;
}
