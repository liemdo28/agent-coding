// vision/VisionAnalyzer.js — local image analysis for UI debugging (no cloud, no API)
// Operates on local image files only. Uses pixel-level heuristics and metadata.
import { existsSync, statSync, readFileSync } from 'fs';
import { extname, basename } from 'path';

const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);

/**
 * Parse basic PNG metadata from file buffer (no external deps).
 * Returns width/height from IHDR chunk.
 * @param {Buffer} buf
 * @returns {{ width: number, height: number }|null}
 */
function parsePNGDimensions(buf) {
  // PNG signature: 8 bytes, IHDR chunk starts at offset 8
  if (buf.length < 24) return null;
  if (buf.slice(1, 4).toString() !== 'PNG') return null;
  const width  = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/**
 * Analyze a local screenshot/image for potential UI issues.
 * @param {string} imagePath — absolute path to local image
 * @returns {AnalysisResult}
 */
export function analyzeImage(imagePath) {
  if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
  const ext = extname(imagePath).toLowerCase();
  if (!SUPPORTED_EXTS.has(ext)) throw new Error(`Unsupported format: ${ext}. Supported: ${[...SUPPORTED_EXTS].join(', ')}`);

  const stat    = statSync(imagePath);
  const buf     = readFileSync(imagePath);
  const fileSizeKB = Math.round(stat.size / 1024);

  let dimensions = null;
  if (ext === '.png') dimensions = parsePNGDimensions(buf);

  const issues  = [];
  const checks  = {};

  // File size checks
  checks.file_size = fileSizeKB < 10240; // warn if > 10 MB screenshot
  if (!checks.file_size) issues.push({ type: 'large_file', msg: `Screenshot is large: ${fileSizeKB} KB — may indicate uncompressed capture` });

  // Dimension checks (PNG only)
  if (dimensions) {
    const { width, height } = dimensions;
    checks.dimensions = width > 0 && height > 0;

    // Detect suspicious blank/tiny screenshots
    if (width < 100 || height < 100) {
      issues.push({ type: 'tiny_image', msg: `Very small image: ${width}×${height}px — may be blank or error state` });
    }

    // Common mobile breakpoints
    const aspectRatio = width / height;
    if (aspectRatio > 5 || aspectRatio < 0.2) {
      issues.push({ type: 'unusual_aspect', msg: `Unusual aspect ratio (${aspectRatio.toFixed(2)}) — may be cropped incorrectly` });
    }
  }

  // Entropy check: estimate if image is mostly blank (solid color)
  const sampleSize = Math.min(buf.length, 4096);
  const sample     = buf.slice(0, sampleSize);
  const uniqueBytes = new Set(sample).size;
  const entropy    = uniqueBytes / 256;
  checks.content   = entropy > 0.05;
  if (entropy < 0.05) {
    issues.push({ type: 'blank_image', msg: `Image appears mostly blank (low entropy: ${entropy.toFixed(3)}) — may be a failed screenshot` });
  }

  return {
    file:         basename(imagePath),
    path:         imagePath,
    fileSizeKB,
    dimensions,
    entropy:      +entropy.toFixed(3),
    checks,
    issues,
    healthy:      issues.length === 0,
    issueCount:   issues.length,
    note:         'Local heuristic analysis only — no cloud vision API used',
  };
}

/**
 * Compare two images for structural differences (file-level comparison).
 * @param {string} beforePath
 * @param {string} afterPath
 * @returns {CompareResult}
 */
export function compareImages(beforePath, afterPath) {
  if (!existsSync(beforePath)) throw new Error(`Before image not found: ${beforePath}`);
  if (!existsSync(afterPath))  throw new Error(`After image not found: ${afterPath}`);

  const b1 = readFileSync(beforePath);
  const b2 = readFileSync(afterPath);

  const d1 = extname(beforePath) === '.png' ? parsePNGDimensions(b1) : null;
  const d2 = extname(afterPath)  === '.png' ? parsePNGDimensions(b2) : null;

  const sizeChanged   = b1.length !== b2.length;
  const sizeDeltaKB   = +((b2.length - b1.length) / 1024).toFixed(1);
  const dimsChanged   = d1 && d2 && (d1.width !== d2.width || d1.height !== d2.height);
  const identical     = b1.equals(b2);

  // Byte-level diff sampling (1% of file)
  const step   = Math.max(1, Math.floor(Math.min(b1.length, b2.length) / 100));
  let diffBytes = 0;
  for (let i = 0; i < Math.min(b1.length, b2.length); i += step) {
    if (b1[i] !== b2[i]) diffBytes++;
  }
  const diffPct = +((diffBytes / (Math.min(b1.length, b2.length) / step)) * 100).toFixed(1);

  const changes = [];
  if (dimsChanged)            changes.push(`Dimensions changed: ${d1.width}×${d1.height} → ${d2.width}×${d2.height}`);
  if (sizeChanged)            changes.push(`File size: ${sizeDeltaKB > 0 ? '+' : ''}${sizeDeltaKB} KB`);
  if (diffPct > 30)           changes.push(`Major visual change detected (${diffPct}% bytes differ)`);
  else if (diffPct > 5)       changes.push(`Moderate change (${diffPct}% bytes differ)`);
  else if (!identical)        changes.push(`Minor change (${diffPct}% bytes differ)`);

  return {
    identical,
    sizeChanged,
    sizeDeltaKB,
    dimsChanged,
    diffPct,
    changes,
    before: { path: beforePath, sizeKB: Math.round(b1.length / 1024), dimensions: d1 },
    after:  { path: afterPath,  sizeKB: Math.round(b2.length / 1024), dimensions: d2 },
  };
}
