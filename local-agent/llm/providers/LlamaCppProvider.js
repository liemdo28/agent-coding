// llm/providers/LlamaCppProvider.js - llama.cpp server adapter
import { assertLocalUrl, streamLines } from '../utils.js';

export class LlamaCppProvider {
  constructor(config) {
    assertLocalUrl(config.baseUrl);
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model   = config.model ?? '';
    this.timeout = config.timeoutMs ?? 120000;
  }

  async isAvailable() {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 5000);
      const res  = await fetch(`${this.baseUrl}/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return { available: false, reason: `HTTP ${res.status}` };
      return { available: true, modelReady: true, reason: 'llama.cpp server online' };
    } catch (err) {
      return { available: false, modelReady: false, reason: err.message };
    }
  }

  async *streamChat(systemPrompt, userPrompt) {
    assertLocalUrl(this.baseUrl);

    const prompt = `<|system|>\n${systemPrompt}\n<|user|>\n${userPrompt}\n<|assistant|>\n`;

    const body = JSON.stringify({
      prompt,
      stream: true,
      n_predict: 2048,
      temperature: 0.2,
      stop: ['<|user|>', '<|system|>'],
    });

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), this.timeout);

    let res;
    try {
      res = await fetch(`${this.baseUrl}/completion`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(tid);
      throw new Error(`llama.cpp unreachable at ${this.baseUrl}: ${err.message}`);
    }

    if (!res.ok) {
      clearTimeout(tid);
      throw new Error(`llama.cpp error: HTTP ${res.status}`);
    }

    try {
      for await (const line of streamLines(res.body)) {
        if (!line) continue;
        const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
        let obj;
        try { obj = JSON.parse(jsonStr); } catch { continue; }
        const token = obj?.content ?? '';
        if (token) yield token;
        if (obj?.stop) break;
      }
    } finally {
      clearTimeout(tid);
    }
  }

  async chat(systemPrompt, userPrompt) {
    let full = '';
    for await (const tok of this.streamChat(systemPrompt, userPrompt)) full += tok;
    return full;
  }
}
