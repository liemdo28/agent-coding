// social/CaptionOptimizer.js — Social media caption analysis and optimization
// Offline-only, rule-based. ES module. Node.js 22.

// ── Platform config ────────────────────────────────────────────────────────────

const PLATFORM_CONFIG = {
  instagram: {
    optimalMin: 150, optimalMax: 300,
    absoluteMax: 2200,
    hashtagMin: 5, hashtagMax: 15,
    emojiMin: 1, emojiMax: 8,
    hashtagPlacement: 'end',
    toneStyle: 'casual',
  },
  tiktok: {
    optimalMin: 50, optimalMax: 150,
    absoluteMax: 2200,
    hashtagMin: 3, hashtagMax: 5,
    emojiMin: 1, emojiMax: 6,
    hashtagPlacement: 'body',
    toneStyle: 'casual',
  },
  facebook: {
    optimalMin: 80, optimalMax: 200,
    absoluteMax: 63206,
    hashtagMin: 0, hashtagMax: 3,
    emojiMin: 0, emojiMax: 5,
    hashtagPlacement: 'end',
    toneStyle: 'mixed',
  },
  linkedin: {
    optimalMin: 1300, optimalMax: 2000,
    absoluteMax: 3000,
    hashtagMin: 3, hashtagMax: 5,
    emojiMin: 0, emojiMax: 3,
    hashtagPlacement: 'end',
    toneStyle: 'professional',
  },
};

// ── Strong CTA phrases ─────────────────────────────────────────────────────────

const CTA_PHRASES = [
  'order now', 'order today', 'visit us', 'come in', 'stop by', 'call us',
  'reserve', 'book', 'link in bio', 'tap the link', 'swipe up', 'learn more',
  'try it', 'get yours', 'don\'t miss', 'grab', 'see you', 'follow us',
  'share', 'tag a friend', 'comment below', 'drop a', 'tell us', 'click',
  'save this', 'send this to', 'dm us', 'message us', 'walk in',
];

const WEAK_CTA = [
  'check it out', 'see more', 'find out', 'go to', 'visit our', 'click here',
];

// ── Emoji detection ────────────────────────────────────────────────────────────

function countEmojis(text) {
  // Match Unicode emoji ranges (broad coverage)
  const emojiRe = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  return (text.match(emojiRe) ?? []).length;
}

// ── Hashtag helpers ────────────────────────────────────────────────────────────

