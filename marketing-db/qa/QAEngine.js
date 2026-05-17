// qa/QAEngine.js — campaign QA engine (fully offline, rule-based)
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOUNT_MIN_PCT = 5;
const DISCOUNT_MAX_PCT = 70;

// Phrases that are illegal/legally risky in marketing copy
const LEGAL_CLAIM_PATTERNS = [
  { pattern: /\bbest\s+in\s+(the\s+)?(city|town|area|region|country|world)\b/i, label: 'superlative claim: "best in [area]"' },
  { pattern: /\b#1\s+in\b/i,                                                    label: 'superlative claim: "#1 in"' },
  { pattern: /\bguaranteed\b/i,                                                  label: 'unsubstantiated guarantee' },
  { pattern: /\b(cheapest|lowest\s+price)\b/i,                                   label: 'price claim: cheapest/lowest' },
  { pattern: /\b(no\.?\s*1|number\s+one)\s+(in|rated)\b/i,                      label: 'superlative claim: "number one"' },
  { pattern: /\bcertified\b/i,                                                   label: 'certification claim (verify)' },
  { pattern: /\baward.winning\b/i,                                               label: 'award claim (must be verified)' },
  { pattern: /\b(doctor|physician|dentist|medical)\s+recommended\b/i,            label: 'professional endorsement claim' },
  { pattern: /\b(clinically\s+)?(proven|tested)\b/i,                             label: 'clinical/proof claim' },
  { pattern: /\bnot\s+responsible\b/i,                                           label: 'liability disclaimer (legal review needed)' },
  { pattern: /\b(limited\s+time|while\s+supplies\s+last)\b/i,                   label: 'urgency claim (must be genuine)' },
  { pattern: /\bfree\b/i,                                                        label: 'free offer claim (disclosure required)' },
  { pattern: /\b(win|winner|prize|sweepstakes|contest|giveaway)\b/i,             label: 'promotion/contest claim (legal review)' },
];

// Phone number validation — US formats
const PHONE_RE = /^\+?1?\s*[\-.]?\s*\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}$/;

// Strong CTA verbs that drive engagement
const STRONG_CTA_VERBS = [
  'order', 'book', 'reserve', 'get', 'claim', 'grab', 'download',
  'subscribe', 'join', 'start', 'try', 'shop', 'buy', 'save', 'call',
  'visit', 'discover', 'unlock', 'activate', 'redeem', 'schedule',
];

const WEAK_CTA_PHRASES = [
  'click here', 'learn more', 'read more', 'find out', 'see more',
  'check it out', 'more info', 'details here',
];

// Platform caption length limits (characters)
const PLATFORM_LIMITS = {
  instagram: { caption: 2200, hook_required: false },
  tiktok:    { caption: 2200, hook_required: true, hook_max_chars: 150 },
  facebook:  { caption: 63206, hook_required: false },
  twitter:   { caption: 280,   hook_required: false },
  x:         { caption: 280,   hook_required: false },
  linkedin:  { caption: 3000,  hook_required: false },
  youtube:   { caption: 5000,  hook_required: true, hook_max_chars: 200 },
  google:    { caption: 1500,  hook_required: false },
  email:     { caption: 100000, hook_required: false },
};

// Brand color format: either a named CSS color or a 3/6-digit hex
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() {
  return new Date();
}

/**
 * Normalise a discount value to a float percentage (0–100).
 * Accepts "20%", 20, "0.20", etc.
 */
function parseDiscount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    // If value looks like a decimal fraction (e.g. 0.20) convert to percent
    return raw > 0 && raw <= 1 ? raw * 100 : raw;
  }
  const s = String(raw).trim().replace('%', '');
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return n > 0 && n <= 1 ? n * 100 : n;
}

/**
 * Collect every legal-claim pattern that matches in `text`.
 */
function detectLegalClaims(text) {
  if (!text) return [];
  return LEGAL_CLAIM_PATTERNS
    .filter((lc) => lc.pattern.test(text))
    .map((lc) => lc.label);
}

/**
 * Test whether a phone string is a valid US phone number.
 */
