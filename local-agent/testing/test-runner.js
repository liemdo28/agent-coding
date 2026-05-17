// local-agent/testing/test-runner.js — TestRunner with --check-quality CLI gate
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

export class TestRunner {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Run the quality gate — checks workspace health without running a full test suite.
   * Returns a structured report that can drive CI pass/fail.
   */
  async checkQuality() {
    const results = {
      timestamp:     new Date().toISOString(),
      workspaceRoot: this.workspaceRoot,
      checks:        [],
      passed:        0,
      failed:        0,
    };

    const check = (name, ok, detail) => {
      results.checks.push({ name, passed: ok, detail });
      ok ? results.passed++ : results.failed++;
    };

    // 1 — Critical entry points
    for (const entry of ['bin/local-agent.js', 'accounting-engine/bin/accounting.js']) {
      const ok = existsSync(join(this.workspaceRoot, entry));
      check(`Entry: ${entry}`, ok, ok ? 'exists' : 'MISSING — critical file absent');
    }

    // 2 — Engineering log structure
    for (const dir of ['.local-agent/engineering-log', '.local-agent/engineering-log/architecture']) {
      const ok = existsSync(join(this.workspaceRoot, dir));
      check(`Log dir: ${dir}`, ok, ok ? 'exists' : 'MISSING — run: local-agent logs update');
    }

    // 3 — Required package.json scripts
    const pkgPath = join(this.workspaceRoot, 'package.json');
    if (existsSync(pkgPath)) {
      let pkg;
      try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { pkg = {}; }
      for (const script of ['test', 'build', 'lint', 'test:integration']) {
        const ok = Boolean(pkg.scripts?.[script]);
        check(`Script: ${script}`, ok, ok ? pkg.scripts[script].slice(0, 80) : 'MISSING from package.json');
      }
    }

    // 4 — No TODO placeholders in eng-log modules (quality gate for AI-written code)
    const engLogDir = join(this.workspaceRoot, 'local-agent/eng-log');
    if (existsSync(engLogDir)) {
      for (const file of readdirSync(engLogDir).filter((f) => f.endsWith('.js'))) {
        let src;
        try { src = readFileSync(join(engLogDir, file), 'utf8'); } catch { continue; }
        const hasTODO = /\bTODO\b/.test(src);
        check(`No-TODO: eng-log/${file}`, !hasTODO,
          hasTODO ? 'Contains TODO placeholder — not production ready' : 'clean');
      }
    }

    // 5 — No internet imports in local-agent source
    const srcDir = join(this.workspaceRoot, 'local-agent');
    const INTERNET_PATTERNS = [/\bfetch\s*\(/, /from\s+['"]axios['"]/, /from\s+['"]node-fetch['"]/, /openai/i, /anthropic/i];
    if (existsSync(srcDir)) {
      const violations = [];
      const scan = (dir) => {
        try {
          for (const f of readdirSync(dir)) {
            const full = join(dir, f);
            try {
              if (existsSync(full) && readFileSync(full).toString().length === 0) continue;
            } catch { continue; }
            if (f.endsWith('.js')) {
              try {
                const src = readFileSync(full, 'utf8');
                if (INTERNET_PATTERNS.some((p) => p.test(src))) violations.push(f);
              } catch { /* skip */ }
            } else {
              try { if (readdirSync(full)) scan(full); } catch { /* not dir */ }
            }
          }
        } catch { /* skip */ }
      };
      scan(srcDir);
      check('Offline policy: no internet imports', violations.length === 0,
        violations.length ? `Violations: ${violations.join(', ')}` : 'all clear');
    }

    // 6 — CI workflow exists
    const ciPath = join(this.workspaceRoot, '.github/workflows/ci.yml');
    const ok = existsSync(ciPath);
    check('CI workflow: .github/workflows/ci.yml', ok, ok ? 'exists' : 'MISSING — CI not configured');

    results.overallPassed = results.failed === 0;
    return results;
  }

  /** Alias kept for backward compatibility. */
  async runTests() {
    return this.checkQuality();
  }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const args          = process.argv.slice(2);
  const checkQuality  = args.includes('--check-quality');
  const workspaceRoot = args.find((a) => !a.startsWith('--')) ?? process.cwd();

  if (!checkQuality) {
    console.log('Usage: node local-agent/testing/test-runner.js --check-quality [workspace-path]');
    process.exit(0);
  }

  const runner  = new TestRunner(workspaceRoot);
  const results = await runner.checkQuality();

  const width = 60;
  console.log(`\nQuality Gate — ${results.timestamp}`);
  console.log('─'.repeat(width));
  for (const c of results.checks) {
    const icon   = c.passed ? '✓' : '✗';
    const color  = c.passed ? '\x1b[32m' : '\x1b[31m';
    const reset  = '\x1b[0m';
    const detail = c.detail.length > 50 ? c.detail.slice(0, 47) + '...' : c.detail;
    console.log(`  ${color}${icon}${reset} ${c.name.padEnd(38)} ${color}${detail}${reset}`);
  }
  console.log('─'.repeat(width));

  const status = results.overallPassed ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m';
  console.log(`Result: ${status}  (${results.passed} passed, ${results.failed} failed)\n`);

  if (!results.overallPassed) process.exit(1);
}
