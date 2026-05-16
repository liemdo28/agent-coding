// llm/LocalLLMAdapter.js - provider router with fallback and retry
import { assertLocalUrl } from './utils.js';
import { OllamaProvider }   from './providers/OllamaProvider.js';
import { LMStudioProvider } from './providers/LMStudioProvider.js';
import { LlamaCppProvider } from './providers/LlamaCppProvider.js';

const PROVIDERS = {
  ollama:    OllamaProvider,
  lmstudio:  LMStudioProvider,
  'lm-studio': LMStudioProvider,
  llamacpp:  LlamaCppProvider,
  'llama.cpp': LlamaCppProvider,
};

export class LocalLLMAdapter {
  constructor(llmConfig) {
    // Hard enforce offline — no remote URLs ever
    assertLocalUrl(llmConfig.baseUrl);

    const ProviderClass = PROVIDERS[llmConfig.provider?.toLowerCase()];
    if (!ProviderClass) {
      throw new Error(
        `Unknown LLM provider: "${llmConfig.provider}". ` +
        `Supported: ${Object.keys(PROVIDERS).join(', ')}`
      );
    }

    this.primary  = new ProviderClass(llmConfig);
    this.config   = llmConfig;
    this.retries  = llmConfig.retryAttempts ?? 3;
    this.retryMs  = llmConfig.retryDelayMs  ?? 1000;

    // Fallback provider (same type, different model)
    if (llmConfig.fallbackModel) {
      this.fallback = new ProviderClass({
        ...llmConfig,
        model: llmConfig.fallbackModel,
      });
    }
  }

  async checkAvailability() {
    return this.primary.isAvailable();
  }

  /**
   * Stream a chat response token-by-token.
   * Handles retries; falls back to fallbackModel on model-not-found errors.
   */
  async *streamChat(systemPrompt, userPrompt) {
    let lastErr;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        yield* this.primary.streamChat(systemPrompt, userPrompt);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < this.retries) {
          await sleep(this.retryMs * attempt);
        }
      }
    }

    // Try fallback model
    if (this.fallback) {
      try {
        yield* this.fallback.streamChat(systemPrompt, userPrompt);
        return;
      } catch (fbErr) {
        lastErr = fbErr;
      }
    }

    throw lastErr;
  }

  async chat(systemPrompt, userPrompt) {
    let full = '';
    for await (const tok of this.streamChat(systemPrompt, userPrompt)) full += tok;
    return full;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
