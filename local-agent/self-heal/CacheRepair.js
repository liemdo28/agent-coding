// local-agent/self-heal/CacheRepair.js
// Phase 24: Cache repair module — detect and repair corrupted/stale caches

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync, rmdirSync } from 'fs';
import { join, basename } from 'path';

export class CacheRepair {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.cacheRoot = join(workspaceRoot, '.local-agent', 'cache');
    this.indexCache = join(this.cacheRoot, 'index');
    this.contextCache = join(this.cacheRoot, 'context');
    this.modelCache = join(this.cacheRoot, 'model');
  }

  async repairCache() {
    const issues = [];
    const repaired = [];

    // Check each cache directory
    for (const cacheDir of [this.cacheRoot, this.indexCache, this.contextCache, this.modelCache]) {
      if (!existsSync(cacheDir)) continue;

      try {
        const files = readdirSync(cacheDir);
        for (const file of files) {
          const filePath = join(cacheDir, file);
          const stat = statSync(filePath);
          
          // Check for zero-size files (likely corrupted)
          if (stat.size === 0) {
            issues.push({ type: 'ZERO_SIZE', path: filePath, file });
            try { unlinkSync(filePath); repaired.push(filePath); } catch { /* ignore */ }
          }

          // Check for oversized cache files
          if (stat.size > 100 * 1024 * 1024) { // > 100MB
            issues.push({ type: 'OVERSIZED', path: filePath, file, size: stat.size });
          }

          // Check for corrupted JSON cache files
          if (file.endsWith('.json') || file.endsWith('.cache')) {
            try {
              const content = readFileSync(filePath, 'utf8');
              JSON.parse(content);
            } catch {
              issues.push({ type: 'CORRUPTED_JSON', path: filePath, file });
              // Backup and remove corrupted cache
              try {
                writeFileSync(filePath + '.broken', content, 'utf8');
                unlinkSync(filePath);
                repaired.push(filePath);
              } catch { /* ignore */ }
            }
          }
        }
      } catch (err) {
        issues.push({ type: 'DIR_ACCESS_ERROR', path: cacheDir, error: err.message });
      }
    }

    return { success: issues.length === 0, issues, repaired, details: [`${repaired.length} cache entries repaired`] };
  }

  async clearCache() {
    const cleared = [];
    const errors = [];

    for (const cacheDir of [this.cacheRoot, this.indexCache, this.contextCache, this.modelCache]) {
      if (!existsSync(cacheDir)) continue;

      try {
        const files = readdirSync(cacheDir);
        for (const file of files) {
          if (file === '.gitkeep') continue; // Preserve gitkeep
          const filePath = join(cacheDir, file);
          try {
            const stat = statSync(filePath);
            if (stat.isDirectory()) {
              // Recursively remove directory
              this.rmrf(filePath);
            } else {
              unlinkSync(filePath);
            }
            cleared.push(filePath);
          } catch (err) {
            errors.push({ path: filePath, error: err.message });
          }
        }
      } catch (err) {
        errors.push({ path: cacheDir, error: err.message });
      }
    }

    // Recreate essential cache directories
    for (const cacheDir of [this.cacheRoot, this.indexCache, this.contextCache, this.modelCache]) {
      try { mkdirSync(cacheDir, { recursive: true }); } catch { /* ignore */ }
      try { writeFileSync(join(cacheDir, '.gitkeep'), ''); } catch { /* ignore */ }
    }

    return {
      success: errors.length === 0,
      clearedCount: cleared.length,
      clearedPaths: cleared.slice(0, 20),
      errors,
      details: [`${cleared.length} cache entries cleared`],
    };
  }

  rmrf(dir) {
    if (!existsSync(dir)) return;
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          this.rmrf(filePath);
          try { rmdirSync(filePath); } catch { /* ignore */ }
        } else {
          try { unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
      try { rmdirSync(dir); } catch { /* ignore */ }
    } catch { /* ignore */ }
  }

  async checkCacheHealth() {
    const report = { healthy: true, issues: [], cacheDirs: [], totalSize: 0, totalEntries: 0 };

    for (const cacheDir of [this.cacheRoot, this.indexCache, this.contextCache, this.modelCache]) {
      if (!existsSync(cacheDir)) {
        report.cacheDirs.push({ dir: cacheDir, exists: false });
        continue;
      }

      let dirSize = 0;
      let entryCount = 0;
      const dirIssues = [];

      try {
        const files = readdirSync(cacheDir);
        for (const file of files) {
          if (file === '.gitkeep') continue;
          const filePath = join(cacheDir, file);
          try {
            const stat = statSync(filePath);
            dirSize += stat.size;
            entryCount++;
            
            if (stat.size === 0) dirIssues.push({ type: 'ZERO_SIZE', file });
            if (stat.size > 50 * 1024 * 1024) dirIssues.push({ type: 'LARGE', file, size: stat.size });
          } catch { /* ignore */ }
        }
      } catch (err) {
        dirIssues.push({ type: 'ACCESS_ERROR', error: err.message });
        report.healthy = false;
      }

      report.cacheDirs.push({ dir: cacheDir, exists: true, size: dirSize, entries: entryCount, issues: dirIssues });
      report.totalSize += dirSize;
      report.totalEntries += entryCount;
      if (dirIssues.length > 0) report.healthy = false;
    }

    return report;
  }
}

export default CacheRepair;