function isValidPhone(phone) {
  if (!phone) return false;
  return PHONE_RE.test(phone.trim());
}

/**
 * Parse a date string into a Date object (returns null on failure).
 */
function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── CTA Scoring ───────────────────────────────────────────────────────────────

/**
 * Score a CTA string from 0–100 based on heuristics.
 *
 * Scoring model:
 *  - Starts at 40 (neutral baseline)
 *  - +30  if a strong action verb leads the CTA
 *  - +20  if the CTA is between 5 and 60 characters (concise)
 *  - +10  if it contains a benefit or urgency word
 *  - -20  if it uses a weak CTA phrase
 *  - -10  if the text is shorter than 4 characters (too vague)
 *  - -10  if the CTA is ALL CAPS (aggressive, looks spammy)
 *  - -10  if excessive punctuation (!!!!) found
 *
 * @param {string} ctaText
 * @returns {{ score: number, label: string, notes: string[] }}
 */
export function scoreCTA(ctaText) {
  const notes = [];
  let score = 40;

  if (!ctaText || typeof ctaText !== 'string') {
    return { score: 0, label: 'MISSING', notes: ['No CTA provided'] };
  }

  const text = ctaText.trim();
  const lower = text.toLowerCase();

  if (text.length < 4) {
    score -= 10;
    notes.push('CTA is too short / vague');
  }

  // Strong verb at the start
  const startsWithStrong = STRONG_CTA_VERBS.some((v) => lower.startsWith(v));
  if (startsWithStrong) {
    score += 30;
    notes.push('Starts with a strong action verb (+30)');
  }

  // Concise length
  if (text.length >= 5 && text.length <= 60) {
    score += 20;
    notes.push('Concise length 5–60 chars (+20)');
  } else if (text.length > 60) {
    notes.push('CTA is too long — consider shortening');
  }

  // Urgency/benefit words
  const urgencyBenefit = [
    'now', 'today', 'free', 'exclusive', 'limited', 'save', 'off',
    'bonus', 'deal', 'discount', 'instant', 'fast', 'easy',
  ];
  if (urgencyBenefit.some((w) => lower.includes(w))) {
    score += 10;
    notes.push('Contains urgency/benefit word (+10)');
  }

  // Weak phrase penalty
  const weakMatch = WEAK_CTA_PHRASES.find((w) => lower.includes(w));
  if (weakMatch) {
    score -= 20;
    notes.push(`Weak CTA phrase detected: "${weakMatch}" (-20)`);
  }

  // ALL CAPS penalty
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) {
    score -= 10;
    notes.push('All-caps CTA looks spammy (-10)');
  }

  // Excessive punctuation
  if (/[!?]{3,}/.test(text)) {
    score -= 10;
    notes.push('Excessive punctuation (-10)');
  }

  score = Math.max(0, Math.min(100, score));

  let label;
  if (score >= 80) label = 'STRONG';
  else if (score >= 55) label = 'GOOD';
  else if (score >= 35) label = 'WEAK';
  else label = 'POOR';

  return { score, label, notes };
}

// ── Risk Level Assessment ─────────────────────────────────────────────────────

/**
 * Assign a risk level to a campaign based on its content.
 *
 * Risk tiers:
 *  CRITICAL — illegal claim + unverified guarantee combination,
 *             or discount > 90 %, or expired with published status
 *  HIGH     — legal claims present, or discount outside 5–70 %,
 *             or missing required contact info for campaigns with a phone CTA
 *  MEDIUM   — weak CTA, no expiry date, discount near edge of range
 *  LOW      — everything looks fine
 *
 * @param {object} campaignData
 * @returns {{ riskLevel: string, reasons: string[] }}
 */
