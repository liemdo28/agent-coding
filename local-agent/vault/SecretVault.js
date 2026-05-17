// vault/SecretVault.js — local vault: index secret metadata (hashes only, never raw)
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { hashSecret } from './SecretScanner.js';

const VAULT_INDEX  = '.local-agent/vault-index.json';
const VAULT_AUDIT  = '.local-agent/vault-audit.jsonl';

/**
 * Load vault index.
 * @param {string} workspaceRoot
 * @returns {VaultIndex}
 */
export function loadVault(workspaceRoot) {
  const p = join(workspaceRoot, VAULT_INDEX);
  if (!existsSync(p)) return { entries: {}, updatedAt: null };
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { entries: {}, updatedAt: null }; }
}

/**
 * Register a secret reference (hash only — raw value never stored).
 * @param {string} workspaceRoot
 * @param {{ name: string, rawValue?: string, hash?: string, description?: string, file?: string }} entry
 */
export function registerSecret(workspaceRoot, { name, rawValue, hash, description, file }) {
  const vault = loadVault(workspaceRoot);
  const h     = hash ?? (rawValue ? hashSecret(rawValue) : null);
  if (!h) throw new Error('Must provide rawValue or hash');

  vault.entries[name] = {
    name,
    hash: h,
    description: description ?? '',
    file:        file ?? null,
    registeredAt: new Date().toISOString(),
  };
  vault.updatedAt = new Date().toISOString();

  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  writeFileSync(join(workspaceRoot, VAULT_INDEX), JSON.stringify(vault, null, 2));
  _audit(workspaceRoot, 'register', { name, hash: h });
}

/**
 * Audit log entry for vault actions.
 * @param {string} workspaceRoot
 * @param {string} action
 * @param {object} meta — must not contain raw secret values
 */
export function _audit(workspaceRoot, action, meta = {}) {
  const entry = { ts: new Date().toISOString(), action, ...meta };
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  appendFileSync(join(workspaceRoot, VAULT_AUDIT), JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Read vault audit log.
 * @param {string} workspaceRoot
 * @param {{ limit?: number }} opts
 * @returns {object[]}
 */
export function readVaultAudit(workspaceRoot, { limit = 50 } = {}) {
  const p = join(workspaceRoot, VAULT_AUDIT);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    .slice(-limit);
}
