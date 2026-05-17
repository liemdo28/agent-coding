// semantic/chunkingEngine.js — splits code/text into optimal chunks for embedding
// Phase 8: max chunk size 512 tokens (~2048 chars), splits at function/class/paragraph boundaries

const MAX_CHUNK_CHARS = 2048;

/**
 * Split code into chunks at function/class/block boundaries.
 * @param {string} code
 * @param {string} filename
 * @param {{ maxChars?: number }} options
 * @returns {Array<{ text: string, metadata: object }>}
 */
export function chunkCode(code, filename, options = {}) {
  const maxChars = options.maxChars ?? MAX_CHUNK_CHARS;
  const lines    = code.split('\n');
  const chunks   = [];
  let current    = [];
  let currentLen = 0;
  let chunkStart = 1;

  const BOUNDARY_RE = /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?class\s+\w+|^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const lineLen = line.length + 1;

    // Flush if we hit a boundary and have content
    if (current.length > 0 && BOUNDARY_RE.test(line) && currentLen > 100) {
      chunks.push({
        text:     current.join('\n'),
        metadata: getChunkMetadata({ text: current.join('\n'), start: chunkStart, end: i, filename }),
      });
      current    = [];
      currentLen = 0;
      chunkStart = i + 1;
    }

    // Flush if over max size
    if (currentLen + lineLen > maxChars && current.length > 0) {
      chunks.push({
        text:     current.join('\n'),
        metadata: getChunkMetadata({ text: current.join('\n'), start: chunkStart, end: i, filename }),
      });
      current    = [];
      currentLen = 0;
      chunkStart = i + 1;
    }

    current.push(line);
    currentLen += lineLen;
  }

  if (current.length > 0) {
    chunks.push({
      text:     current.join('\n'),
      metadata: getChunkMetadata({ text: current.join('\n'), start: chunkStart, end: lines.length, filename }),
    });
  }

  return chunks;
}

/**
 * Split plain text into chunks by sentence/paragraph.
 * @param {string} text
 * @param {{ maxChars?: number }} options
 * @returns {Array<{ text: string, metadata: object }>}
 */
export function chunkText(text, options = {}) {
  const maxChars   = options.maxChars ?? MAX_CHUNK_CHARS;
  const paragraphs = text.split(/\n\n+/);
  const chunks     = [];
  let current      = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push({ text: current.trim(), metadata: { type: 'paragraph', start: null, end: null, name: null } });
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), metadata: { type: 'paragraph', start: null, end: null, name: null } });
  }

  return chunks;
}

/**
 * Split Markdown into chunks at heading boundaries.
 * @param {string} md
 * @param {{ maxChars?: number }} options
 * @returns {Array<{ text: string, metadata: object }>}
 */
export function chunkMarkdown(md, options = {}) {
  const maxChars = options.maxChars ?? MAX_CHUNK_CHARS;
  const lines    = md.split('\n');
  const chunks   = [];
  let current    = [];
  let heading    = null;

  for (const line of lines) {
    const hMatch = /^(#{1,6})\s+(.+)/.exec(line);
    if (hMatch && current.length > 0) {
      const text = current.join('\n').trim();
      if (text) chunks.push({ text, metadata: { type: 'heading', name: heading, start: null, end: null } });
      current = [line];
      heading = hMatch[2];
    } else {
      current.push(line);
      // Flush if oversized mid-section
      if (current.join('\n').length > maxChars) {
        const text = current.join('\n').trim();
        if (text) chunks.push({ text, metadata: { type: 'block', name: heading, start: null, end: null } });
        current = [];
      }
    }
  }

  if (current.length > 0) {
    const text = current.join('\n').trim();
    if (text) chunks.push({ text, metadata: { type: 'heading', name: heading, start: null, end: null } });
  }

  return chunks;
}

/**
 * Describe metadata for a chunk.
 * @param {{ text: string, start: number, end: number, filename?: string }} chunk
 * @returns {{ start: number, end: number, type: string, name: string|null }}
 */
export function getChunkMetadata(chunk) {
  const text = chunk.text ?? '';
  let type   = 'block';
  let name   = null;

  const funcMatch  = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/.exec(text);
  const classMatch = /^(?:export\s+)?class\s+(\w+)/.exec(text);
  const arrowMatch = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/.exec(text);

  if (funcMatch)  { type = 'function'; name = funcMatch[1]; }
  else if (classMatch) { type = 'class'; name = classMatch[1]; }
  else if (arrowMatch) { type = 'function'; name = arrowMatch[1]; }

  return { start: chunk.start ?? null, end: chunk.end ?? null, type, name, filename: chunk.filename ?? null };
}
