/**
 * LocalLLMAdapter — thin wrapper around Ollama localhost API for offline LLM inference.
 *
 * All calls go to http://localhost:11434 only. No external network access.
 *
 * Usage:
 *   import { LocalLLMAdapter } from './LocalLLMAdapter.js';
 *   const llm = new LocalLLMAdapter({ model: 'qwen2.5-coder:7b' });
 *   const response = await llm.generate('def hello(): return "world"');
 */

const OLLAMA_BASE = 'http://localhost:11434';

export class LocalLLMAdapter {
  /**
   * @param {{ model?: string; timeout?: number; temperature?: number }} [options]
   */
  constructor({ model = 'qwen2.5-coder:7b', timeout = 120, temperature = 0.2 } = {}) {
    this.model = model;
    this.timeout = timeout;
    this.temperature = temperature;
  }

  /**
   * Generate a response from the model.
   * @param {string} prompt
   * @param {{ temperature?: number; top_p?: number; stop?: string[] }} [options]
   * @returns {Promise<string>} raw text response
   */
  async generate(prompt, { temperature = this.temperature, top_p = 0.9, stop } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout * 1000);

    try {
      const body = {
        model: this.model,
        prompt,
        stream: false,
        options: { temperature, top_p },
      };
      if (stop) body.options.stop = stop;

      const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama error ${res.status}: ${text}`);
      }

      const data = await res.json();
      return (data.response || '').trim();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Ollama timeout after ${this.timeout}s for model '${this.model}'`);
      }
      throw err;
    }
  }

  /**
   * Check if Ollama is reachable.
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Extract code from an LLM response (markdown code block or raw).
   * @param {string} response
   * @param {string} [language]
   * @returns {string}
   */
  extractCode(response, language) {
    const pattern = language
      ? new RegExp(`\`\`\`${language}[^\\n]*\\n?([\\s\\S]*?)\`\`\``)
      : /```(?:\w+)?\n?([\s\S]*?)```/;
    const match = response.match(pattern);
    return match ? match[1].trim() : response.trim();
  }
}

export default LocalLLMAdapter;