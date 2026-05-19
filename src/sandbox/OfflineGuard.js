/**
 * OfflineGuard — enforces offline network policy by intercepting HTTP/HTTPS/fetch/WS calls.
 *
 * Only allows connections to localhost (127.0.0.1, ::1) and port 11434 (Ollama).
 * All other outbound connections are blocked and logged.
 *
 * Usage:
 *   import { OfflineGuard } from './OfflineGuard.js';
 *   const guard = new OfflineGuard({ allowOllama: true });
 *   guard.install();
 *   // ... run agent code ...
 *   guard.uninstall();
 */

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const ALLOWED_PORTS = new Set([11434, 80, 443]);

/** @type {Map<string, { url: string, stack: string, timestamp: string }>} */
const _blockedLog = new Map();
let _logIdCounter = 0;

export class OfflineGuard {
  /**
   * @param {{
   *   allowOllama?: boolean,
   *   allowLocalhost?: boolean,
   *   onBlocked?: (url: string, stack: string) => void,
   *   extraAllowedHosts?: string[],
   *   extraAllowedPorts?: number[],
   * }} options
   */
  constructor({
    allowOllama = true,
    allowLocalhost = true,
    onBlocked = null,
    extraAllowedHosts = [],
    extraAllowedPorts = [],
  } = {}) {
    this.allowOllama = allowOllama;
    this.allowLocalhost = allowLocalhost;
    this.onBlocked = onBlocked;
    this._installed = false;

    /** @type {Set<string>} */
    this._extraAllowedHosts = new Set(extraAllowedHosts);
    /** @type {Set<number>} */
    this._extraAllowedPorts = new Set(extraAllowedPorts);

    // Original references
    this._origFetch = null;
    this._origHttpRequest = null;
    this._origHttpGet = null;
    this._origHttpsRequest = null;
    this._origHttpsGet = null;
    this._origHttpAgent = null;
    this._origHttpsAgent = null;

    this._blockedCount = 0;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Install — monkey-patch global APIs to enforce offline policy.
   * Safe to call multiple times (idempotent).
   */
  install() {
    if (this._installed) return;
    this._installed = true;
    this._blockedCount = 0;
    _blockedLog.clear();
    _logIdCounter = 0;

    // Save originals
    this._origFetch = globalThis.fetch;

    let http = null;
    let https = null;
    try { http = require('http'); } catch {}
    try { https = require('https'); } catch {}

    this._origHttpRequest = http?.request;
    this._origHttpGet = http?.get;
    this._origHttpsRequest = https?.request;
    this._origHttpsGet = https?.get;
    this._origHttpAgent = http?.Agent;
    this._origHttpsAgent = https?.Agent;

    // Patch fetch / XMLHttpRequest
    globalThis.fetch = this._patchedFetch.bind(this);
    globalThis.XMLHttpRequest = this._patchedXMLHttpRequest.bind(this);

    // Patch http/https
    if (http) {
      if (http.request) http.request = this._patchedHttpRequest.bind(this);
      if (http.get) http.get = this._patchedHttpGet.bind(this);
      if (http.Agent) {
        const origAgent = http.Agent;
        http.Agent = class extends origAgent {
          createConnection(...args) {
            const result = super.createConnection(...args);
            const addr = result?.address?.();
            if (addr && !this._guard_isAllowed(addr)) {
              setTimeout(() => {
                try { result.destroy(); } catch {}
              }, 0);
            }
            return result;
          }
          _guard_isAllowed(addr) {
            return (
              _isAllowedHost(this._guard_allowLocalhost, this._guard_extraHosts, addr.address || '') &&
              _isAllowedPort(true, this._guard_extraPorts, addr.port || 80)
            );
          }
        };
        // Attach config onto the class so instances carry it
        http.Agent.prototype._guard_allowLocalhost = this.allowLocalhost;
        http.Agent.prototype._guard_extraHosts = this._extraAllowedHosts;
        http.Agent.prototype._guard_extraPorts = this._extraAllowedPorts;
      }
    }

    if (https) {
      if (https.request) https.request = this._patchedHttpsRequest.bind(this);
      if (https.get) https.get = this._patchedHttpsGet.bind(this);
      if (https.Agent) {
        const origAgent = https.Agent;
        https.Agent = class extends origAgent {
          createConnection(...args) {
            const result = super.createConnection(...args);
            const addr = result?.address?.();
            if (addr && !this._guard_isAllowed(addr)) {
              setTimeout(() => {
                try { result.destroy(); } catch {}
              }, 0);
            }
            return result;
          }
          _guard_isAllowed(addr) {
            return (
              _isAllowedHost(this._guard_allowLocalhost, this._guard_extraHosts, addr.address || '') &&
              _isAllowedPort(true, this._guard_extraPorts, addr.port || 443)
            );
          }
        };
        https.Agent.prototype._guard_allowLocalhost = this.allowLocalhost;
        https.Agent.prototype._guard_extraHosts = this._extraAllowedHosts;
        https.Agent.prototype._guard_extraPorts = this._extraAllowedPorts;
      }
    }
  }

  /**
   * Uninstall — restore original global APIs.
   */
  uninstall() {
    if (!this._installed) return;
    this._installed = false;

    if (this._origFetch) globalThis.fetch = this._origFetch;
    globalThis.XMLHttpRequest = undefined;

    try {
      const http = require('http');
      if (this._origHttpRequest && http) http.request = this._origHttpRequest;
      if (this._origHttpGet && http) http.get = this._origHttpGet;
      if (this._origHttpAgent && http) http.Agent = this._origHttpAgent;
    } catch {}

    try {
      const https = require('https');
      if (this._origHttpsRequest && https) https.request = this._origHttpsRequest;
      if (this._origHttpsGet && https) https.get = this._origHttpsGet;
      if (this._origHttpsAgent && https) https.Agent = this._origHttpsAgent;
    } catch {}
  }

  /** @returns {boolean} */
  isInstalled() {
    return this._installed;
  }

  /** @returns {number} */
  get blockedCount() {
    return this._blockedCount;
  }

  /**
   * Returns a snapshot of all blocked connections so far.
   * @returns {{ id: string, url: string, stack: string, timestamp: string }[]}
   */
  getBlockedLog() {
    return Array.from(_blockedLog.values());
  }

  /**
   * Add a host to the allow-list at runtime.
   * @param {string} host
   */
  allowHost(host) {
    this._extraAllowedHosts.add(host);
  }

  /**
   * Add a port to the allow-list at runtime.
   * @param {number} port
   */
  allowPort(port) {
    this._extraAllowedPorts.add(port);
  }

  // ─── Patch implementations ─────────────────────────────────────────────────

  _patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    const method = (init?.method || 'GET').toUpperCase();

    if (this._isAllowedUrl(url)) {
      return this._origFetch.call(globalThis, input, init);
    }

    this._recordBlocked(`fetch(${method} ${url})`, url, new Error().stack);

    return Promise.reject(
      new Error(`OfflineGuard: outbound fetch blocked — ${method} ${url}`)
    );
  }

