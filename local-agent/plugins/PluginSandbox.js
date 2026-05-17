// plugins/PluginSandbox.js — restricted execution context for plugins
// Plugins run in a limited context: no process.env access, no network, no require outside workspace.
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve }               from 'path';

const BLOCKED_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'eval', 'Function'];

/**
 * Build a sandboxed context object for a plugin.
 * The plugin receives this context via its exported init(ctx) function.
 *
 * @param {string} workspaceRoot
 * @param {string[]} grantedPermissions
 * @param {{ logger?: object }} opts
 * @returns {PluginContext}
 */
export function buildSandboxContext(workspaceRoot, grantedPermissions, opts = {}) {
  const perms  = new Set(grantedPermissions);
  const logger = opts.logger ?? console;

  function guardPath(relPath) {
    const abs = resolve(join(workspaceRoot, relPath));
    if (!abs.startsWith(workspaceRoot)) throw new Error('Path traversal denied');
    return abs;
  }

  function safeReadFile(relPath) {
    if (!perms.has('read:workspace')) throw new Error('Permission denied: read:workspace');
    return readFileSync(guardPath(relPath), 'utf8');
  }

  function safeWriteFile(relPath, content) {
    if (!perms.has('write:workspace')) throw new Error('Permission denied: write:workspace');
    writeFileSync(guardPath(relPath), content, 'utf8');
  }

  const ctx = {
    workspaceRoot,
    permissions: [...perms],
    fs:  { readFile: safeReadFile, writeFile: safeWriteFile },
    log: {
      info:  (msg) => logger.log   ? logger.log(`[plugin] ${msg}`)   : console.log(`[plugin] ${msg}`),
      warn:  (msg) => logger.warn  ? logger.warn(`[plugin] ${msg}`)  : console.warn(`[plugin] ${msg}`),
      error: (msg) => logger.error ? logger.error(`[plugin] ${msg}`) : console.error(`[plugin] ${msg}`),
    },
  };

  // Blocked network / dangerous globals — throw on access
  for (const g of BLOCKED_GLOBALS) {
    Object.defineProperty(ctx, g, {
      get() { throw new Error(`${g} is blocked in plugin sandbox (offline policy)`); },
      enumerable: false,
    });
  }

  return ctx;
}
