// vault/SecretScanner.js — scan workspace files for accidentally exposed secrets
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { createHash } from 'crypto';

const PATTERNS = [
  { name: 'api_key',       pattern: /["']?(?:api[_-]?key)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-]{16,})["']?/gi },
  { name: 'access_token',  pattern: /["']?(?:access[_-]?token)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-\.]{16,})["']?/gi },
  { name: 'secret_key',    pattern: /["']?(?:secret[_-]?key)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-]{16,})["']?/gi },
  { name: 'password',      pattern: /["']?password["']?\s*[:=]\s*["']?(\S{8,})["']?/gi },
  { name: 'private_key',   pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'bearer_token',  pattern: /Bearer\s+([A-Za-z0-9_\-\.]{20,})/gi },
  { name: 'aws_access',    pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'github_token',  pattern: /gh[pousr]_[A-Za-z0-9]{36}/g },
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.local-agent']);
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf']);
const MAX_FILE_SIZE = 512 * 1024; // 512 KB

/**
 * Hash a secret value (never store raw).
 * @param {string} value
 * @returns {string}
 */
export function hashSecret(value) {
  return 'sha256:' + createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Scan a workspace for leaked secrets.
 * @param {string} workspaceRoot
 * @param {{ ignore?: string[] }} opts
 * @returns {ScanResult}
 */
export function scanForSecrets(workspaceRoot, opts = {}) {
  const extraSkip = new Set(opts.ignore ?? []);
  const findings  = [];

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name) || extraSkip.has(name)) continue;
      const abs = join(dir, name);
      let stat;
      try { stat = statSync(abs); } catch { continue; }

      if (stat.isDirectory()) { walk(abs); continue; }
      if (!stat.isFile()) continue;
      if (SKIP_EXTS.has(extname(name).toLowerCase())) continue;
      if (stat.size > MAX_FILE_SIZE) continue;

      let content;
      try { content = readFileSync(abs, 'utf8'); } catch { continue; }

      const relPath = relative(workspaceRoot, abs);

      for (const { name: secretType, pattern } of PATTERNS) {
        const re = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = re.exec(content)) !== null) {
          const lineNo = content.slice(0, match.index).split('\n').length;
          // Only record hash, never raw value
          const rawVal = match[1] ?? match[0];
          findings.push({
            file:       relPath,
            line:       lineNo,
            secretType,
            hash:       hashSecret(rawVal),
            snippet:    `...${match[0].slice(0, 30).replace(/["']/g, '')}...`,
          });
        }
      }
    }
  }

  walk(workspaceRoot);
  return { findings, count: findings.length, scanned: workspaceRoot };
}
