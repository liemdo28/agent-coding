// models/ModelBenchmark.js - benchmark local LLM models with a coding prompt

import { assertLocalUrl } from '../security/OfflineGuard.js';

export const BENCHMARK_PROMPT =
  'Write a JavaScript function that reverses a string. Reply with only the code, no explanation.';

const BENCHMARK_TIMEOUT_MS = 30000;

/**
 * Send BENCHMARK_PROMPT to a provider and measure response metrics.
 *
 * @param {'ollama'|'lmstudio'|'llamacpp'} provider
 * @param {string} baseUrl
 * @param {string} modelName
 * @returns {Promise<{ latencyMs: number|null, tokensGenerated: number|null, tokensPerSec: number|null, model: string, provider: string, timestamp: string, response?: string, error?: string }>}
 */
export async function benchmarkModel(provider, baseUrl, modelName) {
  assertLocalUrl(baseUrl);
  const url = baseUrl.replace(/\/$/, '');
  const timestamp = new Date().toISOString();
  const start = Date.now();

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), BENCHMARK_TIMEOUT_MS);

  try {
    let responseText = '';

    if (provider === 'ollama') {
      const res = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          stream: false,
          messages: [{ role: 'user', content: BENCHMARK_PROMPT }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      responseText = data?.message?.content ?? data?.response ?? '';
      const latencyMs = Date.now() - start;
      // Ollama reports eval_count (tokens generated) and eval_duration (nanoseconds)
      const tokensGenerated = data?.eval_count ?? null;
      const evalDurationSec = data?.eval_duration ? data.eval_duration / 1e9 : null;
      const tokensPerSec =
        tokensGenerated && evalDurationSec
          ? Math.round(tokensGenerated / evalDurationSec)
          : tokensGenerated
            ? Math.round(tokensGenerated / (latencyMs / 1000))
            : null;
      return { latencyMs, tokensGenerated, tokensPerSec, model: modelName, provider, timestamp, response: responseText };

    } else if (provider === 'lmstudio' || provider === 'lm-studio') {
      const res = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          stream: false,
          messages: [{ role: 'user', content: BENCHMARK_PROMPT }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      responseText = data?.choices?.[0]?.message?.content ?? '';
      const latencyMs = Date.now() - start;
      const tokensGenerated = data?.usage?.completion_tokens ?? null;
      const tokensPerSec = tokensGenerated
        ? Math.round(tokensGenerated / (latencyMs / 1000))
        : null;
      return { latencyMs, tokensGenerated, tokensPerSec, model: modelName, provider, timestamp, response: responseText };

    } else {
      // llamacpp — use /completion endpoint
      const res = await fetch(`${url}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: BENCHMARK_PROMPT,
          stream: false,
          n_predict: 512,
          temperature: 0.2,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      responseText = data?.content ?? '';
      const latencyMs = Date.now() - start;
      const tokensGenerated = data?.tokens_predicted ?? null;
      const timingMs = data?.timings?.predicted_ms ?? null;
      const tokensPerSec =
        tokensGenerated && timingMs
          ? Math.round(tokensGenerated / (timingMs / 1000))
          : tokensGenerated
            ? Math.round(tokensGenerated / (latencyMs / 1000))
            : null;
      return { latencyMs, tokensGenerated, tokensPerSec, model: modelName, provider, timestamp, response: responseText };
    }
  } catch (err) {
    clearTimeout(tid);
    const latencyMs = Date.now() - start;
    return {
      latencyMs: err.name === 'AbortError' ? BENCHMARK_TIMEOUT_MS : latencyMs,
      tokensGenerated: null,
      tokensPerSec: null,
      model: modelName,
      provider,
      timestamp,
      error: err.message,
    };
  }
}

/**
 * Benchmark every available model across all available providers.
 * Results are sorted by tokensPerSec descending (null values last).
 *
 * @param {Array<{ name: string, baseUrl: string, available: boolean, models: object[] }>} providers
 * @returns {Promise<Array<ReturnType<typeof benchmarkModel>>>}
 */
export async function benchmarkAll(providers) {
  const tasks = [];

  for (const p of providers) {
    if (!p.available) continue;
    for (const model of p.models) {
      tasks.push(benchmarkModel(p.name, p.baseUrl, model.name));
    }
  }

  const results = await Promise.all(tasks);

  return results.sort((a, b) => {
    if (a.tokensPerSec === null && b.tokensPerSec === null) return 0;
    if (a.tokensPerSec === null) return 1;
    if (b.tokensPerSec === null) return -1;
    return b.tokensPerSec - a.tokensPerSec;
  });
}
