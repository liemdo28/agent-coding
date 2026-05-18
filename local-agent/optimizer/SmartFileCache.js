// optimizer/SmartFileCache.js — LRU in-memory cache for frequently accessed file content
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MAX_BYTES   = 32 * 1024 * 1024; // 32 MB

export class SmartFileCache {
  constructor({ maxEntries = DEFAULT_MAX_ENTRIES, maxBytes = DEFAULT_MAX_BYTES } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes   = maxBytes;
    this._map       = new Map();   // path → { content, size, hits, ts }
    this._bytes     = 0;
  }

  get(path) {
    const entry = this._map.get(path);
    if (!entry) return null;
    entry.hits++;
    entry.ts = Date.now();
    // Refresh LRU position
    this._map.delete(path);
    this._map.set(path, entry);
    return entry.content;
  }

  set(path, content) {
    const size = Buffer.byteLength(content, 'utf8');

    // Don't cache huge individual files
    if (size > this.maxBytes * 0.25) return;

    // Evict LRU if at capacity
    while (
      (this._map.size >= this.maxEntries || this._bytes + size > this.maxBytes) &&
      this._map.size > 0
    ) {
      const oldest = this._map.keys().next().value;
      this._evict(oldest);
    }

    this._map.set(path, { content, size, hits: 1, ts: Date.now() });
    this._bytes += size;
  }

  invalidate(path) { this._evict(path); }

  invalidateAll() { this._map.clear(); this._bytes = 0; }

  stats() {
    return {
      entries:  this._map.size,
      bytes:    this._bytes,
      maxBytes: this.maxBytes,
      usagePct: +((this._bytes / this.maxBytes) * 100).toFixed(1),
    };
  }

  _evict(path) {
    const entry = this._map.get(path);
    if (entry) { this._bytes -= entry.size; this._map.delete(path); }
  }
}
