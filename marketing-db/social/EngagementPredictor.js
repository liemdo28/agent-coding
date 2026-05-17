// social/EngagementPredictor.js — Predicts engagement level for social posts
// Offline-only, rule-based scoring. ES module. Node.js 22.

// ── Platform engagement multipliers ────────────────────────────────────────────

const PLATFORM_MULTIPLIERS = {
  instagram: 1.0,
  tiktok:    1.4,  // Highest organic reach
  facebook:  0.7,  // Declining organic reach
  linkedin:  0.85,
};

// ── Content type weights (base score contribution) ─────────────────────────────

const CONTENT_TYPE_WEIGHTS = {
  reel:           40,
  video:          38,
  carousel:       30,
  story:          22,
  single_image:   18,
  text:           12,
  live:           36,
};

// Platform-specific content type overrides
const PLATFORM_CONTENT_WEIGHTS = {
  tiktok: {
    reel: 45, video: 45, carousel: 25, story: 18, single_image: 15, text: 10, live: 40,
  },
  linkedin: {
    reel: 28, video: 30, carousel: 35, story: 15, single_image: 22, text: 30, live: 25,
  },
  instagram: {
    reel: 42, video: 38, carousel: 32, story: 24, single_image: 20, text: 12, live: 34,
  },
  facebook: {
    reel: 30, video: 35, carousel: 28, story: 18, single_image: 16, text: 18, live: 32,
  },
};

// ── Time-of-day scoring (0-25 pts) ─────────────────────────────────────────────

const TIME_WINDOWS = [
  // [startHour, endHour, score, label]
  [7,  9,  18, 'morning commute'],
  [11, 13, 25, 'lunch peak'],
  [17, 19, 22, 'evening commute / dinner'],
  [19, 21, 20, 'prime evening'],
  [12, 14, 20, 'lunch browse'],
  [9,  11, 14, 'mid-morning'],
  [13, 17, 12, 'afternoon slump'],
  [21, 23, 10, 'late night'],
  [0,   7,  4, 'overnight'],
  [23, 24,  5, 'late night tail'],
];

// ── Day-of-week scoring (0-20 pts) ────────────────────────────────────────────

// 0=Sunday … 6=Saturday
const DAY_SCORES = {
  0: { score: 14, label: 'Sunday' },       // Good for food browsing
  1: { score: 10, label: 'Monday' },       // Lower engagement
  2: { score: 12, label: 'Tuesday' },
  3: { score: 18, label: 'Wednesday' },    // Mid-week peak for food
  4: { score: 20, label: 'Thursday' },     // Pre-weekend high
  5: { score: 20, label: 'Friday' },       // Highest for restaurant content
  6: { score: 18, label: 'Saturday' },     // High for dining out
};

// ── Seasonal factors (by month, 0-indexed) ─────────────────────────────────────

const SEASONAL_MULTIPLIERS = {
  0:  0.90, // January  — post-holiday slump
  1:  0.92, // February — Valentine's boost
  2:  0.95, // March    — spring uptick
  3:  0.98, // April    — spring dining
  4:  1.00, // May      — Mother's Day, warm weather
  5:  1.05, // June     — summer socializing
  6:  1.05, // July     — summer peak
  7:  1.02, // August   — end of summer
  8:  0.97, // September — back to routine
  9:  1.03, // October  — fall flavors, Halloween
  10: 1.08, // November  — Thanksgiving push
  11: 1.10, // December  — holiday season peak
};

// ── Best post times database ───────────────────────────────────────────────────

