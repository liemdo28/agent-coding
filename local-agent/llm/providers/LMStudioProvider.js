// llm/providers/LMStudioProvider.js - LM Studio local OpenAI-compatible API
import { assertLocalUrl, streamLines } from '../utils.js';

export class LMStudioProvider {
  constructor(config) {
    assertLocalUrl(config.baseUrl);
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model   = config.model ?? 'local-model';
    this.timeout = config.timeoutMs ?? 120000;
  }

  async isAvailable() {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 5000);
      const res  = await fetch(`${this.baseUrl}/v1/models`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return { available: false, reason: `HTTP ${res.status}` };
      const data  = await res.json();
      const names = (data.data ?? []).map((m) => m.id);
      return { available: true, modelReady: true, models: names, reason: 'LM Studio server online' };
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
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    });

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), this.timeout);

    let res;
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(tid);
      throw new Error(`LM Studio unreachable at ${this.baseUrl}: ${err.message}`);
    }

    if (!res.ok) {
      clearTimeout(tid);
      throw new Error(`LM Studio error: HTTP ${res.status}`);
    }

    try {
      for await (const line of streamLines(res.body)) {
        if (!line || line === 'data: [DONE]') continue;
        const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
        let obj;
        try { obj = JSON.parse(jsonStr); } catch { continue; }
        const token = obj?.choices?.[0]?.delta?.content ?? '';
        if (token) yield token;
        if (obj?.choices?.[0]?.finish_reason) break;
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
