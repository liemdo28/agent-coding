// optimizer/LargeProjectCoordinator.js — orchestrate optimized scanning for large projects
import { collectFiles, processInParallel } from './ParallelScanner.js';
import { detectChanges, updateManifest }   from './IncrementalIndexer.js';
import { LazyContextLoader }               from './LazyContextLoader.js';
import { SmartFileCache }                  from './SmartFileCache.js';

// Classification thresholds
const THRESHOLDS = { small: 500, medium: 5000 }; // file counts

export class LargeProjectCoordinator {
  constructor(workspaceRoot, opts = {}) {
    this.root     = workspaceRoot;
    this._cache   = new SmartFileCache(opts.cache ?? {});
    this._loader  = new LazyContextLoader({ cache: this._cache });
  }

  /**
   * Classify project size and decide scan strategy.
   * @param {{ extensions?: string[] }} opts
   * @returns {{ size: 'small'|'medium'|'large', fileCount: number, strategy: string }}
   */
  classify(opts = {}) {
    const files     = collectFiles(this.root, opts);
    const fileCount = files.length;
    const size      = fileCount <= THRESHOLDS.small  ? 'small'  :
                      fileCount <= THRESHOLDS.medium ? 'medium' : 'large';
    const strategy  = size === 'small'  ? 'full-scan'         :
                      size === 'medium' ? 'incremental-scan'   : 'parallel-incremental';
    return { size, fileCount, strategy, files };
  }

  /**
   * Run an optimized incremental scan.
   * @param {{ onProgress?: Function, concurrency?: number }} opts
   * @returns {Promise<ScanResult>}
   */
  async scan(opts = {}) {
    const t0               = Date.now();
    const { size, files, strategy } = this.classify();
    const { changed, unchanged, deleted } = detectChanges(this.root, files);

    const results = await processInParallel(
      changed,
      async (f) => { return { path: f, size: (await import('fs')).statSync(f).size }; },
      { concurrency: opts.concurrency ?? 8, onProgress: opts.onProgress }
    );

    if (!opts.dryRun) {
      updateManifest(this.root, changed, deleted);
    }

    const durationMs = Date.now() - t0;
    return {
      strategy,
      projectSize:     size,
      totalFiles:      files.length,
      changedFiles:    changed.length,
      unchangedFiles:  unchanged,
      deletedFiles:    deleted.length,
      processedFiles:  results.filter((r) => !r.error).length,
      errors:          results.filter((r) => r.error).length,
      durationMs,
      cacheStats:      this._cache.stats(),
    };
  }

  /** Get lazy context loader for on-demand file reads */
  getLoader() { return this._loader; }

  /** Benchmark: time a full classify + incremental detect */
  benchmark() {
    const t0 = Date.now();
    const classification = this.classify();
    const { changed } = detectChanges(this.root, classification.files);
    const ms = Date.now() - t0;

    return {
      projectSize:  classification.size,
      totalFiles:   classification.fileCount,
      changedFiles: changed.length,
      benchmarkMs:  ms,
      meetsTarget:  (
        (classification.size === 'small'  && ms < 10_000)  ||
        (classification.size === 'medium' && ms < 60_000)  ||
        (classification.size === 'large'  && ms < 300_000)
      ),
    };
  }
}
