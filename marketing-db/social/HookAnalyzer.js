// social/HookAnalyzer.js — Social media hook quality analysis engine
// Offline-only, rule-based scoring. ES module. Node.js 22.

// ── Word lists ─────────────────────────────────────────────────────────────────

const POWER_WORDS = [
  'secret', 'exclusive', 'never', 'always', 'finally', 'imagine', 'proven',
  'shocking', 'hidden', 'revealed', 'insider', 'forbidden', 'ultimate',
  'guaranteed', 'effortless', 'instantly', 'immediately', 'unleash',
  'transform', 'extraordinary', 'remarkable', 'unbelievable', 'surprising',
];

const URGENCY_WORDS = [
  'today', 'now', 'limited', 'last chance', 'hurry', 'ends soon', 'deadline',
  'don\'t miss', 'only', 'just', 'act now', 'expires', 'while supplies last',
  'running out', 'almost gone',
];

const QUESTION_STARTERS = ['what', 'why', 'how', 'did', 'have you', 'are you',
  'do you', 'would you', 'can you', 'is this', 'which', 'who'];

// ── Platform ideal lengths (word counts) ──────────────────────────────────────

const IDEAL_LENGTH = {
  instagram: { min: 6, max: 10 },
  tiktok:    { min: 5, max: 8 },
  facebook:  { min: 6, max: 12 },
  linkedin:  { min: 8, max: 15 },
};

// ── Hook type classifiers ──────────────────────────────────────────────────────

/**
 * Classify the hook type of a given text.
 * Returns one of: 'question' | 'number-based' | 'surprise' | 'story' | 'direct'
 */
export function classifyHookType(text) {
  if (!text || typeof text !== 'string') return 'direct';
  const lower = text.trim().toLowerCase();

  // Question hook
  if (lower.endsWith('?') || QUESTION_STARTERS.some((q) => lower.startsWith(q))) {
    return 'question';
  }

  // Number-based hook — starts with digit or written number
  if (/^\d+\s+\w/.test(lower) || /^(one|two|three|four|five|six|seven|eight|nine|ten)\s+/i.test(lower)) {
    return 'number-based';
  }

  // Story start hook
  if (/^i\s+(was|am|used to|couldn't|can't|never|always|had|have|found|discovered|tried)/i.test(lower)
    || /^(my|our|we|the day|last (week|month|year|night))/i.test(lower)) {
    return 'story';
  }

  // Surprise / curiosity gap — contains ellipsis, em dash reveal, or "you won't believe"
  if (lower.includes('...') || lower.includes('—') || lower.includes('but')
    || /you (won't|will never|can't) believe/i.test(lower)
    || /\bwait\b|\bsurprise\b|\bshock/i.test(lower)) {
    return 'surprise';
  }

  return 'direct';
}

// ── Core scoring ───────────────────────────────────────────────────────────────

/**
 * Score a hook 0-100 for a specific platform.
 */
