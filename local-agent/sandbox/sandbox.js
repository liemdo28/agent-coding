// sandbox/sandbox.js - secure command runner with allowlist enforcement
import { spawn } from 'child_process';
import { resolve } from 'path';

/**
 * Normalize a command string to its base executable name.
 * e.g. "npm run build" -> "npm", "/usr/bin/npm" -> "npm"
 */
function getBaseCommand(command) {
  // Strip leading path components
  const base = command.split('/').pop().split('\\').pop();
  // Return the first word (handles "rm -rf /" style)
  return base.split(/\s+/)[0].toLowerCase();
}

/**
 * Check if a command string matches any entry in a list (base name or full string match).
 */
function matchesCommandList(command, list) {
  const base = getBaseCommand(command);
  for (const entry of list) {
    const entryBase = entry.split(/\s+/)[0].toLowerCase();
    if (base === entryBase) return true;
    // Also check full command string for multi-word blocked entries like "rm -rf /"
    if (command.toLowerCase().includes(entry.toLowerCase())) return true;
  }
  return false;
}

/**
 * Validate that a cwd path stays within the workspace root (anti-traversal).
 */
function validateCwd(cwd, workspaceRoot) {
  const resolvedCwd = resolve(cwd);
  const resolvedRoot = resolve(workspaceRoot);
  if (!resolvedCwd.startsWith(resolvedRoot + '/') && resolvedCwd !== resolvedRoot) {
    throw new Error(
      `Path traversal rejected: cwd "${resolvedCwd}" is outside workspace root "${resolvedRoot}"`
    );
  }
  return resolvedCwd;
}

/**
 * Run a command with timeout, output size limits, and allowlist enforcement.
 *
 * @param {string} command - The executable to run (e.g. "npm")
 * @param {string[]} args - Arguments array
 * @param {object} options
 * @param {string} options.cwd - Working directory (must be within workspaceRoot)
 * @param {number} [options.timeout] - Override timeout in ms
 * @param {object} [options.env] - Additional env vars (merged with process.env)
 * @returns {Promise<{ success: boolean, exitCode: number|null, stdout: string, stderr: string, timedOut: boolean }>}
 */
async function runCommand(command, args = [], options = {}) {
  const { allowedCommands, blockedCommands, timeoutMs, maxOutputBytes, workspaceRoot } = this;

  // --- Allowlist check ---
  if (!matchesCommandList(command, allowedCommands)) {
    throw new Error(
      `Command not allowed: "${command}". Allowed: ${allowedCommands.join(', ')}`
    );
  }

  // --- Blocklist check ---
  const fullCommandStr = [command, ...args].join(' ');
  if (matchesCommandList(command, blockedCommands) || matchesCommandList(fullCommandStr, blockedCommands)) {
    throw new Error(
      `Command is blocked: "${command}". This command is on the security blocklist.`
    );
  }

  // --- Path traversal check ---
  const cwd = options.cwd
    ? validateCwd(options.cwd, workspaceRoot)
    : workspaceRoot;

  const timeout = options.timeout ?? timeoutMs;

  const env = {
    ...process.env,
    // Prevent npm/pip from making network calls for audit etc.
    NPM_CONFIG_AUDIT: 'false',
    ...(options.env ?? {}),
  };

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputBytes = 0;
    let outputTruncated = false;

    const child = spawn(command, args, {
      cwd,
      env,
      shell: false, // Never use shell — prevents injection
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
      }, 3000);
    }, timeout);

    function appendOutput(chunk, target) {
      const remaining = maxOutputBytes - outputBytes;
      if (remaining <= 0) {
        if (!outputTruncated) {
          outputTruncated = true;
          stderr += '\n[OUTPUT TRUNCATED: maxOutputBytes limit reached]';
        }
        return;
      }
      const str = chunk.toString('utf8');
      const slice = str.slice(0, remaining);
      outputBytes += Buffer.byteLength(slice, 'utf8');
      if (target === 'stdout') stdout += slice;
      else stderr += slice;
    }

    child.stdout.on('data', (chunk) => appendOutput(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => appendOutput(chunk, 'stderr'));

    child.on('close', (exitCode) => {
      clearTimeout(timeoutHandle);
      resolve({
        success: exitCode === 0 && !timedOut,
        exitCode,
        stdout,
        stderr,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      resolve({
        success: false,
        exitCode: null,
        stdout,
        stderr: stderr + `\n[SPAWN ERROR] ${err.message}`,
        timedOut: false,
      });
    });
  });
}

/**
 * Create a sandbox bound to a workspace root and config.
 *
 * @param {string} workspaceRoot - Absolute path to the project root
 * @param {object} config - Loaded agent config
 * @returns {{ runCommand: Function, workspaceRoot: string }}
 */
export function createSandbox(workspaceRoot, config) {
  const sandboxConfig = config?.sandbox ?? {};

  const allowedCommands = sandboxConfig.allowedCommands ?? ['node', 'npm', 'npx'];
  const blockedCommands = sandboxConfig.blockedCommands ?? [];
  const timeoutMs = sandboxConfig.timeoutMs ?? 60000;
  const maxOutputBytes = sandboxConfig.maxOutputBytes ?? 1048576;

  const context = {
    workspaceRoot: resolve(workspaceRoot),
    allowedCommands,
    blockedCommands,
    timeoutMs,
    maxOutputBytes,
  };

  return {
    workspaceRoot: context.workspaceRoot,
    allowedCommands,
    blockedCommands,
    timeoutMs,
    maxOutputBytes,

    /**
     * Run an allowed command within the sandbox.
     *
     * @param {string} command
     * @param {string[]} args
     * @param {object} options - { cwd, timeout, env }
     */
    runCommand: runCommand.bind(context),
  };
}
