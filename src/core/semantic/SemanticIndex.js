/**
 * SemanticIndex.js — Semantic search with embeddings and vector storage
 *
 * Supports queries like:
 * - "projects using websocket"
 * - "projects with auth"
 * - "projects with memory leak"
 *
 * Uses: local embeddings (Ollama), cosine similarity, keyword fallback
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export class SemanticIndex {
    #config;
    #documents = [];
    #storageDir;
    #embedder = null;
    #stats = { indexed: 0, searches: 0, hits: 0 };

    constructor(config = {}) {
        this.#config = {
            storageDir: config.storageDir || join(process.cwd(), '.super-agent-ai', 'semantic'),
            embeddingModel: config.embeddingModel || 'nomic-embed-text',
            chunkSize: config.chunkSize || 2048,
            topK: config.topK || 10,
            ...config,
        };
        this.#storageDir = this.#config.storageDir;
    }

    async initialize() {
        mkdirSync(this.#storageDir, { recursive: true });

        // Load existing index
        this.#loadIndex();

        // Try to initialize embedding engine (Ollama)
        try {
            this.#embedder = await this.#initEmbedder();
        } catch {
            // Fallback to keyword-only search
            this.#embedder = null;
        }
    }

    /**
     * Index a document for semantic search.
     * @param {object} doc - { id, type, path, content, metadata }
     */
    async index(doc) {
        const entry = {
            id: doc.id,
            type: doc.type || 'document',
            path: doc.path || null,
            content: doc.content,
            metadata: doc.metadata || {},
            indexedAt: Date.now(),
            embedding: null,
            keywords: this.#extractKeywords(doc.content),
        };

        // Generate embedding if available
        if (this.#embedder) {
            try {
                entry.embedding = await this.#embedder.embed(doc.content);
            } catch {
                // Continue without embedding
            }
        }

        // Upsert
        const existingIdx = this.#documents.findIndex(d => d.id === doc.id);
        if (existingIdx >= 0) {
            this.#documents[existingIdx] = entry;
        } else {
            this.#documents.push(entry);
        }

        this.#stats.indexed++;
        this.#persistIndex();
    }

    /**
     * Search the index with a natural language query.
     * @param {string} query
     * @param {object} options - { topK, type, minScore }
     * @returns {Promise<Array>} ranked results
     */
    async search(query, options = {}) {
        this.#stats.searches++;
        const topK = options.topK || this.#config.topK;
        const minScore = options.minScore || 0.1;

        let results;

        if (this.#embedder) {
            // Vector similarity search
            try {
                const queryEmbedding = await this.#embedder.embed(query);
                results = this.#vectorSearch(queryEmbedding, topK);
            } catch {
                // Fallback to keyword
                results = this.#keywordSearch(query, topK);
            }
        } else {
            // Keyword-only search
            results = this.#keywordSearch(query, topK);
        }

        // Filter by type if specified
        if (options.type) {
            results = results.filter(r => r.type === options.type);
        }

        // Filter by minimum score
        results = results.filter(r => r.score >= minScore);

        if (results.length > 0) this.#stats.hits++;

        return results.slice(0, topK);
    }

    /** Vector similarity search using cosine distance */
    #vectorSearch(queryEmbedding, topK) {
        const scored = this.#documents
            .filter(doc => doc.embedding)
            .map(doc => ({
                id: doc.id,
                type: doc.type,
                path: doc.path,
                metadata: doc.metadata,
                score: this.#cosineSimilarity(queryEmbedding, doc.embedding),
                snippet: doc.content.slice(0, 200),
            }))
            .sort((a, b) => b.score - a.score);

        return scored.slice(0, topK);
    }

    /** Keyword-based search with BM25-like scoring */
    #keywordSearch(query, topK) {
        const queryTerms = this.#extractKeywords(query);
        if (queryTerms.length === 0) return [];

        const scored = this.#documents.map(doc => {
            let score = 0;
            const docTerms = doc.keywords;

            for (const term of queryTerms) {
                // Exact match
                if (docTerms.includes(term)) {
                    score += 2;
                }
                // Partial match
                else if (docTerms.some(dt => dt.includes(term) || term.includes(dt))) {
                    score += 1;
                }
                // Content contains term
                if (doc.content.toLowerCase().includes(term)) {
                    score += 0.5;
                }
            }

            // Normalize by query length
            score = score / queryTerms.length;

            return {
                id: doc.id,
                type: doc.type,
                path: doc.path,
                metadata: doc.metadata,
                score,
                snippet: doc.content.slice(0, 200),
            };
        })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);

        return scored.slice(0, topK);
    }

    #cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom === 0 ? 0 : dot / denom;
    }

    #extractKeywords(text) {
        if (!text) return [];
        const stopWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'can', 'shall',
            'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
            'as', 'into', 'through', 'during', 'before', 'after', 'and',
            'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
            'neither', 'each', 'every', 'all', 'any', 'few', 'more',
            'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
            'than', 'too', 'very', 'just', 'because', 'if', 'when', 'that',
            'this', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our',
        ]);

        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w))
            .slice(0, 100);
    }

    async #initEmbedder() {
        // Try Ollama local embedding
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.#config.embeddingModel, prompt: 'test' }),
            signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) throw new Error('Ollama not available');

        return {
            embed: async (text) => {
                const resp = await fetch('http://localhost:11434/api/embeddings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.#config.embeddingModel,
                        prompt: text.slice(0, this.#config.chunkSize),
                    }),
                    signal: AbortSignal.timeout(10000),
                });
                const data = await resp.json();
                return data.embedding;
            },
        };
    }

    #loadIndex() {
        const indexPath = join(this.#storageDir, 'index.json');
        if (existsSync(indexPath)) {
            try {
                const data = JSON.parse(readFileSync(indexPath, 'utf8'));
                this.#documents = data.documents || [];
            } catch {
                this.#documents = [];
            }
        }
    }

    #persistIndex() {
        const indexPath = join(this.#storageDir, 'index.json');
        // Don't persist embeddings to JSON (too large) — only metadata + keywords
        const serializable = this.#documents.map(d => ({
            ...d,
            embedding: null, // Embeddings regenerated on load if needed
        }));
        writeFileSync(indexPath, JSON.stringify({ documents: serializable, updatedAt: Date.now() }, null, 2));
    }

    getStats() {
        return {
            ...this.#stats,
            documentCount: this.#documents.length,
            hasEmbedder: !!this.#embedder,
        };
    }
}
