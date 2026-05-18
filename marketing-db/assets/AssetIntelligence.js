// assets/AssetIntelligence.js — Visual Asset Intelligence (Phase 17)
// Offline-only: no cloud vision, no external APIs. Uses file system + heuristics.
import { createHash } from 'crypto';
import {
  existsSync, statSync, readdirSync, readFileSync, mkdirSync, writeFileSync,
} from 'fs';
import { join, extname, basename, dirname, relative } from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif', '.heic', '.avif']);
const VIDEO_EXTS  = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv', '.3gp']);
const PDF_EXTS    = new Set(['.pdf']);
const DOC_EXTS    = new Set(['.doc', '.docx', '.ppt', '.pptx', '.key', '.pages']);
const FONT_EXTS   = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot']);

// Size thresholds
const SIZE_SMALL_PHOTO_BYTES   = 50   * 1024;       //  50 KB
const SIZE_GOOD_MIN_BYTES      = 100  * 1024;       // 100 KB
const SIZE_GOOD_MAX_BYTES      = 5    * 1024 * 1024; //   5 MB
const SIZE_LARGE_SOCIAL_BYTES  = 10   * 1024 * 1024; //  10 MB
const SIZE_LARGE_VIDEO_BYTES   = 50   * 1024 * 1024; //  50 MB

// Brand-safe filename pattern: lowercase alphanumeric, hyphens, underscores
const BRAND_SAFE_NAME_RE = /^[a-z0-9_\-]+(\.[a-z0-9]+)?$/i;

// Promotional asset filename patterns (expect a CTA)
const PROMO_PATTERNS = [
  /flyer/i, /promo/i, /banner/i, /ad[_-]|_ad$/i, /sale/i,
  /discount/i, /offer/i, /deal/i, /special/i, /campaign/i,
];

// CTA hint patterns (inside filename or metadata)
const CTA_HINT_RE = /cta|call.?to.?action|order.?now|click|shop|visit|book|reserve/i;

// ── Asset type classification rules ──────────────────────────────────────────

const CLASSIFICATION_RULES = [
  // Most-specific first
  { type: 'qr_code',         test: (name) => /qr[_\-.]?code|qr$/i.test(name) },
  { type: 'logo',            test: (name) => /logo/i.test(name) },
  { type: 'brand_asset',     test: (name, dir) => /brand|identity|style.?guide|guidelines/i.test(name + dir) },
  { type: 'social_template', test: (name, dir) => /template|story|reel|post[_-]|_post/i.test(name + dir) },
  { type: 'menu_image',      test: (name, dir) => /menu/i.test(name + dir) },
  { type: 'flyer',           test: (name, dir) => /flyer|banner|poster|brochure/i.test(name + dir) },
  { type: 'food_photo',      test: (name, dir) => /food|dish|plate|meal|appetizer|entree|dessert|drink|beverage|special/i.test(name + dir) },
  { type: 'video_asset',     test: (name, dir, ext) => VIDEO_EXTS.has(ext) },
];

// ── SHA-256 hashing ───────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of a file.
 * Returns hex string, or null if the file cannot be read.
 *
 * @param {string} filePath
 * @returns {string|null}
 */
