// models/ModelDetector.js - detects running local LLM providers via localhost HTTP
import { assertLocalUrl } from '../security/OfflineGuard.js';

const DETECT_TIMEOUT_MS = 3000;

/**
 * Detect Ollama running on localhost.
 * @param {string} baseUrl
 * @returns {Promise<{ available: boolean, models: object[], error?: string }>}
 */
export async function detectOllama(baseUrl = 'http://localhost:11434') {
  assertLocalUrl(baseUrl);
  const url = baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/api/tags`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) {
      return { available: false, models: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const models = (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size ?? null,
      modified_at: m.modified_at ?? null,
      details: {
        parameter_size: m.details?.parameter_size ?? null,
        quantization_level: m.details?.quantization_level ?? null,
      },
    }));
    return { available: true, models };
  } catch (err) {
    clearTimeout(tid);
    return { available: false, models: [], error: err.message };
  }
}

/**
 * Detect LM Studio running on localhost.
 * @param {string} baseUrl
 * @returns {Promise<{ available: boolean, models: object[], error?: string }>}
 */
export async function detectLMStudio(baseUrl = 'http://localhost:1234') {
  assertLocalUrl(baseUrl);
  const url = baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/v1/models`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) {
      return { available: false, models: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const models = (data.data ?? []).map((m) => ({
      name: m.id,
      size: null,
      created: m.created ?? null,
    }));
    return { available: true, models };
  } catch (err) {
    clearTimeout(tid);
    return { available: false, models: [], error: err.message };
  }
}

/**
 * Detect llama.cpp server running on localhost.
 * @param {string} baseUrl
 * @returns {Promise<{ available: boolean, models: object[], error?: string }>}
 */
export async function detectLlamaCpp(baseUrl = 'http://localhost:8080') {
  assertLocalUrl(baseUrl);
  const url = baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
  try {
    // Try /health first, fall back to /v1/models
    let res = await fetch(`${url}/health`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      // Also try to get model list from /v1/models
      let models = [{ name: 'local-model', size: null }];
      try {
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), DETECT_TIMEOUT_MS);
        const res2 = await fetch(`${url}/v1/models`, { signal: ctrl2.signal });
        clearTimeout(tid2);
        if (res2.ok) {
          const data = await res2.json();
          const list = data.data ?? data.models ?? [];
          if (list.length > 0) {
            models = list.map((m) => ({ name: m.id ?? m.name ?? 'local-model', size: null }));
          }
        }
      } catch {
        // Keep default model entry
      }
      return { available: true, models };
    }
    return { available: false, models: [], error: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(tid);
    // Try /v1/models as fallback
    const ctrl2 = new AbortController();
    const tid2 = setTimeout(() => ctrl2.abort(), DETECT_TIMEOUT_MS);
    try {
      const res2 = await fetch(`${url}/v1/models`, { signal: ctrl2.signal });
      clearTimeout(tid2);
      if (res2.ok) {
        const data = await res2.json();
        const list = data.data ?? data.models ?? [];
        const models = list.length > 0
          ? list.map((m) => ({ name: m.id ?? m.name ?? 'local-model', size: null }))
          : [{ name: 'local-model', size: null }];
        return { available: true, models };
      }
      return { available: false, models: [], error: `HTTP ${res2.status}` };
    } catch (err2) {
      clearTimeout(tid2);
      return { available: false, models: [], error: err.message };
    }
  }
}

/**
 * Detect all providers, including defaults and any configured provider.
 * @param {object} config - agent config object
 * @returns {Promise<{ providers: object[], totalModels: number, activeProvider: string|null }>}
 */
export async function detectAllProviders(config) {
  const llm = config?.llm ?? {};
  const configuredProvider = llm.provider?.toLowerCase() ?? null;
  const configuredBaseUrl = llm.baseUrl ?? null;

  // Build candidate list: always try the three common defaults
  const candidates = [
    { name: 'ollama',    baseUrl: 'http://localhost:11434', detect: detectOllama },
    { name: 'lmstudio',  baseUrl: 'http://localhost:1234',  detect: detectLMStudio },
    { name: 'llamacpp',  baseUrl: 'http://localhost:8080',  detect: detectLlamaCpp },
  ];

  // If config specifies a provider with a non-default URL, add it (avoid duplicating defaults)
  if (configuredBaseUrl && configuredProvider) {
    const defaultUrls = {
      ollama: 'http://localhost:11434',
      lmstudio: 'http://localhost:1234',
      'lm-studio': 'http://localhost:1234',
      llamacpp: 'http://localhost:8080',
      'llama.cpp': 'http://localhost:8080',
    };
    const normalised = configuredBaseUrl.replace(/\/$/, '');
    const defaultUrl = (defaultUrls[configuredProvider] ?? '').replace(/\/$/, '');
    if (normalised !== defaultUrl) {
      const detectFn =
        configuredProvider === 'ollama' ? detectOllama :
        (configuredProvider === 'lmstudio' || configuredProvider === 'lm-studio') ? detectLMStudio :
        detectLlamaCpp;
      candidates.unshift({ name: configuredProvider, baseUrl: configuredBaseUrl, detect: detectFn, configured: true });
    }
  }

  // Run all detections in parallel
  const results = await Promise.all(
    candidates.map(async (c) => {
      let result;
      try {
        result = await c.detect(c.baseUrl);
      } catch (err) {
        result = { available: false, models: [], error: err.message };
      }
      return {
        name: c.name,
        baseUrl: c.baseUrl,
        available: result.available,
        models: result.models ?? [],
        error: result.error ?? null,
        configured: c.configured ?? false,
      };
    })
  );

  const totalModels = results.reduce((sum, p) => sum + (p.available ? p.models.length : 0), 0);

  // Determine active provider: prefer configured one if available, else first available
  let activeProvider = null;
  if (configuredProvider) {
    const configured = results.find(
      (p) => p.name === configuredProvider && p.available
    );
    if (configured) activeProvider = configured.name;
  }
  if (!activeProvider) {
    const first = results.find((p) => p.available);
    if (first) activeProvider = first.name;
  }

  return { providers: results, totalModels, activeProvider };
}
