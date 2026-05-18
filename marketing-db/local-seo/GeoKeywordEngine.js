// local-seo/GeoKeywordEngine.js — Geo-targeted keyword generation for local SEO
// Offline-only: no fetch, no axios, no OpenAI

// ── Search volume estimates by keyword pattern ────────────────────────────────

const VOLUME_PATTERNS = [
  { pattern: /^best .+ in .+$/i,        range: [1200, 3500] },
  { pattern: /near me/i,                range: [2000, 8000] },
  { pattern: /delivery/i,               range: [800,  2500] },
  { pattern: /downtown|north|south|east|west/i, range: [300, 900] },
  { pattern: /restaurant$/i,            range: [600,  2000] },
  { pattern: / ca$/i,                   range: [400,  1200] },
  { pattern: /bar/i,                    range: [500,  1500] },
  { pattern: /^[a-z]+ [a-z]+$/i,        range: [200,  800]  }, // short 2-word
];

function estimateVolumeForKeyword(keyword) {
  for (const { pattern, range } of VOLUME_PATTERNS) {
    if (pattern.test(keyword)) {
      // Deterministic pseudo-random based on keyword string
      const hash = keyword.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
      const spread = range[1] - range[0];
      return range[0] + Math.floor((hash / 0xffff) * spread);
    }
  }
  // Default for unmatched
  const hash = keyword.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
  return 100 + Math.floor((hash / 0xffff) * 400);
}

// ── Priority scoring ──────────────────────────────────────────────────────────

const PRIORITY_RULES = [
  { test: (kw) => /near me/i.test(kw),                    priority: 'critical', score: 10 },
  { test: (kw) => /^best .+ in /i.test(kw),               priority: 'high',     score: 8  },
  { test: (kw) => /delivery/i.test(kw),                   priority: 'high',     score: 7  },
  { test: (kw) => /restaurant .+ [A-Z]{2}$/i.test(kw),   priority: 'high',     score: 7  },
  { test: (kw) => /downtown|north|south|east|west/i.test(kw), priority: 'medium', score: 5 },
  { test: (kw) => / [A-Z]{2}$/.test(kw),                  priority: 'medium',   score: 4  },
  { test: (kw) => /bar|cafe|bistro/i.test(kw),             priority: 'medium',   score: 4  },
];

// ── Cuisine synonym/expansion map ─────────────────────────────────────────────

const CUISINE_SYNONYMS = {
  sushi:      ['sushi', 'japanese food', 'japanese restaurant', 'sashimi', 'maki', 'raw fish bar', 'omakase'],
  ramen:      ['ramen', 'japanese noodles', 'noodle bar', 'tonkotsu', 'ramen bowl'],
  pizza:      ['pizza', 'italian food', 'pizzeria', 'pizza pie', 'neapolitan pizza'],
  burgers:    ['burgers', 'burger joint', 'american food', 'smash burgers', 'gourmet burgers'],
  tacos:      ['tacos', 'mexican food', 'taqueria', 'burritos', 'mexican restaurant'],
  bbq:        ['bbq', 'barbecue', 'smoked meats', 'southern food', 'bbq ribs'],
  chinese:    ['chinese food', 'chinese restaurant', 'dim sum', 'asian food', 'chinese cuisine'],
  indian:     ['indian food', 'indian restaurant', 'curry', 'tandoori', 'indian cuisine'],
  thai:       ['thai food', 'thai restaurant', 'pad thai', 'thai cuisine'],
  mediterranean: ['mediterranean food', 'greek food', 'falafel', 'shawarma', 'mediterranean restaurant'],
  seafood:    ['seafood', 'seafood restaurant', 'fish and chips', 'crab', 'lobster', 'fresh fish'],
  vegan:      ['vegan food', 'plant-based restaurant', 'vegan restaurant', 'vegan cuisine'],
  coffee:     ['coffee shop', 'cafe', 'espresso bar', 'specialty coffee'],
};

function getCuisineSynonyms(cuisine) {
  const key = cuisine.toLowerCase();
  return CUISINE_SYNONYMS[key] ?? [cuisine.toLowerCase(), `${cuisine.toLowerCase()} restaurant`];
}

// ── Main export: generateGeoKeywords ──────────────────────────────────────────

/**
 * @param {string} brand - Brand/restaurant name
 * @param {string} city  - City name (e.g. "Stockton")
 * @param {string} state - State abbreviation (e.g. "CA")
 * @param {string} cuisine - Cuisine type (e.g. "sushi")
 * @param {{ radius?: string[] }} options
 * @returns {Array<{ keyword: string, type: string, priority: string, estimatedVolume: number }>}
 */
