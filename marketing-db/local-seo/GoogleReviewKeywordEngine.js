// local-seo/GoogleReviewKeywordEngine.js — Review keyword extraction + analysis
// Offline-only: word frequency analysis, no NLP libraries, no internet calls.

// ── Stop words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may',
  'might','can','it','its','that','this','these','those','they','their','them',
  'we','our','you','your','he','she','his','her','i','my','us','not','no',
  'so','if','as','than','then','when','where','who','which','what','how',
  'all','each','every','both','other','such','too','very','just','also','more',
  'most','some','any','only','own','same','here','there','very','really','got',
  'get','went','go','came','come','made','make','said','say','one','two','three',
  'time','first','last','would','could','even','back','see','way','well','good',
  'great','much','many','little','little','always','never','every','over','under',
  'again','further','once','there','here','when','where','why','how','all','both',
  'each','few','more','most','other','some','such','no','nor','not','only','own',
  'same','so','than','too','very','s','t','will','just','don','should','now',
  'i\'ve','i\'m','i\'ll','it\'s','don\'t','didn\'t','wasn\'t','weren\'t','isn\'t',
  'can\'t','won\'t','wouldn\'t','couldn\'t','shouldn\'t','haven\'t','hasn\'t',
  'hadn\'t','they\'re','we\'re','you\'re','that\'s','there\'s','here\'s',
  'place','went','try','tried','tried','order','ordered','experience','came',
]);

// ── Sentiment lexicons ────────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  // Taste / quality
  'delicious','amazing','excellent','fantastic','wonderful','outstanding',
  'incredible','perfect','superb','exceptional','spectacular','phenomenal',
  'exquisite','divine','heavenly','magnificent','brilliant','flawless',
  // Food descriptors
  'fresh','tasty','flavorful','savory','crispy','tender','juicy','rich',
  'creamy','light','authentic','traditional','homemade','quality','premium',
  'generous','satisfying','filling','mouthwatering','scrumptious','yummy',
  // Service
  'friendly','attentive','professional','helpful','welcoming','warm','kind',
  'courteous','prompt','efficient','excellent','knowledgeable','accommodating',
  'gracious','personable','enthusiastic','dedicated','wonderful','lovely',
  // Overall
  'recommend','love','loved','enjoyed','impressed','happy','pleased','satisfied',
  'thrilled','excited','delighted','definitely','absolutely','highly','best',
  'favorite','favourite','gem','hidden','worth','value','reasonable','affordable',
  'clean','cozy','comfortable','nice','beautiful','gorgeous','elegant',
  'relaxing','vibrant','lively','fun','great','good','cool','solid','top',
]);

const NEGATIVE_WORDS = new Set([
  // Quality issues
  'terrible','awful','horrible','disgusting','dreadful','atrocious','appalling',
  'pathetic','unacceptable','disappointing','disappointed','bland','tasteless',
  'overcooked','undercooked','stale','dry','cold','soggy','oily','greasy',
  'salty','burnt','raw','frozen','tiny','small','overpriced','expensive',
  // Service issues
  'rude','unfriendly','unprofessional','slow','lazy','inattentive','dismissive',
  'ignorant','incompetent','careless','neglectful','forgetful','impatient',
  'disrespectful','condescending','unhelpful','indifferent','hostile',
  // Overall
  'avoid','never','waste','regret','worst','bad','poor','mediocre','below',
  'average','lacking','missing','wrong','incorrect','inaccurate','dirty',
  'messy','noisy','crowded','cramped','uncomfortable','long','wait','waited',
  'waiting','forever','hour','hours','understaffed','ignored','disappointed',
  'overrated','overcharge','charge','mistake','error','issue','problem',
  'complaint','complain','mess','nasty','gross','chewy','tough','rubbery',
]);

// ── Category keyword patterns ─────────────────────────────────────────────────

