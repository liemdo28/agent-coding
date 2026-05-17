// release/ReleaseChecker.js - Pre-release readiness checks (local only, no deploy)
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

function makeCheck(id, name, category, passed, severity, message, details = [], suggestions = []) {
  return { id, name, category, passed, severity, message, details, suggestions };
}

function safeExec(cmd, cwd, timeoutMs = 60000) {
  try {
    const out = execSync(cmd, { cwd, stdio: 'pipe', timeout: timeoutMs });
    return { success: true, stdout: out.toString(), stderr: '' };
  } catch (err) {
    return { success: false, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? err.message };
  }
}

function getProjectName(workspaceRoot) {
  try {
    const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));
    return pkg.name ?? workspaceRoot.split('/').pop();
  } catch { return workspaceRoot.split('/').pop(); }
}

function loadScanReport(workspaceRoot) {
  const p = join(workspaceRoot, '.local-agent', 'scan-report.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function loadProjectMap(workspaceRoot) {
  const p = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// ── Individual Checks ────────────────────────────────────────────────────────

export function checkBuild(workspaceRoot, config) {
  let cmd = config?.commands?.build;
  if (!cmd) {
    try {
      const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));
      cmd = pkg.scripts?.build ? 'npm run build' : null;
    } catch { /* no package.json */ }
  }
  if (!cmd) return makeCheck('build', 'Build', 'ci', null, 'INFO', 'No build command detected — skipped.', [], ['Add a build script to package.json']);

  const result = safeExec(cmd, workspaceRoot, 60000);
  return makeCheck('build', 'Build', 'ci', result.success, result.success ? 'INFO' : 'FAIL',
    result.success ? `Build passed: ${cmd}` : `Build failed: ${cmd}`,
    result.success ? [] : (result.stderr || result.stdout).split('\n').filter(Boolean).slice(0, 5),
    result.success ? [] : ['Fix build errors before release', `Run: ${cmd}`]);
}

export function checkTests(workspaceRoot, config) {
  let cmd = config?.commands?.test;
  if (!cmd) {
    try {
      const pkg = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));
      cmd = pkg.scripts?.test ? 'npm test' : null;
    } catch { /* no package.json */ }
  }
  if (!cmd) return makeCheck('tests', 'Tests', 'ci', null, 'INFO', 'No test command detected — skipped.', [], ['Add a test script to package.json']);

  const result = safeExec(cmd, workspaceRoot, 120000);
  return makeCheck('tests', 'Tests', 'ci', result.success, result.success ? 'INFO' : 'WARN',
    result.success ? `Tests passed: ${cmd}` : `Tests failed: ${cmd}`,
    result.success ? [] : (result.stderr || result.stdout).split('\n').filter(Boolean).slice(0, 5),
    result.success ? [] : ['Fix failing tests before release']);
}

export function checkEnvExample(workspaceRoot) {
  const hasEnv         = existsSync(join(workspaceRoot, '.env'));
  const hasEnvExample  = existsSync(join(workspaceRoot, '.env.example')) || existsSync(join(workspaceRoot, '.env.sample'));
  const gitignorePath  = join(workspaceRoot, '.gitignore');
  const envInGitignore = existsSync(gitignorePath) && readFileSync(gitignorePath, 'utf8').includes('.env');

  if (!hasEnv) return makeCheck('env-example', 'Env Example', 'config', true, 'INFO', 'No .env file found — skipped.');

  const passed = hasEnvExample;
  return makeCheck('env-example', 'Env Example', 'config', passed,
    passed ? 'INFO' : 'WARN',
    passed ? '.env.example present.' : '.env present but .env.example is missing.',
    passed ? [] : ['.env.example helps new developers set up the project'],
    passed ? [] : ['Create .env.example with placeholder values (no real secrets)', 'Add .env to .gitignore']);
}