export function generateGeoKeywords(brand, city, state, cuisine, { radius = ['downtown', 'north', 'south'] } = {}) {
  if (!brand || !city || !cuisine) throw new Error('brand, city, and cuisine are required');

  const cityLc   = city.trim();
  const stateLc  = state?.trim().toUpperCase() ?? '';
  const brandLc  = brand.trim();
  const synList  = getCuisineSynonyms(cuisine);
  const primary  = synList[0]; // "sushi", "japanese food", etc.
  const cityState = stateLc ? `${cityLc} ${stateLc}` : cityLc;

  const keywords = [];

  const add = (keyword, type) => {
    const kw = keyword.trim();
    if (!kw) return;
    // Deduplicate
    if (keywords.some(k => k.keyword.toLowerCase() === kw.toLowerCase())) return;
    keywords.push({
      keyword:         kw,
      type,
      priority:        getKeywordPriority(kw),
      estimatedVolume: estimateSearchVolume(kw),
    });
  };

  // ── 1. Core geo-modified keywords ─────────────────────────────────────────
  add(`${primary} ${cityLc}`,              'geo_primary');
  add(`${primary} ${cityState}`,           'geo_primary');
  add(`best ${primary} ${cityLc}`,         'best_in_city');
  add(`best ${primary} in ${cityLc}`,      'best_in_city');
  add(`${primary} near me ${cityLc}`,      'near_me');
  add(`${primary} near me`,                'near_me');
  add(`${cityLc} ${primary}`,              'city_first');
  add(`${cityLc} ${primary} restaurant`,   'city_first');
  add(`${primary} restaurant ${cityLc}`,   'restaurant_type');
  add(`${primary} restaurant in ${cityLc}`, 'restaurant_type');
  add(`${primary} delivery ${cityLc}`,     'delivery');
  add(`${primary} takeout ${cityLc}`,      'delivery');
  add(`${primary} pickup ${cityLc}`,       'delivery');

  // ── 2. Brand name + location combos ──────────────────────────────────────
  add(`${brandLc} ${cityLc}`,              'branded_geo');
  add(`${brandLc} ${cityState}`,           'branded_geo');
  add(`${brandLc} ${primary}`,             'branded_cuisine');
  add(`${brandLc} restaurant`,             'branded_type');

  // ── 3. Proximity / neighborhood keywords ─────────────────────────────────
  for (const area of radius) {
    add(`${primary} ${area} ${cityLc}`,    'proximity');
    add(`best ${primary} ${area} ${cityLc}`, 'proximity');
  }

  // ── 4. Cuisine synonym variants ───────────────────────────────────────────
  for (const syn of synList.slice(1, 5)) {
    add(`${syn} ${cityLc}`,                'cuisine_variant');
    add(`best ${syn} in ${cityLc}`,        'cuisine_variant');
    if (stateLc) add(`${syn} ${cityState}`, 'cuisine_variant');
  }

  // ── 5. Modifier keywords ──────────────────────────────────────────────────
  const MODIFIERS = ['authentic', 'best rated', 'top rated', 'highly rated', 'popular', 'local'];
  for (const mod of MODIFIERS) {
    add(`${mod} ${primary} ${cityLc}`,     'modifier');
  }

  // ── 6. Long-tail question keywords ───────────────────────────────────────
  add(`where to eat ${primary} in ${cityLc}`,   'question');
  add(`best place for ${primary} in ${cityLc}`, 'question');
  add(`good ${primary} restaurant in ${cityLc}`, 'question');

  // Sort by priority score descending
  const scoreMap = { critical: 10, high: 8, medium: 5, low: 2 };
  keywords.sort((a, b) => (scoreMap[b.priority] ?? 0) - (scoreMap[a.priority] ?? 0));

  return keywords;
}

/**
 * Returns a priority label for a keyword.
 * @param {string} keyword
 * @returns {'critical'|'high'|'medium'|'low'}
 */
export function getKeywordPriority(keyword) {
  for (const { test, priority } of PRIORITY_RULES) {
    if (test(keyword)) return priority;
  }
  return 'low';
}

/**
 * Estimates monthly search volume for a keyword using heuristic patterns.
 * Fully offline — no external data.
 * @param {string} keyword
 * @returns {number}
 */
export function estimateSearchVolume(keyword) {
  return estimateVolumeForKeyword(keyword);
}
