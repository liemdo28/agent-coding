/**
 * IngestionEngine.js — Real Knowledge Processing Pipeline
 *
 * Reads files, chunks content, generates embeddings, stores in database.
 * Supports: code files, markdown, JSON, text.
 * Processes in batches for throughput.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename, relative } from 'path';

export class IngestionEngine {
    #db;
    #cognition;
    #events;
    #chunkSize = 1500;
    #chunkOverlap = 200;
    #stats = { filesProcessed: 0, chunksStored: 0, errors: 0, bytesProcessed: 0 };
    #processing = false;
    #queue = [];

    constructor(db, cognition, events) {
        this.#db = db;
        this.#cognition = cognition;
        this.#events = events;
    }

    async initialize() {
        // Nothing to initialize — ready to ingest
    }

    /**
     * Ingest a file or directory.
     */
    async ingest(path) {
        if (!existsSync(path)) return { error: 'Path not found', path };

        const stat = statSync(path);
        if (stat.isDirectory()) {
            return this.#ingestDirectory(path);
        }
        return this.#ingestFile(path);
    }

    /**
     * Ingest a single file (called by fs watcher).
     */
    async ingestFile(filePath) {
        return this.#ingestFile(filePath);
    }

    async #ingestFile(filePath) {
        const ext = extname(filePath).toLowerCase();
        if (!this.#isSupportedExt(ext)) return { skipped: true, path: filePath };

        try {
            const content = readFileSync(filePath, 'utf-8');
            if (content.length === 0) return { skipped: true, reason: 'empty' };

            const chunks = this.#chunkContent(content, filePath);
            const source = relative(process.cwd(), filePath);

            // Store chunks
            const rows = chunks.map((chunk, i) => ({
                id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
                source,
                content: chunk,
                embedding: null,
                metadata: JSON.stringify({ ext, index: i, total: chunks.length }),
                created_at: Date.now(),
            }));

            if (this.#db.type !== 'none') {
                this.#db.batchInsert('knowledge', rows);
            }

            this.#stats.filesProcessed++;
            this.#stats.chunksStored += chunks.length;
            this.#stats.bytesProcessed += content.length;

            this.#events?.publish('ingestion.file.processed', {
                source,
                chunks: chunks.length,
                bytes: content.length,
            });

            // Generate embeddings async (non-blocking)
            this.#generateEmbeddings(rows).catch(() => { });

            return { source, chunks: chunks.length, bytes: content.length };
        } catch (err) {
            this.#stats.errors++;
            return { error: err.message, path: filePath };
        }
    }

    async #ingestDirectory(dirPath) {
        const results = { files: 0, chunks: 0, errors: 0 };

        const walk = (dir, depth = 0) => {
            if (depth > 5) return;
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (this.#shouldSkip(entry.name)) continue;
                    const full = join(dir, entry.name);

                    if (entry.isDirectory()) {
                        walk(full, depth + 1);
                    } else if (entry.isFile() && this.#isSupportedExt(extname(entry.name).toLowerCase())) {
                        this.#queue.push(full);
                    }
                }
            } catch { }
        };

        walk(dirPath);

        // Process queue in batches
        while (this.#queue.length > 0) {
            const batch = this.#queue.splice(0, 10);
            const batchResults = await Promise.allSettled(
                batch.map(f => this.#ingestFile(f))
            );

            for (const r of batchResults) {
                if (r.status === 'fulfilled' && !r.value.error && !r.value.skipped) {
                    results.files++;
                    results.chunks += r.value.chunks || 0;
                } else if (r.status === 'rejected' || r.value?.error) {
                    results.errors++;
                }
            }
        }

        this.#events?.publish('ingestion.directory.completed', {
            path: dirPath,
            ...results,
        });

        return results;
    }

    async #generateEmbeddings(rows) {
        if (!this.#cognition?.isAvailable) return;

        for (const row of rows) {
            const embedding = await this.#cognition.embed(row.content);
            if (embedding && this.#db.type !== 'none') {
                this.#db.run(
                    'UPDATE knowledge SET embedding = ? WHERE id = ?',
                    [Buffer.from(new Float32Array(embedding).buffer), row.id]
                );
            }
        }
    }

    #chunkContent(content, filePath) {
        const ext = extname(filePath).toLowerCase();

        // Code files: chunk by logical boundaries
        if (['.js', '.ts', '.py', '.rs', '.go', '.java'].includes(ext)) {
            return this.#chunkCode(content);
        }

        // Markdown: chunk by headers
        if (['.md', '.mdx'].includes(ext)) {
            return this.#chunkMarkdown(content);
        }

        // Default: fixed-size chunks
        return this.#chunkFixed(content);
    }

    #chunkCode(content) {
        const chunks = [];
        const lines = content.split('\n');
        let current = [];
        let currentSize = 0;

        for (const line of lines) {
            current.push(line);
            currentSize += line.length + 1;

            // Split on function/class boundaries or size limit
            const isBoundary = /^(export\s+)?(function|class|const\s+\w+\s*=|async\s+function)/.test(line.trim());
            if ((isBoundary && currentSize > 500) || currentSize > this.#chunkSize) {
                chunks.push(current.join('\n'));
                // Keep overlap
                const overlapLines = current.slice(-3);
                current = [...overlapLines];
                currentSize = overlapLines.join('\n').length;
            }
        }

        if (current.length > 0) {
            chunks.push(current.join('\n'));
        }

        return chunks.filter(c => c.trim().length > 50);
    }

    #chunkMarkdown(content) {
        const sections = content.split(/^#{1,3}\s+/m);
        const chunks = [];

        for (const section of sections) {
            if (section.trim().length < 50) continue;
            if (section.length <= this.#chunkSize) {
                chunks.push(section.trim());
            } else {
                chunks.push(...this.#chunkFixed(section));
            }
        }

        return chunks;
    }

    #chunkFixed(content) {
        const chunks = [];
        let start = 0;

        while (start < content.length) {
            const end = Math.min(start + this.#chunkSize, content.length);
            chunks.push(content.slice(start, end));
            start = end - this.#chunkOverlap;
        }

        return chunks.filter(c => c.trim().length > 50);
    }

    #isSupportedExt(ext) {
        const supported = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go', '.java',
            '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml',
            '.css', '.html', '.sql', '.sh', '.bash',
        ];
        return supported.includes(ext);
    }

    #shouldSkip(name) {
        const skip = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.venv'];
        return skip.includes(name) || name.startsWith('.');
    }

    getStats() {
        return { ...this.#stats, queueSize: this.#queue.length };
    }
}
