// local-agent/sensors/scan-sensor.js — Scan latency sensor (reads from baseline)

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

const BASELINE_PATH = join(PROJECT_ROOT, 'metrics', 'baseline-2026-05-18.json');

// Thresholds (ms)
const WARN_MULTIPLIER = 1.5;  // warn if > 1.5× baseline
const FAIL_MULTIPLIER = 3.0;  // fail if > 3× baseline

/**
 * Derive a status string from last vs baseline values.
 */
function deriveStatus(lastMs, baselineMs) {
  if (lastMs == null || baselineMs == null) return 'unknown';
  if (lastMs <= baselineMs * WARN_MULTIPLIER) return 'ok';
  if (lastMs <= baselineMs * FAIL_MULTIPLIER) return 'warn';
  return 'fail';
}

/**
 * Collect scan latency metrics from the recorded baseline JSON.
 * @returns {{ last_scan_ms, baseline_ms, target_ms, status, last_measured }}
 */
export async function collect() {
  if (!existsSync(BASELINE_PATH)) {
    return {
      last_scan_ms:  null,
      baseline_ms:   null,
      target_ms:     null,
      status:        'unknown',
      last_measured: null,
    };
  }

  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

    const baselineMs  = data?.performance?.scan_latency_sample_project_ms ?? null;
    // "last_scan_ms" is the most recently recorded value — same as baseline until re-measured
    const lastScanMs  = baselineMs;
    // Target: same as the previous (improved) value as a goal (or 10% below baseline)
    const targetMs    = baselineMs != null ? Math.round(baselineMs * 0.9) : null;
    const lastMeasured = data?.timestamp ?? data?.baseline_updated ?? null;

    return {
      last_scan_ms:  lastScanMs,
      baseline_ms:   baselineMs,
      target_ms:     targetMs,
      status:        deriveStatus(lastScanMs, baselineMs),
      last_measured: lastMeasured,
    };
  } catch (err) {
    return {
      last_scan_ms:  null,
      baseline_ms:   null,
      target_ms:     null,
      status:        'unknown',
      last_measured: null,
      error:         err.message,
    };
  }
}
