// local-agent/optimizer/IncrementalIndexer.js
// Phase 26: Incremental indexer — only update changed portions of the index

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative } from 'path';

export class IncrementalIndexer {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.workspaceDir = join(workspaceRoot, '.local-agent');
    this.indexFile = join(this.workspaceDir, 'project-map.json');
    this.fingerprintFile = join(this.workspaceDir, 'file-fingerprints.json');
    this.lastIndex = null;
    this.loadLastIndex();
  }

  loadLastIndex() {
    if (existsSync(this.indexFile)) {
      try {
        this.lastIndex = JSON.parse(readFileSync(this.indexFile, 'utf8'));
        this.lastFingerprints = this.loadFingerprints();
      } catch { /* ignore */ }
    }
  }

  loadFingerprints() {
    if (existsSync(this.fingerprintFile)) {
      try { return JSON.parse(readFileSync(this.fingerprintFile, 'utf8')); } catch { /* ignore */ }
    }
    return {};
  }

  saveFingerprints(fingerprints) {
    try { writeFileSync(this.fingerprintFile, JSON.stringify(fingerprints, null, 2)); } catch { /* ignore */ }
  }

  computeFingerprint(filePath) {
    try {
      const stat = statSync(filePath);
      // Use mtime + size + first 1KB hash as fingerprint
      const content = readFileSync(filePath);
      const hash = this.simpleHash(content.slice(0, 1024).toString('utf8'));
      return `${stat.mtimeMs}-${stat.size}-${hash}`;
    } catch {
      return null;
    }
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  findChangedFiles(allFiles, currentFingerprints) {
    const changed = [];
    const unchanged = [];
    const newFiles = [];

    const oldFingerprints = this.lastFingerprints || {};

    for (const file of allFiles) {
      const fp = currentFingerprints[file.path];
      if (!fp) {
        newFiles.push(file);
        continue;
      }

      const oldFp = oldFingerprints[file.path];
      if (oldFp !== fp) {
        changed.push(file);
      } else {
        unchanged.push(file);
      }
    }

    return { changed, unchanged, newFiles };
  }

  async incrementalIndex(scanResult) {
    const currentFingerprints = {};
    const allFiles = scanResult.files || [];

    // Compute fingerprints for all files
    for (const file of allFiles) {
      const fp = this.computeFingerprint(join(this.workspaceRoot, file.path));
      if (fp) currentFingerprints[file.path] = fp;
    }

    // Find changed files
    const { changed, unchanged, newFiles } = this.findChangedFiles(allFiles, currentFingerprints);

    // Update index incrementally
    let index = this.lastIndex || {};
    if (!index.files) index.files = [];

    // Remove changed and new files from index
    index.files = index.files.filter(f => {
      return unchanged.some(u => u.path === f.path);
    });

    // Add changed and new files
    index.files.push(...changed, ...newFiles);

    // Update metadata
    index.scannedAt = new Date().toISOString();
    index.incremental = true;
    index.stats = scanResult.stats;

    // Save
    writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
    this.saveFingerprints(currentFingerprints);
    this.lastIndex = index;
    this.lastFingerprints = currentFingerprints;

    return {
      incremental: true,
      totalFiles: allFiles.length,
      changedFiles: changed.length,
      newFiles: newFiles.length,
      unchangedFiles: unchanged.length,
      indexFile: this.indexFile,
    };
  }

  getIndexStats() {
    return {
      lastIndexed: this.lastIndex?.scannedAt,
      totalFiles: this.lastIndex?.files?.length ?? 0,
      incrementalSupported: true,
    };
  }
}

export default IncrementalIndexer;