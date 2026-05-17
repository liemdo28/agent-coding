// security/NetworkRequestMonitor.js - intercept and validate all network requests
import { resolve } from 'path';

/**
 * Allowed local hostnames/addresses for LLM endpoints and any in-process HTTP calls.
 */
export const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/**
 * Known external service domains that must never be contacted by the agent.
 */
export const BLOCKED_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'github.com',
  'npmjs.com',
  'googleapis.com',
  'registry.npmjs.org',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
];

/**
 * Determine whether a URL targets a permitted local address.
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
 * Determine whether a URL targets a known blocked external domain.
 * Also matches sub-domains (e.g. api.foo.googleapis.com matches googleapis.com).
 *
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isBlockedDomain(urlStr) {
  let hostname;
  try {
    hostname = new URL(urlStr).hostname.toLowerCase();
  } catch {
    return false;
  }

  return BLOCKED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith('.' + domain)
  );
}

/**
 * Validate a URL against the offline policy.
 *
 * @param {string} urlStr
 * @returns {{ allowed: boolean, reason: string, isLocal: boolean }}
 */
export function validateUrl(urlStr) {
  let hostname;
  try {
    hostname = new URL(urlStr).hostname.toLowerCase();
  } catch {
    return {
      allowed: false,
      reason: `Invalid URL: "${urlStr}"`,
      isLocal: false,
    };
  }

  if (ALLOWED_HOSTS.has(hostname)) {
    return {
      allowed: true,
      reason: `Host "${hostname}" is a permitted local address`,
      isLocal: true,
    };
  }

  if (isBlockedDomain(urlStr)) {
    return {
      allowed: false,
      reason: `POLICY VIOLATION: Domain "${hostname}" is in the blocked-domains list. This agent operates fully offline.`,
      isLocal: false,
    };
  }

  // Any other external host is also disallowed
  return {
    allowed: false,
    reason: `POLICY VIOLATION: External host "${hostname}" is not in the allowed-hosts list (${[...ALLOWED_HOSTS].join(', ')}). This agent operates fully offline.`,
    isLocal: false,
  };
}

/**
 * Guard function used before making any outbound HTTP/HTTPS call.
 * Throws immediately if the URL is not a local address.
 *
 * @param {string} urlStr
 * @throws {Error} POLICY VIOLATION if the URL is external
 */
export function blockExternalUrl(urlStr) {
  const { allowed, reason } = validateUrl(urlStr);
  if (!allowed) {
    throw new Error(reason);
  }
}

/**
 * A drop-in wrapper around the global `fetch` that enforces the offline policy.
 * Any request to an external URL is rejected before a connection attempt is made.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 * @throws {Error} POLICY VIOLATION if the URL is not local
 */
export async function monitoredFetch(url, options = {}) {
  const urlStr = url instanceof URL ? url.toString() : String(url);

  // Validate before touching the network
  blockExternalUrl(urlStr);

  // At this point the URL is verified local — proceed with the real fetch
  return fetch(urlStr, options);
}
