// local-agent/providers/ProviderRouter.js
// 4-Provider LLM Router: Local Ollama + Claude + OpenAI + Antigravity IDE
// Supports Personal SKU (local only) and Pro SKU (local + cloud + Antigravity)

export class ProviderRouter {
  constructor(config = {}) {
    this.config = {
      // Default to local-only for Personal SKU
      sku: config.sku || 'personal',
      // Local Ollama (always available)
      localUrl: config.localUrl || 'http://127.0.0.1:11434',
      // Claude (Pro only)
      claudeApiKey: config.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY,
      // OpenAI (Pro only)
      openaiApiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      // OpusMax (OpenAI-compatible, available to all SKUs)
      opusMaxApiKey:      config.OPUSMAX_API_KEY  || process.env.OPUSMAX_API_KEY,
      opusMaxBaseUrl:     config.OPUSMAX_BASE_URL || process.env.OPUSMAX_BASE_URL || 'https://opusmax.shop/v1',
      defaultOpusMaxModel: config.defaultOpusMaxModel || process.env.OPUSMAX_DEFAULT_MODEL || 'claude-opus-4.7',
      // Antigravity NKQ — Anthropic-compatible proxy, key format: AGOP-XXXX-XXXX-XXXX
      antigravityApiKey:      config.ANTIGRAVITY_API_KEY  || process.env.ANTIGRAVITY_API_KEY,
      antigravityBaseUrl:      config.ANTIGRAVITY_BASE_URL || process.env.ANTIGRAVITY_BASE_URL || 'https://api.nkq.vn/v1',
      defaultAntigravityModel: config.defaultAntigravityModel || process.env.ANTIGRAVITY_DEFAULT_MODEL || 'claude-opus-4-6',
      // Model selection
      defaultLocalModel: config.defaultLocalModel || 'qwen2.5-coder:7b',
      defaultClaudeModel: config.defaultClaudeModel || 'claude-3-5-sonnet-20241022',
      defaultOpenAIModel: config.defaultOpenAIModel || 'gpt-4o',
      // Routing preferences
      preferLocal: config.preferLocal ?? true,
      maxTokens: config.maxTokens || 4096,
      // Fallback chain — opusmax first (cloud, no local infra needed)
      fallbackChain: config.fallbackChain || ['opusmax', 'local', 'claude', 'openai'],
      ...config
    };

    // Provider registry with metadata
    this.providers = {
      opusmax: {
        name: 'OpusMax',
        sku: 'both',
        enabled: !!this.config.opusMaxApiKey,
        handler: this._routeOpusMax.bind(this),
        models: ['claude-opus-4', 'claude-sonnet-4-6', 'claude-haiku-4-5']
      },
      local: {
        name: 'Local Ollama',
        sku: 'both', // Available in Personal and Pro
        enabled: true,
        handler: this._routeLocal.bind(this),
        models: ['qwen2.5-coder:7b', 'qwen2.5-coder:1.5b', 'deepseek-r1:7b', 'llama3:latest']
      },
      claude: {
        name: 'Claude (Anthropic)',
        sku: 'pro',
        enabled: this.config.claudeApiKey ? true : false,
        handler: this._routeClaude.bind(this),
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-opus-20241022', 'claude-3-haiku-20240307']
      },
      openai: {
        name: 'OpenAI Codex',
        sku: 'pro',
        enabled: this.config.openaiApiKey ? true : false,
        handler: this._routeOpenAI.bind(this),
        models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
      },
      antigravity: {
        name: 'Antigravity NKQ',
        sku: 'both',
        enabled: !!this.config.antigravityApiKey,
        handler: this._routeAntigravity.bind(this),
        models: ['claude-opus-4', 'claude-sonnet-4-6', 'claude-haiku-4-5']
      }
    };

    // Metrics tracking
    this.metrics = {
      requests: { opusmax: 0, local: 0, claude: 0, openai: 0, antigravity: 0 },
      failures: { opusmax: 0, local: 0, claude: 0, openai: 0, antigravity: 0 },
      avgLatency: { opusmax: 0, local: 0, claude: 0, openai: 0, antigravity: 0 }
    };
  }

