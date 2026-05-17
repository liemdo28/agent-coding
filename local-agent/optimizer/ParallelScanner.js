// local-agent/optimizer/ParallelScanner.js
// Phase 26: Parallel scanner — scan large projects with concurrency control

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';

export class ParallelScanner {
  constructor(workspaceRoot, options = {}) {
    this.workspaceRoot = workspaceRoot;
    this.maxConcurrency = options.maxConcurrency || 4;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.ignorePatterns = options.ignorePatterns || ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'];
  }

  async scan(patterns = ['**/*']) {
    const startTime = Date.now();
    const allFiles = [];

    // Phase 1: Quick directory listing (single-threaded)
    const files = this.listFilesSync(this.workspaceRoot, patterns);

    // Phase 2: Parallel content read for small files
    const chunks = this.chunkArray(files, this.maxConcurrency);
    const results = await Promise.all(
      chunks.map(chunk => this.processChunk(chunk))
    );

    for (const result of results) {
      allFiles.push(...result);
    }

    const duration = Date.now() - startTime;

    return {
      files: allFiles,
      stats: {
        totalFiles: allFiles.length,
        totalSize: allFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        scanDurationMs: duration,
        averageFileMs: duration / allFiles.length,
      },
    };
  }

  listFilesSync(root, patterns) {
    const files = [];
    const dirs = [root];

    while (dirs.length > 0) {
      const dir = dirs.pop();
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              if (!this.shouldIgnore(entry)) {
                dirs.push(fullPath);
              }
            } else if (stat.isFile()) {
              if (!this.shouldIgnore(entry)) {
                files.push({
                  path: fullPath,
                  relPath: fullPath.replace(root + '/', '').replace(root + '\\', ''),
                  size: stat.size,
                  ext: extname(entry),
                  mtime: stat.mtimeMs,
                });
              }
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    return files;
  }

  shouldIgnore(name) {
    return this.ignorePatterns.some(p => name === p || name.startsWith('.'));
  }

  async processChunk(files) {
    const results = [];
    for (const file of files) {
      try {
        if (file.size <= this.maxFileSize) {
          const content = readFileSync(file.path, 'utf8');
          results.push({ ...file, content, hasContent: true });
        } else {
          results.push({ ...file, content: null, hasContent: false, skipped: 'TOO_LARGE' });
        }
      } catch {
        results.push({ ...file, content: null, hasContent: false, skipped: 'READ_ERROR' });
      }
    }
    return results;
  }

  chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  estimateScanTime(fileCount) {
    const perFileMs = 0.5;
    const overheadMs = 500;
    return Math.round(fileCount * perFileMs + overheadMs);
  }

  getProjectSize(files) {
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (totalSize < 1024 * 1024) return 'SMALL';
    if (totalSize < 100 * 1024 * 1024) return 'MEDIUM';
    if (totalSize < 1024 * 1024 * 1024) return 'LARGE';
    return 'VERY_LARGE';
  }
}

export default ParallelScanner;