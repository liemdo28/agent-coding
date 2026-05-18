// local-seo/LocalSERPAnalyzer.js — Local SERP ranking factor analysis
// Offline-only: analyzes provided data, no internet calls

// ── GBP field weights for completeness scoring ────────────────────────────────

const GBP_FIELDS = [
  { field: 'name',            weight: 10, label: 'Business name' },
  { field: 'address',         weight: 10, label: 'Address' },
  { field: 'phone',           weight: 8,  label: 'Phone number' },
  { field: 'website',         weight: 7,  label: 'Website URL' },
  { field: 'hours',           weight: 8,  label: 'Business hours' },
  { field: 'category',        weight: 7,  label: 'Primary category' },
  { field: 'description',     weight: 6,  label: 'Business description' },
  { field: 'photos',          weight: 6,  label: 'Photo gallery' },
  { field: 'menu_url',        weight: 5,  label: 'Menu link' },
  { field: 'attributes',      weight: 4,  label: 'Business attributes' },
  { field: 'google_place_id', weight: 5,  label: 'Google Place ID verified' },
  { field: 'google_maps_url', weight: 4,  label: 'Google Maps URL' },
  { field: 'zip',             weight: 3,  label: 'ZIP code' },
  { field: 'state',           weight: 3,  label: 'State' },
  { field: 'service_areas',   weight: 4,  label: 'Service areas' },
];

const GBP_MAX_WEIGHT = GBP_FIELDS.reduce((s, f) => s + f.weight, 0);

// ── Scoring helpers ───────────────────────────────────────────────────────────