export function assessRiskLevel(campaignData) {
  const { title = '', offer = '', cta = '', discount_pct, phone, expiry_date, status } = campaignData;
  const allText = [title, offer, cta].filter(Boolean).join(' ');
  const reasons = [];
  let riskScore = 0; // accumulate risk points

  // Legal claims
  const claims = detectLegalClaims(allText);
  if (claims.length) {
    riskScore += claims.length * 15;
    reasons.push(`Legal claims detected: ${claims.join('; ')}`);
  }

  // Discount range
  const pct = parseDiscount(discount_pct);
  if (pct !== null) {
    if (pct > 90) {
      riskScore += 50;
      reasons.push(`Extreme discount ${pct}% — likely fake or misleading`);
    } else if (pct > DISCOUNT_MAX_PCT) {
      riskScore += 25;
      reasons.push(`Discount ${pct}% exceeds maximum allowed (${DISCOUNT_MAX_PCT}%)`);
    } else if (pct < DISCOUNT_MIN_PCT) {
      riskScore += 10;
      reasons.push(`Discount ${pct}% below minimum meaningful threshold (${DISCOUNT_MIN_PCT}%)`);
    }
  }

  // Expired promotion
  const expiry = parseDate(expiry_date);
  if (expiry && expiry < now()) {
    const daysExpired = Math.floor((now() - expiry) / 86400000);
    riskScore += daysExpired > 30 ? 60 : 30;
    reasons.push(`Promotion expired ${daysExpired} day(s) ago`);
    if (status === 'published' || status === 'active') {
      riskScore += 40;
      reasons.push('Expired promotion is still published/active');
    }
  }

  // Phone CTA without valid phone
  if (/\bcall\b/i.test(cta) && !isValidPhone(phone)) {
    riskScore += 20;
    reasons.push('CTA instructs to "call" but no valid phone number provided');
  }

  // CTA strength
  const ctaResult = scoreCTA(cta);
  if (ctaResult.label === 'POOR' || ctaResult.label === 'MISSING') {
    riskScore += 15;
    reasons.push(`CTA is ${ctaResult.label} — reduces campaign effectiveness`);
  }

  // Map score to risk level
  let riskLevel;
  if (riskScore >= 60) riskLevel = 'CRITICAL';
  else if (riskScore >= 35) riskLevel = 'HIGH';
  else if (riskScore >= 15) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  return { riskLevel, riskScore, reasons };
}

// ── Campaign Validation ───────────────────────────────────────────────────────

/**
 * Validate a full campaign object.
 *
 * @param {object} campaignData
 * @returns {{ valid: boolean, errors: string[], warnings: string[], riskLevel: string, ctaScore: object }}
 */
