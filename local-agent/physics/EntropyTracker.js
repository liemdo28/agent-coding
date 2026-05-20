// local-agent/physics/EntropyTracker.js
// Phase 110 — Physics Engine
// Tracks disorder accumulation: entropy grows when net_force is positive,
// slowly decays when net_force is negative.

import { existsSync, readFileSync } from 'fs';

/**
 * Compute new entropy from current entropy + net force.
 *
 * Formula from spec:
 *   entropy = prev_entropy + max(0, net_force * 0.1) - max(0, -net_force * 0.05)
 *   clamped to [0, 100]
 *
 * @param {number} currentEntropy  — previous entropy value (0-100)
 * @param {number} force           — net force scalar
 * @param {number} decayRate       — default 0.05
 * @returns {{ newEntropy: number, delta: number, trend: 'increasing'|'stable'|'decreasing' }}
 */
export function accumulateEntropy(currentEntropy, force, decayRate = 0.05) {
  const growth = Math.max(0, force * 0.1);
  const decay  = Math.max(0, -force * decayRate);
  const raw    = currentEntropy + growth - decay;
  const newEntropy = Math.max(0, Math.min(100, +raw.toFixed(2)));
  const delta      = +(newEntropy - currentEntropy).toFixed(2);
  const trend      = delta > 0.5 ? 'increasing' : delta < -0.5 ? 'decreasing' : 'stable';

  return { newEntropy, delta, trend };
}

/**
 * Read the entropy value from the last line of physics-log.jsonl.
 * Returns 0 if the file does not exist or has no valid entries.
 *
 * @param {string} physicsLogPath
 * @returns {number}
 */
export function readLastEntropy(physicsLogPath) {
  if (!existsSync(physicsLogPath)) return 0;
  try {
    const lines = readFileSync(physicsLogPath, 'utf8')
      .split('\n').filter(Boolean);
    if (!lines.length) return 0;
    const last = JSON.parse(lines[lines.length - 1]);
    return last?.entropy?.current ?? 0;
  } catch {
    return 0;
  }
}