export function scoreHook(text, platform = 'instagram') {
  if (!text || typeof text !== 'string') return 0;

  const trimmed = text.trim();
  const lower   = trimmed.toLowerCase();
  const words   = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  let score = 0;

  // ── 1. Hook type base score (30 pts) ──────────────────────────────────────
  const hookType = classifyHookType(trimmed);
  const typeScore = {
    question:     30,
    'number-based': 28,
    surprise:     26,
    story:        24,
    direct:       18,
  };
  score += typeScore[hookType] ?? 18;

  // ── 2. Length scoring (25 pts) ────────────────────────────────────────────
  const ideal = IDEAL_LENGTH[platform] ?? IDEAL_LENGTH.instagram;
  if (wordCount >= ideal.min && wordCount <= ideal.max) {
    score += 25;
  } else if (wordCount >= ideal.min - 1 && wordCount <= ideal.max + 2) {
    score += 18;
  } else if (wordCount >= ideal.min - 2 && wordCount <= ideal.max + 4) {
    score += 10;
  } else {
    score += 3;
  }

  // ── 3. Power word bonus (20 pts max) ─────────────────────────────────────
  const powerHits = POWER_WORDS.filter((w) => lower.includes(w));
  score += Math.min(20, powerHits.length * 8);

  // ── 4. Urgency word bonus (10 pts max) ───────────────────────────────────
  const urgencyHits = URGENCY_WORDS.filter((w) => lower.includes(w));
  score += Math.min(10, urgencyHits.length * 5);

  // ── 5. Quality modifiers (15 pts) ────────────────────────────────────────
  // Starts with a capital letter — basic polish
  if (/^[A-Z]/.test(trimmed)) score += 3;

  // Has a number (specific = credible)
  if (/\d/.test(trimmed)) score += 4;

  // Does NOT start with "I just" or "So I" (weak openers)
  if (!/^(so i|i just|basically|actually)/i.test(lower)) score += 4;

  // Ends with punctuation (intentional close)
  if (/[.!?…]$/.test(trimmed)) score += 4;

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── Main analysis function ─────────────────────────────────────────────────────

/**
 * Full hook analysis.
 * @param {string} hookText   The first line/sentence of the post.
 * @param {string} platform   'instagram' | 'tiktok' | 'facebook' | 'linkedin'
 * @returns {{ score, hookType, powerWords, urgencyWords, wordCount, lengthOk, grade }}
 */
export function analyzeHook(hookText, platform = 'instagram') {
  if (!hookText || typeof hookText !== 'string') {
    return { score: 0, hookType: 'direct', powerWords: [], urgencyWords: [],
             wordCount: 0, lengthOk: false, grade: 'F' };
  }

  const trimmed    = hookText.trim();
  const lower      = trimmed.toLowerCase();
  const words      = trimmed.split(/\s+/).filter(Boolean);
  const wordCount  = words.length;
  const ideal      = IDEAL_LENGTH[platform] ?? IDEAL_LENGTH.instagram;
  const score      = scoreHook(trimmed, platform);
  const hookType   = classifyHookType(trimmed);
  const powerWords = POWER_WORDS.filter((w) => lower.includes(w));
  const urgencyWords = URGENCY_WORDS.filter((w) => lower.includes(w));
  const lengthOk   = wordCount >= ideal.min && wordCount <= ideal.max;

  let grade;
  if (score >= 85)      grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else                  grade = 'F';

  return { score, hookType, powerWords, urgencyWords, wordCount, lengthOk,
           idealRange: ideal, grade, platform };
}

// ── Recommendations ────────────────────────────────────────────────────────────

/**
 * Return actionable recommendations to improve a hook.
 */
export function getHookRecommendations(text, platform = 'instagram') {
  const analysis = analyzeHook(text, platform);
  const recs = [];

  if (analysis.score >= 85) {
    recs.push('Hook is strong — no major changes needed.');
    return recs;
  }

  const ideal = analysis.idealRange;

  if (!analysis.lengthOk) {
    if (analysis.wordCount < ideal.min) {
      recs.push(`Hook is too short (${analysis.wordCount} words). Aim for ${ideal.min}–${ideal.max} words to maximize impact.`);
    } else {
      recs.push(`Hook is too long (${analysis.wordCount} words). Tighten it to ${ideal.min}–${ideal.max} words for ${platform}.`);
    }
  }

  if (analysis.hookType === 'direct') {
    recs.push('Consider rewriting as a question, a number-based list opener, or a curiosity gap to boost engagement.');
  }

  if (analysis.powerWords.length === 0) {
    recs.push(`Add a power word (e.g., "secret", "proven", "exclusive") to increase click-through.`);
  }

  if (analysis.urgencyWords.length === 0 && platform !== 'linkedin') {
    recs.push('Add urgency language ("today", "limited", "now") to drive immediate action.');
  }

  if (!/\d/.test(text)) {
    recs.push('Include a specific number to boost credibility and clarity (e.g., "3 reasons…", "5-minute…").');
  }

  if (analysis.hookType !== 'question' && platform === 'instagram') {
    recs.push('Instagram hooks that ask a question drive 2× more comments — try reformatting as a question.');
  }

  if (analysis.hookType !== 'question' && platform === 'tiktok') {
    recs.push('TikTok algorithms favour hooks that create curiosity gaps or start with a provocative question.');
  }

  if (recs.length === 0) {
    recs.push('Hook is good. Minor polish: ensure it starts with a capital letter and ends with punctuation.');
  }

  return recs;
}
