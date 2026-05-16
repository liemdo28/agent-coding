// memory/MemorySanitizer.js - strips secrets from any object before storage

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ── Suspicious key name patterns ────────────────────────────────────────────
const SUSPICIOUS_KEY_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token(?!Count)/i,
  /private[_-]?key/i,
  /auth[_-]?key/i,
  /credential/i,
  /access[_-]?key/i,
  /\.env/i,
  /id_rsa/i,
];

// ── Suspicious value patterns (regex applied to string values) ───────────────
const SUSPICIOUS_VALUE_PATTERNS = [
  // AWS access key IDs (AKIA...)
  /\bAKIA[0-9A-Z]{16}\b/,
  // AWS secret access keys (40-char base64)
  /\b[A-Za-z0-9/+=]{40}\b(?=.*aws|.*AWS)/,
  // OpenAI keys
  /\bsk-[A-Za-z0-9]{20,}\b/,
  // GitHub personal access tokens
  /\bghp_[A-Za-z0-9]{36,}\b/,
  // GitHub OAuth tokens
  /\bgho_[A-Za-z0-9]{36,}\b/,
  // GitHub Actions tokens
  /\bghs_[A-Za-z0-9]{36,}\b/,
  // GitHub refresh tokens
  /\bghr_[A-Za-z0-9]{36,}\b/,
  // Basic auth in URLs
  /https?:\/\/[^:@\s]+:[^@\s]+@/i,
  // Generic long hex secrets (32+ chars)
  /\b[0-9a-f]{32,}\b/i,
  // Generic bearer tokens
  /bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  // Private key PEM blocks
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
  // .env file paths
  /\b\.env(?:\.\w+)?\b/i,
];

/**
 * Check whether a key name looks like it holds a secret.
 *
 * @param {string} key
 * @returns {boolean}
 */
function isSuspiciousKey(key) {
  return SUSPICIOUS_KEY_PATTERNS.some((re) => re.test(key));
}

/**
 * Check whether a string value looks like a secret itself.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isSuspiciousValue(value) {
  if (typeof value !== 'string') return false;
  return SUSPICIOUS_VALUE_PATTERNS.some((re) => re.test(value));
}

/**
 * Recursively walk obj/array and redact any suspicious keys or values.
 *
 * @param {*} obj - any JSON-compatible value
 * @returns {*} sanitized copy
 */
export function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSuspiciousKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitize(value);
      }
    }
    return result;
  }

  if (typeof obj === 'string') {
    if (isSuspiciousValue(obj)) return '[REDACTED]';
    return obj;
  }

  return obj;
}

/**
 * Read a JSON file, sanitize its contents, write back.
 * If the file does not exist, do nothing.
 *
 * @param {string} filePath - absolute path to a .json file
 */
export function sanitizeFile(filePath) {
  if (!existsSync(filePath)) return;
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return; // not valid JSON — leave untouched
  }
  const clean = sanitize(data);
  writeFileSync(filePath, JSON.stringify(clean, null, 2), 'utf8');
}

/**
 * Sanitize all memory JSON files inside <workspaceRoot>/.local-agent/memory/.
 *
 * @param {string} workspaceRoot
 */
export function sanitizeAll(workspaceRoot) {
  const memDir = join(workspaceRoot, '.local-agent', 'memory');
  if (!existsSync(memDir)) return;

  let entries;
  try {
    entries = readdirSync(memDir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    sanitizeFile(join(memDir, name));
  }
}