  /** @param {any} [input] */
  _patchedXMLHttpRequest(input) {
    // Native XMLHttpRequest — intercept open()
    const OrigXHR = this._origXMLHttpRequest || (() => {
      if (typeof window !== 'undefined' && window.XMLHttpRequest) {
        return window.XMLHttpRequest;
      }
      // In Node env, replace with a mock that always errors
      return class {
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('XMLHttpRequest blocked by OfflineGuard'));
          }, 0);
        }
        open() {}
        send() {}
      };
    })();

    class GuardedXHR extends OrigXHR {
      /** @param {string} method @param {string} url */
      open(method, url, ...rest) {
        if (!_isAllowedUrlStatic(url, true, this._guard_extraHosts || new Set(), this._guard_extraPorts || new Set())) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error(`OfflineGuard: XMLHttpRequest blocked — ${url}`));
            }
          }, 0);
          return;
        }
        super.open(method, url, ...rest);
      }
    }

    const instance = new GuardedXHR();
    // Attach guard config
    instance._guard_extraHosts = this._extraAllowedHosts;
    instance._guard_extraPorts = this._extraAllowedPorts;
    return instance;
  }

  /** @param {string|URL|object} options @param {any} [callback] */
  _patchedHttpRequest(options, callback) {
    const { hostname, host, port, pathname, path, protocol } = this._parseUrlOptions(options);
    const resolvedHost = hostname || host || '';
    const resolvedPort = parseInt(String(port || 80), 10);

    if (_isAllowedHostStatic(resolvedHost, this.allowLocalhost, this._extraAllowedHosts) &&
        _isAllowedPortStatic(resolvedPort, this.allowOllama, this._extraAllowedPorts)) {
      return this._origHttpRequest.call(require('http'), options, callback);
    }

    this._recordBlocked(`http.request(${resolvedHost}:${resolvedPort}${pathname || path || ''})`, `${resolvedHost}:${resolvedPort}`, new Error().stack);

    const err = new Error(`OfflineGuard: outbound http blocked — ${resolvedHost}:${resolvedPort}`);
    const fakeReq = {
      on: () => fakeReq,
      end: () => fakeReq,
      write: () => fakeReq,
      destroy: () => fakeReq,
    };
    setTimeout(() => {
      if (callback) callback(err);
      if (fakeReq.on) fakeReq.on('error', err);
    }, 0);
    return fakeReq;
  }

  /** @param {string|URL|object} options @param {any} [callback] */
  _patchedHttpGet(options, callback) {
    const { hostname, host, port, pathname, path } = this._parseUrlOptions(options);
    const resolvedHost = hostname || host || '';
    const resolvedPort = parseInt(String(port || 80), 10);

    if (_isAllowedHostStatic(resolvedHost, this.allowLocalhost, this._extraAllowedHosts) &&
        _isAllowedPortStatic(resolvedPort, this.allowOllama, this._extraAllowedPorts)) {
      return this._origHttpGet.call(require('http'), options, callback);
    }

    this._recordBlocked(`http.get(${resolvedHost}:${resolvedPort}${pathname || path || ''})`, `${resolvedHost}:${resolvedPort}`, new Error().stack);

    const err = new Error(`OfflineGuard: outbound http.get blocked — ${resolvedHost}:${resolvedPort}`);
    const fakeReq = { on: () => fakeReq, end: () => fakeReq, write: () => fakeReq };
    setTimeout(() => { if (callback) callback(err); }, 0);
    return fakeReq;
  }

  /** @param {string|URL|object} options @param {any} [callback] */
  _patchedHttpsRequest(options, callback) {
    const { hostname, host, port, pathname, path } = this._parseUrlOptions(options);
    const resolvedHost = hostname || host || '';
    const resolvedPort = parseInt(String(port || 443), 10);

    if (_isAllowedHostStatic(resolvedHost, this.allowLocalhost, this._extraAllowedHosts) &&
        _isAllowedPortStatic(resolvedPort, this.allowOllama, this._extraAllowedPorts)) {
      return this._origHttpsRequest.call(require('https'), options, callback);
    }

    this._recordBlocked(`https.request(${resolvedHost}:${resolvedPort}${pathname || path || ''})`, `${resolvedHost}:${resolvedPort}`, new Error().stack);

    const err = new Error(`OfflineGuard: outbound https blocked — ${resolvedHost}:${resolvedPort}`);
    const fakeReq = {
      on: () => fakeReq,
      end: () => fakeReq,
      write: () => fakeReq,
      destroy: () => fakeReq,
    };
    setTimeout(() => {
      if (callback) callback(err);
      if (fakeReq.on) fakeReq.on('error', err);
    }, 0);
    return fakeReq;
  }

  /** @param {string|URL|object} options @param {any} [callback] */
  _patchedHttpsGet(options, callback) {
    const { hostname, host, port, pathname, path } = this._parseUrlOptions(options);
    const resolvedHost = hostname || host || '';
    const resolvedPort = parseInt(String(port || 443), 10);

    if (_isAllowedHostStatic(resolvedHost, this.allowLocalhost, this._extraAllowedHosts) &&
        _isAllowedPortStatic(resolvedPort, this.allowOllama, this._extraAllowedPorts)) {
      return this._origHttpsGet.call(require('https'), options, callback);
    }

    this._recordBlocked(`https.get(${resolvedHost}:${resolvedPort}${pathname || path || ''})`, `${resolvedHost}:${resolvedPort}`, new Error().stack);

    const err = new Error(`OfflineGuard: outbound https.get blocked — ${resolvedHost}:${resolvedPort}`);
    const fakeReq = { on: () => fakeReq, end: () => fakeReq, write: () => fakeReq };
    setTimeout(() => { if (callback) callback(err); }, 0);
    return fakeReq;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * @param {string|URL|object} options
   * @returns {{ hostname: string, host: string, port: string|number, pathname: string, path: string }}
   */
  _parseUrlOptions(options) {
    if (typeof options === 'string') {
      try {
        const u = new URL(options);
        return { hostname: u.hostname, host: u.host, port: u.port, pathname: u.pathname, path: u.pathname, protocol: u.protocol };
      } catch {
        // raw string fallback
        const match = options.match(/^https?:\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/);
        if (match) return { hostname: match[1], host: match[1], port: match[2] || '', pathname: match[3] || '/', path: match[3] || '/', protocol: options.startsWith('https') ? 'https:' : 'http:' };
      }
    }
    if (options instanceof URL) {
      return { hostname: options.hostname, host: options.host, port: options.port, pathname: options.pathname, path: options.pathname, protocol: options.protocol };
    }
    return { hostname: (options && options.hostname) || '', host: (options && options.host) || '', port: (options && options.port) || '', pathname: (options && options.pathname) || '', path: (options && options.path) || '', protocol: (options && options.protocol) || '' };
  }

  _isAllowedUrl(url) {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      return _isAllowedHostStatic(parsed.hostname, this.allowLocalhost, this._extraAllowedHosts) &&
             _isAllowedPortStatic(parseInt(port, 10), this.allowOllama, this._extraAllowedPorts);
    } catch {
      return true;
    }
  }

  /**
   * @param {string} detail
   * @param {string} url
   * @param {string} stack
   */
  _recordBlocked(detail, url, stack) {
    this._blockedCount++;
    const id = `blk_${String(++_logIdCounter).padStart(4, '0')}`;
    const entry = { id, url, stack, timestamp: new Date().toISOString() };
    _blockedLog.set(id, entry);

    const msg = `[${entry.timestamp}] [OfflineGuard] BLOCKED ${detail}`;
    if (process.env.VERBOSE || process.env.OFFLINE_GUARD_VERBOSE) {
      console.warn(msg);
      if (stack) console.warn(stack);
    }

    if (this.onBlocked) {
      this.onBlocked(url, stack);
    }
  }
}

