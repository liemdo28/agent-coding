// rootcause/regressionTracer.js — identifies which patch introduced a regression
// Phase 13: binary-search style analysis over patch history

/**
 * Trace which patch introduced a regression using binary search over patch history.
 * @param {string} failingTest  test name or identifier
 * @param {Array<{ id: string, appliedAt: string, files: string[], testResults?: object }>} patchHistory
 * @returns {{ patch: object|null, confidence: number, evidence: string[] }}
 */
export function traceRegression(failingTest, patchHistory) {
  if (!patchHistory || patchHistory.length === 0) {
    return { patch: null, confidence: 0, evidence: ['No patch history available'] };
  }

  // Sort patches chronologically
  const sorted = [...patchHistory].sort((a, b) =>
    new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime()
  );

  // Binary search: find first patch where test started failing
  let lo = 0, hi = sorted.length - 1;
  let candidate = null;

  while (lo <= hi) {
    const mid    = Math.floor((lo + hi) / 2);
    const patch  = sorted[mid];
    const passed = testPassedAtPatch(failingTest, patch);

    if (!passed) {
      candidate = patch;
      hi = mid - 1; // look earlier
    } else {
      lo = mid + 1;
    }
  }

  if (!candidate) {
    return { patch: null, confidence: 0.3, evidence: ['Could not isolate regression with available data'] };
  }

  const evidence = [
    `Regression first detected at patch: ${candidate.id}`,
    `Applied at: ${candidate.appliedAt}`,
    `Files changed: ${(candidate.files ?? []).join(', ') || 'unknown'}`,
  ];

  return { patch: candidate, confidence: 0.75, evidence };
}

/**
 * Given test result snapshots for each patch, find the patch that broke a test.
 * @param {Array<{ patchId: string, results: Record<string, boolean> }>} testResults
 * @param {object[]} patches
 * @returns {{ patch: object|null, confidence: number, evidence: string[] }}
 */
export function findRegressionPatch(testResults, patches) {
  if (!testResults || testResults.length === 0) {
    return { patch: null, confidence: 0, evidence: ['No test result snapshots provided'] };
  }

  for (let i = 1; i < testResults.length; i++) {
    const prev    = testResults[i - 1];
    const current = testResults[i];

    for (const [testName, passed] of Object.entries(current.results ?? {})) {
      const wasPassing = prev.results?.[testName] !== false;
      if (wasPassing && !passed) {
        const patch = patches.find(p => p.id === current.patchId) ?? { id: current.patchId };
        return {
          patch,
          confidence: 0.85,
          evidence: [
            `Test "${testName}" changed from PASS to FAIL at patch ${current.patchId}`,
          ],
        };
      }
    }
  }

  return { patch: null, confidence: 0.2, evidence: ['No clear regression detected in provided snapshots'] };
}

/**
 * Build a timeline of test pass/fail over patches for a named test.
 * @param {string} projectRoot  (used for labeling only in this implementation)
 * @param {string} testName
 * @param {Array<{ id: string, appliedAt: string, testResults?: Record<string, boolean> }>} patchHistory
 * @returns {Array<{ patchId: string, appliedAt: string, passed: boolean|null }>}
 */
export function buildRegressionTimeline(projectRoot, testName, patchHistory = []) {
  return patchHistory.map(p => ({
    patchId:   p.id,
    appliedAt: p.appliedAt,
    passed:    p.testResults?.[testName] ?? null,
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function testPassedAtPatch(testName, patch) {
  // If patch has embedded test results, use them
  if (patch.testResults && testName in patch.testResults) {
    return patch.testResults[testName] === true;
  }
  // If no data, assume passed (unknown = optimistic)
  return true;
}
