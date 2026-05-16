// core/policy.js - offline and security policy enforcement
import { existsSync, readFileSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';

// Only local loopback addresses are acceptable for LLM endpoints
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isLocalUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return LOCAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// Patterns that suggest a secret may be hardcoded in source
const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9\-_]{20,}/i,
  /sk-[A-Za-z0-9]{32,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/i,
];

// Paths that are off-limits for the agent to read
const FORBIDDEN_PATH_PATTERNS = [
  /^\/etc\//,
  /^\/root\//,
  /^\/?~\//,
  /[/\\]\.ssh[/\\]/,
  /[/\\]\.aws[/\\]/,
  /[/\\]\.gnupg[/\\]/,
  /[/\\]\.config[/\\]/,
];

// Blocked shell commands (for policy-check on scripts)
const BLOCKED_SHELL_COMMANDS = ['curl', 'wget', 'fetch', 'ssh', 'scp', 'nc', 'netcat'];

/**
 * Run all policy checks against a project workspace.
 *
 * @param {string} workspaceRoot - Absolute path to the project directory
 * @param {object} config - Loaded agent config
 * @returns {{ passed: boolean, checks: Check[] }}
 *
 * Each check: { name, passed, severity, message }
 */
export function runPolicyChecks(workspaceRoot, config) {
  const checks = [];

  // ── 1. offlineOnly must be true ──────────────────────────────────────────
  checks.push({
    name: 'offline-mode-enabled',
    passed: config.offline === true,
    severity: 'FAIL',
    message: config.offline === true
      ? 'Offline mode is enabled'
      : 'Config has offline=false — must be true',
  });

  // ── 2. allowInternet must be false ───────────────────────────────────────
  const allowInternet = config.allowInternet ?? false;
  checks.push({
    name: 'internet-access-disabled',
    passed: allowInternet === false,
    severity: 'FAIL',
    message: allowInternet === false
      ? 'Internet access is disabled'
      : 'Config has allowInternet=true — must be false',
  });

  // ── 3. telemetry must be off ─────────────────────────────────────────────
  checks.push({
    name: 'telemetry-disabled',
    passed: config.telemetry === false,
    severity: 'FAIL',
    message: config.telemetry === false
      ? 'Telemetry is disabled'
      : 'Config has telemetry=true — must be false',
  });

  // ── 4. workspaceSandbox must be on ───────────────────────────────────────
  const sandbox = config.workspaceSandbox ?? config.sandbox?.timeoutMs !== undefined ? true : null;
  const sandboxEnabled = config.workspaceSandbox !== false;
  checks.push({
    name: 'workspace-sandbox-enabled',
    passed: sandboxEnabled,
    severity: 'FAIL',
    message: sandboxEnabled
      ? 'Workspace sandbox is enabled'
      : 'Config has workspaceSandbox=false — must be true',
  });

  // ── 5. projectRoot must exist ────────────────────────────────────────────
  const projectRoot = config.projectRoot
    ? resolve(workspaceRoot, config.projectRoot)
    : workspaceRoot;
  const rootExists = existsSync(projectRoot);
  checks.push({
    name: 'project-root-valid',
    passed: rootExists,
    severity: 'FAIL',
    message: rootExists
      ? `Project root exists: ${projectRoot}`
      : `Project root does not exist: ${projectRoot}`,
  });

  // ── 6. LLM baseUrl must be local ─────────────────────────────────────────
  const baseUrl = config.llm?.baseUrl ?? '';
  const llmIsLocal = baseUrl === '' || isLocalUrl(baseUrl);
  checks.push({
    name: 'llm-endpoint-local',
    passed: llmIsLocal,
    severity: 'FAIL',
    message: llmIsLocal
      ? `LLM endpoint is local: ${baseUrl || '(not configured)'}`
      : `LLM endpoint is not local: "${baseUrl}" — only localhost/127.0.0.1 allowed`,
  });

  // ── 7. LLM offlineOnly must be true ──────────────────────────────────────
  const llmOffline = config.llm?.offlineOnly ?? true;
  checks.push({
    name: 'llm-offline-only',
    passed: llmOffline === true,
    severity: 'FAIL',
    message: llmOffline
      ? 'LLM offlineOnly is enabled'
      : 'LLM has offlineOnly=false — must be true',
  });

  // ── 8. Scan for hardcoded secrets in project-map ─────────────────────────
  const projectMapPath = join(workspaceRoot, '.local-agent', 'project-map.json');
  if (existsSync(projectMapPath)) {
    try {
      const projectMap = JSON.parse(readFileSync(projectMapPath, 'utf8'));
      const secrets = projectMap?.risks?.hardcodedSecrets ?? [];
      checks.push({
        name: 'no-hardcoded-secrets',
        passed: secrets.length === 0,
        severity: 'FAIL',
        message: secrets.length === 0
          ? 'No hardcoded secrets detected'
          : `${secrets.length} possible hardcoded secret(s) found — run 'local-agent scan' for details`,
        details: secrets.slice(0, 5).map((s) => `${s.file}:${s.line} (${s.type})`),
      });
    } catch {
      checks.push({ name: 'no-hardcoded-secrets', passed: false, severity: 'WARN',
        message: 'Could not parse project-map.json to check for secrets — run scan first' });
    }
  } else {
    checks.push({ name: 'no-hardcoded-secrets', passed: null, severity: 'INFO',
      message: 'No scan data yet — run scan to check for secrets' });
  }

  // ── 9. Blocked shell commands in allowedCommands list ────────────────────
  const allowed = config.sandbox?.allowedCommands ?? [];
  const leakedCmds = allowed.filter((cmd) =>
    BLOCKED_SHELL_COMMANDS.some((b) => cmd.toLowerCase().includes(b))
  );
  checks.push({
    name: 'no-network-commands-in-allowlist',
    passed: leakedCmds.length === 0,
    severity: 'FAIL',
    message: leakedCmds.length === 0
      ? 'No network commands in sandbox allowlist'
      : `Network commands in allowlist: ${leakedCmds.join(', ')}`,
  });

  // ── 10. cloudSync must be off ─────────────────────────────────────────────
  checks.push({
    name: 'cloud-sync-disabled',
    passed: config.cloudSync !== true,
    severity: 'FAIL',
    message: config.cloudSync !== true
      ? 'Cloud sync is disabled'
      : 'Config has cloudSync=true — must be false',
  });

  // ── Aggregate result ──────────────────────────────────────────────────────
  const hardFails = checks.filter((c) => c.passed === false && c.severity === 'FAIL');
  const warnings  = checks.filter((c) => c.passed === false && c.severity === 'WARN');

  return {
    passed:   hardFails.length === 0,
    result:   hardFails.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARNING' : 'PASS',
    failCount: hardFails.length,
    warnCount: warnings.length,
    checks,
  };
}

/**
 * Validate that a file path is inside the allowed workspace root.
 * Throws if the path escapes the sandbox.
 */
export function assertPathInWorkspace(filePath, workspaceRoot) {
  const abs = resolve(filePath);
  const root = resolve(workspaceRoot);
  if (!abs.startsWith(root + '/') && abs !== root) {
    throw new Error(`Security violation: path "${abs}" is outside workspace "${root}"`);
  }
  // Also check against forbidden system paths
  for (const pattern of FORBIDDEN_PATH_PATTERNS) {
    if (pattern.test(abs)) {
      throw new Error(`Security violation: access to "${abs}" is forbidden by policy`);
    }
  }
}
