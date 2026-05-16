// debug/RetryPlanner.js - decide whether and how to retry a failed fix

/**
 * Track retry state across loops within a single QA session.
 */
export class RetryPlanner {
  constructor(config = {}) {
    this.maxLoops         = config.maxRetryLoops            ?? 3;
    this.maxFilesPerLoop  = config.maxFilesChangedPerLoop   ?? 10;
    this.maxPatchRisk     = config.maxPatchRisk             ?? 0.75;
    this.requireApproval  = config.requireApprovalForHighRisk ?? true;

    this._loop           = 0;
    this._seen           = new Set(); // fingerprints of error messages
    this._history        = [];        // per-loop summary
  }

  get currentLoop() { return this._loop; }
  get exhausted()   { return this._loop >= this.maxLoops; }

  /**
   * Evaluate whether another retry loop should run.
   *
   * @param {object} runResult - Latest build/test result
   * @param {object} classification - From FailureClassifier
   * @param {number} regressionRisk
   * @returns {{ shouldRetry, reason, loop }}
   */
  evaluate(runResult, classification, regressionRisk = 0) {
    if (!classification.hasFailures) {
      return { shouldRetry: false, reason: 'All checks passed — no retry needed', loop: this._loop };
    }

    if (this.exhausted) {
      return { shouldRetry: false, reason: `Max retry loops (${this.maxLoops}) reached`, loop: this._loop };
    }

    // Detect repeat failures (same error fingerprint)
    const fingerprint = this._errorFingerprint(classification);
    if (this._seen.has(fingerprint)) {
      return {
        shouldRetry: false,
        reason: 'Same failure pattern repeated — patch had no effect, stopping to avoid loop',
        loop: this._loop,
      };
    }

    // Stop if regression risk is too high
    if (regressionRisk > 0.7) {
      return {
        shouldRetry: false,
        reason: `Regression risk ${regressionRisk} is too high — stopping retry`,
        loop: this._loop,
      };
    }

    // Stop for high-risk error types
    const stopTypes = ['AUTH_ERROR', 'DATABASE_ERROR', 'DEPLOYMENT_ERROR'];
    for (const t of stopTypes) {
      if (classification.groups[t]?.length > 0) {
        return {
          shouldRetry: false,
          reason: `Auto-retry blocked: ${t} requires human review`,
          loop: this._loop,
        };
      }
    }

    return { shouldRetry: true, reason: `Retry loop ${this._loop + 1}/${this.maxLoops}`, loop: this._loop };
  }

  /**
   * Record starting a retry loop.
   */
  beginLoop(errorSummary, classification) {
    this._loop++;
    this._seen.add(this._errorFingerprint(classification));
    this._history.push({
      loop: this._loop,
      startedAt: new Date().toISOString(),
      errorTypes: Object.keys(classification.groups ?? {}),
      errorCount: errorSummary?.length ?? 0,
    });
  }

  /**
   * Record the outcome of a loop.
   */
  endLoop(patchResults, runResult) {
    const last = this._history[this._history.length - 1];
    if (last) {
      last.endedAt     = new Date().toISOString();
      last.patchCount  = patchResults?.applied ?? 0;
      last.buildPassed = runResult?.buildResult?.success ?? false;
      last.testPassed  = runResult?.testResult?.success  ?? false;
    }
  }

  get history() { return this._history; }

  _errorFingerprint(classification) {
    // Stable key: sorted error type names + first message of dominant type
    const types = Object.keys(classification.groups ?? {}).sort().join(',');
    const firstMsg = classification.groups?.[classification.dominant]?.[0]?.message?.slice(0, 60) ?? '';
    return `${types}::${firstMsg}`;
  }
}
