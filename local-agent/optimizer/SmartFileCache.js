// local-agent/optimizer/SmartFileCache.js
// Phase 26: Smart file cache — cache file contents with LRU eviction

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

export class SmartFileCache {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = join(workspaceRoot, '.local-agent', 'cache', 'files');
    this.cacheIndexFile = join(this.cacheDir, 'cache-index.json');
    this.index = this.loadIndex();
    this.maxCacheSize = 200 * 1024 * 1024; // 200MB
    this.currentSize = this.computeCurrentSize();
  }

  loadIndex() {
    if (existsSync(this.cacheIndexFile)) {
      try { return JSON.parse(readFileSync(this.cacheIndexFile, 'utf8')); } catch { /* ignore */ }
    }
    return { entries: {}, accessOrder: [] };
  }

  saveIndex() {
    try { writeFileSync(this.cacheIndexFile, JSON.stringify(this.index, null, 2)); } catch { /* ignore */ }
  }

  computeCurrentSize() {
    return Object.values(this.index.entries).reduce((sum, e) => sum + (e.size || 0), 0);
  }

  getCached(path) {
    const key = this.makeKey(path);
    const entry = this.index.entries[key];
    if (!entry) return null;

    // Check if file still exists and hasn't changed
    try {
      const stat = statSync(path);
      if (stat.mtimeMs > entry.mtime) {
        this.invalidate(path);
        return null;
      }
    } catch {
      this.invalidate(path);
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);
    return entry.content;
  }

  setCached(path, content) {
    const key = this.makeKey(path);
    const stat = statSync(path);

    const entry = {
      path,
      key,
      content,
      size: Buffer.byteLength(content, 'utf8'),
      mtime: stat.mtimeMs,
      cachedAt: Date.now(),
      ext: extname(path),
    };

    // Evict if necessary
    while (this.currentSize + entry.size > this.maxCacheSize && this.index.accessOrder.length > 0) {
      this.evictLRU();
    }

    this.index.entries[key] = entry;
    this.index.accessOrder.push(key);
    this.currentSize += entry.size;
    this.saveIndex();
  }

  invalidate(path) {
    const key = this.makeKey(path);
    const entry = this.index.entries[key];
    if (entry) {
      this.currentSize -= entry.size;
      delete this.index.entries[key];
      this.index.accessOrder = this.index.accessOrder.filter(k => k !== key);
      this.saveIndex();
    }
  }

  evictLRU() {
    if (this.index.accessOrder.length === 0) return;
    const lruKey = this.index.accessOrder.shift();
    const entry = this.index.entries[lruKey];
    if (entry) {
      this.currentSize -= entry.size;
      delete this.index.entries[lruKey];
    }
  }

  updateAccessOrder(key) {
    this.index.accessOrder = this.index.accessOrder.filter(k => k !== key);
    this.index.accessOrder.push(key);
  }

  makeKey(path) {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36) + '-' + path.length;
  }

  clear() {
    this.index = { entries: {}, accessOrder: [] };
    this.currentSize = 0;
    this.saveIndex();
  }

  getStats() {
    return {
      entries: Object.keys(this.index.entries).length,
      currentSize: this.currentSize,
      maxSize: this.maxCacheSize,
      usagePercent: Math.round((this.currentSize / this.maxCacheSize) * 100),
    };
  }
}

export default SmartFileCache;