export function checkNoHardcodedSecrets(workspaceRoot) {
  const scan = loadScanReport(workspaceRoot);
  if (scan?.risks?.hardcodedSecrets?.length >= 0) {
    const count = scan.risks.hardcodedSecrets.length;
    const highs = scan.risks.hardcodedSecrets.filter((s) => s.severity === 'HIGH' || !s.severity);
    const passed = count === 0;
    const severity = highs.length > 0 ? 'FAIL' : count > 0 ? 'WARN' : 'INFO';
    return makeCheck('no-secrets', 'No Hardcoded Secrets', 'security', passed, severity,
      passed ? 'No hardcoded secrets detected.' : `${count} potential secret(s) detected.`,
      scan.risks.hardcodedSecrets.slice(0, 5).map((s) => `${s.file}:${s.line} — ${s.type}`),
      passed ? [] : ['Remove secrets from source code', 'Use environment variables instead', 'Run: local-agent security scan-secrets']);
  }

  // Fallback: quick scan
  const SECRET_RE = /(?:api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]{8,}/gi;
  const SRC_DIRS  = ['src', 'app', 'lib', 'server', 'backend'].filter((d) => existsSync(join(workspaceRoot, d)));
  const findings  = [];

  function scanDir(dir) {
    try {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) { if (f !== 'node_modules' && f !== '.git') scanDir(full); continue; }
        if (!/\.(js|ts|jsx|tsx|py|json|yaml|yml)$/.test(f)) continue;
        try {
          const content = readFileSync(full, 'utf8');
          const lines   = content.split('\n');
          lines.forEach((line, i) => { if (SECRET_RE.test(line)) findings.push(`${relative(workspaceRoot, full)}:${i+1}`); SECRET_RE.lastIndex = 0; });
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip inaccessible */ }
  }

  for (const d of SRC_DIRS) scanDir(join(workspaceRoot, d));
  const passed = findings.length === 0;
  return makeCheck('no-secrets', 'No Hardcoded Secrets', 'security', passed,
    passed ? 'INFO' : 'FAIL',
    passed ? 'No hardcoded secrets detected.' : `${findings.length} potential secret(s) found.`,
    findings.slice(0, 5),
    passed ? [] : ['Remove secrets and use environment variables instead']);
}

