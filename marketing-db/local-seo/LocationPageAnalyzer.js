// local-seo/LocationPageAnalyzer.js — Local landing page SEO analysis
// Offline-only: operates on provided HTML string / plain text. No fetch, no axios.

// ── Stop words (excluded from keyword density calc) ────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','through','is','are','was','were','be','been',
  'being','have','has','had','do','does','did','will','would','could','should',
  'may','might','can','it','its','that','this','these','those','they','their',
  'them','we','our','you','your','he','she','his','her','i','my','we','us',
  'not','no','so','if','as','than','then','when','where','who','which','what',
  'how','all','each','every','both','other','such','than','too','very','just',
  'also','more','most','some','any','only','own','same','here','there',
]);

// ── HTML → plain text helpers ─────────────────────────────────────────────────

/**
 * Minimal HTML stripper — removes tags, decodes common entities.
 */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extract first match of a regex from html; return '' if not found.
 */
function extract(html, regex) {
  const m = html.match(regex);
  return m ? (m[1] ?? m[0]).trim() : '';
}

// ── Individual check functions ────────────────────────────────────────────────

function checkH1City(html, city) {
  // Extract all H1 content
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Texts   = h1Matches.map(m => stripHtml(m[1]).toLowerCase());
  const cityLc    = city.toLowerCase();
  const found     = h1Texts.some(t => t.includes(cityLc));

  return {
    pass:    found,
    label:   'H1 includes city name',
    detail:  found
      ? `H1 contains "${city}"`
      : h1Texts.length === 0
        ? 'No H1 tag found on page'
        : `H1 found but missing city name "${city}". H1 text: "${h1Texts[0]?.slice(0, 80)}"`,
    weight:  15,
  };
}

function checkTitleTag(html, city, businessType) {
  const titleRaw = extract(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleLc  = titleRaw.toLowerCase();
  const cityLc   = city.toLowerCase();
  const typeLc   = (businessType ?? '').toLowerCase();

  const hasCity = titleLc.includes(cityLc);
  const hasType = typeLc ? titleLc.includes(typeLc) : true; // if no type given, skip check

  const pass = hasCity && hasType;

  return {
    pass,
    label:  'Title tag includes city + business type',
    detail: titleRaw
      ? pass
        ? `Title: "${titleRaw.slice(0, 80)}"`
        : `Title found but missing: ${[!hasCity && `city "${city}"`, !hasType && `type "${businessType}"`].filter(Boolean).join(', ')}. Title: "${titleRaw.slice(0,80)}"`
      : 'No <title> tag found',
    weight: 15,
  };
}

function checkNAPFooter(html, locationData) {
  // Look in footer area for NAP signals
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  const footerHtml  = footerMatch ? footerMatch[0] : html; // fall back to full page
  const footerText  = stripHtml(footerHtml).toLowerCase();

  const name    = String(locationData.name    ?? '').toLowerCase();
  const address = String(locationData.address ?? '').toLowerCase();
  const phone   = String(locationData.phone   ?? '').replace(/\D/g, '');

  const hasName    = name    ? footerText.includes(name.split(' ')[0])  : false;
  const hasAddress = address ? footerText.includes(address.split(' ').slice(0,3).join(' ')) : false;
  const hasPhone   = phone.length >= 7
    ? footerText.replace(/\D/g,'').includes(phone.slice(-7))
    : false;

  const napCount = [hasName, hasAddress, hasPhone].filter(Boolean).length;
  const pass     = napCount >= 2;

  return {
    pass,
    label:  'NAP (Name, Address, Phone) in footer',
    detail: pass
      ? `NAP elements found in footer: ${[hasName && 'name', hasAddress && 'address', hasPhone && 'phone'].filter(Boolean).join(', ')}`
      : `Incomplete NAP in footer. Missing: ${[!hasName && 'name', !hasAddress && 'address', !hasPhone && 'phone'].filter(Boolean).join(', ')}`,
    weight: 12,
    napCount,
  };
}

function checkLocalSchema(html) {
  // Look for JSON-LD with LocalBusiness / Restaurant / FoodEstablishment
  const jsonldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let hasLocalSchema = false;
  let schemaType     = null;

  for (const block of jsonldBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const types = [].concat(data['@type'] ?? []);
      if (types.some(t => /LocalBusiness|Restaurant|FoodEstablishment|Organization/i.test(t))) {
        hasLocalSchema = true;
        schemaType     = types[0];
        break;
      }
    } catch {
      // Malformed JSON-LD — try a regex fallback
      if (/@type.*LocalBusiness|Restaurant|FoodEstablishment/i.test(block[1])) {
        hasLocalSchema = true;
        schemaType     = 'detected via pattern';
        break;
      }
    }
  }

  // Also check for microdata
  if (!hasLocalSchema && /itemtype=["']https?:\/\/schema\.org\/(LocalBusiness|Restaurant|FoodEstablishment)/i.test(html)) {
    hasLocalSchema = true;
    schemaType     = 'microdata';
  }

  return {
    pass:   hasLocalSchema,
    label:  'Local schema markup (JSON-LD or microdata)',
    detail: hasLocalSchema
      ? `Local schema found: @type "${schemaType}"`
      : 'No LocalBusiness / Restaurant schema markup detected. Add JSON-LD structured data.',
    weight: 12,
    schemaType,
  };
}

function checkInternalLinks(html) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const hrefs  = links.map(m => m[1].toLowerCase());
  const texts  = links.map(m => stripHtml(m[2]).toLowerCase());

  const menuKeywords        = ['menu', 'food', 'dishes', 'order'];
  const reservationKeywords = ['reserv', 'book', 'table', 'opentable', 'resy'];

  const hasMenuLink = hrefs.some(h => menuKeywords.some(k => h.includes(k)))
    || texts.some(t => menuKeywords.some(k => t.includes(k)));
  const hasReservationLink = hrefs.some(h => reservationKeywords.some(k => h.includes(k)))
    || texts.some(t => reservationKeywords.some(k => t.includes(k)));

  const pass = hasMenuLink || hasReservationLink;

  return {
    pass,
    label:  'Internal links to menu/reservation',
    detail: pass
      ? `Links found: ${[hasMenuLink && 'menu', hasReservationLink && 'reservation'].filter(Boolean).join(', ')}`
      : 'No internal links to menu or reservation pages detected.',
    weight: 8,
    hasMenuLink,
    hasReservationLink,
  };
}

