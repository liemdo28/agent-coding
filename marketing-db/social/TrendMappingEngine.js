// social/TrendMappingEngine.js — Maps content to restaurant marketing trends
// Offline-only, static database of curated trends. ES module. Node.js 22.

// ── Evergreen trend database by brand type ─────────────────────────────────────

const EVERGREEN_TRENDS = {
  restaurant: [
    { id: 'behind-scenes-kitchen', name: 'Behind-the-Scenes Kitchen', formats: ['reel', 'video', 'story'], description: 'Show prep, plating, and kitchen activity in real-time.', engagementScore: 88 },
    { id: 'chef-spotlight', name: 'Chef Spotlight', formats: ['reel', 'carousel', 'video'], description: 'Feature the chef: background, inspiration, signature dish.', engagementScore: 84 },
    { id: 'ingredient-sourcing', name: 'Ingredient Sourcing Story', formats: ['carousel', 'reel', 'story'], description: 'Where the ingredients come from — farm, fish market, import.', engagementScore: 80 },
    { id: 'food-prep-reveal', name: 'Food Prep ASMR / Reveal', formats: ['reel', 'video'], description: 'Slow-motion or ASMR-style prep: chopping, pouring broth, plating.', engagementScore: 86 },
    { id: 'customer-reaction', name: 'Customer First-Bite Reaction', formats: ['reel', 'video', 'story'], description: 'Capture genuine reactions to signature dishes.', engagementScore: 82 },
    { id: 'team-introduction', name: 'Team / Staff Introduction', formats: ['carousel', 'reel'], description: 'Show the faces behind the restaurant — builds trust.', engagementScore: 72 },
    { id: 'daily-special', name: 'Daily Special Reveal', formats: ['story', 'reel', 'single_image'], description: 'Quick announcement of today\'s special or limited item.', engagementScore: 76 },
    { id: 'table-tour', name: 'Table / Ambiance Tour', formats: ['reel', 'video'], description: 'Walk through the dining experience — decor, atmosphere, vibe.', engagementScore: 70 },
    { id: 'how-its-made', name: '"How It\'s Made" Explainer', formats: ['carousel', 'reel', 'video'], description: 'Step-by-step breakdown of how a signature dish is made.', engagementScore: 85 },
    { id: 'food-close-up', name: 'Hero Food Close-Up Shot', formats: ['single_image', 'carousel'], description: 'Macro/close-up photography of signature dishes.', engagementScore: 78 },
  ],
  ramen: [
    { id: 'broth-reveal', name: 'Broth Simmering Reveal', formats: ['reel', 'video'], description: '24-hour broth process — shows craftsmanship.', engagementScore: 90 },
    { id: 'noodle-pull', name: 'Noodle Pull Shot', formats: ['reel', 'single_image'], description: 'Slow noodle lift from bowl — highly shareable.', engagementScore: 88 },
    { id: 'toppings-assembly', name: 'Toppings Assembly Montage', formats: ['reel', 'video'], description: 'Time-lapse of toppings being placed one by one.', engagementScore: 85 },
    { id: 'ramen-variety', name: 'Ramen Menu Showcase Carousel', formats: ['carousel'], description: 'Show every bowl option side by side.', engagementScore: 79 },
  ],
  sushi: [
    { id: 'fish-cut', name: 'Sashimi Cutting Technique', formats: ['reel', 'video'], description: 'Skilled knife work — mesmerizing and credibility-building.', engagementScore: 92 },
    { id: 'roll-assembly', name: 'Roll Assembly Time-Lapse', formats: ['reel', 'video'], description: 'Full roll creation from rice to slice.', engagementScore: 89 },
    { id: 'fish-freshness', name: 'Fish Freshness / Delivery', formats: ['story', 'reel'], description: 'Show fresh fish arrival — signals quality.', engagementScore: 83 },
    { id: 'sushi-plating', name: 'Artistic Sushi Plating', formats: ['single_image', 'carousel'], description: 'Overhead beauty shot of finished platter.', engagementScore: 86 },
    { id: 'omakase-experience', name: 'Omakase Journey Carousel', formats: ['carousel'], description: 'Walk through a multi-course omakase experience.', engagementScore: 80 },
  ],
  fast_casual: [
    { id: 'speed-of-service', name: 'Speed-of-Service Reel', formats: ['reel', 'video'], description: 'Show fast, efficient food prep and delivery.', engagementScore: 74 },
    { id: 'customization', name: 'Customization Demo', formats: ['reel', 'carousel'], description: 'Show all topping/protein options for a build-your-own item.', engagementScore: 78 },
    { id: 'value-deal', name: 'Deal / Value Highlight', formats: ['story', 'single_image', 'carousel'], description: 'Promote combo deals or value meals visually.', engagementScore: 82 },
  ],
};