function extractHashtags(text) {
  return (text.match(/#\w+/g) ?? []);
}

function detectHashtagPlacement(text, hashtags) {
  if (hashtags.length === 0) return 'none';
  const firstHashtag = text.indexOf(hashtags[0]);
  const textWithout  = text.replace(/#\w+\s*/g, '').trim();
  const bodyLen      = textWithout.length;
  // If all hashtags are in the last 20% of the text length, they're at the end
  if (firstHashtag >= text.length * 0.7) return 'end';
  return 'body';
}

// ── Structure detection ────────────────────────────────────────────────────────

/**
 * Detect whether a caption has Hook + Body + CTA structure.
 * Returns { hasHook, hasBody, hasCTA, hasFinalQuestion, lineBreaks }
 */
export function detectCaptionStructure(caption) {
  if (!caption || typeof caption !== 'string') {
    return { hasHook: false, hasBody: false, hasCTA: false, hasFinalQuestion: false, lineBreaks: 0 };
  }

  const lines      = caption.split('\n');
  const lineBreaks = lines.length - 1;
  const lower      = caption.toLowerCase();

  // Hook = first line / first sentence has ≥5 words
  const firstLine   = lines[0]?.trim() ?? '';
  const hasHook     = firstLine.split(/\s+/).filter(Boolean).length >= 5;

  // Body = more than one paragraph / more than 2 line breaks OR length > 100 chars after first line
  const remainder   = lines.slice(1).join('\n').trim();
  const hasBody     = remainder.length > 60 || lineBreaks >= 2;

  // CTA detection — strong CTA phrase found
  const hasCTA      = CTA_PHRASES.some((p) => lower.includes(p));

  // Final question — last non-empty line is a question
  const nonEmpty    = lines.filter((l) => l.trim().length > 0);
  const lastLine    = nonEmpty[nonEmpty.length - 1]?.trim() ?? '';
  const hasFinalQuestion = lastLine.endsWith('?');

  return { hasHook, hasBody, hasCTA, hasFinalQuestion, lineBreaks };
}

// ── Caption scoring ────────────────────────────────────────────────────────────

/**
 * Score a caption 0-100 for a specific platform.
 */
export function getCaptionScore(caption, platform = 'instagram') {
  if (!caption || typeof caption !== 'string') return 0;

  const cfg      = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.instagram;
  const length   = caption.length;
  const hashtags = extractHashtags(caption);
  const hashtagCount = hashtags.length;
  const emojiCount   = countEmojis(caption);
  const structure    = detectCaptionStructure(caption);
  let score = 0;

  // ── 1. Structure (30 pts) ─────────────────────────────────────────────────
  if (structure.hasHook)          score += 10;
  if (structure.hasBody)          score += 10;
  if (structure.hasCTA)           score += 10;

  // ── 2. Length (25 pts) ───────────────────────────────────────────────────
  if (length >= cfg.optimalMin && length <= cfg.optimalMax) {
    score += 25;
  } else if (length >= cfg.optimalMin * 0.7 && length <= cfg.optimalMax * 1.3) {
    score += 15;
  } else if (length >= cfg.optimalMin * 0.4 && length <= cfg.absoluteMax) {
    score += 8;
  } else {
    score += 2;
  }

  // ── 3. Hashtag count (15 pts) ─────────────────────────────────────────────
  if (hashtagCount >= cfg.hashtagMin && hashtagCount <= cfg.hashtagMax) {
    score += 15;
  } else if (hashtagCount > cfg.hashtagMax) {
    // Penalise over-hashtagging
    score += Math.max(0, 15 - (hashtagCount - cfg.hashtagMax) * 2);
  } else if (hashtagCount > 0) {
    score += 8;
  }

  // ── 4. Hashtag placement (5 pts) ─────────────────────────────────────────
  if (hashtags.length > 0) {
    const placement = detectHashtagPlacement(caption, hashtags);
    if (placement === cfg.hashtagPlacement) score += 5;
    else if (cfg.hashtagPlacement === 'end' && placement === 'body') score += 2;
  }

  // ── 5. Emoji usage (10 pts) ───────────────────────────────────────────────
  if (emojiCount >= cfg.emojiMin && emojiCount <= cfg.emojiMax) {
    score += 10;
  } else if (emojiCount > cfg.emojiMax) {
    score += Math.max(0, 10 - (emojiCount - cfg.emojiMax) * 2);
  } else if (emojiCount === 0 && cfg.emojiMin === 0) {
    score += 10;
  }

  // ── 6. Engagement boosters (15 pts) ──────────────────────────────────────
  if (structure.hasFinalQuestion) score += 7;
  if (structure.lineBreaks >= 2)  score += 5; // readability
  // Strong vs weak CTA bonus
  const lower = caption.toLowerCase();
  const hasStrongCTA = CTA_PHRASES.some((p) => lower.includes(p));
  const hasWeakCTA   = WEAK_CTA.some((p) => lower.includes(p));
  if (hasStrongCTA && !hasWeakCTA) score += 3;

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── Full analysis ──────────────────────────────────────────────────────────────

/**
 * Comprehensive caption analysis.
 */
export function analyzeCaption(caption, platform = 'instagram') {
  if (!caption || typeof caption !== 'string') {
    return { score: 0, grade: 'F', issues: ['Caption is empty'], suggestions: [] };
  }

  const cfg          = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.instagram;
  const length       = caption.length;
  const hashtags     = extractHashtags(caption);
  const hashtagCount = hashtags.length;
  const emojiCount   = countEmojis(caption);
  const structure    = detectCaptionStructure(caption);
  const placement    = detectHashtagPlacement(caption, hashtags);
  const score        = getCaptionScore(caption, platform);

  const issues      = [];
  const suggestions = [];

  // Structure checks
  if (!structure.hasHook)          issues.push('Missing hook (first line too short or weak).');
  if (!structure.hasBody)          issues.push('Missing body — add supporting detail or storytelling.');
  if (!structure.hasCTA)           issues.push('Missing call to action.');
  if (!structure.hasFinalQuestion) suggestions.push('Add a question at the end to encourage comments.');

  // Length checks
  if (length < cfg.optimalMin) {
    issues.push(`Caption too short: ${length} chars. Optimal for ${platform} is ${cfg.optimalMin}–${cfg.optimalMax} chars.`);
  } else if (length > cfg.optimalMax && length <= cfg.absoluteMax) {
    suggestions.push(`Caption is ${length} chars — consider trimming to ${cfg.optimalMax} chars for optimal ${platform} display.`);
  } else if (length > cfg.absoluteMax) {
    issues.push(`Caption exceeds ${platform} character limit (${cfg.absoluteMax}).`);
  }

  // Hashtag checks
  if (hashtagCount < cfg.hashtagMin) {
    issues.push(`Too few hashtags: ${hashtagCount}. Use ${cfg.hashtagMin}–${cfg.hashtagMax} for ${platform}.`);
  } else if (hashtagCount > cfg.hashtagMax) {
    issues.push(`Too many hashtags: ${hashtagCount}. Maximum for ${platform} is ${cfg.hashtagMax}.`);
  }

  if (hashtagCount > 0 && placement !== cfg.hashtagPlacement) {
    suggestions.push(`Move hashtags to the ${cfg.hashtagPlacement} of the caption for ${platform} best practice.`);
  }

  // Emoji checks
  if (emojiCount > cfg.emojiMax) {
    suggestions.push(`Reduce emojis to ${cfg.emojiMax} or fewer for ${platform} — currently using ${emojiCount}.`);
  }

  // Readability
  if (structure.lineBreaks < 2 && length > 100) {
    suggestions.push('Add line breaks to improve readability — walls of text reduce engagement.');
  }

  let grade;
  if (score >= 85)      grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else                  grade = 'F';

  return {
    score, grade, platform,
    length, hashtagCount, emojiCount,
    hashtagPlacement: placement,
    structure, issues, suggestions,
    config: { optimalLength: `${cfg.optimalMin}–${cfg.optimalMax}`, hashtagRange: `${cfg.hashtagMin}–${cfg.hashtagMax}` },
  };
}

// ── Caption optimizer ──────────────────────────────────────────────────────────

/**
 * Attempt lightweight automated optimization of a caption.
 * Returns { original, optimized, changes[] }
 */
export function optimizeCaption(caption, platform = 'instagram') {
  if (!caption || typeof caption !== 'string') return { original: caption, optimized: caption, changes: [] };

  const cfg     = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.instagram;
  let text      = caption.trim();
  const changes = [];

  // 1. Move hashtags to correct placement if needed
  const hashtags = extractHashtags(text);
  if (hashtags.length > 0) {
    const placement = detectHashtagPlacement(text, hashtags);
    if (cfg.hashtagPlacement === 'end' && placement === 'body') {
      const withoutTags = text.replace(/#\w+\s*/g, '').replace(/\s{2,}/g, ' ').trim();
      const tagStr      = hashtags.join(' ');
      text = `${withoutTags}\n\n${tagStr}`;
      changes.push('Moved hashtags to end of caption.');
    }
  }

  // 2. Trim to platform absolute max
  if (text.length > cfg.absoluteMax) {
    text = text.slice(0, cfg.absoluteMax - 3) + '...';
    changes.push(`Trimmed caption to ${cfg.absoluteMax} character platform limit.`);
  }

  // 3. Add missing line breaks if long and no breaks
  const lineBreaks = (text.match(/\n/g) ?? []).length;
  if (lineBreaks === 0 && text.length > 150) {
    // Find a natural sentence break around 40% of the text
    const half = Math.floor(text.length * 0.4);
    const sentenceEnd = text.indexOf('. ', half);
    if (sentenceEnd !== -1 && sentenceEnd < text.length * 0.7) {
      text = text.slice(0, sentenceEnd + 1) + '\n\n' + text.slice(sentenceEnd + 2);
      changes.push('Added paragraph break for readability.');
    }
  }

  // 4. Add simple CTA if none detected
  const lower = text.toLowerCase();
  const hasCTA = CTA_PHRASES.some((p) => lower.includes(p));
  if (!hasCTA && platform === 'instagram') {
    text = text + '\n\n👇 Visit us today or tap the link in bio to learn more!';
    changes.push('Added default CTA for Instagram.');
  } else if (!hasCTA && platform === 'tiktok') {
    text = text + '\n\nFollow for more! 🔥';
    changes.push('Added default CTA for TikTok.');
  }

  return { original: caption, optimized: text, changes };
}