export function validateCampaign(campaignData) {
  const errors = [];
  const warnings = [];

  const {
    title,
    type,
    platform,
    cta,
    offer,
    discount_pct,
    phone,
    expiry_date,
    brand,
    scheduled_at,
  } = campaignData;

  // ── Required fields ──────────────────────────────────────────────────────
  if (!title || String(title).trim().length === 0) {
    errors.push('Campaign title is required');
  } else if (String(title).trim().length < 5) {
    errors.push('Campaign title is too short (minimum 5 characters)');
  } else if (String(title).trim().length > 200) {
    warnings.push('Campaign title exceeds 200 characters — consider shortening');
  }

  if (!type) {
    errors.push('Campaign type is required');
  }

  // ── Discount validation ──────────────────────────────────────────────────
  if (discount_pct !== undefined && discount_pct !== null) {
    const pct = parseDiscount(discount_pct);
    if (pct === null) {
      errors.push(`Invalid discount value: ${discount_pct}`);
    } else if (pct < DISCOUNT_MIN_PCT) {
      warnings.push(`Discount ${pct.toFixed(1)}% is below the meaningful minimum (${DISCOUNT_MIN_PCT}%) — omit or increase`);
    } else if (pct > DISCOUNT_MAX_PCT) {
      errors.push(`Discount ${pct.toFixed(1)}% exceeds maximum allowed ${DISCOUNT_MAX_PCT}% — appears fake or misleading`);
    }
  }

  // ── Legal claim detection ────────────────────────────────────────────────
  const allText = [title, offer, cta].filter(Boolean).join(' ');
  const legalClaims = detectLegalClaims(allText);
  for (const claim of legalClaims) {
    // "free", "limited time", "certified" → warning; harder claims → error
    const hardClaims = ['superlative', 'guarantee', 'price claim: cheapest', 'clinical', 'professional endorse'];
    const isHard = hardClaims.some((h) => claim.includes(h));
    if (isHard) {
      errors.push(`Legal claim requires substantiation: ${claim}`);
    } else {
      warnings.push(`Legal claim detected — ensure compliance: ${claim}`);
    }
  }

  // ── Phone validation ─────────────────────────────────────────────────────
  if (phone) {
    if (!isValidPhone(phone)) {
      errors.push(`Invalid phone number format: "${phone}" — expected US format e.g. (555) 555-5555`);
    }
  } else if (/\bcall\b/i.test(cta)) {
    errors.push('CTA includes "call" but no phone number is provided');
  }

  // ── Expiry date validation ───────────────────────────────────────────────
  if (expiry_date) {
    const expiry = parseDate(expiry_date);
    if (!expiry) {
      errors.push(`Invalid expiry date format: "${expiry_date}"`);
    } else if (expiry < now()) {
      errors.push(`Promotion has expired (${expiry_date}) — update or remove the expiry date`);
    } else {
      const daysUntilExpiry = Math.floor((expiry - now()) / 86400000);
      if (daysUntilExpiry < 2) {
        warnings.push(`Promotion expires very soon (${daysUntilExpiry} day(s)) — ensure content can be published in time`);
      }
    }
  } else {
    warnings.push('No expiry date set — evergreen promotions should be explicitly marked as such');
  }

  // ── Scheduled date validation ────────────────────────────────────────────
  if (scheduled_at) {
    const scheduled = parseDate(scheduled_at);
    if (!scheduled) {
      errors.push(`Invalid scheduled_at date format: "${scheduled_at}"`);
    } else if (scheduled < now()) {
      warnings.push(`Scheduled date ${scheduled_at} is in the past — campaign may not publish on time`);
    }
  }

  // ── Platform check ───────────────────────────────────────────────────────
  if (platform) {
    const platformKey = String(platform).toLowerCase();
    if (!PLATFORM_LIMITS[platformKey]) {
      warnings.push(`Unrecognised platform "${platform}" — ensure content specs are correct`);
    }
  }

  // ── CTA scoring ──────────────────────────────────────────────────────────
  const ctaScore = scoreCTA(cta);
  if (ctaScore.label === 'POOR') {
    errors.push(`CTA is too weak (score ${ctaScore.score}/100): "${cta}"`);
  } else if (ctaScore.label === 'WEAK') {
    warnings.push(`CTA could be stronger (score ${ctaScore.score}/100): "${cta}"`);
  }

  // ── Brand compliance (if brand data supplied) ────────────────────────────
  if (brand) {
    const brandWarnings = checkBrandCompliance(brand, campaignData);
    warnings.push(...brandWarnings);
  }

  // ── Risk level ───────────────────────────────────────────────────────────
  const { riskLevel, riskScore, reasons } = assessRiskLevel(campaignData);
  if (riskLevel === 'CRITICAL') {
    errors.push(`Risk level is CRITICAL (score ${riskScore}) — campaign blocked: ${reasons.join('; ')}`);
  } else if (riskLevel === 'HIGH') {
    warnings.push(`Risk level is HIGH (score ${riskScore}): ${reasons.join('; ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    riskLevel,
    riskScore,
    ctaScore,
  };
}

// ── Post Validation ───────────────────────────────────────────────────────────

/**
 * Validate a single content post against platform rules.
 *
 * @param {object} postData
 * @returns {{ valid: boolean, errors: string[], warnings: string[], platformChecks: object }}
 */
export function validatePost(postData) {
  const errors = [];
  const warnings = [];
  const platformChecks = {};

  const { platform, caption, hook, hashtags, cta } = postData;

  // ── Caption required ─────────────────────────────────────────────────────
  if (!caption || String(caption).trim().length === 0) {
    errors.push('Post caption is required');
  }

  // ── Platform-specific rules ──────────────────────────────────────────────
  if (platform) {
    const key = String(platform).toLowerCase();
    const limits = PLATFORM_LIMITS[key];

    if (!limits) {
      warnings.push(`Unknown platform "${platform}" — no spec validation applied`);
    } else {
      platformChecks[key] = { ok: true, issues: [] };

      const captionLen = caption ? String(caption).length : 0;

      // Caption length
      if (captionLen > limits.caption) {
        const overage = captionLen - limits.caption;
        platformChecks[key].ok = false;
        platformChecks[key].issues.push(`Caption exceeds ${platform} limit by ${overage} chars (${captionLen}/${limits.caption})`);
        errors.push(`Caption too long for ${platform}: ${captionLen} chars (max ${limits.caption})`);
      }

      // Hook requirement (TikTok, YouTube)
      if (limits.hook_required) {
        if (!hook || String(hook).trim().length === 0) {
          platformChecks[key].ok = false;
          platformChecks[key].issues.push(`${platform} requires a hook (first line/sentence)`);
          errors.push(`${platform} content requires a hook — add a compelling opening line`);
        } else {
          const hookLen = String(hook).length;
          const hookMax = limits.hook_max_chars || 150;
          if (hookLen > hookMax) {
            platformChecks[key].issues.push(`Hook exceeds ${hookMax} chars (${hookLen})`);
            warnings.push(`${platform} hook is too long: ${hookLen} chars (recommended max ${hookMax})`);
          }
        }
      }

      // Instagram-specific: hashtag count
      if (key === 'instagram' && hashtags) {
        const tags = Array.isArray(hashtags)
          ? hashtags
          : String(hashtags).match(/#\w+/g) || [];
        if (tags.length > 30) {
          platformChecks[key].issues.push(`Too many hashtags: ${tags.length} (Instagram max 30)`);
          errors.push(`Instagram allows max 30 hashtags — you have ${tags.length}`);
        } else if (tags.length < 3) {
          platformChecks[key].issues.push('Low hashtag count — aim for 5–15 for organic reach');
          warnings.push('Instagram post has fewer than 3 hashtags — consider adding more for reach');
        }
      }

      // Twitter/X: no hashtag spam
      if ((key === 'twitter' || key === 'x') && hashtags) {
        const tags = Array.isArray(hashtags)
          ? hashtags
          : String(hashtags).match(/#\w+/g) || [];
        if (tags.length > 3) {
          warnings.push(`Twitter/X: using ${tags.length} hashtags — best practice is 1–2`);
        }
      }

      // LinkedIn: professional tone check
      if (key === 'linkedin' && caption) {
        if (/\b(lol|omg|wtf|lmao)\b/i.test(caption)) {
          warnings.push('LinkedIn caption contains informal language — consider a professional tone');
        }
      }
    }
  }

  // ── Legal claims in caption ──────────────────────────────────────────────
  const allPostText = [caption, hook, cta].filter(Boolean).join(' ');
  const legalClaims = detectLegalClaims(allPostText);
  for (const claim of legalClaims) {
    warnings.push(`Legal claim in post copy — verify compliance: ${claim}`);
  }

  // ── CTA check ────────────────────────────────────────────────────────────
  const ctaScore = scoreCTA(cta);
  if (cta && ctaScore.label === 'POOR') {
    warnings.push(`Post CTA is weak (score ${ctaScore.score}/100)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    platformChecks,
    ctaScore,
  };
}

// ── Brand Compliance ──────────────────────────────────────────────────────────

/**
 * Check brand consistency rules against a piece of campaign data.
 *
 * @param {object} brand       Brand record from DB (name, colors, tagline)
 * @param {object} item        Campaign or post data
 * @returns {string[]}         Array of warning strings
 */
export function checkBrandCompliance(brand, item) {
  const warnings = [];

  if (!brand) return warnings;

  // Name consistency — check if a different brand name appears in the copy
  if (brand.name) {
    const allText = [item.title, item.offer, item.cta, item.caption].filter(Boolean).join(' ');
    // Simple heuristic: if the text references common aliases that differ from the stored brand name
    // This catches cases like "McDonald's" appearing in a "Burger King" campaign
    // We can only do this if an explicit alias check is configured; skip for now
    // (would need brand.aliases[] to do this definitively offline)
  }

  // Color validation — if colors are stored as hex codes, check format
  if (brand.colors) {
    const colorList = String(brand.colors).split(/[,;]/);
    for (const color of colorList) {
      const c = color.trim();
      if (!c) continue;
      // Accept named colors or hex codes; warn on obviously wrong values
      if (c.startsWith('#') && !HEX_COLOR_RE.test(c)) {
        warnings.push(`Brand color "${c}" is not a valid hex code`);
      }
    }
  }

  // Tagline consistency
  if (brand.tagline && item.caption) {
    const taglineWords = String(brand.tagline).toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    // If the brand tagline is explicitly contradicted in copy, warn
    // (e.g., tagline says "freshness guaranteed" but copy says "no guarantees")
    if (taglineWords.length > 0) {
      const negationRe = new RegExp(`no[t]?\\s+(${taglineWords.join('|')})`, 'i');
      if (negationRe.test(String(item.caption))) {
        warnings.push(`Post copy may contradict brand tagline: "${brand.tagline}"`);
      }
    }
  }

  return warnings;
}

// ── Full QA Run ───────────────────────────────────────────────────────────────

/**
 * Run QA across all campaigns and posts in the database.
 * Writes JSON reports to reports/qa/.
 *
 * @param {string} workspaceRoot  Absolute path to project root
 * @param {object} db             Open better-sqlite3 database instance
 * @returns {object}              Full QA report
 */
export async function runFullQA(workspaceRoot, db) {
  const report = {
    timestamp: new Date().toISOString(),
    workspaceRoot,
    campaignResults: [],
    postResults: [],
    summary: {
      totalCampaigns: 0,
      passedCampaigns: 0,
      failedCampaigns: 0,
      criticalCampaigns: 0,
      highRiskCampaigns: 0,
      totalPosts: 0,
      passedPosts: 0,
      failedPosts: 0,
      topIssues: [],
    },
    passed: true,
  };

  // ── Campaign QA ──────────────────────────────────────────────────────────
  let campaigns = [];
  try {
    campaigns = db
      .prepare(`
        SELECT c.*, b.name as brand_name, b.colors as brand_colors, b.tagline as brand_tagline
        FROM campaigns c
        LEFT JOIN brands b ON c.brand_id = b.id
        ORDER BY c.created_at DESC
      `)
      .all();
  } catch (e) {
    report.summary.topIssues.push(`Failed to load campaigns: ${e.message}`);
  }

  const issueCount = {};

  for (const campaign of campaigns) {
    // Build brand object if available
    const brand = campaign.brand_name
      ? { name: campaign.brand_name, colors: campaign.brand_colors, tagline: campaign.brand_tagline }
      : null;

    const result = validateCampaign({ ...campaign, brand });
    result.campaign_id = campaign.id;
    result.campaign_title = campaign.title;
    report.campaignResults.push(result);

    report.summary.totalCampaigns++;
    if (result.valid) {
      report.summary.passedCampaigns++;
    } else {
      report.summary.failedCampaigns++;
      report.passed = false;
    }
    if (result.riskLevel === 'CRITICAL') report.summary.criticalCampaigns++;
    if (result.riskLevel === 'HIGH')     report.summary.highRiskCampaigns++;

    // Tally issue categories for top-issues list
    for (const err of result.errors) {
      const key = err.split(' ').slice(0, 4).join(' ');
      issueCount[key] = (issueCount[key] || 0) + 1;
    }
  }

  // ── Post QA ──────────────────────────────────────────────────────────────
  let posts = [];
  try {
    posts = db
      .prepare(`
        SELECT p.*, b.name as brand_name
        FROM content_posts p
        LEFT JOIN brands b ON p.brand_id = b.id
        ORDER BY p.created_at DESC
        LIMIT 500
      `)
      .all();
  } catch (e) {
    report.summary.topIssues.push(`Failed to load posts: ${e.message}`);
  }

  for (const post of posts) {
    const result = validatePost(post);
    result.post_id = post.id;
    result.platform = post.platform;
    report.postResults.push(result);

    report.summary.totalPosts++;
    if (result.valid) {
      report.summary.passedPosts++;
    } else {
      report.summary.failedPosts++;
      report.passed = false;
    }

    for (const err of result.errors) {
      const key = err.split(' ').slice(0, 4).join(' ');
      issueCount[key] = (issueCount[key] || 0) + 1;
    }
  }

  // Build top-issues list (top 10 by frequency)
  report.summary.topIssues = Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([issue, count]) => ({ issue, count }));

  // ── Write reports ────────────────────────────────────────────────────────
  const reportDir = join(workspaceRoot, 'reports/qa');
  mkdirSync(reportDir, { recursive: true });

  writeFileSync(
    join(reportDir, 'qa-summary.json'),
    JSON.stringify({ summary: report.summary, timestamp: report.timestamp, passed: report.passed }, null, 2),
  );

  writeFileSync(
    join(reportDir, 'campaign-qa.json'),
    JSON.stringify(report.campaignResults, null, 2),
  );

  writeFileSync(
    join(reportDir, 'post-qa.json'),
    JSON.stringify(report.postResults, null, 2),
  );

  writeFileSync(
    join(reportDir, 'qa-report.md'),
    generateQAMarkdown(report),
  );

  // Log to audit_log if table exists
  try {
    db.prepare(
      `INSERT INTO audit_log(action, module, result, details) VALUES(?, ?, ?, ?)`
    ).run(
      'full_qa_run',
      'QAEngine',
      report.passed ? 'PASSED' : 'FAILED',
      JSON.stringify(report.summary),
    );
  } catch { /* non-fatal — DB may not have audit_log yet */ }

  return report;
}