// ── Platform trending formats by month ────────────────────────────────────────

const TRENDING_FORMATS = {
  instagram: {
    // Month 1-12 → { primary, secondary, notes }
    1:  { primary: 'carousel', secondary: 'reel', notes: 'New Year menus, resolution content' },
    2:  { primary: 'reel', secondary: 'carousel', notes: 'Valentine\'s specials, couple dining' },
    3:  { primary: 'reel', secondary: 'story', notes: 'Spring menu launches' },
    4:  { primary: 'carousel', secondary: 'reel', notes: 'Spring flavors, Easter specials' },
    5:  { primary: 'reel', secondary: 'single_image', notes: 'Mother\'s Day, outdoor dining' },
    6:  { primary: 'reel', secondary: 'story', notes: 'Summer drinks, patio content' },
    7:  { primary: 'video', secondary: 'reel', notes: 'Summer food, outdoor events' },
    8:  { primary: 'reel', secondary: 'carousel', notes: 'End-of-summer specials' },
    9:  { primary: 'carousel', secondary: 'reel', notes: 'Fall menu reveals, back-to-school' },
    10: { primary: 'reel', secondary: 'carousel', notes: 'Halloween food, fall flavors' },
    11: { primary: 'carousel', secondary: 'reel', notes: 'Thanksgiving, holiday menus' },
    12: { primary: 'reel', secondary: 'carousel', notes: 'Holiday season, New Year\'s Eve events' },
  },
  tiktok: {
    1:  { primary: 'video', secondary: 'reel', notes: 'Trend challenges, new year food resolutions' },
    2:  { primary: 'reel', secondary: 'video', notes: 'Valentine\'s Day food gift ideas' },
    3:  { primary: 'video', secondary: 'reel', notes: 'ASMR food content trending' },
    4:  { primary: 'reel', secondary: 'video', notes: 'Spring food trends, visually satisfying content' },
    5:  { primary: 'video', secondary: 'reel', notes: 'Mom appreciation, restaurant tours' },
    6:  { primary: 'reel', secondary: 'video', notes: 'Summer foods, drinks, cool-down content' },
    7:  { primary: 'video', secondary: 'reel', notes: 'BBQ, outdoor food, viral challenges' },
    8:  { primary: 'reel', secondary: 'video', notes: 'Back-to-school meal prep, quick bites' },
    9:  { primary: 'video', secondary: 'reel', notes: 'Fall comfort food' },
    10: { primary: 'reel', secondary: 'video', notes: 'Halloween-themed food content' },
    11: { primary: 'video', secondary: 'reel', notes: 'Holiday cooking, Thanksgiving content' },
    12: { primary: 'reel', secondary: 'video', notes: 'Holiday season, year-in-review food' },
  },
  facebook: {
    1:  { primary: 'video', secondary: 'single_image', notes: 'Community-focused updates, promotions' },
    2:  { primary: 'single_image', secondary: 'video', notes: 'Valentine\'s day event promotions' },
    3:  { primary: 'carousel', secondary: 'video', notes: 'Spring specials, menu updates' },
    4:  { primary: 'single_image', secondary: 'carousel', notes: 'Easter events, spring promotion' },
    5:  { primary: 'video', secondary: 'single_image', notes: 'Mother\'s Day specials, events' },
    6:  { primary: 'carousel', secondary: 'video', notes: 'Summer specials, loyalty promotions' },
    7:  { primary: 'video', secondary: 'carousel', notes: 'Summer events, community posts' },
    8:  { primary: 'single_image', secondary: 'video', notes: 'End-of-summer deals' },
    9:  { primary: 'carousel', secondary: 'single_image', notes: 'Fall menu announcements' },
    10: { primary: 'video', secondary: 'carousel', notes: 'Halloween events, fall specials' },
    11: { primary: 'single_image', secondary: 'video', notes: 'Holiday deals, Thanksgiving' },
    12: { primary: 'carousel', secondary: 'video', notes: 'Holiday events, year-end promotions' },
  },
  linkedin: {
    1:  { primary: 'carousel', secondary: 'text', notes: 'Business goals, team highlights' },
    2:  { primary: 'text', secondary: 'single_image', notes: 'Behind-the-business story' },
    3:  { primary: 'carousel', secondary: 'text', notes: 'Q1 milestones, expansion news' },
    4:  { primary: 'single_image', secondary: 'carousel', notes: 'Community involvement, spring hiring' },
    5:  { primary: 'text', secondary: 'carousel', notes: 'Team appreciation, Mother\'s Day story' },
    6:  { primary: 'carousel', secondary: 'video', notes: 'Mid-year business update' },
    7:  { primary: 'single_image', secondary: 'text', notes: 'Team building, summer update' },
    8:  { primary: 'carousel', secondary: 'text', notes: 'Back-to-work, operations story' },
    9:  { primary: 'text', secondary: 'carousel', notes: 'Q3 recap, fall business update' },
    10: { primary: 'carousel', secondary: 'video', notes: 'Growth milestones, case study' },
    11: { primary: 'text', secondary: 'carousel', notes: 'Gratitude posts, year-in-review' },
    12: { primary: 'carousel', secondary: 'video', notes: 'Year-in-review, holiday team post' },
  },
};