  // ========== Main Interface ==========

  /**
   * Generate response using specified provider or auto-route
   * @param {string} provider - Provider name or 'auto' for auto-routing
   * @param {string} prompt - The prompt to send
   * @param {object} options - Additional options
   * @returns {Promise<object>} Response with text and metadata
   */
  async generate(providerName, prompt, options = {}) {
    const provider = providerName?.toLowerCase() || 'auto';

    if (provider === 'auto') {
      return this._autoRoute(prompt, options);
    }

    const handler = this.providers[provider];
    if (!handler) {
      throw new Error(
        `Provider '${provider}' not found. Available: ${Object.keys(this.providers).join(', ')}`
      );
    }

    if (!handler.enabled) {
      throw new Error(
        `Provider '${provider}' is not enabled. ` +
        (handler.sku === 'pro' ? 'Requires Pro SKU.' : 'Check configuration.')
      );
    }

    // Check SKU compatibility
    if (!this._isSkuAllowed(handler.sku)) {
      throw new Error(
        `Provider '${provider}' requires Pro SKU. Current: ${this.config.sku}`
      );
    }

    return this._withMetrics(provider, () => handler.handler(prompt, options));
  }

  /**
   * Generate with automatic provider selection
   */
  async _autoRoute(prompt, options = {}) {
    const complexity = this._estimateComplexity(prompt);
    const availableProviders = this._getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No providers available. Check configuration and API keys.');
    }

    // Try providers in fallback chain until one succeeds
    for (const providerName of this.config.fallbackChain) {
      const provider = this.providers[providerName];
      if (!provider?.enabled || !this._isSkuAllowed(provider.sku)) {
        continue;
      }

      try {
        return await this._withMetrics(providerName, () =>
          provider.handler(prompt, { ...options, complexity })
        );
      } catch (err) {
        console.warn(`[ProviderRouter] ${providerName} failed: ${err.message}. Trying next...`);
        this.metrics.failures[providerName]++;
      }
    }

