// kb/pipeline/MDNFetcher.js — BUILD-TIME TOOL — fetches MDN Web Docs content
// License: CC BY-SA 2.5 (Mozilla contributors)
// Policy: https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license
//
// Uses MDN's public API (no auth required):
//   https://developer.mozilla.org/api/v1/doc/<locale>/<path>
//
// Rate limit: 1 req/300ms to stay polite. MDN has no published rate limit.

const UA      = 'local-offline-kb/1.0 (https://github.com/liemdo28/agent-coding; contact: kb-build)';
const BASE    = 'https://developer.mozilla.org';
const DELAY_MS    = 300;
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429) { await sleep(Math.pow(2, attempt + 1) * 1000); continue; }
      if (res.status === 404) return null;
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(Math.pow(2, attempt) * 500);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(Math.pow(2, attempt) * 500);
    }
  }
  throw lastErr;
}

/**
 * Fetch a single MDN page by its path slug.
 * @param {string} slug e.g. "Web/JavaScript/Reference/Global_Objects/Promise"
 * @returns {{ title, extract, url, wordCount } | null}
 */
export async function fetchMDNPage(slug) {
  const apiUrl = `${BASE}/api/v1/doc/en-US/${slug}`;
  const data = await fetchJSON(apiUrl);
  if (!data || !data.doc) return null;

  const doc   = data.doc;
  const title = doc.title;
  const url   = `${BASE}/en-US/docs/${slug}`;

  // Extract plain text from MDN's body sections
  const text = extractPlainText(doc);
  if (!text || text.split(/\s+/).length < 30) return null;

  return {
    title,
    extract: text,
    url,
    categories: doc.tags ?? [],
    wordCount: text.split(/\s+/).length,
    license: 'CC BY-SA 2.5',
    source: 'MDN Web Docs',
  };
}

/**
 * Extract readable plain text from MDN doc object.
 * MDN returns structured sections — flatten to markdown-like text.
 */
function extractPlainText(doc) {
  const parts = [`# ${doc.title}\n`];

  // MDN summary
  if (doc.summary) parts.push(doc.summary + '\n');

  // Body sections
  if (doc.body) {
    for (const section of doc.body) {
      if (section.type === 'prose' && section.value) {
        if (section.value.title) parts.push(`\n## ${section.value.title}\n`);
        if (section.value.content) {
          // Strip HTML tags from MDN content
          const text = section.value.content
            .replace(/<[^>]+>/g, ' ')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          if (text) parts.push(text);
        }
      }
    }
  }

  parts.push('');
  parts.push('---');
  parts.push(`*Source: [MDN Web Docs — ${doc.title}](${BASE}/en-US/docs/${doc.mdn_url?.replace('/en-US/docs/', '') ?? ''}) — CC BY-SA 2.5 — Mozilla contributors*`);

  return parts.join('\n');
}

/**
 * Fetch multiple MDN pages with rate limiting.
 * @param {string[]} slugs
 * @param {{ onProgress? }} opts
 * @returns {{ slug, article, error }[]}
 */
export async function fetchMDNPages(slugs, { onProgress } = {}) {
  const results = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    try {
      const article = await fetchMDNPage(slug);
      results.push({ slug, article, error: null });
      if (onProgress) onProgress({ done: i + 1, total: slugs.length, slug, ok: !!article });
    } catch (err) {
      results.push({ slug, article: null, error: err.message });
      if (onProgress) onProgress({ done: i + 1, total: slugs.length, slug, ok: false, err: err.message });
    }
    await sleep(DELAY_MS);
  }

  return results;
}
