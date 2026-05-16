// llm/utils.js - shared utilities for LLM providers

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/**
 * Reject any URL that is not a local loopback address.
 * This is the core offline enforcement for the LLM layer.
 */
export function assertLocalUrl(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch {
    throw new Error(`Invalid LLM baseUrl: "${urlStr}"`);
  }
  if (!LOCAL_HOSTS.has(u.hostname)) {
    throw new Error(
      `POLICY VIOLATION: LLM baseUrl "${urlStr}" is not a local address. ` +
      `Only localhost / 127.0.0.1 / 0.0.0.0 are allowed (offline mode).`
    );
  }
}

/**
 * Async generator that yields lines from a ReadableStream.
 * Works with Node.js 18+ native fetch response bodies.
 */
export async function* streamLines(body) {
  const reader  = body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer) yield buffer;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // last (possibly incomplete) line stays in buffer
      for (const line of lines) yield line;
    }
  } finally {
    reader.releaseLock();
  }
}
