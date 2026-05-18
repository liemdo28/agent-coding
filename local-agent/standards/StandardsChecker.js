// standards/StandardsChecker.js — enforce local coding standards (fully offline)
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname, basename, dirname } from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);

// ── Rule Definitions ──────────────────────────────────────────────────────────

const RULES = [
  {
    id: 'naming:kebab-files',
    description: 'Source files should use kebab-case or PascalCase (no spaces/underscores in JS/TS)',
    check(file) {
      const base = basename(file.rel, extname(file.rel));
      if (['.js', '.ts', '.jsx', '.tsx'].includes(extname(file.rel))) {
        if (/\s|_{2,}/.test(base)) return `File name has spaces or double-underscores: ${file.rel}`;
      }
      return null;
    },
  },
  {
    id: 'arch:no-deep-relative',
    description: 'Avoid deeply nested relative imports (../../.. more than 3 levels)',
    check(file) {
      if (!['.js', '.ts', '.jsx', '.tsx'].includes(extname(file.rel))) return null;
      const content = safeRead(file.abs);
      if (!content) return null;
      const bad = [...content.matchAll(/from\s+['"](\.\.[\/\\]){4,}/g)];
      if (bad.length) return `Deep relative imports (${bad.length}) in ${file.rel}`;
      return null;
    },
  },
  {
    id: 'arch:no-console-in-lib',
    description: 'Library/utility files should not use console.log',
    check(file) {
      if (!/\/(lib|util|helper|core|service)\//i.test(file.abs)) return null;
      const content = safeRead(file.abs);
      if (!content) return null;
      const count = (content.match(/console\.(log|debug|warn)\(/g) ?? []).length;
      if (count > 0) return `console.log/debug/warn (${count}) in library file: ${file.rel}`;
      return null;
    },
  },
  {
    id: 'style:no-magic-numbers',
    description: 'Avoid bare magic numbers (prefer named constants) — warn only',
    check(file) {
      if (!['.js', '.ts'].includes(extname(file.rel))) return null;
      const content = safeRead(file.abs);
      if (!content) return null;
      const bad = [...content.matchAll(/(?<![a-zA-Z_\$'"`])(?<!\.)\b([2-9][0-9]{2,}|[1-9][0-9]{3,})\b(?!\s*[,;]?\s*\/\/)/g)];
      if (bad.length > 5) return `${bad.length} potential magic numbers in ${file.rel} (warn)`;
      return null;
    },
  },
  {
    id: 'qa:test-coverage-missing',
    description: 'Source files with no corresponding test file',
    check(file) {
      if (!/\.(js|ts)$/.test(file.rel)) return null;
      if (/\.(test|spec)\./i.test(file.rel)) return null;
      if (/\/(test|tests|__tests__)\//i.test(file.abs)) return null;
      // Check for test file in common locations
      const base = basename(file.rel).replace(/\.(js|ts)$/, '');
      const dir  = dirname(file.abs);
      const testPaths = [
        join(dir, `${base}.test.js`),  join(dir, `${base}.test.ts`),
        join(dir, `${base}.spec.js`),  join(dir, `${base}.spec.ts`),
        join(dir, '__tests__', `${base}.test.js`),
      ];
      if (!testPaths.some((p) => existsSync(p))) return `No test file for: ${file.rel}`;
      return null;
    },
  },
  {
    id: 'commit:husky-missing',
    description: 'Projects without git hooks (husky/.husky) may miss commit validation',
    check(file) { return null; }, // project-level, handled separately
  },
];

function safeRead(abs) {
  try { return readFileSync(abs, 'utf8'); } catch { return null; }
}

/**
 * Collect all checkable source files.
 * @param {string} projectDir
 * @returns {FileEntry[]}
 */
function collectFiles(projectDir) {
  const results = [];
  function walk(dir, depth) {
    if (depth > 8) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      const abs = join(dir, name);
      let stat;
      try { stat = statSync(abs); } catch { continue; }
      if (stat.isDirectory()) walk(abs, depth + 1);
      else results.push({ abs, rel: relative(projectDir, abs) });
    }
  }
  walk(projectDir, 0);
  return results;
}

/**
 * Run all standards checks on a project.
 * @param {string} projectDir
 * @returns {CheckResult}
 */
export function checkStandards(projectDir) {
  const files    = collectFiles(projectDir);
  const findings = [];

  for (const file of files) {
    for (const rule of RULES) {
      if (rule.id === 'commit:husky-missing') continue;
      try {
        const msg = rule.check(file);
        if (msg) findings.push({ ruleId: rule.id, file: file.rel, message: msg });
      } catch { /* skip broken file */ }
    }
  }

  // Project-level checks
  if (!existsSync(join(projectDir, '.husky')) && !existsSync(join(projectDir, '.githooks'))) {
    findings.push({ ruleId: 'commit:husky-missing', file: '.', message: 'No git hooks directory (.husky/.githooks)' });
  }

  const byRule = {};
  for (const f of findings) byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1;

  return {
    totalFiles:  files.length,
    findings:    findings.length,
    byRule,
    details:     findings.slice(0, 50),
    healthy:     findings.length === 0,
  };
}

/**
 * Generate a fix plan (suggestions, not auto-applied).
 * @param {CheckResult} result
 * @returns {FixPlan}
 */
export function buildFixPlan(result) {
  const FIX_SUGGESTIONS = {
    'naming:kebab-files':      'Rename files to use kebab-case or PascalCase',
    'arch:no-deep-relative':   'Move shared code to src/lib/ and use absolute imports',
    'arch:no-console-in-lib':  'Replace console.log with a logger utility',
    'style:no-magic-numbers':  'Extract magic numbers into named constants (const MAX_RETRIES = 3)',
    'qa:test-coverage-missing':'Create corresponding .test.js for each source file',
    'commit:husky-missing':    'Run: npx husky init && npx husky add .husky/pre-commit "npx lint-staged"',
  };

  const steps = Object.entries(result.byRule).map(([ruleId, count]) => ({
    ruleId,
    count,
    suggestion: FIX_SUGGESTIONS[ruleId] ?? 'Review and fix manually',
  }));

  return { steps, note: 'Fix plan only — changes require manual implementation or local-agent fix' };
}