function checkImageAltText(html, city) {
  const imgTags  = [...html.matchAll(/<img[^>]+>/gi)];
  const cityLc   = city.toLowerCase();

  let totalImages   = imgTags.length;
  let imagesWithAlt = 0;
  let altWithCity   = 0;

  for (const img of imgTags) {
    const altMatch = img[0].match(/alt=["']([^"']*)["']/i);
    if (altMatch) {
      imagesWithAlt++;
      if (altMatch[1].toLowerCase().includes(cityLc)) altWithCity++;
    }
  }

  const pass = totalImages === 0
    ? true // no images, not a failure
    : imagesWithAlt > 0 && altWithCity > 0;

  return {
    pass,
    label:  'Image alt text includes location',
    detail: totalImages === 0
      ? 'No images found on page'
      : `${imagesWithAlt}/${totalImages} images have alt text; ${altWithCity} include city name "${city}"`,
    weight: 8,
    totalImages,
    imagesWithAlt,
    altWithCity,
  };
}

function checkLocalKeywordDensity(html, city, cuisine) {
  const text     = stripHtml(html).toLowerCase();
  const words    = text.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const total    = words.length;

  if (total === 0) {
    return { pass: false, label: 'Local keyword density', detail: 'Page appears empty', weight: 10, density: 0 };
  }

  const cityLc    = city.toLowerCase();
  const cuisineLc = (cuisine ?? '').toLowerCase();

  const cityCount    = words.filter(w => w.includes(cityLc) || cityLc.includes(w)).length;
  const cuisineCount = cuisineLc
    ? words.filter(w => w.includes(cuisineLc) || cuisineLc.includes(w)).length
    : 0;

  const combined  = cityCount + cuisineCount;
  const density   = combined / total;

  // Ideal: 1-4% combined local keyword density
  const pass      = density >= 0.01 && density <= 0.06;

  return {
    pass,
    label:   'Local keyword density (1-6%)',
    detail:  `Combined density: ${(density * 100).toFixed(2)}% (${combined} local keyword mentions / ${total} total words)`,
    weight:  10,
    density: parseFloat(density.toFixed(4)),
    cityCount,
    cuisineCount,
    totalWords: total,
  };
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Analyze a local landing page for SEO signals.
 *
 * @param {string} html         - Raw HTML string or plain text of the page
 * @param {object} locationData - { name, city, state, address, phone, cuisine?, businessType? }
 * @returns {object} Full analysis object with checks, scores, and metadata
 */
export function analyzeLocationPage(html, locationData) {
  if (typeof html !== 'string') throw new Error('html must be a string');
  if (!locationData || typeof locationData !== 'object') throw new Error('locationData must be an object');

  const city         = String(locationData.city ?? '');
  const businessType = locationData.businessType ?? locationData.cuisine ?? locationData.category ?? 'restaurant';
  const cuisine      = locationData.cuisine ?? locationData.category ?? '';

  if (!city) throw new Error('locationData.city is required');

  const checks = [
    checkH1City(html, city),
    checkTitleTag(html, city, businessType),
    checkNAPFooter(html, locationData),
    checkLocalSchema(html),
    checkInternalLinks(html),
    checkImageAltText(html, city),
    checkLocalKeywordDensity(html, city, cuisine),
  ];

  const passed   = checks.filter(c => c.pass).length;
  const failed   = checks.filter(c => !c.pass).length;
  const maxScore = checks.reduce((s, c) => s + c.weight, 0);
  const earned   = checks.filter(c => c.pass).reduce((s, c) => s + c.weight, 0);
  const pct      = Math.round((earned / maxScore) * 100);

  return {
    location:    locationData.name ?? 'Unknown',
    city,
    url:         locationData.url ?? null,
    checks,
    summary: {
      passed,
      failed,
      total: checks.length,
      score: pct,
      earned,
      maxScore,
    },
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Returns the numeric score (0-100) for a page analysis result.
 * @param {object} analysis - Output of analyzeLocationPage()
 * @returns {number}
 */
export function getPageScore(analysis) {
  if (!analysis?.summary) throw new Error('Invalid analysis object — run analyzeLocationPage() first');
  return analysis.summary.score;
}

/**
 * Returns prioritized recommendations to improve the page.
 * @param {object} analysis - Output of analyzeLocationPage()
 * @returns {Array<{ priority: string, check: string, recommendation: string, impact: string }>}
 */
export function getPageRecommendations(analysis) {
  if (!analysis?.checks) throw new Error('Invalid analysis object — run analyzeLocationPage() first');

  const recs = [];

  for (const check of analysis.checks) {
    if (check.pass) continue;

    const priority = check.weight >= 14 ? 'critical'
      : check.weight >= 10 ? 'high'
      : check.weight >= 7  ? 'medium'
      : 'low';

    let recommendation = '';
    switch (check.label) {
      case 'H1 includes city name':
        recommendation = `Update the H1 heading to include the city name "${analysis.city}" (e.g. "Best Sushi in ${analysis.city}").`;
        break;
      case 'Title tag includes city + business type':
        recommendation = `Rewrite the <title> tag to include both the city and business type (e.g. "Sushi Restaurant in ${analysis.city} | Brand Name").`;
        break;
      case 'NAP (Name, Address, Phone) in footer':
        recommendation = 'Add complete NAP (Name, Address, Phone) to the page footer — consistent with your Google Business Profile.';
        break;
      case 'Local schema markup (JSON-LD or microdata)':
        recommendation = 'Add JSON-LD structured data with @type "Restaurant" or "LocalBusiness" including address, phone, geo coordinates, and opening hours.';
        break;
      case 'Internal links to menu/reservation':
        recommendation = 'Add prominent internal links to your menu page and online reservation/ordering system.';
        break;
      case 'Image alt text includes location':
        recommendation = `Update image alt text to include the city name and food/business type (e.g. "sushi platter in ${analysis.city}").`;
        break;
      case 'Local keyword density (1-6%)':
        recommendation = `Ensure city name and cuisine type appear naturally throughout the page content. Current density is outside the 1-6% ideal range.`;
        break;
      default:
        recommendation = check.detail;
    }

    recs.push({
      priority,
      check:          check.label,
      recommendation,
      currentStatus:  check.detail,
      impact:         `${check.weight} points (of ${analysis.summary.maxScore} total)`,
    });
  }

  // Sort by weight desc (highest impact first)
  recs.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });

  return recs;
}