    throw new Error('All providers failed. Check logs for details.');
  }

  /**
   * Batch generate with multiple providers
   */
  async generateMultiple(providers, prompt, options = {}) {
    return Promise.all(
      providers.map(p => this.generate(p, prompt, options))
    );
  }

  /**
   * Compare responses from multiple providers
   */
  async compare(prompt, options = {}) {
    const providers = this._getAvailableProviders();
    const results = await Promise.allSettled(
      providers.map(p => this.generate(p, prompt, options))
    );

    return providers.map((name, i) => ({
      provider: name,
      success: results[i].status === 'fulfilled',
      response: results[i].status === 'fulfilled' ? results[i].value : null,
      error: results[i].status === 'rejected' ? results[i].reason.message : null
    }));
  }

  // ========== Provider Handlers ==========

  async _routeLocal(prompt, options = {}) {
    const model = options.model || this.config.defaultLocalModel;
    const url = `${this.config.localUrl}/api/generate`;

    console.log(`[ProviderRouter] Routing to Local Ollama (${model})`);

    // Check if Ollama is available
    const available = await this._checkOllamaHealth();
    if (!available) {
      throw new Error('Ollama is not running. Start with: ollama serve');
    }

    const body = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.9,
        num_predict: options.maxTokens || this.config.maxTokens,
        ...options.ollamaOptions
      }
    };

    // Add context from previous messages if provided
    if (options.context) {
      body.context = options.context;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        text: data.response,
        provider: 'local',
        model,
        done: data.done,
        totalDuration: data.total_duration,
        loadDuration: data.load_duration,
        promptEvalCount: data.prompt_eval_count,
        evalCount: data.eval_count,
        context: data.context
      };
    } catch (err) {
      console.error('[ProviderRouter] Local provider failed:', err.message);
      throw err;
    }
  }

  async _routeClaude(prompt, options = {}) {
    const apiKey = this.config.claudeApiKey;
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY is required for Claude provider.');
    }

    const model = options.model || this.config.defaultClaudeModel;
    console.log(`[ProviderRouter] Routing to Claude API (${model})`);

    // Build messages array for Claude
    const messages = this._buildMessages(prompt, options);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-password-access': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || this.config.maxTokens,
          messages,
          system: options.system || undefined,
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? undefined,
          top_k: options.topK ?? undefined,
          stop_sequences: options.stopSequences || undefined,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Claude error ${response.status}: ${errorData.error?.type || response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.content[0].text,
        provider: 'claude',
        model,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens
        },
        stopReason: data.stop_reason
      };
    } catch (err) {
      console.error('[ProviderRouter] Claude provider failed:', err.message);
      throw err;
    }
  }

  async _routeOpenAI(prompt, options = {}) {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI provider.');
    }

    const model = options.model || this.config.defaultOpenAIModel;
    console.log(`[ProviderRouter] Routing to OpenAI API (${model})`);

    const messages = this._buildMessages(prompt, options);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? undefined,
          max_tokens: options.maxTokens || this.config.maxTokens,
          frequency_penalty: options.frequencyPenalty ?? 0,
          presence_penalty: options.presencePenalty ?? 0,
          stop: options.stopSequences || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI error ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        provider: 'openai',
        model,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        finishReason: data.choices[0].finish_reason
      };
    } catch (err) {
      console.error('[ProviderRouter] OpenAI provider failed:', err.message);
      throw err;
    }
  }

  async _routeOpusMax(prompt, options = {}) {
    const apiKey = this.config.opusMaxApiKey;
    if (!apiKey) {
      throw new Error('OPUSMAX_API_KEY is required. Set it in .env (format: sk_...)');
    }

    const baseUrl = this.config.opusMaxBaseUrl;
    const model   = options.model || this.config.defaultOpusMaxModel;
    console.log(`[ProviderRouter] Routing to OpusMax (${model}) @ ${baseUrl}`);

    const messages = this._buildMessages(prompt, options);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ban-${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || this.config.maxTokens,
          stream: false,
          ...(options.stopSequences ? { stop: options.stopSequences } : {})
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`OpusMax error ${response.status}: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        provider: 'opusmax',
        model,
        usage: {
          inputTokens:  data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          totalTokens:  data.usage?.total_tokens
        },
        finishReason: data.choices[0].finish_reason
      };
    } catch (err) {
      console.error('[ProviderRouter] OpusMax provider failed:', err.message);
      throw err;
    }
  }

  async _routeAntigravity(prompt, options = {}) {
    const apiKey = this.config.antigravityApiKey;
    if (!apiKey) {
      throw new Error('ANTIGRAVITY_API_KEY is required. Set it in .env (format: AGOP-XXXX-XXXX-XXXX)');
    }

    const baseUrl = this.config.antigravityBaseUrl;
    const model   = options.model || this.config.defaultAntigravityModel;
    console.log(`[ProviderRouter] Routing to Antigravity NKQ (${model}) @ ${baseUrl}`);

    // Antigravity NKQ is an Anthropic-compatible proxy.
    // Setup: $env:ANTHROPIC_API_KEY="AGOP-..." ; irm https://antigravity.nkq.vn/claude-setup.ps1 | iex
    const messages = this._buildMessages(prompt, options);

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || this.config.maxTokens,
          messages,
          ...(options.system        ? { system: options.system }               : {}),
          ...(options.temperature   ? { temperature: options.temperature }      : {}),
          ...(options.stopSequences ? { stop_sequences: options.stopSequences } : {})
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Antigravity error ${response.status}: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.content.find(c => c.type === 'text')?.text || '',
        provider: 'antigravity',
        model,
        usage: {
          inputTokens:  data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens
        },
        stopReason: data.stop_reason
      };
    } catch (err) {
      console.error('[ProviderRouter] Antigravity provider failed:', err.message);
      throw err;
    }
  }

  // ========== Helper Methods ==========

  _buildMessages(prompt, options) {
    const messages = [];

    // Add previous conversation context if provided
    if (options.history && Array.isArray(options.history)) {
      messages.push(...options.history);
    }

    // Add current prompt
    if (typeof prompt === 'string') {
      messages.push({ role: 'user', content: prompt });
    } else if (Array.isArray(prompt)) {
      messages.push(...prompt);
    }

    return messages;
  }

  _estimateComplexity(prompt) {
    // Estimate task complexity to route to appropriate model
    const length = prompt.length;
    const hasCode = /```[\s\S]*?```/.test(prompt);
    const hasMath = /\\?\$[^$]+\\\$|\d+\s*[\+\-\*\/]\s*\d+/.test(prompt);
    const hasLongContext = prompt.split('\\n').length > 50;

    if (length > 5000 || hasLongContext) return 'high';
    if (length > 1000 || hasCode || hasMath) return 'medium';
    return 'low';
  }

  _getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([name, p]) =>
        p.enabled && this._isSkuAllowed(p.sku)
      )
      .map(([name]) => name);
  }

  _isSkuAllowed(requiredSku) {
    if (requiredSku === 'both') return true;
    if (requiredSku === 'personal' && this.config.sku === 'personal') return true;
    if (requiredSku === 'pro') return this.config.sku === 'pro';
    return this.config.sku === requiredSku;
  }

  async _checkOllamaHealth() {
    try {
      const response = await fetch(`${this.config.localUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async _withMetrics(provider, fn) {
    const startTime = Date.now();
    try {
      const result = await fn();
      const latency = Date.now() - startTime;

      // Update metrics
      this.metrics.requests[provider]++;
      this._updateAvgLatency(provider, latency);

      return result;
    } catch (err) {
      this.metrics.failures[provider]++;
      throw err;
    }
  }

  _updateAvgLatency(provider, latency) {
    const current = this.metrics.avgLatency[provider];
    const count = this.metrics.requests[provider];
    this.metrics.avgLatency[provider] =
      (current * (count - 1) + latency) / count;
  }

  // ========== Management Interface ==========

  getStatus() {
    return {
      sku: this.config.sku,
      providers: Object.entries(this.providers).map(([name, p]) => ({
        name,
        displayName: p.name,
        enabled: p.enabled,
        skuRequired: p.sku,
        available: p.enabled && this._isSkuAllowed(p.sku),
        models: p.models
      })),
      metrics: this.metrics,
      config: {
        preferLocal: this.config.preferLocal,
        fallbackChain: this.config.fallbackChain
      }
    };
  }

  enableProvider(name) {
    const provider = this.providers[name];
    if (provider) {
      provider.enabled = true;
      return { success: true, provider: name };
    }
    return { success: false, error: 'Provider not found' };
  }

  disableProvider(name) {
    const provider = this.providers[name];
    if (provider) {
      provider.enabled = false;
      return { success: true, provider: name };
    }
    return { success: false, error: 'Provider not found' };
  }

  setSku(sku) {
    if (!['personal', 'pro'].includes(sku)) {
      throw new Error('SKU must be "personal" or "pro"');
    }
    this.config.sku = sku;
    return { success: true, sku };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics = {
      requests: { opusmax: 0, local: 0, claude: 0, openai: 0, antigravity: 0 },
      failures: { opusmax: 0, local: 0, claude: 0, openai: 0, antigravity: 0 },
      avgLatency: { opusmax: 0, local: 0, claude: 0, openai: 0, antigravity: 0 }
    };
    return { success: true };
  }
}

// ========== Factory Function ==========

export function createProviderRouter(config = {}) {
  return new ProviderRouter(config);
}

// ========== CLI Helper ==========

export async function interactiveRoute(prompt, config = {}) {
  const router = createProviderRouter(config);

  console.log('\\n[ProviderRouter] Interactive Mode');
  console.log('Available providers:', router._getAvailableProviders().join(', '));
  console.log('Current SKU:', router.config.sku);
  console.log('');

  // Try each provider and show comparison
  const results = await router.compare(prompt);

  console.log('\\nResults:');
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`  ${status} ${r.provider}: ${r.success ? r.response.text.substring(0, 100) + '...' : r.error}`);
  });

  return results;
}

export default ProviderRouter;