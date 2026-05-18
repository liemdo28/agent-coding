// rbac/RBACManager.js — local multi-user role-based access control
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const RBAC_FILE  = '.local-agent/rbac.json';
const RBAC_AUDIT = '.local-agent/rbac-audit.jsonl';

// Role hierarchy (higher index = more privileged)
const ROLE_LEVELS = { viewer: 0, qa: 1, dev: 2, senior_dev: 3, admin: 4, ceo: 5 };

const ROLE_PERMISSIONS = {
  viewer:     ['read:status', 'read:reports'],
  qa:         ['read:status', 'read:reports', 'run:qa', 'read:patches'],
  dev:        ['read:status', 'read:reports', 'run:qa', 'read:patches', 'write:patches', 'read:memory'],
  senior_dev: ['read:status', 'read:reports', 'run:qa', 'read:patches', 'write:patches',
               'read:memory', 'approve:patch', 'export:reports'],
  admin:      ['read:status', 'read:reports', 'run:qa', 'read:patches', 'write:patches',
               'read:memory', 'approve:patch', 'export:reports',
               'clear:memory', 'modify:governance', 'access:vault', 'manage:plugins'],
  ceo:        ['*'],  // all permissions
};

export function loadRBAC(workspaceRoot) {
  const p = join(workspaceRoot, RBAC_FILE);
  if (!existsSync(p)) return { users: {}, updatedAt: null };
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { users: {}, updatedAt: null }; }
}

function saveRBAC(workspaceRoot, rbac) {
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  rbac.updatedAt = new Date().toISOString();
  writeFileSync(join(workspaceRoot, RBAC_FILE), JSON.stringify(rbac, null, 2));
}

/**
 * Assign a role to a user (local username).
 * @param {string} workspaceRoot
 * @param {string} username
 * @param {string} role
 */
export function assignRole(workspaceRoot, username, role) {
  if (!(role in ROLE_LEVELS)) throw new Error(`Unknown role: ${role}. Valid: ${Object.keys(ROLE_LEVELS).join(', ')}`);
  const rbac = loadRBAC(workspaceRoot);
  rbac.users[username] = { username, role, assignedAt: new Date().toISOString() };
  saveRBAC(workspaceRoot, rbac);
  _audit(workspaceRoot, 'assign_role', { username, role });
  return rbac.users[username];
}

/**
 * Check if a user has a specific permission.
 * @param {string} workspaceRoot
 * @param {string} username
 * @param {string} permission
 * @returns {{ allowed: boolean, role: string|null }}
 */
export function checkPermission(workspaceRoot, username, permission) {
  const rbac = loadRBAC(workspaceRoot);
  const user = rbac.users[username];
  if (!user) return { allowed: false, role: null };

  const perms = ROLE_PERMISSIONS[user.role] ?? [];
  const allowed = perms.includes('*') || perms.includes(permission);
  return { allowed, role: user.role };
}

/**
 * List all users with their roles.
 * @param {string} workspaceRoot
 * @returns {UserEntry[]}
 */
export function listUsers(workspaceRoot) {
  const rbac = loadRBAC(workspaceRoot);
  return Object.values(rbac.users).map((u) => ({
    ...u,
    permissions: ROLE_PERMISSIONS[u.role] ?? [],
    level: ROLE_LEVELS[u.role] ?? 0,
  }));
}

/**
 * Get available roles and their permissions.
 * @returns {object}
 */
export function getRoleDefinitions() {
  return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
    role,
    level: ROLE_LEVELS[role],
    permissions,
  }));
}

export function readAccessAudit(workspaceRoot, { limit = 50 } = {}) {
  const p = join(workspaceRoot, RBAC_AUDIT);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).slice(-limit);
}

function _audit(workspaceRoot, action, meta = {}) {
  const entry = { ts: new Date().toISOString(), action, ...meta };
  mkdirSync(join(workspaceRoot, '.local-agent'), { recursive: true });
  appendFileSync(join(workspaceRoot, RBAC_AUDIT), JSON.stringify(entry) + '\n', 'utf8');
}
