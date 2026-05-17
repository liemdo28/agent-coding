// security/WorkspaceSandbox.js - workspace sandboxing and unified access validation
import { resolve } from 'path';

import {
  checkPathAccess,
  isInWorkspace,
  isPathBlocked,
  assertInWorkspace,
  BLOCKED_PATH_PATTERNS,
} from './PathPolicy.js';

import {
  checkCommand,
  isNetworkCommand,
  isDestructiveCommand,
  BLOCKED_COMMANDS,
  NETWORK_PATTERNS,
  DESTRUCTIVE_PATTERNS,
} from './CommandPolicy.js';

// Re-export helpers so callers can import from a single place
export {
  checkPathAccess,
  isInWorkspace,
  isPathBlocked,
  assertInWorkspace,
  BLOCKED_PATH_PATTERNS,
  checkCommand,
  isNetworkCommand,
  isDestructiveCommand,
  BLOCKED_COMMANDS,
  NETWORK_PATTERNS,
  DESTRUCTIVE_PATTERNS,
};

/**
 * Create a sandbox context object scoped to a specific workspace root.
 * All methods are bound to the provided workspaceRoot so callers don't
 * need to pass it on every call.
 *
 * @param {string} workspaceRoot - Absolute path to the workspace directory
 * @param {object} [config={}] - Optional agent config (reserved for future policy knobs)
 * @returns {{
 *   validatePath: (filePath: string) => { allowed: boolean, reason: string },
 *   validateCommand: (command: string, args?: string[]) => { allowed: boolean, reason: string, blocked: boolean, destructive: boolean, network: boolean },
 *   assertPathInWorkspace: (filePath: string) => void,
 *   isPathAllowed: (filePath: string) => boolean,
 *   getWorkspaceRoot: () => string,
 * }}
 */
export function createSandboxContext(workspaceRoot, config = {}) {
  const root = resolve(workspaceRoot);

  return {
    /**
     * Validate a file path against workspace containment and blocked-path rules.
     *
     * @param {string} filePath
     * @returns {{ allowed: boolean, reason: string }}
     */
    validatePath(filePath) {
      return checkPathAccess(filePath, root);
    },

    /**
     * Validate a command against blocked, destructive, and network policies.
     *
     * @param {string} command
     * @param {string[]} [args=[]]
     * @returns {{ allowed: boolean, reason: string, blocked: boolean, destructive: boolean, network: boolean }}
     */
    validateCommand(command, args = []) {
      return checkCommand(command, args);
    },

    /**
     * Assert that a file path is inside the workspace root.
     * Throws a descriptive Error if the path escapes the sandbox.
     *
     * @param {string} filePath
     * @throws {Error}
     */
    assertPathInWorkspace(filePath) {
      assertInWorkspace(filePath, root);
    },

    /**
     * Return true only if the path is inside the workspace and not blocked.
     *
     * @param {string} filePath
     * @returns {boolean}
     */
    isPathAllowed(filePath) {
      return checkPathAccess(filePath, root).allowed;
    },

    /**
     * Return the resolved workspace root this sandbox is scoped to.
     *
     * @returns {string}
     */
    getWorkspaceRoot() {
      return root;
    },
  };
}

/**
 * General-purpose access check for any operation type.
 *
 * Supported operation types:
 *   - 'read'   : read a file path
 *   - 'write'  : write to a file path
 *   - 'exec'   : execute a command (target is the command string)
 *   - 'network': make a network request (target is the URL)
 *
 * @param {'read'|'write'|'exec'|'network'} operation
 * @param {string} target - File path, command string, or URL
 * @param {string} workspaceRoot
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateAccess(operation, target, workspaceRoot) {
  switch (operation) {
    case 'read':
    case 'write': {
      return checkPathAccess(target, workspaceRoot);
    }

    case 'exec': {
      const result = checkCommand(target);
      return { allowed: result.allowed, reason: result.reason };
    }

    case 'network': {
      // Inline local-URL check to avoid a circular dependency with NetworkRequestMonitor
      try {
        const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
        const u = new URL(target);
        if (ALLOWED_HOSTS.has(u.hostname)) {
          return { allowed: true, reason: `Network target "${u.hostname}" is a permitted local host` };
        }
        return {
          allowed: false,
          reason: `POLICY VIOLATION: External network target "${u.hostname}" is blocked. Only local addresses are permitted.`,
        };
      } catch {
        return {
          allowed: false,
          reason: `POLICY VIOLATION: Invalid or non-local URL "${target}" is blocked`,
        };
      }
    }

    default:
      return {
        allowed: false,
        reason: `Unknown operation type "${operation}" — denying by default`,
      };
  }
}
