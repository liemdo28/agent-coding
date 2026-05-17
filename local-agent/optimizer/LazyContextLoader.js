// local-agent/optimizer/LazyContextLoader.js
// Phase 26: Lazy context loader — load file contents only when needed

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class LazyContextLoader {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.loadedFiles = new Map();
    this.accessCount = new Map();
    this.maxLoadedFiles = 50;
  }

  load(path) {
    const key = this.normalizePath(path);

    if (this.loadedFiles.has(key)) {
      this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
      return this.loadedFiles.get(key);
    }

    if (!existsSync(key)) return null;

    try {
      const content = readFileSync(key, 'utf8');
      this.evictIfNeeded();
      this.loadedFiles.set(key, content);
      this.accessCount.set(key, 1);
      return content;
    } catch {
      return null;
    }
  }

  loadBatch(paths) {
    const results = [];
    for (const path of paths) {
      results.push(this.load(path));
    }
    return results;
  }

  normalizePath(path) {
    if (path.startsWith('/')) return path;
    return join(this.workspaceRoot, path);
  }

  evictIfNeeded() {
    if (this.loadedFiles.size < this.maxLoadedFiles) return;

    // Find least accessed file
    let minAccess = Infinity;
    let lruKey = null;
    for (const [key, count] of this.accessCount) {
      if (count < minAccess) {
        minAccess = count;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.loadedFiles.delete(lruKey);
      this.accessCount.delete(lruKey);
    }
  }

  invalidate(path) {
    const key = this.normalizePath(path);
    this.loadedFiles.delete(key);
    this.accessCount.delete(key);
  }

  clear() {
    this.loadedFiles.clear();
    this.accessCount.clear();
  }

  getStats() {
    return {
      loadedFiles: this.loadedFiles.size,
      maxLoadedFiles: this.maxLoadedFiles,
      totalAccesses: Array.from(this.accessCount.values()).reduce((a, b) => a + b, 0),
    };
  }

  isLoaded(path) {
    return this.loadedFiles.has(this.normalizePath(path));
  }
}

export default LazyContextLoader;