export function checkNoDebugCode(workspaceRoot) {
  const DEBUG_RE = /console\.(log|debug|warn)\(|debugger;|\/\/ TODO:\s*REMOVE|\/\/ FIXME:\s*REMOVE/g;
  const SRC_DIRS = ['src', 'app', 'lib', 'pages', 'components'].filter((d) => existsSync(join(workspaceRoot, d)));
  const findings = [];

  function scanDir(dir) {
    try {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) { if (f !== 'node_modules' && f !== '.git') scanDir(full); continue; }
        if (/\.(test|spec)\.|__tests__/.test(f)) continue;
        if (!/\.(js|ts|jsx|tsx)$/.test(f)) continue;
        try {
          const lines = readFileSync(full, 'utf8').split('\n');
          lines.forEach((line, i) => { if (DEBUG_RE.test(line)) findings.push(`${relative(workspaceRoot, full)}:${i+1}`); DEBUG_RE.lastIndex = 0; });
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  for (const d of SRC_DIRS) scanDir(join(workspaceRoot, d));

  const passed = findings.length === 0;
  return makeCheck('no-debug', 'No Debug Code', 'quality', passed,
    passed ? 'INFO' : 'WARN',
    passed ? 'No console.log or debugger statements in source.' : `${findings.length} debug statement(s) found.`,
    findings.slice(0, 8),
    passed ? [] : ['Remove console.log and debugger statements from production code']);
}

export function checkCriticalTODOs(workspaceRoot) {
  const CRITICAL_RE = /\/\/\s*(TODO|FIXME)[\s:].*(CRITICAL|URGENT|BLOCKING|SECURITY|AUTH|PAYMENT)/gi;
  const projectMap  = loadProjectMap(workspaceRoot);
  const todos       = projectMap?.todos ?? [];
  const critical    = todos.filter((t) => CRITICAL_RE.test(t.text ?? t));
  CRITICAL_RE.lastIndex = 0;

  const passed = critical.length === 0;
  return makeCheck('no-critical-todos', 'No Critical TODOs', 'quality', passed,
    passed ? 'INFO' : 'WARN',
    passed ? `${todos.length} TODO(s) found, none critical.` : `${critical.length} critical TODO(s) found.`,
    critical.slice(0, 5).map((t) => `${t.file ?? ''}:${t.line ?? ''} — ${(t.text ?? t).slice(0, 80)}`),
    passed ? [] : ['Resolve critical TODOs before release']);
}

export function checkReadme(workspaceRoot) {
  const readme = ['README.md', 'README', 'readme.md', 'Readme.md'].find((f) => existsSync(join(workspaceRoot, f)));
  if (!readme) return makeCheck('readme', 'README', 'docs', false, 'WARN', 'README not found.',
    [], ['Create a README.md with setup and usage instructions']);

  const size = statSync(join(workspaceRoot, readme)).size;
  const passed = size > 100;
  return makeCheck('readme', 'README', 'docs', passed,
    passed ? 'INFO' : 'WARN',
    passed ? `README present (${size} bytes).` : 'README is nearly empty.',
    [], passed ? [] : ['Add project description, setup steps, and usage to README.md']);
}

export function checkRollbackAvailable(workspaceRoot) {
  const patchesDir  = join(workspaceRoot, '.local-agent', 'patches');
  const backupsDir  = join(workspaceRoot, '.local-agent', 'backups');
  const hasPatches  = existsSync(patchesDir);
  const hasBackups  = existsSync(backupsDir);
  let appliedIds    = [];

  if (hasPatches) {
    try {
      appliedIds = readdirSync(patchesDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => { try { return JSON.parse(readFileSync(join(patchesDir, f), 'utf8')); } catch { return null; } })
        .filter((p) => p?.status === 'applied')
        .map((p) => p.patchId);
    } catch { /* skip */ }
  }

  return makeCheck('rollback', 'Rollback Available', 'safety', null, 'INFO',
    appliedIds.length > 0
      ? `${appliedIds.length} applied patch(es) can be rolled back.`
      : 'No applied patches. Rollback N/A.',
    appliedIds.map((id) => `local-agent rollback ${id}`),
    []);
}

export function checkNoMissingAssets(workspaceRoot) {
  const warnings = [];
  const nodeModules = join(workspaceRoot, 'node_modules');
  const pkgPath     = join(workspaceRoot, 'package.json');

  if (existsSync(pkgPath) && !existsSync(nodeModules)) {
    warnings.push('node_modules missing — run: npm install');
  }

  const scanReport = loadScanReport(workspaceRoot);
  if (scanReport?.risks?.largeFiles?.length > 0) {
    warnings.push(`${scanReport.risks.largeFiles.length} large file(s) detected.`);
  }

  const passed = warnings.length === 0;
  return makeCheck('no-missing-assets', 'No Missing Assets', 'build', passed,
    passed ? 'INFO' : 'WARN',
    passed ? 'All project assets present.' : `${warnings.length} issue(s) found.`,
    warnings,
    passed ? [] : warnings.map((w) => `Fix: ${w}`));
}

export function checkBrokenRoutes(workspaceRoot) {
  const projectMap = loadProjectMap(workspaceRoot);
  if (!projectMap?.routes?.length) return makeCheck('routes', 'Routes', 'code', null, 'INFO', 'No routes detected — skipped.');

  const missing = projectMap.routes
    .filter((r) => r.file && !existsSync(join(workspaceRoot, r.file)))
    .map((r) => `${r.method ?? 'GET'} ${r.path} → ${r.file}`);

  const passed = missing.length === 0;
  return makeCheck('routes', 'Routes', 'code', passed,
    passed ? 'INFO' : 'WARN',
    passed ? `${projectMap.routes.length} route(s) verified.` : `${missing.length} route handler(s) file missing.`,
    missing.slice(0, 8),
    passed ? [] : ['Check route handler file paths']);
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function runAllChecks(workspaceRoot, config, options = {}) {
  const checks = [];

  const runCheck = async (fn, ...args) => {
    try {
      const result = await fn(...args);
      checks.push(result);
    } catch (err) {
      checks.push(makeCheck(fn.name, fn.name, 'error', false, 'WARN', `Check threw: ${err.message}`));
    }
  };

  if (options.deep) {
    await runCheck(checkBuild, workspaceRoot, config);
    await runCheck(checkTests, workspaceRoot, config);
  }
  await runCheck(checkEnvExample,          workspaceRoot);
  await runCheck(checkNoHardcodedSecrets,  workspaceRoot);
  await runCheck(checkNoDebugCode,         workspaceRoot);
  await runCheck(checkCriticalTODOs,       workspaceRoot);
  await runCheck(checkReadme,              workspaceRoot);
  await runCheck(checkRollbackAvailable,   workspaceRoot);
  await runCheck(checkNoMissingAssets,     workspaceRoot);
  await runCheck(checkBrokenRoutes,        workspaceRoot);

  const failCount  = checks.filter((c) => c.passed === false && c.severity === 'FAIL').length;
  const warnCount  = checks.filter((c) => c.passed === false && c.severity === 'WARN').length;
  const infoCount  = checks.filter((c) => c.passed === true  || c.severity === 'INFO').length;
  const blockers   = checks.filter((c) => c.passed === false && c.severity === 'FAIL');
  const result     = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARNING' : 'PASS';

  const recommendations = checks
    .filter((c) => c.passed === false || c.severity === 'WARN')
    .flatMap((c) => c.suggestions)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  return { checks, result, failCount, warnCount, infoCount, blockers, recommendations, projectName: getProjectName(workspaceRoot) };
}
