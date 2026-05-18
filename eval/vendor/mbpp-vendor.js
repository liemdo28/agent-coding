/**
 * eval/vendor/mbpp-vendor.js — M1: Vendor MBPP dataset
 * =====================================================
 * Downloads and vendors the MBPP (Mostly Basic Python Problems) dataset.
 * MBPP: 974 Python programming problems, sanitized version.
 *
 * Source: pulkit1joshi/supercharging-the-bughunter repository
 *
 * Usage:
 *   node eval/vendor/mbpp-vendor.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'benchmarks', 'mbpp', 'data');
const MBPP_URL = 'https://raw.githubusercontent.com/pulkit1joshi/supercharging-the-bughunter/main/data/mbpp_sanitized.json';

mkdirSync(DATA_DIR, { recursive: true });

async function vendorMBPP() {
  console.log('[mbpp-vendor] Starting vendor process...');
  console.log('[mbpp-vendor] Source: pulkit1joshi/supercharging-the-bughunter (GitHub)');

  const outFile = join(DATA_DIR, 'mbpp.json');

  if (existsSync(outFile)) {
    try {
      const data = JSON.parse(readFileSync(outFile, 'utf-8'));
      console.log(`[mbpp-vendor] Already vendored: ${data.length} problems`);
      return data;
    } catch {
      console.warn('[mbpp-vendor] Corrupted file. Re-vendoring...');
    }
  }

  try {
    console.log('[mbpp-vendor] Fetching from GitHub...');
    const response = await fetch(MBPP_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Expected JSON array');
    }

    writeFileSync(outFile, JSON.stringify(data, null, 2));
    console.log(`[mbpp-vendor] ✓ Vendored ${data.length} MBPP problems`);
    console.log(`[mbpp-vendor]   → ${outFile}`);

    return data;
  } catch (err) {
    console.error(`[mbpp-vendor] Failed: ${err.message}`);
    console.error('  Manual download: https://github.com/pulkit1joshi/supercharging-the-bughunter');
    process.exit(1);
  }
}

vendorMBPP().catch(err => {
  console.error(`[mbpp-vendor] Fatal: ${err.message}`);
  process.exit(1);
});

export { vendorMBPP };