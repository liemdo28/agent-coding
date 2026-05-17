// patch/PatchValidator.js - validate patch proposals before applying

import { existsSync, statSync } from 'fs';
import { resolve, extname, normalize } from 'path';

// Folders that must never be patched
const BLOCKED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.astro', '.nuxt',
  'coverage', '.nyc_output', '__pycache__', '.git',
]);

// Files that must never be patched
const BLOCKED_FILENAME_PATTERNS = [
  /^\.env$/,
  /^\.env\.(local|prod|production|staging|development|test)$/i,
  /private[_-]?key/i,
  /credentials/i,
  /\.pem$/,
  /\.key$/,
  /\.pfx$/,
  /\.p12$/,
  /id_rsa|id_ed25519|id_ecdsa/i,
];

// Binary file extensions that must not be patched
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.webm', '.mp3', '.wav', '.ogg',
  '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.sqlite', '.db',
]);

// Patterns signalling high-risk content in a diff
const HIGH_RISK_DIFF_PATTERNS = [
  /(?:password|passwd|secret|api[_-]?key)\s*[:=]/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE KEY/,
  /sk-[A-Za-z0-9]{32,}/,
  /AKIA[0-9A-Z]{16}/,
  /AUTH|auth_token|bearer\s+token/i,
];

// Patterns in file path signalling high-risk
const HIGH_RISK_PATH_PATTERNS = [
  /auth|security|crypto|permission/i,
  /payment|billing|stripe|paypal/i,
  /migration|schema|database/i,
  /secret|credential/i,
];

/**
 * Validate a patch proposal before applying.
 *
 * @param {object} patch - { filePath, patchText, workspaceRoot }
 * @returns {{ valid: boolean, errors: string[], riskLevel: 'low'|'medium'|'high' }}
 */
export function validatePatch(patch) {
  const errors = [];
  let riskLevel = 'low';

  const { filePath, patchText, workspaceRoot } = patch;

  // ── 1. Path must be within workspace ────────────────────────────────────
  const absPath = resolve(workspaceRoot, filePath);
  const absRoot = resolve(workspaceRoot);
  if (!absPath.startsWith(absRoot + '/') && absPath !== absRoot) {
    errors.push(`Path traversal: "${filePath}" escapes workspace root`);
  }

  // ── 2. Blocked directories ───────────────────────────────────────────────
  const parts = normalize(filePath).split(/[/\\]/);
  for (const part of parts) {
    if (BLOCKED_DIRS.has(part)) {
      errors.push(`File is inside blocked directory "${part}"`);
      break;
    }
  }

  // ── 3. Blocked filenames ─────────────────────────────────────────────────
  const basename = parts[parts.length - 1] ?? '';
  for (const re of BLOCKED_FILENAME_PATTERNS) {
    if (re.test(basename)) {
      errors.push(`File "${basename}" is protected and cannot be patched`);
      break;
    }
  }

  // ── 4. Binary file check ─────────────────────────────────────────────────
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXTS.has(ext)) {
    errors.push(`Binary files (${ext}) cannot be patched with unified diffs`);
  }

  // ── 5. Target file must exist ────────────────────────────────────────────
  if (existsSync(absPath)) {
    try {
      const st = statSync(absPath);
      if (!st.isFile()) {
        errors.push(`Target path is not a regular file: ${filePath}`);
      }
    } catch {
      errors.push(`Cannot stat file: ${filePath}`);
    }
  }
  // Note: new files (not yet existing) are allowed — the diff creates them

  // ── 6. Diff must not contain secrets ────────────────────────────────────
  if (patchText) {
    for (const re of HIGH_RISK_DIFF_PATTERNS) {
      if (re.test(patchText)) {
        errors.push(`Diff contains possible secret pattern — patch rejected for security`);
        riskLevel = 'high';
        break;
      }
    }
  }

  // ── 7. Risk level from path ───────────────────────────────────────────────
  if (riskLevel !== 'high') {
    for (const re of HIGH_RISK_PATH_PATTERNS) {
      if (re.test(filePath)) {
        riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
        break;
      }
    }
  }

  // ── 8. Diff size sanity ───────────────────────────────────────────────────
  if (patchText && patchText.length > 500_000) {
    errors.push('Diff is too large (>500 KB) — split into smaller patches');
    riskLevel = 'high';
  }

  return { valid: errors.length === 0, errors, riskLevel };
}

/**
 * Validate a batch of patch proposals. Returns per-patch results.
 */
export function validatePatchBatch(patches) {
  return patches.map((p) => ({
    filePath: p.filePath,
    result: validatePatch(p),
  }));
}