// ─── Static helpers (no instance dependency) ──────────────────────────────

/**
 * @param {string} host
 * @param {boolean} allowLocalhost
 * @param {Set<string>} extraHosts
 * @returns {boolean}
 */
function _isAllowedHostStatic(host, allowLocalhost, extraHosts) {
  if (extraHosts.has(host)) return true;
  if (!allowLocalhost) return false;
  return ALLOWED_HOSTS.has(host);
}

/**
 * @param {number} port
 * @param {boolean} allowOllama
 * @param {Set<number>} extraPorts
 * @returns {boolean}
 */
function _isAllowedPortStatic(port, allowOllama, extraPorts) {
  if (extraPorts.has(port)) return true;
  if (allowOllama && port === 11434) return true;
  return ALLOWED_PORTS.has(port);
}

/**
 * @param {string} url
 * @param {boolean} allowOllama
 * @param {Set<string>} extraHosts
 * @param {Set<number>} extraPorts
 * @returns {boolean}
 */
function _isAllowedUrlStatic(url, allowOllama, extraHosts, extraPorts) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return _isAllowedHostStatic(parsed.hostname, true, extraHosts) &&
           _isAllowedPortStatic(parseInt(port, 10), allowOllama, extraPorts);
  } catch {
    return true;
  }
}

export default OfflineGuard;