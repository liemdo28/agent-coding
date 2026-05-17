// semantic/embeddingEngine.js — local embedding engine via Ollama (loopback only)
// Phase 8: uses nomic-embed-text; falls back gracefully if Ollama unavailable

import http from 'http';

const DEFAULT_OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL       = 'nomic-embed-text';

/**
 * Generate an embedding for a single text string.
 * @param {string} text
 * @param {{ model?: string, ollamaBase?: string }} options
 * @returns {Promise<number[]|null>}  null if Ollama unavailable
 */
export async function embed(text, options = {}) {
  const model = options.model ?? DEFAULT_MODEL;
  const base  = options.ollamaBase ?? DEFAULT_OLLAMA_BASE;

  try {
    const body = JSON.stringify({ model, prompt: text });
    const result = await post(`${base}/api/embeddings`, body);
    return result?.embedding ?? null;
  } catch {
    return null; // Ollama not available — graceful fallback
  }
}

/**
 * Generate embeddings for multiple texts.
 * @param {string[]} texts
 * @param {{ model?: string, ollamaBase?: string }} options
 * @returns {Promise<Array<number[]|null>>}
 */
export async function batchEmbed(texts, options = {}) {
  const results = [];
  for (const text of texts) {
    results.push(await embed(text, options));
  }
  return results;
}

/**
 * Get info about the embedding model from Ollama.
 * @param {{ model?: string, ollamaBase?: string }} options
 * @returns {Promise<object|null>}
 */
export async function getModelInfo(options = {}) {
  const model = options.model ?? DEFAULT_MODEL;
  const base  = options.ollamaBase ?? DEFAULT_OLLAMA_BASE;
  try {
    const result = await post(`${base}/api/show`, JSON.stringify({ name: model }));
    return result;
  } catch {
    return null;
  }
}

/**
 * Check if Ollama is available and the embedding model is loaded.
 * @param {{ ollamaBase?: string, model?: string }} options
 * @returns {Promise<boolean>}
 */
export async function isAvailable(options = {}) {
  const base = options.ollamaBase ?? DEFAULT_OLLAMA_BASE;
  try {
    await get(`${base}/api/tags`);
    return true;
  } catch {
    return false;
  }
}

// ── HTTP helpers (loopback only) ──────────────────────────────────────────────

function post(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port:     parsed.port || 11434,
      path:     parsed.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(body);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.setTimeout(3_000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
