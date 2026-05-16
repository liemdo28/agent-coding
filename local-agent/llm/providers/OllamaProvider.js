// llm/providers/OllamaProvider.js - Ollama local API adapter
import { assertLocalUrl, streamLines } from '../utils.js';

export class OllamaProvider {
  constructor(config) {
    assertLocalUrl(config.baseUrl);
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model   = config.model ?? 'qwen2.5-coder:7b';
    this.timeout = config.timeoutMs ?? 120000;
  }

  async isAvailable() {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 5000);
      const res  = await fetch(`${this.baseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return { available: false, reason: `HTTP ${res.status}` };
      const data  = await res.json();
      const names = (data.models ?? []).map((m) => m.name);
      const found = names.some((n) => n === this.model || n.startsWith(this.model + ':'));
      return {
        available: true,
        modelReady: found,
        models: names,
        reason: found ? 'Model ready' : `Model "${this.model}" not found. Available: ${names.join(', ')}`,
      };
    } catch (err) {
      return { available: false, modelReady: false, reason: err.message };
    }
  }

  async *streamChat(systemPrompt, userPrompt) {
    assertLocalUrl(this.baseUrl);

    const body = JSON.stringify({
      model:  this.model,
      stream: true,
      messages: [
        { role: 'system',  content: systemPrompt },
        { role: 'user',    content: userPrompt   },
      ],
    });

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), this.timeout);

    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(tid);
      throw new Error(`Ollama unreachable at ${this.baseUrl}: ${err.message}`);
    }

    if (!res.ok) {
      clearTimeout(tid);
      throw new Error(`Ollama error: HTTP ${res.status} — ${await res.text()}`);
    }

    try {
      for await (const line of streamLines(res.body)) {
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        const token = obj?.message?.content ?? '';
        if (token) yield token;
        if (obj.done) break;
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