export function hashFile(filePath) {
  try {
    const buf = readFileSync(filePath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

// ── Helper: detect file category ─────────────────────────────────────────────

function detectFileCategory(ext) {
  if (IMAGE_EXTS.has(ext))  return 'image';
  if (VIDEO_EXTS.has(ext))  return 'video';
  if (PDF_EXTS.has(ext))    return 'pdf';
  if (DOC_EXTS.has(ext))    return 'document';
  if (FONT_EXTS.has(ext))   return 'font';
  return 'other';
}

// ── Asset classification ──────────────────────────────────────────────────────

/**
 * Classify an asset based on its filename and file stats.
 *
 * @param {string} filename  Full path or just the filename.
 * @param {object} stats     fs.Stats object.
 * @returns {string}         One of the classification type strings.
 */
export function classifyAsset(filename, stats) {
  const base = basename(filename).toLowerCase();
  const dir  = dirname(filename).toLowerCase();
  const ext  = extname(filename).toLowerCase();

  // Run classification rules in priority order
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.test(base, dir, ext)) return rule.type;
  }

  // Fallback by file category
  const cat = detectFileCategory(ext);
  if (cat === 'image') return 'food_photo';
  if (cat === 'video') return 'video_asset';
  return cat;
}

// ── Quality heuristics ────────────────────────────────────────────────────────

/**
 * Assess image quality from file metadata alone (no image processing lib).
 *
 * @param {string} filePath
 * @param {object} stats  fs.Stats
 * @returns {{ quality: string, score: number, notes: string[] }}
 */
function assessQuality(filePath, stats) {
  const notes = [];
  let score = 50; // neutral start
  const ext  = extname(filePath).toLowerCase();
  const size = stats.size;
  const name = basename(filePath).toLowerCase();

  if (IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) {
    if (size < SIZE_SMALL_PHOTO_BYTES) {
      score -= 30;
      notes.push(`Very small file (${(size / 1024).toFixed(1)} KB) — likely low quality for a photo`);
    } else if (size >= SIZE_GOOD_MIN_BYTES && size <= SIZE_GOOD_MAX_BYTES) {
      score += 30;
      notes.push(`Good file size range (${(size / 1024).toFixed(0)} KB)`);
    } else if (size > SIZE_GOOD_MAX_BYTES && size <= SIZE_LARGE_SOCIAL_BYTES) {
      score += 10;
      notes.push(`Large file (${(size / (1024 * 1024)).toFixed(1)} MB) — may need compression for social`);
    } else if (size > SIZE_LARGE_SOCIAL_BYTES) {
      score -= 10;
      notes.push(`Very large file (${(size / (1024 * 1024)).toFixed(1)} MB) — exceeds social media limit`);
    }

    // SVG is always vector quality
    if (ext === '.svg') {
      score = Math.max(score, 70);
      notes.push('SVG vector — resolution-independent');
    }

    // Modern formats
    if (ext === '.webp' || ext === '.avif') {
      score += 10;
      notes.push('Modern compressed format (+10)');
    }

    // Brand color hints from filename
    const colorHints = name.match(/red|blue|green|yellow|orange|purple|brand|primary|secondary|accent/g);
    if (colorHints && colorHints.length > 0) {
      notes.push(`Filename suggests brand color usage: ${[...new Set(colorHints)].join(', ')}`);
      score += 5;
    }
  }

  if (VIDEO_EXTS.has(ext)) {
    score = 60; // video gets neutral-good baseline
    if (size > SIZE_LARGE_VIDEO_BYTES) {
      score -= 15;
      notes.push(`Video exceeds 50 MB (${(size / (1024 * 1024)).toFixed(1)} MB) — may need compression`);
    } else {
      notes.push(`Video size OK (${(size / (1024 * 1024)).toFixed(1)} MB)`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  let quality;
  if (score >= 75)      quality = 'excellent';
  else if (score >= 55) quality = 'good';
  else if (score >= 35) quality = 'acceptable';
  else                  quality = 'poor';

  return { quality, score, notes };
}

// ── Asset scanning ────────────────────────────────────────────────────────────

/**
 * Recursively scan a directory for marketing assets.
 *
 * @param {string} dirPath   Directory to scan.
 * @param {number} brand_id  Brand ID to associate assets with.
 * @returns {object[]}       Array of asset descriptor objects.
 */
export function scanAssets(dirPath, brand_id) {
  if (!existsSync(dirPath)) return [];
  const assets = [];

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stats;
      try { stats = statSync(fullPath); } catch { continue; }

      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const ext = extname(entry).toLowerCase();
      const category = detectFileCategory(ext);
      if (category === 'other') continue; // skip unknown file types

      const assetType   = classifyAsset(fullPath, stats);
      const qualInfo    = assessQuality(fullPath, stats);
      const isBrandSafe = BRAND_SAFE_NAME_RE.test(entry);
      const isPromo     = PROMO_PATTERNS.some((p) => p.test(entry));

      const issues = [];

      // Size flags
      if (category === 'image' && stats.size > SIZE_LARGE_SOCIAL_BYTES) {
        issues.push(`Oversized for social media (>${SIZE_LARGE_SOCIAL_BYTES / (1024 * 1024)} MB)`);
      }
      if (category === 'video' && stats.size > SIZE_LARGE_VIDEO_BYTES) {
        issues.push(`Video exceeds 50 MB threshold`);
      }

      // Naming convention
      if (!isBrandSafe) {
        issues.push(`Non-brand-safe filename: "${entry}" (use lowercase alphanumeric + hyphens/underscores)`);
      }

      const asset = {
        file_path:    fullPath,
        name:         entry,
        brand_id,
        type:         assetType,
        category,
        extension:    ext,
        size_bytes:   stats.size,
        hash:         null, // lazy — filled by detectDuplicates or validateAsset
        quality:      qualInfo.quality,
        quality_score: qualInfo.score,
        quality_notes: qualInfo.notes,
        brand_safe_name: isBrandSafe,
        is_promo:     isPromo,
        issues,
        status:       issues.length > 0 ? 'needs_review' : 'active',
        created_at:   stats.birthtime?.toISOString() ?? stats.mtime.toISOString(),
        modified_at:  stats.mtime.toISOString(),
      };

      assets.push(asset);
    }
  }

  walk(dirPath);
  return assets;
}

// ── Duplicate detection ───────────────────────────────────────────────────────

/**
 * Detect duplicate files by SHA-256 hash comparison.
 * Mutates each asset in the array to populate the `hash` field.
 *
 * @param {object[]} assets  Array of asset descriptors from scanAssets().
 * @returns {object[]}       Array of duplicate groups: { hash, files: string[] }
 */
export function detectDuplicates(assets) {
  const hashMap = new Map(); // hash → [asset, ...]

  for (const asset of assets) {
    if (!asset.hash) {
      asset.hash = hashFile(asset.file_path);
    }
    if (!asset.hash) continue;

    const group = hashMap.get(asset.hash) ?? [];
    group.push(asset);
    hashMap.set(asset.hash, group);
  }

  const duplicates = [];
  for (const [hash, group] of hashMap) {
    if (group.length > 1) {
      // Mark duplicates in the asset objects
      const primary = group[0];
      for (let i = 1; i < group.length; i++) {
        group[i].issues = group[i].issues ?? [];
        group[i].issues.push(`Duplicate of: ${primary.file_path}`);
        group[i].status = 'duplicate';
      }
      duplicates.push({
        hash,
        count: group.length,
        files: group.map((a) => a.file_path),
        primary: primary.file_path,
      });
    }
  }

  return duplicates;
}

// ── Missing CTA detection ─────────────────────────────────────────────────────

/**
 * Check whether a promotional asset likely has a missing CTA.
 *
 * @param {object} asset  Asset descriptor from scanAssets().
 * @returns {{ missing: boolean, reason: string|null }}
 */
function detectMissingCTA(asset) {
  // Only applies to promo image/flyer/pdf assets
  if (!asset.is_promo) return { missing: false, reason: null };
  if (!['image', 'pdf', 'document'].includes(asset.category)) return { missing: false, reason: null };

  // Check filename for CTA hint
  const nameLower = asset.name.toLowerCase();
  if (CTA_HINT_RE.test(nameLower)) return { missing: false, reason: null };

  return {
    missing: true,
    reason: `Promotional asset "${asset.name}" has no CTA indicator in filename — ensure the design contains a call-to-action`,
  };
}

// ── Asset validation ──────────────────────────────────────────────────────────

/**
 * Validate a single asset against brand standards.
 *
 * @param {string} assetPath  Full path to the file.
 * @param {object} brand      Brand record { name, colors, tagline }.
 * @returns {object}          Validation result with issues and recommendations.
 */
export function validateAsset(assetPath, brand) {
  const issues   = [];
  const warnings = [];
  const recommendations = [];

  if (!existsSync(assetPath)) {
    return { valid: false, issues: ['File not found'], warnings: [], recommendations: [] };
  }

  let stats;
  try { stats = statSync(assetPath); } catch (e) {
    return { valid: false, issues: [`Cannot read file: ${e.message}`], warnings: [], recommendations: [] };
  }

  const ext      = extname(assetPath).toLowerCase();
  const name     = basename(assetPath);
  const category = detectFileCategory(ext);
  const assetType = classifyAsset(assetPath, stats);
  const qualInfo = assessQuality(assetPath, stats);

  // Populate hash
  const hash = hashFile(assetPath);

  // Quality check
  if (qualInfo.quality === 'poor') {
    issues.push(`Poor quality score (${qualInfo.score}/100): ${qualInfo.notes.join('; ')}`);
  } else if (qualInfo.quality === 'acceptable') {
    warnings.push(`Acceptable quality (${qualInfo.score}/100) — consider upgrading`);
  }

  // Naming convention
  if (!BRAND_SAFE_NAME_RE.test(name)) {
    warnings.push(`Filename "${name}" does not follow brand-safe naming convention (use lowercase alphanumeric + hyphens/underscores only)`);
    recommendations.push(`Rename to: ${name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-')}`);
  }

  // Size checks
  if (category === 'image' && stats.size < SIZE_SMALL_PHOTO_BYTES) {
    issues.push(`Image is too small (${(stats.size / 1024).toFixed(1)} KB) — minimum 50 KB expected for photos`);
    recommendations.push('Replace with a higher-resolution version (at least 100 KB)');
  }

  if (category === 'image' && stats.size > SIZE_LARGE_SOCIAL_BYTES) {
    warnings.push(`Image exceeds 10 MB social media limit (${(stats.size / (1024 * 1024)).toFixed(1)} MB)`);
    recommendations.push('Compress image for social media use');
  }

  if (category === 'video' && stats.size > SIZE_LARGE_VIDEO_BYTES) {
    warnings.push(`Video exceeds 50 MB threshold (${(stats.size / (1024 * 1024)).toFixed(1)} MB) — may not upload to some platforms`);
    recommendations.push('Compress video or export at lower bitrate');
  }

  // Brand color check from filename
  if (brand && brand.colors) {
    const brandColorNames = String(brand.colors)
      .split(/[,;]/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    const nameLower = name.toLowerCase();
    const brandColorMentioned = brandColorNames.some((color) => nameLower.includes(color.replace('#', '')));
    if (!brandColorMentioned && ['logo', 'brand_asset', 'social_template'].includes(assetType)) {
      recommendations.push(`Consider using brand colors in your ${assetType}: ${brand.colors}`);
    }
  }

  // CTA check
  const ctaCheck = detectMissingCTA({ name, category, is_promo: PROMO_PATTERNS.some((p) => p.test(name)) });
  if (ctaCheck.missing) {
    warnings.push(ctaCheck.reason);
    recommendations.push('Add a clear call-to-action to the design (e.g., "Order Now", "Visit Us Today")');
  }

  // Asset type note
  const validForBrand = ['logo', 'brand_asset', 'social_template', 'food_photo', 'menu_image', 'flyer', 'video_asset', 'qr_code'];
  if (!validForBrand.includes(assetType)) {
    warnings.push(`Asset type "${assetType}" may not be a recognised marketing asset type`);
  }

  return {
    valid:           issues.length === 0,
    file_path:       assetPath,
    name,
    type:            assetType,
    category,
    size_bytes:      stats.size,
    hash,
    quality:         qualInfo.quality,
    quality_score:   qualInfo.score,
    quality_notes:   qualInfo.notes,
    issues,
    warnings,
    recommendations,
  };
}

// ── Asset report ──────────────────────────────────────────────────────────────

/**
 * Generate a summary report from a scanned asset list.
 *
 * @param {object[]} assets  Output from scanAssets().
 * @returns {object}         Summary report.
 */
export function generateAssetReport(assets) {
  const byType     = {};
  const byQuality  = {};
  const allIssues  = [];

  let totalSize = 0;
  let duplicateCount = 0;
  let promoMissingCTA = 0;
  let brandUnsafeCount = 0;

  for (const asset of assets) {
    // Type counts
    byType[asset.type] = (byType[asset.type] ?? 0) + 1;

    // Quality counts
    byQuality[asset.quality] = (byQuality[asset.quality] ?? 0) + 1;

    totalSize += asset.size_bytes ?? 0;

    if (asset.status === 'duplicate')  duplicateCount++;
    if (!asset.brand_safe_name)        brandUnsafeCount++;

    // CTA check
    const ctaResult = detectMissingCTA(asset);
    if (ctaResult.missing) promoMissingCTA++;

    // Collect all issues
    for (const issue of asset.issues ?? []) {
      allIssues.push({ file: asset.name, issue });
    }
  }

  const avgQualityScore = assets.length > 0
    ? Math.round(assets.reduce((s, a) => s + (a.quality_score ?? 0), 0) / assets.length)
    : 0;

  return {
    generated_at:    new Date().toISOString(),
    total_assets:    assets.length,
    total_size_bytes: totalSize,
    total_size_mb:   +(totalSize / (1024 * 1024)).toFixed(2),
    avg_quality_score: avgQualityScore,
    by_type:         byType,
    by_quality:      byQuality,
    duplicate_count: duplicateCount,
    brand_unsafe_names: brandUnsafeCount,
    promo_missing_cta:  promoMissingCTA,
    issues:          allIssues,
    recommendations: buildReportRecommendations(assets, { duplicateCount, promoMissingCTA, brandUnsafeCount, avgQualityScore }),
  };
}

function buildReportRecommendations(assets, { duplicateCount, promoMissingCTA, brandUnsafeCount, avgQualityScore }) {
  const recs = [];

  if (duplicateCount > 0) {
    recs.push(`Remove ${duplicateCount} duplicate file(s) to reduce storage and confusion`);
  }
  if (promoMissingCTA > 0) {
    recs.push(`${promoMissingCTA} promotional asset(s) appear to be missing a CTA — add "Order Now", "Visit Us", or similar`);
  }
  if (brandUnsafeCount > 0) {
    recs.push(`Rename ${brandUnsafeCount} file(s) to follow brand-safe naming (lowercase, hyphens/underscores only)`);
  }
  if (avgQualityScore < 50) {
    recs.push('Overall asset quality is low — consider replacing small or poorly-sized images with higher-resolution versions');
  }
  if (assets.filter((a) => a.type === 'logo').length === 0) {
    recs.push('No logo asset detected — add a logo file (e.g., brand-logo.svg) to your asset library');
  }
  if (assets.filter((a) => a.type === 'qr_code').length === 0) {
    recs.push('No QR code asset found — consider generating a QR code for your menu/ordering page');
  }

  return recs;
}

// ── DB persistence helper ─────────────────────────────────────────────────────

/**
 * Upsert asset records into the database.
 *
 * @param {object}   db      better-sqlite3 database instance.
 * @param {object[]} assets  Asset descriptors.
 */
export function saveAssetsToDb(db, assets) {
  const stmt = db.prepare(`
    INSERT INTO assets(brand_id, name, file_path, type, size_bytes, hash, status, issues)
    VALUES (@brand_id, @name, @file_path, @type, @size_bytes, @hash, @status, @issues)
    ON CONFLICT(id) DO NOTHING
  `);

  const insert = db.transaction((items) => {
    for (const a of items) {
      stmt.run({
        brand_id:   a.brand_id,
        name:       a.name,
        file_path:  a.file_path,
        type:       a.type,
        size_bytes: a.size_bytes,
        hash:       a.hash ?? null,
        status:     a.status,
        issues:     JSON.stringify(a.issues ?? []),
      });
    }
  });

  insert(assets);
}