// ── Content keyword → trend mapping ───────────────────────────────────────────

const CONTENT_KEYWORD_MAP = [
  { keywords: ['broth', 'soup', 'simmer', 'boil'], trendId: 'broth-reveal', brandType: 'ramen' },
  { keywords: ['noodle', 'ramen', 'bowl'], trendId: 'noodle-pull', brandType: 'ramen' },
  { keywords: ['topping', 'garnish', 'assemble', 'build'], trendId: 'toppings-assembly', brandType: 'ramen' },
  { keywords: ['fish', 'salmon', 'tuna', 'cut', 'slice', 'knife'], trendId: 'fish-cut', brandType: 'sushi' },
  { keywords: ['roll', 'sushi', 'maki', 'wrap'], trendId: 'roll-assembly', brandType: 'sushi' },
  { keywords: ['fresh', 'delivery', 'arrival', 'market'], trendId: 'fish-freshness', brandType: 'sushi' },
  { keywords: ['plate', 'plating', 'presentation', 'art', 'beautiful'], trendId: 'sushi-plating', brandType: 'sushi' },
  { keywords: ['kitchen', 'behind', 'prep', 'cook', 'fire', 'station'], trendId: 'behind-scenes-kitchen', brandType: 'restaurant' },
  { keywords: ['chef', 'cook', 'head chef', 'executive'], trendId: 'chef-spotlight', brandType: 'restaurant' },
  { keywords: ['farm', 'source', 'local', 'organic', 'ingredient', 'supplier'], trendId: 'ingredient-sourcing', brandType: 'restaurant' },
  { keywords: ['reaction', 'first bite', 'taste', 'try', 'customer'], trendId: 'customer-reaction', brandType: 'restaurant' },
  { keywords: ['team', 'staff', 'meet', 'employee', 'crew'], trendId: 'team-introduction', brandType: 'restaurant' },
  { keywords: ['special', 'today', 'limited', 'daily', 'feature'], trendId: 'daily-special', brandType: 'restaurant' },
  { keywords: ['decor', 'ambiance', 'vibe', 'atmosphere', 'tour', 'inside'], trendId: 'table-tour', brandType: 'restaurant' },
  { keywords: ['how', 'make', 'process', 'step', 'recipe'], trendId: 'how-its-made', brandType: 'restaurant' },
  { keywords: ['close up', 'macro', 'shot', 'photo', 'image'], trendId: 'food-close-up', brandType: 'restaurant' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAllEvergreenTrends(brandType) {
  const base = EVERGREEN_TRENDS.restaurant ?? [];
  const specific = EVERGREEN_TRENDS[brandType] ?? [];
  // Merge: specific overrides or extends
  const seen = new Set(specific.map((t) => t.id));
  return [...specific, ...base.filter((t) => !seen.has(t.id))];
}

function findTrendById(trendId, brandType) {
  const all = getAllEvergreenTrends(brandType);
  return all.find((t) => t.id === trendId) ?? null;
}

// ── Public exports ─────────────────────────────────────────────────────────────

/**
 * Get trending content formats for a platform in a given month.
 * @param {string} platform   'instagram' | 'tiktok' | 'facebook' | 'linkedin'
 * @param {number} month      1-12 (1=January). Defaults to current month.
 */
export function getTrendingFormats(platform = 'instagram', month = null) {
  const m = month ?? (new Date().getMonth() + 1);
  const pfMap = TRENDING_FORMATS[platform] ?? TRENDING_FORMATS.instagram;
  const monthData = pfMap[m] ?? pfMap[1];
  return {
    platform,
    month: m,
    primaryFormat: monthData.primary,
    secondaryFormat: monthData.secondary,
    notes: monthData.notes,
    recommendation: `Focus on ${monthData.primary} content this month — ${monthData.notes}. Secondary: ${monthData.secondary}.`,
  };
}

/**
 * Get evergreen (always-relevant) trends for a brand type.
 * @param {string} brandType  'restaurant' | 'ramen' | 'sushi' | 'fast_casual'
 */
export function getEvergreenTrends(brandType = 'restaurant') {
  return getAllEvergreenTrends(brandType).sort((a, b) => b.engagementScore - a.engagementScore);
}

/**
 * Map a content description to matching trends.
 * @param {string} contentDescription  Free-text description of the content
 * @param {string} platform            Platform for format context
 * @returns {{ matches: [], primaryTrend, trendScore }}
 */
export function mapContentToTrend(contentDescription, platform = 'instagram') {
  if (!contentDescription || typeof contentDescription !== 'string') {
    return { matches: [], primaryTrend: null, trendScore: 0 };
  }

  const lower   = contentDescription.toLowerCase();
  const matched = new Map(); // trendId → { score, entry }

  for (const mapping of CONTENT_KEYWORD_MAP) {
    let hits = 0;
    for (const kw of mapping.keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      const existing = matched.get(mapping.trendId);
      if (!existing || existing.hits < hits) {
        matched.set(mapping.trendId, { hits, brandType: mapping.brandType });
      }
    }
  }

  const matches = [];
  for (const [trendId, { hits, brandType }] of matched.entries()) {
    const trend = findTrendById(trendId, brandType);
    if (trend) {
      // Boost if platform format matches
      const formatMatch = trend.formats.some((f) => {
        const pfFmt = getTrendingFormats(platform);
        return f === pfFmt.primaryFormat || f === pfFmt.secondaryFormat;
      });
      const relevanceScore = Math.min(100, trend.engagementScore + hits * 3 + (formatMatch ? 5 : 0));
      matches.push({ trend, hits, relevanceScore, formatMatchesPlatformTrend: formatMatch });
    }
  }

  matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const primaryTrend = matches[0]?.trend ?? null;
  const trendScore   = matches[0]?.relevanceScore ?? 0;

  return { matches, primaryTrend, trendScore, platform };
}

/**
 * Get a trend relevance score for a content type on a platform in a given month.
 * @param {string} contentType  e.g. 'reel', 'carousel', 'single_image'
 * @param {string} platform
 * @param {number} month        1-12
 */
export function getTrendScore(contentType, platform = 'instagram', month = null) {
  const m       = month ?? (new Date().getMonth() + 1);
  const formats = getTrendingFormats(platform, m);

  const type    = (contentType ?? '').toLowerCase().replace(/\s+/g, '_');

  let score;
  if (type === formats.primaryFormat)   score = 90;
  else if (type === formats.secondaryFormat) score = 75;
  else {
    // Derive a base score from content type popularity
    const baseScores = { reel: 70, video: 68, carousel: 60, story: 50, single_image: 45, text: 35, live: 65 };
    score = baseScores[type] ?? 40;
  }

  return {
    contentType,
    platform,
    month: m,
    trendScore: score,
    isTrending: score >= 75,
    primaryTrendingFormat: formats.primaryFormat,
    notes: formats.notes,
  };
}
