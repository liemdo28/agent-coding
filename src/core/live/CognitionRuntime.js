/**
 * CognitionRuntime.js — Real Local AI Integration
 *
 * Direct Ollama integration for local-first AI cognition.
 * Manages model lifecycle, streaming, embeddings, and task-specific model selection.
 * Falls back gracefully when Ollama is unavailable.
 */

export class CognitionRuntime {
    #baseUrl;
    #events;
    #available = false;
    #models = [];
    #activeModel = null;
    #stats = { chats: 0, embeddings: 0, tokens: 0, errors: 0, latencyMs: [] };

    constructor(config = {}, events) {
        this.#baseUrl = config.ollamaUrl || 'http://localhost:11434';
        this.#events = events;
    }

    async initialize() {
        this.#available = await this.#checkHealth();
        if (this.#available) {
            this.#models = await this.#fetchModels();
            this.#activeModel = this.#selectDefaultModel();
        }
    }

    async #checkHealth() {
        try {
            const res = await fetch(`${this.#baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(3000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async #fetchModels() {
        try {
            const res = await fetch(`${this.#baseUrl}/api/tags`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.models || []).map(m => m.name);
        } catch {
            return [];
        }
    }

    #selectDefaultModel() {
        const preferred = ['qwen2.5-coder:7b', 'llama3.1:8b', 'deepseek-r1:8b', 'phi4-mini'];
        for (const model of preferred) {
            if (this.#models.includes(model)) return model;
        }
        return this.#models[0] || null;
    }

    /**
     * Select the best model for a task type.
     */
    selectModel(taskType) {
        const map = {
            coding: ['qwen2.5-coder:7b', 'deepseek-coder:6.7b'],
            reasoning: ['deepseek-r1:8b', 'llama3.1:8b'],
            chat: ['llama3.1:8b', 'phi4-mini'],
            embedding: ['nomic-embed-text', 'mxbai-embed-large'],
            fast: ['phi4-mini', 'qwen2.5:3b'],
        };

        const candidates = map[taskType] || map.chat;
        for (const model of candidates) {
            if (this.#models.includes(model)) return model;
        }
        return this.#activeModel;
    }

    /**
     * Chat completion (non-streaming).
     */
    async chat(prompt, options = {}) {
        if (!this.#available) {
            return { content: '[AI offline — Ollama not available]', offline: true };
        }

        const model = options.model || this.selectModel(options.taskType || 'chat');
        const messages = [];

        // Add context if provided
        if (options.context) {
            messages.push({
                role: 'system',
                content: `Context:\n${typeof options.context === 'string' ? options.context : JSON.stringify(options.context, null, 2)}`,
            });
        }

        messages.push({ role: 'user', content: prompt });

        const start = Date.now();
        try {
            const res = await fetch(`${this.#baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        temperature: options.temperature ?? 0.7,
                        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
                    },
                }),
            });

            if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
            const data = await res.json();

            const latency = Date.now() - start;
            this.#stats.chats++;
            this.#stats.tokens += data.eval_count || 0;
            this.#stats.latencyMs.push(latency);
            if (this.#stats.latencyMs.length > 100) this.#stats.latencyMs.shift();

            this.#events?.publish('cognition.chat.completed', {
                model,
                latency,
                tokens: data.eval_count,
            });

            return {
                content: data.message?.content || '',
                model: data.model,
                latency,
                tokens: data.eval_count,
            };
        } catch (err) {
            this.#stats.errors++;
            this.#events?.publish('cognition.error', { error: err.message });
            return { content: `[AI error: ${err.message}]`, error: true };
        }
    }

    /**
     * Streaming chat completion.
     */
    async *stream(prompt, options = {}) {
        if (!this.#available) {
            yield '[AI offline — Ollama not available]';
            return;
        }

        const model = options.model || this.selectModel(options.taskType || 'chat');
        const messages = [];

        if (options.context) {
            messages.push({
                role: 'system',
                content: `Context:\n${typeof options.context === 'string' ? options.context : JSON.stringify(options.context, null, 2)}`,
            });
        }

        messages.push({ role: 'user', content: prompt });

        try {
            const res = await fetch(`${this.#baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    options: { temperature: options.temperature ?? 0.7 },
                }),
                signal: options.signal,
            });

            if (!res.ok) throw new Error(`Stream error: ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(Boolean);

                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            if (json.message?.content) {
                                yield json.message.content;
                            }
                            if (json.done) {
                                this.#stats.chats++;
                                return;
                            }
                        } catch {
                            // Partial JSON
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (err) {
            this.#stats.errors++;
            yield `[Stream error: ${err.message}]`;
        }
    }

    /**
     * Generate embeddings for text.
     */
    async embed(text, model = 'nomic-embed-text') {
        if (!this.#available) return null;

        try {
            const res = await fetch(`${this.#baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt: text }),
            });

            if (!res.ok) return null;
            const data = await res.json();
            this.#stats.embeddings++;
            return data.embedding;
        } catch {
            return null;
        }
    }

    /**
     * Batch embed multiple texts.
     */
    async embedBatch(texts, model = 'nomic-embed-text') {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text, model));
        }
        return results;
    }

    get isAvailable() { return this.#available; }
    get loadedModels() { return this.#models; }
    get activeModel() { return this.#activeModel; }

    getStats() {
        const avgLatency = this.#stats.latencyMs.length > 0
            ? Math.round(this.#stats.latencyMs.reduce((a, b) => a + b, 0) / this.#stats.latencyMs.length)
            : 0;

        return {
            available: this.#available,
            models: this.#models,
            activeModel: this.#activeModel,
            chats: this.#stats.chats,
            embeddings: this.#stats.embeddings,
            totalTokens: this.#stats.tokens,
            errors: this.#stats.errors,
            avgLatencyMs: avgLatency,
        };
    }
}