const BEST_POST_TIMES = {
  instagram: [
    { time: '11:00 AM – 1:00 PM', day: 'Wednesday–Friday', reason: 'Lunch scrolling peak' },
    { time: '5:00 PM – 7:00 PM', day: 'Monday–Friday', reason: 'After-work browsing' },
    { time: '7:00 AM – 9:00 AM', day: 'Thursday–Friday', reason: 'Morning routine check' },
  ],
  tiktok: [
    { time: '7:00 PM – 9:00 PM', day: 'Tuesday–Friday', reason: 'Prime TikTok viewing window' },
    { time: '12:00 PM – 1:00 PM', day: 'Any weekday', reason: 'Lunch break scrolling' },
    { time: '6:00 AM – 8:00 AM', day: 'Monday–Wednesday', reason: 'Morning routine start' },
  ],
  facebook: [
    { time: '1:00 PM – 3:00 PM', day: 'Wednesday', reason: 'Highest Facebook engagement window' },
    { time: '12:00 PM – 1:00 PM', day: 'Friday', reason: 'Friday lunch engagement' },
    { time: '9:00 AM – 10:00 AM', day: 'Thursday', reason: 'Morning news browse' },
  ],
  linkedin: [
    { time: '7:00 AM – 8:30 AM', day: 'Tuesday–Thursday', reason: 'Pre-work professional check' },
    { time: '12:00 PM – 1:00 PM', day: 'Tuesday–Thursday', reason: 'Business lunch scroll' },
    { time: '5:00 PM – 6:00 PM', day: 'Tuesday–Wednesday', reason: 'End-of-day review' },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTimeScore(hour) {
  for (const [start, end, score] of TIME_WINDOWS) {
    if (hour >= start && hour < end) return score;
  }
  return 5;
}

function getDayScore(dayOfWeek) {
  return DAY_SCORES[dayOfWeek] ?? { score: 12, label: 'Weekday' };
}

function getSeasonalMultiplier(month) {
  const m = typeof month === 'number' ? month : new Date().getMonth();
  return SEASONAL_MULTIPLIERS[m] ?? 1.0;
}

// ── Public exports ─────────────────────────────────────────────────────────────

/**
 * Get the base score contribution for a content type on a given platform.
 */
export function getContentTypeMultiplier(contentType, platform = 'instagram') {
  const type   = (contentType ?? 'single_image').toLowerCase().replace(/\s+/g, '_');
  const pfWeights = PLATFORM_CONTENT_WEIGHTS[platform] ?? PLATFORM_CONTENT_WEIGHTS.instagram;
  return pfWeights[type] ?? CONTENT_TYPE_WEIGHTS[type] ?? 15;
}

/**
 * Return best post times for a given platform.
 */
export function getBestPostTimes(platform = 'instagram') {
  return BEST_POST_TIMES[platform] ?? BEST_POST_TIMES.instagram;
}

/**
 * Predict engagement level for a post.
 *
 * @param {object} postData            Post metadata: { platform, hookScore, captionScore, hasEmoji, hashtagCount }
 * @param {object} timing              { postTime: Date | number (hour 0-23), dayOfWeek: 0-6, contentType: string, month?: number }
 * @returns {{ predictedEngagement, score, grade, bestPostTime, reasoning }}
 */
export function predictEngagement(postData = {}, { postTime, dayOfWeek, contentType = 'single_image', month } = {}) {
  const platform   = (postData.platform ?? 'instagram').toLowerCase();
  const pfMult     = PLATFORM_MULTIPLIERS[platform] ?? 1.0;

  const reasoning  = [];
  let rawScore     = 0;

  // ── 1. Content type (0-45 pts) ────────────────────────────────────────────
  const contentScore = getContentTypeMultiplier(contentType, platform);
  rawScore += contentScore;
  reasoning.push(`Content type "${contentType}" on ${platform}: +${contentScore} pts`);

  // ── 2. Time of day (0-25 pts) ─────────────────────────────────────────────
  let hour = null;
  if (postTime instanceof Date) {
    hour = postTime.getHours();
  } else if (typeof postTime === 'number' && postTime >= 0 && postTime <= 23) {
    hour = postTime;
  }

  const timeScore = hour !== null ? getTimeScore(hour) : 12; // default to mid-value
  rawScore += timeScore;
  if (hour !== null) {
    reasoning.push(`Post time ${hour}:00 — time window score: +${timeScore} pts`);
  } else {
    reasoning.push(`Post time unknown — estimated time score: +${timeScore} pts`);
  }

  // ── 3. Day of week (0-20 pts) ─────────────────────────────────────────────
  let dow = dayOfWeek;
  if (dow === undefined || dow === null) dow = new Date().getDay();
  const dayInfo  = getDayScore(dow);
  rawScore      += dayInfo.score;
  reasoning.push(`${dayInfo.label} posting — day score: +${dayInfo.score} pts`);

  // ── 4. Content quality signals (0-20 pts) ────────────────────────────────
  let qualityScore = 0;

  if (typeof postData.hookScore === 'number') {
    const hookContrib = Math.round(postData.hookScore * 0.10); // up to 10 pts
    qualityScore += hookContrib;
    reasoning.push(`Hook score ${postData.hookScore}/100 → +${hookContrib} quality pts`);
  }

  if (typeof postData.captionScore === 'number') {
    const captionContrib = Math.round(postData.captionScore * 0.05); // up to 5 pts
    qualityScore += captionContrib;
    reasoning.push(`Caption score ${postData.captionScore}/100 → +${captionContrib} quality pts`);
  }

  if (postData.hasEmoji) {
    qualityScore += 3;
    reasoning.push('Emoji usage detected: +3 pts');
  }

  if (typeof postData.hashtagCount === 'number') {
    const htPlatformMax = { instagram: 15, tiktok: 5, facebook: 3, linkedin: 5 };
    const max = htPlatformMax[platform] ?? 10;
    if (postData.hashtagCount >= 3 && postData.hashtagCount <= max) {
      qualityScore += 4;
      reasoning.push(`Hashtag count ${postData.hashtagCount} is optimal: +4 pts`);
    } else if (postData.hashtagCount > 0) {
      qualityScore += 2;
    }
  }

  rawScore += Math.min(20, qualityScore);

  // ── 5. Seasonal factor ────────────────────────────────────────────────────
  const seasonal = getSeasonalMultiplier(month);
  rawScore = Math.round(rawScore * seasonal);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mIdx = typeof month === 'number' ? month : new Date().getMonth();
  reasoning.push(`${monthNames[mIdx]} seasonal multiplier: ×${seasonal.toFixed(2)}`);

  // ── 6. Platform multiplier ────────────────────────────────────────────────
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore * pfMult)));
  reasoning.push(`${platform} platform multiplier: ×${pfMult.toFixed(2)} → final score: ${finalScore}`);

  // ── Classify level ────────────────────────────────────────────────────────
  let predictedEngagement;
  let grade;
  if (finalScore >= 75) {
    predictedEngagement = 'HIGH';
    grade = 'A';
  } else if (finalScore >= 50) {
    predictedEngagement = 'MEDIUM';
    grade = 'B';
  } else if (finalScore >= 30) {
    predictedEngagement = 'LOW';
    grade = 'C';
  } else {
    predictedEngagement = 'VERY LOW';
    grade = 'D';
  }

  const bestTimes = getBestPostTimes(platform);
  const bestPostTime = bestTimes[0]
    ? `${bestTimes[0].time} (${bestTimes[0].day}) — ${bestTimes[0].reason}`
    : 'Check platform best practices';

  return {
    predictedEngagement,
    score: finalScore,
    grade,
    platform,
    contentType,
    bestPostTime,
    allBestTimes: bestTimes,
    reasoning,
  };
}
