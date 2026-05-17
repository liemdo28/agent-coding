// optimizer/LazyContextLoader.js — load file context on-demand, batch prefetch neighbors
import { readFileSync, existsSync } from 'fs';
import { SmartFileCache }           from './SmartFileCache.js';

export class LazyContextLoader {
  constructor({ cache } = {}) {
    this._cache    = cache ?? new SmartFileCache();
    this._pending  = new Set();
    this._prefetch = [];
  }

  /**
   * Read a file, using cache if available.
   * @param {string} absPath
   * @returns {string|null} content or null if unreadable
   */
  read(absPath) {
    const cached = this._cache.get(absPath);
    if (cached !== null) return cached;

    try {
      const content = readFileSync(absPath, 'utf8');
      this._cache.set(absPath, content);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Queue files for background prefetch (non-blocking).
   * @param {string[]} paths
   */
  prefetch(paths) {
    for (const p of paths) {
      if (!this._pending.has(p)) {
        this._pending.add(p);
        this._prefetch.push(p);
      }
    }
    // Drain prefetch queue asynchronously
    setImmediate(() => this._drainPrefetch());
  }

  /**
   * Read multiple files, returning a map of path → content.
   * @param {string[]} paths
   * @returns {Map<string, string>}
   */
  readBatch(paths) {
    const result = new Map();
    for (const p of paths) {
      const content = this.read(p);
      if (content !== null) result.set(p, content);
    }
    return result;
  }

  /** Invalidate a file so it is re-read next access */
  invalidate(path) { this._cache.invalidate(path); }

  stats() { return this._cache.stats(); }

  _drainPrefetch() {
    const batch = this._prefetch.splice(0, 20);
    for (const p of batch) {
      if (existsSync(p) && this._cache.get(p) === null) {
        try {
          const content = readFileSync(p, 'utf8');
          this._cache.set(p, content);
        } catch { /* skip */ }
      }
      this._pending.delete(p);
    }
    if (this._prefetch.length > 0) setImmediate(() => this._drainPrefetch());
  }
}
