// security/CommandPolicy.js - command execution policy enforcement
import { join, resolve } from 'path';

/**
 * Set of blocked command binary names.
 * These commands perform network operations or are dangerous in an offline agent context.
 */
export const BLOCKED_COMMANDS = new Set([
  // Network transfer tools
  'curl',
  'wget',
  'nc',
  'netcat',
  // Remote shell / file copy
  'ssh',
  'scp',
  'sftp',
  'ftp',
  // Legacy network tools
  'telnet',
  // Network scanning / DNS
  'nmap',
  'dig',
  'nslookup',
  // External ping (can be used to detect internet reachability)
  'ping',
  // Package managers — blocked in runtime/production context to prevent
  // downloading remote packages during agent execution
  'npm',
  'yarn',
  'pnpm',
  'pip',
  'pip3',
]);

/**
 * Regex patterns that identify network-related command strings.
 * Tested against the full command string (command + args joined).
 */
export const NETWORK_PATTERNS = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bnc\s+-[a-z]*[lzuv]/i,       // netcat flags
  /\bnetcat\b/i,
  /\bssh\s+/i,
  /\bscp\s+/i,
  /\bsftp\s+/i,
  /\bftp\s+/i,
  /\btelnet\s+/i,
  /\bnmap\s+/i,
  /\bdig\s+/i,
  /\bnslookup\s+/i,
  /https?:\/\//i,                  // Inline URL in command
  /--url\s+https?:\/\//i,
  /\bnpm\s+install\b/i,
  /\byarn\s+add\b/i,
  /\bpnpm\s+add\b/i,
  /\bpip\s+install\b/i,
  /\bpip3\s+install\b/i,
];

/**
 * Regex patterns that identify destructive or dangerous commands.
 * Tested against the full command string.
 */
export const DESTRUCTIVE_PATTERNS = [
  // Recursive delete of root or critical paths
  /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+\//i,
  /rm\s+-rf\s*\/+\s*$/i,
  /rm\s+-rf\s*~/i,
  // SQL destructive operations
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bDROP\s+DATABASE\b/i,
  // Windows format command
  /\bformat\s+[a-z]:/i,
  // Filesystem formatting
  /\bmkfs\b/i,
  // Fork bomb
  /:\(\)\{:\|:&\};:/,
  // dd with input file (can destroy disks)
  /\bdd\s+if=/i,
  // Shred / overwrite utilities
  /\bshred\s+.*--remove/i,
  // chmod 777 recursive on root
  /\bchmod\s+-R\s+777\s+\//i,
  // Writing directly to block devices
  />\s*\/dev\/(s|h|xv|nv)d[a-z]/i,
  // poweroff / reboot / shutdown
  /\b(poweroff|reboot|shutdown|halt)\b/i,
];

/**
 * Extract the command binary name from a command string or argv array.
 * Strips leading path components (e.g. /usr/bin/curl → curl).
 *
 * @param {string} command
 * @returns {string}
 */
function extractBinaryName(command) {
  if (!command) return '';
  // Take only the first token (before spaces)
  const firstToken = command.trim().split(/\s+/)[0];
  // Strip path prefix
  return firstToken.split('/').pop().split('\\').pop().toLowerCase();
}

/**
 * Check whether a command + args combination is allowed by policy.
 *
 * @param {string} command - Command string or binary name
 * @param {string[]} [args=[]] - Argument list
 * @returns {{
 *   allowed: boolean,
 *   reason: string,
 *   blocked: boolean,
 *   destructive: boolean,
 *   network: boolean,
 * }}
 */
export function checkCommand(command, args = []) {
  const binaryName = extractBinaryName(command);
  const fullString = [command, ...args].join(' ');

  // 1. Direct binary name block
  if (BLOCKED_COMMANDS.has(binaryName)) {
    return {
      allowed: false,
      reason: `Command "${binaryName}" is blocked by security policy`,
      blocked: true,
      destructive: false,
      network: isNetworkCommand(command, args),
    };
  }

  // 2. Destructive pattern check (takes priority over network for labeling)
  const destructive = isDestructiveCommand(command, args);
  if (destructive) {
    return {
      allowed: false,
      reason: `Command contains a destructive pattern: "${fullString.slice(0, 80)}"`,
      blocked: true,
      destructive: true,
      network: false,
    };
  }

  // 3. Network pattern check
  const network = isNetworkCommand(command, args);
  if (network) {
    return {
      allowed: false,
      reason: `Command contains a network-related pattern: "${fullString.slice(0, 80)}"`,
      blocked: true,
      destructive: false,
      network: true,
    };
  }

  return {
    allowed: true,
    reason: `Command "${binaryName}" is permitted`,
    blocked: false,
    destructive: false,
    network: false,
  };
}

/**
 * Determine whether a command + args involves network activity.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {boolean}
 */
export function isNetworkCommand(command, args) {
  const fullString = [command, ...args].join(' ');
  const binaryName = extractBinaryName(command);

  if (BLOCKED_COMMANDS.has(binaryName)) {
    // curl, wget, ssh, etc. are inherently network commands
    const networkBinaries = new Set([
      'curl', 'wget', 'nc', 'netcat', 'ssh', 'scp', 'sftp',
      'ftp', 'telnet', 'nmap', 'dig', 'nslookup', 'ping',
    ]);
    if (networkBinaries.has(binaryName)) return true;
  }

  return NETWORK_PATTERNS.some((pattern) => pattern.test(fullString));
}

/**
 * Determine whether a command + args is destructive.
 *
 * @param {string} command
 * @param {string[]} args
 * @returns {boolean}
 */
export function isDestructiveCommand(command, args) {
  const fullString = [command, ...args].join(' ');
  return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(fullString));
}
