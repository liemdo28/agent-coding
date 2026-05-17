// local-agent/optimizer/LargeProjectCoordinator.js
// Phase 26: Large project coordinator — orchestrates optimization for large projects

import { IncrementalIndexer } from './IncrementalIndexer.js';
import { ParallelScanner } from './ParallelScanner.js';
import { LazyContextLoader } from './LazyContextLoader.js';
import { SmartFileCache } from './SmartFileCache.js';

export class LargeProjectCoordinator {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.indexer = new IncrementalIndexer(workspaceRoot);
    this.scanner = new ParallelScanner(workspaceRoot);
    this.contextLoader = new LazyContextLoader(workspaceRoot);
    this.fileCache = new SmartFileCache(workspaceRoot);
    this.lastScanStats = null;
  }

  async scan() {
    const startTime = Date.now();
    const projectSize = this.detectProjectSize();

    let result;
    if (projectSize === 'SMALL') {
      result = await this.scanSmall();
    } else if (projectSize === 'MEDIUM') {
      result = await this.scanMedium();
    } else {
      result = await this.scanLarge();
    }

    const duration = Date.now() - startTime;
    this.lastScanStats = {
      ...result,
      durationMs: duration,
      projectSize,
    };

    return this.lastScanStats;
  }

  async scanSmall() {
    const result = await this.scanner.scan();
    return {
      ...result,
      mode: 'full',
      incremental: false,
    };
  }

  async scanMedium() {
    // Use incremental if possible
    const indexStats = this.indexer.getIndexStats();
    if (indexStats.lastIndexed) {
      // Incremental scan
      const scanResult = await this.scanner.scan();
      const indexResult = await this.indexer.incrementalIndex(scanResult);
      return {
        ...scanResult,
        mode: 'incremental',
        incremental: true,
        ...indexResult,
      };
    }
    return this.scanSmall();
  }

  async scanLarge() {
    // Always incremental for large projects
    const scanResult = await this.scanner.scan();
    const indexResult = await this.indexer.incrementalIndex(scanResult);
    return {
      ...scanResult,
      mode: 'incremental',
      incremental: true,
      ...indexResult,
    };
  }

  detectProjectSize() {
    const indexStats = this.indexer.getIndexStats();
    const fileCount = indexStats.totalFiles;
    if (fileCount === 0) {
      // Estimate based on directories
      return 'MEDIUM';
    }
    if (fileCount < 1000) return 'SMALL';
    if (fileCount < 10000) return 'MEDIUM';
    return 'LARGE';
  }

  async loadContext(paths) {
    return this.contextLoader.loadBatch(paths);
  }

  async clearCaches() {
    this.contextLoader.clear();
    this.fileCache.clear();
  }

  getStats() {
    return {
      projectSize: this.lastScanStats?.projectSize || this.detectProjectSize(),
      lastScan: this.lastScanStats,
      indexer: this.indexer.getIndexStats(),
      contextLoader: this.contextLoader.getStats(),
      fileCache: this.fileCache.getStats(),
    };
  }

  getPerformanceTargets() {
    return {
      SMALL_PROJECT_SCAN_MS: 10000,
      MEDIUM_PROJECT_SCAN_MS: 60000,
      LARGE_MONOREPO_INCREMENTAL_MS: 300000,
    };
  }
}

export default LargeProjectCoordinator;