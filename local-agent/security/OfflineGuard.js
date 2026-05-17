// security/OfflineGuard.js - offline mode enforcement and LLM endpoint validation
import { join, resolve } from 'path';

/**
 * Set of allowed hostnames for LLM endpoints and any local network calls.
 * Only loopback / local addresses are permitted.
 */
export const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/**
 * Check whether a URL points to an allowed local host.
 *
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isLocalUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Assert that a URL is local.
 * Throws a policy-violation error if the URL targets an external host.
 *
 * @param {string} urlStr
 * @throws {Error} POLICY VIOLATION if the host is not in ALLOWED_HOSTS
 */
export function assertLocalUrl(urlStr) {
  if (!isLocalUrl(urlStr)) {
    let host = urlStr;
    try {
      host = new URL(urlStr).hostname;
    } catch {
      // use raw string as host label
    }
    throw new Error(
      `POLICY VIOLATION: External URL blocked. Host "${host}" is not in the allowed list (${[...ALLOWED_HOSTS].join(', ')}). This agent operates offline only.`
    );
  }
}

/**
 * Verify that an agent config object satisfies offline policy requirements.
 *
 * @param {object} config
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function verifyConfig(config) {
  const violations = [];

  if (config.offline !== true) {
    violations.push('config.offline must be true');
  }

  if (config.telemetry !== false) {
    violations.push('config.telemetry must be false');
  }

  if (config.cloudSync !== false) {
    violations.push('config.cloudSync must be false');
  }

  if (config.llm?.offlineOnly !== true) {
    violations.push('config.llm.offlineOnly must be true');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validate that the LLM base URL is a local endpoint.
 *
 * @param {string} baseUrl
 * @returns {{ ok: boolean, reason: string }}
 */
export function checkLLMEndpoint(baseUrl) {
  if (!baseUrl || baseUrl.trim() === '') {
    return { ok: false, reason: 'LLM baseUrl is not configured' };
  }

  if (isLocalUrl(baseUrl)) {
    let host;
    try {
      host = new URL(baseUrl).hostname;
    } catch {
      host = baseUrl;
    }
    return { ok: true, reason: `LLM endpoint "${host}" is a permitted local address` };
  }

  let host = baseUrl;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    // use raw string
  }

  return {
    ok: false,
    reason: `LLM endpoint "${host}" is an external address — only ${[...ALLOWED_HOSTS].join(', ')} are allowed`,
  };
}

/**
 * Generate a comprehensive offline status report for a workspace.
 *
 * @param {string} workspaceRoot
 * @param {object} config - Loaded agent config
 * @returns {{
 *   offline: boolean,
 *   telemetryDisabled: boolean,
 *   cloudSyncDisabled: boolean,
 *   llmLocal: boolean,
 *   llmEndpoint: string,
 *   allPassed: boolean,
 *   violations: string[],
 * }}
 */
export function generateOfflineStatus(workspaceRoot, config) {
  const violations = [];

  const offline = config.offline === true;
  if (!offline) violations.push('Offline mode is not enabled (config.offline !== true)');

  const telemetryDisabled = config.telemetry === false;
  if (!telemetryDisabled) violations.push('Telemetry is not disabled (config.telemetry !== false)');

  const cloudSyncDisabled = config.cloudSync === false;
  if (!cloudSyncDisabled) violations.push('Cloud sync is not disabled (config.cloudSync !== false)');

  const llmEndpoint = config.llm?.baseUrl ?? '';
  const llmEndpointCheck = checkLLMEndpoint(llmEndpoint);
  const llmLocal = llmEndpointCheck.ok;
  if (!llmLocal) violations.push(`LLM endpoint is not local: ${llmEndpointCheck.reason}`);

  if (config.llm?.offlineOnly !== true) {
    violations.push('LLM offlineOnly flag is not set (config.llm.offlineOnly !== true)');
  }

  return {
    offline,
    telemetryDisabled,
    cloudSyncDisabled,
    llmLocal,
    llmEndpoint,
    allPassed: violations.length === 0,
    violations,
  };
}
