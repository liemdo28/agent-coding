// OfflineGuard.js — enforces offline-only policy, blocks internet calls
// Policy: NO internet, NO cloud, NO telemetry, NO external API

const BLOCKED_PATTERNS = [
  /fetch\s*\(/,
  /axios\s*[.(]/,
  /require\s*\(\s*['"]axios['"]\s*\)/,
  /require\s*\(\s*['"]node-fetch['"]\s*\)/,
  /import\s+.*from\s+['"]axios['"]/,
  /import\s+.*from\s+['"]node-fetch['"]/,
  /openai/i,
  /anthropic/i,
  /googleapis/i,
  /firebase/i,
  /supabase/i,
  /aws-sdk/i,
];

const BLOCKED_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'googleapis.com',
  'firebase.io',
  'supabase.co',
  'amazonaws.com',
];

export function checkOfflinePolicy(sourceCode, filename = '') {
  const violations = [];
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sourceCode)) {
      violations.push({ file: filename, pattern: pattern.source, severity: 'critical' });
    }
  }
  return violations;
}

export function assertOffline() {
  // Override global fetch to throw if called
  if (typeof globalThis.fetch !== 'undefined') {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function(url, ...args) {
      const urlStr = String(url);
      const isLocal = urlStr.startsWith('http://127.0.0.1') || urlStr.startsWith('http://localhost') || urlStr.startsWith('http://0.0.0.0');
      if (!isLocal) {
        throw new Error(`[OfflineGuard] BLOCKED internet request to: ${urlStr}`);
      }
      return originalFetch(url, ...args);
    };
  }
}

export function isOfflineCompliant(sourceCode) {
  return checkOfflinePolicy(sourceCode).length === 0;
}

export { BLOCKED_PATTERNS, BLOCKED_HOSTS };
