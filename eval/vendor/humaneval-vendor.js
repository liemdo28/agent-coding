/**
 * eval/vendor/humaneval-vendor.js — M1: Vendor HumanEval dataset
 * ================================================================
 * Downloads and vendors the HumanEval dataset from open-source source.
 * HumanEval: 164 Python programming problems with test cases.
 *
 * This script is OFFLINE-FRIENDLY: it fetches from public datasets that are
 * then cached locally. Once vendored, the benchmark runs entirely offline.
 *
 * Usage:
 *   node eval/vendor/humaneval-vendor.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'benchmarks', 'humaneval', 'data');
const HUMANEVAL_URL = 'https://github.com/openai/human-eval/raw/master/data/HumanEval.json';

mkdirSync(DATA_DIR, { recursive: true });

async function vendorHumanEval() {
  console.log('[humaneval-vendor] Starting vendor process...');
  console.log('[humaneval-vendor] Source: OpenAI HumanEval (GitHub)');
  console.log('[humaneval-vendor] Note: For full offline operation, commit the data file to the repo.');

  const outFile = join(DATA_DIR, 'humaneval.json');

  // Check if already vendored
  if (existsSync(outFile)) {
    const stat = readFileSync(outFile, 'utf-8');
    try {
      const data = JSON.parse(stat);
      console.log(`[humaneval-vendor] Already vendored: ${data.length} problems at ${outFile}`);
      console.log('[humaneval-vendor] To re-vendor, delete the file first.');
      return data;
    } catch {
      console.warn('[humaneval-vendor] Existing file is corrupted. Re-vendoring...');
    }
  }

  try {
    console.log('[humaneval-vendor] Fetching from GitHub...');
    const response = await fetch(HUMANEVAL_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    const data = JSON.parse(text);
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid HumanEval data: expected non-empty array');
    }
    
    // Validate structure
    const required = ['task_id', 'prompt', 'entry_point', 'canonical_solution', 'test'];
    for (let i = 0; i < Math.min(data.length, 3); i++) {
      for (const field of required) {
        if (!data[i].hasOwnProperty(field)) {
          console.warn(`[humaneval-vendor] Warning: problem ${i} missing field "${field}"`);
        }
      }
    }
    
    // Write vendored data
    writeFileSync(outFile, JSON.stringify(data, null, 2));
    
    console.log(`[humaneval-vendor] ✓ Vendored ${data.length} HumanEval problems`);
    console.log(`[humaneval-vendor]   → ${outFile}`);
    console.log('[humaneval-vendor]   Commit this file to the repo for offline operation.');
    
    return data;
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.message.includes('fetch')) {
      console.error('[humaneval-vendor] Network error. Options:');
      console.error('  1. Fetch once online, then commit the data file');
      console.error(`  2. Manually download from: ${HUMANEVAL_URL}`);
      console.error(`  3. Place the file at: ${outFile}`);
      console.error(`\n  Error: ${err.message}`);
    } else {
      console.error(`[humaneval-vendor] Failed: ${err.message}`);
    }
    process.exit(1);
  }
}

// Self-run
vendorHumanEval().catch(err => {
  console.error(`[humaneval-vendor] Fatal: ${err.message}`);
  process.exit(1);
});

export { vendorHumanEval };