const CATEGORY_PATTERNS = {
  food: [
    'sushi','ramen','pizza','burger','taco','rice','fish','chicken','beef',
    'pork','shrimp','salmon','tuna','roll','noodle','pasta','soup','salad',
    'steak','lamb','duck','crab','lobster','scallop','oyster','miso','tempura',
    'sashimi','nigiri','maki','udon','soba','gyoza','dumpling','bao','bibimbap',
    'pad','curry','tikka','biryani','kebab','falafel','hummus','tzatziki',
    'bruschetta','risotto','gnocchi','ravioli','lasagna','tiramisu','gelato',
    'dessert','bread','cake','pie','cheesecake','chocolate','vanilla','matcha',
    'edamame','gyudon','tonkatsu','katsu','yakitori','teriyaki','hibachi',
    'menu','dish','dishes','food','meal','entree','appetizer','side','combo',
    'special','special','portion','serving','plate','bowl','wrap','sandwich',
  ],
  service: [
    'staff','server','waiter','waitress','host','hostess','manager','chef',
    'bartender','cashier','team','crew','employee','service','attention',
    'helped','help','assistance','responsive','quick','fast','slow','prompt',
    'reservation','seated','wait','waited','table','seating',
  ],
  atmosphere: [
    'ambiance','atmosphere','decor','vibe','setting','environment','interior',
    'aesthetic','modern','traditional','cozy','intimate','spacious','crowded',
    'loud','quiet','romantic','casual','upscale','casual','trendy','rustic',
    'clean','dirty','lighting','music','noise','parking','location','neighborhood',
  ],
  price: [
    'price','prices','pricing','expensive','cheap','affordable','reasonable',
    'overpriced','value','worth','money','cost','bill','check','total','tip',
    'budget','splurge','deal','discount','coupon','happy hour','lunch','special',
  ],
};

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Tokenize a single review into cleaned words.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, ' ')   // keep apostrophes and hyphens
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Build frequency map from an array of word tokens.
 * Also extracts bigrams (two-word phrases) that appear ≥2 times.
 */
function buildFrequencyMap(tokenArrays) {
  const freq    = new Map();
  const bigrams = new Map();

  for (const tokens of tokenArrays) {
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      freq.set(w, (freq.get(w) ?? 0) + 1);

      // Bigrams
      if (i < tokens.length - 1) {
        const bigram = `${w} ${tokens[i + 1]}`;
        bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
      }
    }
  }

  // Include bigrams that appear ≥2 times
  for (const [bigram, count] of bigrams.entries()) {
    if (count >= 2) freq.set(bigram, count);
  }

  return freq;
}

/**
 * Convert a frequency Map to a sorted array of { word, count, sentiment? }.
 */
function freqMapToArray(freqMap) {
  return [...freqMap.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Extract keyword frequency list from an array of review strings.
 *
 * @param {string[]} reviews  - Array of review text strings
 * @returns {Array<{ word: string, count: number, sentiment: 'positive'|'negative'|'neutral' }>}
 */
export function extractKeywords(reviews) {
  if (!Array.isArray(reviews)) throw new Error('reviews must be an array of strings');
  const validReviews = reviews.filter(r => typeof r === 'string' && r.trim().length > 0);
  if (validReviews.length === 0) return [];

  const tokenArrays = validReviews.map(tokenize);
  const freqMap     = buildFrequencyMap(tokenArrays);
  const keywords    = freqMapToArray(freqMap);

  // Annotate with sentiment
  return keywords.map(kw => {
    const words = kw.word.split(' ');
    const isPos = words.some(w => POSITIVE_WORDS.has(w));
    const isNeg = words.some(w => NEGATIVE_WORDS.has(w));
    return {
      ...kw,
      sentiment: isPos && !isNeg ? 'positive'
               : isNeg && !isPos ? 'negative'
               : 'neutral',
    };
  });
}

/**
 * Group extracted keywords by category (food, service, atmosphere, price).
 *
 * @param {Array<{ word: string, count: number, sentiment: string }>} keywords
 * @returns {{ food: [], service: [], atmosphere: [], price: [], other: [] }}
 */
export function groupByCategory(keywords) {
  const result = { food: [], service: [], atmosphere: [], price: [], other: [] };

  for (const kw of keywords) {
    let placed = false;
    for (const [category, terms] of Object.entries(CATEGORY_PATTERNS)) {
      // Check if any word in the keyword matches a category term
      const kwWords = kw.word.split(' ');
      if (kwWords.some(w => terms.includes(w))) {
        result[category].push(kw);
        placed = true;
        break;
      }
    }
    if (!placed) result.other.push(kw);
  }

  // Sort each category by count desc
  for (const cat of Object.keys(result)) {
    result[cat].sort((a, b) => b.count - a.count);
  }

  return result;
}

/**
 * Returns the top N positive keywords from reviews.
 *
 * @param {string[]} reviews - Array of review strings
 * @param {number}   n       - How many keywords to return (default 10)
 * @returns {Array<{ word: string, count: number, sentiment: 'positive' }>}
 */
export function getTopPositiveKeywords(reviews, n = 10) {
  const keywords = extractKeywords(reviews);
  return keywords
    .filter(kw => kw.sentiment === 'positive')
    .slice(0, n);
}

/**
 * Returns the top N negative keywords from reviews.
 *
 * @param {string[]} reviews - Array of review strings
 * @param {number}   n       - How many keywords to return (default 10)
 * @returns {Array<{ word: string, count: number, sentiment: 'negative' }>}
 */
export function getTopNegativeKeywords(reviews, n = 10) {
  const keywords = extractKeywords(reviews);
  return keywords
    .filter(kw => kw.sentiment === 'negative')
    .slice(0, n);
}