// ── Markdown report generator ─────────────────────────────────────────────────

function generateQAMarkdown(report) {
  const { summary } = report;
  const status = report.passed ? '✅ PASSED' : '❌ FAILED';

  const failedCampaigns = report.campaignResults.filter((r) => !r.valid);
  const criticalCampaigns = report.campaignResults.filter((r) => r.riskLevel === 'CRITICAL');

  return `# Marketing-DB QA Report

**Status:** ${status}
**Generated:** ${report.timestamp}

## Summary

| Metric | Value |
|--------|-------|
| Total Campaigns | ${summary.totalCampaigns} |
| Passed | ${summary.passedCampaigns} |
| Failed | ${summary.failedCampaigns} |
| Critical Risk | ${summary.criticalCampaigns} |
| High Risk | ${summary.highRiskCampaigns} |
| Total Posts | ${summary.totalPosts} |
| Posts Passed | ${summary.passedPosts} |
| Posts Failed | ${summary.failedPosts} |

## Top Issues

${summary.topIssues.length
    ? summary.topIssues.map((t) => `- **${t.count}x** ${t.issue}`).join('\n')
    : 'No issues detected'}

## Critical Campaigns

${criticalCampaigns.length
    ? criticalCampaigns.map((c) => `- **[${c.campaign_id}]** ${c.campaign_title}: ${c.errors.join('; ')}`).join('\n')
    : 'None'}

## Failed Campaigns

${failedCampaigns.length
    ? failedCampaigns.map((c) =>
        `### Campaign ${c.campaign_id}: ${c.campaign_title}\n` +
        `- Risk: **${c.riskLevel}**\n` +
        c.errors.map((e) => `- ❌ ${e}`).join('\n') + '\n' +
        c.warnings.map((w) => `- ⚠️ ${w}`).join('\n')
      ).join('\n\n')
    : 'All campaigns passed QA'}

## Post QA

${report.postResults.filter((r) => !r.valid).length === 0
    ? 'All posts passed platform validation'
    : report.postResults
        .filter((r) => !r.valid)
        .map((p) => `- **Post ${p.post_id}** (${p.platform}): ${p.errors.join('; ')}`)
        .join('\n')}
`;
}
