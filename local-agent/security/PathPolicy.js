// security/PathPolicy.js - path access policy enforcement
import { join, resolve, relative } from 'path';
import { homedir } from 'os';

/**
 * Blocked path patterns.
 * Each entry is a RegExp tested against the resolved absolute file path.
 * NOTE: `~` is expanded to the real home directory at module load time.
 */
const home = homedir();

export const BLOCKED_PATH_PATTERNS = [
  // SSH keys and config
  { pattern: new RegExp(`^${escapeRegex(join(home, '.ssh'))}`), reason: 'SSH directory is off-limits' },
  // GPG keyring
  { pattern: new RegExp(`^${escapeRegex(join(home, '.gnupg'))}`), reason: 'GPG directory is off-limits' },
  // System password/shadow files
  { pattern: /^\/etc\/passwd$/, reason: '/etc/passwd is off-limits' },
  { pattern: /^\/etc\/shadow$/, reason: '/etc/shadow is off-limits' },
  // Generic .env files (any directory)
  { pattern: /(?:^|[/\\])\.env(?:\.[^/\\]+)?$/, reason: '.env files may contain secrets' },
  // Private key files by name
  { pattern: /id_rsa(?:\.pub)?$/, reason: 'RSA private key files are off-limits' },
  { pattern: /id_ed25519(?:\.pub)?$/, reason: 'Ed25519 key files are off-limits' },
  { pattern: /id_ecdsa(?:\.pub)?$/, reason: 'ECDSA key files are off-limits' },
  // PEM certificate / key files
  { pattern: /\.pem$/, reason: 'PEM files may contain private keys' },
  // Generic .key files
  { pattern: /\.key$/, reason: '.key files may contain private keys' },
  // AWS and generic credentials files
  { pattern: /(?:^|[/\\])credentials$/, reason: 'credentials files are off-limits' },
  // AWS credentials directory
  { pattern: new RegExp(`^${escapeRegex(join(home, '.aws'))}`), reason: 'AWS config directory is off-limits' },
  // Path traversal through node_modules (../../)
  { pattern: /node_modules[/\\]\.bin[/\\]\.\.[/\\]\.\./, reason: 'Path traversal via node_modules detected' },
  // Any path containing ../ that tries to escape the workspace is handled by assertInWorkspace
];

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether a file path matches any blocked pattern.
 *
 * @param {string} filePath - May be relative or absolute
 * @returns {{ blocked: boolean, reason: string }}
 */
export function isPathBlocked(filePath) {
  // Resolve to absolute, but don't anchor to a workspace — pure pattern check
  let abs;
  try {
    abs = resolve(filePath);
  } catch {
    return { blocked: true, reason: 'Unable to resolve file path' };
  }

  for (const { pattern, reason } of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(abs)) {
      return { blocked: true, reason };
    }
  }

  return { blocked: false, reason: '' };
}

/**
 * Assert that a file path is inside the workspace root.
 * Throws a descriptive Error if the path escapes the sandbox.
 *
 * @param {string} filePath
 * @param {string} workspaceRoot
 * @throws {Error}
 */
export function assertInWorkspace(filePath, workspaceRoot) {
  const abs = resolve(filePath);
  const root = resolve(workspaceRoot);

  if (!abs.startsWith(root + '/') && abs !== root) {
    throw new Error(
      `Security violation: path "${abs}" is outside the workspace "${root}"`
    );
  }
}

/**
 * Check whether a file path is contained within the workspace root.
 *
 * @param {string} filePath
 * @param {string} workspaceRoot
 * @returns {boolean}
 */
export function isInWorkspace(filePath, workspaceRoot) {
  try {
    const abs = resolve(filePath);
    const root = resolve(workspaceRoot);
    return abs.startsWith(root + '/') || abs === root;
  } catch {
    return false;
  }
}

/**
 * Perform a complete path access check: workspace containment + blocked patterns.
 *
 * @param {string} filePath
 * @param {string} workspaceRoot
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkPathAccess(filePath, workspaceRoot) {
  // 1. Workspace containment
  if (!isInWorkspace(filePath, workspaceRoot)) {
    const abs = resolve(filePath);
    const root = resolve(workspaceRoot);
    return {
      allowed: false,
      reason: `Path "${abs}" is outside the workspace root "${root}"`,
    };
  }

  // 2. Blocked pattern check
  const { blocked, reason } = isPathBlocked(filePath);
  if (blocked) {
    return { allowed: false, reason };
  }

  return { allowed: true, reason: 'Path is within workspace and not blocked' };
}