function hasValue(v) {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

function scoreGBPCompleteness(locationData) {
  let earned = 0;
  const missing = [];
  const present = [];

  for (const { field, weight, label } of GBP_FIELDS) {
    if (hasValue(locationData[field])) {
      earned += weight;
      present.push(label);
    } else {
      missing.push({ field, label, weight });
    }
  }

  const pct = Math.round((earned / GBP_MAX_WEIGHT) * 100);
  return { score: pct, earned, maxWeight: GBP_MAX_WEIGHT, missing, present };
}

function scoreReviews(locationData) {
  const count  = Number(locationData.review_count ?? locationData.reviewCount ?? 0);
  const rating = parseFloat(locationData.avg_rating ?? locationData.avgRating ?? locationData.rating ?? 0);

  // Review count score (0-50 scale, capped at 200 reviews = full score)
  const countScore = Math.min(50, Math.round((count / 200) * 50));

  // Rating score (0-50 scale): 4.0+ = great, below 3.5 = penalty
  let ratingScore = 0;
  if (rating >= 4.5) ratingScore = 50;
  else if (rating >= 4.0) ratingScore = 40;
  else if (rating >= 3.5) ratingScore = 25;
  else if (rating >= 3.0) ratingScore = 10;
  else if (rating > 0)    ratingScore = 0;

  const total = countScore + ratingScore;
  return {
    score: total,          // 0-100
    reviewCount: count,
    avgRating: rating,
    countScore,
    ratingScore,
    notes: [
      count < 10  ? 'Fewer than 10 reviews — actively solicit more reviews' : null,
      count < 50  ? 'Under 50 reviews — consider review request campaigns' : null,
      rating < 4.0 ? 'Rating below 4.0 — address negative feedback urgently' : null,
      rating >= 4.5 && count >= 50 ? 'Strong review profile' : null,
    ].filter(Boolean),
  };
}

function scoreKeywordDensity(locationData) {
  const desc = String(locationData.description ?? '').toLowerCase();
  if (!desc) return { score: 0, density: 0, notes: ['No business description provided'] };

  const city    = String(locationData.city ?? '').toLowerCase();
  const cuisine = String(locationData.cuisine ?? locationData.category ?? '').toLowerCase();
  const name    = String(locationData.name ?? '').toLowerCase();

  const words       = desc.split(/\s+/).filter(w => w.length > 2);
  const wordCount   = words.length;
  if (wordCount === 0) return { score: 0, density: 0, notes: ['Description is empty'] };

  const cityMatches    = (desc.match(new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
  const cuisineMatches = cuisine ? (desc.match(new RegExp(cuisine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length : 0;
  const nameMatches    = name ? (desc.match(new RegExp(name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length : 0;

  const totalKeywordMentions = cityMatches + cuisineMatches + nameMatches;
  const density = totalKeywordMentions / wordCount;

  // Ideal density: 2-5%
  let score = 0;
  if (density >= 0.02 && density <= 0.05) score = 100;
  else if (density >= 0.01 && density < 0.02) score = 60;
  else if (density > 0.05 && density <= 0.08) score = 70;
  else if (density > 0.08) score = 40; // over-stuffed
  else score = 20; // too sparse

  const notes = [];
  if (cityMatches === 0) notes.push(`City name "${city}" not in description`);
  if (cuisineMatches === 0 && cuisine) notes.push(`Cuisine type "${cuisine}" not in description`);
  if (wordCount < 100) notes.push('Description is short — aim for 150+ words');
  if (density > 0.08) notes.push('Keyword density too high — risk of stuffing penalty');

  return { score, density: parseFloat(density.toFixed(4)), cityMatches, cuisineMatches, wordCount, notes };
}

function scoreNAPConsistency(locationData) {
  // Check internal NAP completeness and format quality
  const name    = String(locationData.name    ?? '');
  const address = String(locationData.address ?? '');
  const phone   = String(locationData.phone   ?? '');

  let score = 0;
  const issues = [];

  if (name.length > 0)    score += 33; else issues.push('Missing business name');
  if (address.length > 0) score += 33; else issues.push('Missing address');
  if (phone.length > 0) {
    score += 34;
    // Validate phone format
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) issues.push('Phone number appears invalid (too few digits)');
  } else {
    issues.push('Missing phone number');
  }

  return { score, issues };
}

function scoreCitationEstimate(locationData) {
  // Estimate citation count based on provided source indicators
  const sources = [
    locationData.yelp_url       || locationData.yelpUrl,
    locationData.google_maps_url || locationData.googleMapsUrl,
    locationData.facebook_url   || locationData.facebookUrl,
    locationData.tripadvisor_url,
    locationData.foursquare_url,
    locationData.bing_places_url,
    locationData.apple_maps_url,
    locationData.yellowpages_url,
  ].filter(Boolean);

  const citationCount = locationData.citation_count ?? locationData.citationCount ?? sources.length;
  const score = Math.min(100, Math.round((citationCount / 15) * 100));

  return {
    score,
    estimatedCitations: citationCount,
    detectedSources: sources.length,
    notes: citationCount < 10 ? ['Build more local citations — target 15+ authoritative directories'] : [],
  };
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Full analysis of a location's local presence.
 * @param {object} locationData - Location record (from DB or manual)
 * @returns {object} analysis object with all sub-scores
 */
export function analyzeLocalPresence(locationData) {
  if (!locationData || typeof locationData !== 'object') {
    throw new Error('locationData must be a non-null object');
  }

  const gbp       = scoreGBPCompleteness(locationData);
  const reviews   = scoreReviews(locationData);
  const keywords  = scoreKeywordDensity(locationData);
  const nap       = scoreNAPConsistency(locationData);
  const citations = scoreCitationEstimate(locationData);

  return {
    location:   locationData.name ?? 'Unknown',
    city:       locationData.city ?? '',
    scores: {
      gbp_completeness:   gbp.score,
      review_impact:      reviews.score,
      keyword_density:    keywords.score,
      nap_consistency:    nap.score,
      citation_estimate:  citations.score,
    },
    details: { gbp, reviews, keywords, nap, citations },
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Calculates a single composite SERP score (0-100).
 * Weights reflect local ranking factor research:
 *   GBP (25%) + Reviews (30%) + Keywords (15%) + NAP (20%) + Citations (10%)
 */
export function getSERPScore(locationData) {
  const analysis = analyzeLocalPresence(locationData);
  const { gbp_completeness, review_impact, keyword_density, nap_consistency, citation_estimate } = analysis.scores;

  const composite = Math.round(
    gbp_completeness  * 0.25 +
    review_impact     * 0.30 +
    keyword_density   * 0.15 +
    nap_consistency   * 0.20 +
    citation_estimate * 0.10
  );

  const grade =
    composite >= 85 ? 'A' :
    composite >= 70 ? 'B' :
    composite >= 55 ? 'C' :
    composite >= 40 ? 'D' : 'F';

  return {
    score:     composite,
    grade,
    breakdown: analysis.scores,
    location:  analysis.location,
  };
}

/**
 * Returns prioritized recommendations to improve local SERP ranking.
 * @param {object} locationData
 * @returns {Array<{ priority: string, category: string, recommendation: string, impact: string }>}
 */
export function getImprovementRecommendations(locationData) {
  const analysis = analyzeLocalPresence(locationData);
  const recs = [];

  // GBP recommendations
  if (analysis.scores.gbp_completeness < 80) {
    for (const missing of analysis.details.gbp.missing) {
      recs.push({
        priority:       missing.weight >= 8 ? 'critical' : missing.weight >= 5 ? 'high' : 'medium',
        category:       'Google Business Profile',
        recommendation: `Add missing GBP field: ${missing.label}`,
        impact:         `+${Math.round(missing.weight / GBP_MAX_WEIGHT * 25)} SERP score points`,
      });
    }
  }

  // Review recommendations
  for (const note of analysis.details.reviews.notes) {
    recs.push({
      priority:       'high',
      category:       'Reviews',
      recommendation: note,
      impact:         'Reviews account for 30% of local SERP score',
    });
  }

  // Keyword recommendations
  for (const note of analysis.details.keywords.notes) {
    recs.push({
      priority:       'medium',
      category:       'Keyword Optimization',
      recommendation: note,
      impact:         'Improves keyword density score (15% of SERP)',
    });
  }

  // NAP recommendations
  for (const issue of analysis.details.nap.issues) {
    recs.push({
      priority:       'critical',
      category:       'NAP Consistency',
      recommendation: issue,
      impact:         'NAP consistency accounts for 20% of local SERP score',
    });
  }

  // Citation recommendations
  for (const note of analysis.details.citations.notes) {
    recs.push({
      priority:       'medium',
      category:       'Local Citations',
      recommendation: note,
      impact:         'Citations account for 10% of local SERP score',
    });
  }

  // Sort: critical > high > medium > low
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  recs.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));

  return recs;
}
