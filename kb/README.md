# Knowledge Base

Offline RAG knowledge base for the local-agent system.
**100% offline after first ingest** — no cloud, no API keys, no telemetry.

## Quick Start

```bash
# Clone and install
git clone https://github.com/liemdo28/agent-coding
npm install

# Build the knowledge base (requires internet, ~8-12 min)
npm run kb:ingest

# Query offline — no internet needed
npm run kb:query "how does async/await work in JavaScript"
npm run kb:stats
```

## How It Works

```
Ingest (once, needs internet)         Query (offline, instant)
────────────────────────────          ──────────────────────────
Wikipedia API (CC BY-SA 4.0)          SQLite FTS5
      ↓                                     ↓ candidates
ChunkEngine (400w/80w overlap)        TF-IDF cosine re-rank
      ↓                                     ↓
SQLite DB + FTS5 index                Ranked results with
      ↓                               attribution + license
IDF file (kb/idf.json)
```

## Deployment Strategy — Option B (Reproducible Pipeline)

The SQLite database is **not committed to Git** (typically 50-200 MB, changes with each ingest).
Instead, the pipeline is fully reproducible with one command:

```bash
npm run kb:ingest     # idempotent — safe to re-run, skips existing articles
```

**Why Option B instead of packaging the DB:**
- Git LFS adds cost and complexity for a file that should be refreshed periodically
- Wikipedia content changes — a packaged DB would go stale
- The ingest takes ~10 minutes on first run, then seconds on re-runs (idempotent)
- Any machine with Node.js 18+ and internet can rebuild the full KB from scratch

**CI/CD:** For production deployments, add `npm run kb:ingest` to your init script or
Dockerfile `RUN` step. The runner skips already-ingested articles, so re-deploys are fast.

## Database Location

After ingest, the database lives at:

```
.local-agent/kb/knowledge.db    ← SQLite database (WAL mode)
.local-agent/kb/idf.json        ← TF-IDF term weights (rebuilt automatically)
```

Both paths are in `.gitignore`. The `kb/` source directory (article lists, pipeline code) IS committed.

## Statistics (last ingest: 2026-05-18)

| Domain | Documents | Chunks | Words |
|---|---|---|---|
| coding | 219 | 2,305 | 694,174 |
| machine-learning | 131 | 1,940 | 547,343 |
| marketing | 129 | 1,471 | 455,127 |
| hr | 105 | 1,498 | 466,319 |
| website | 114 | 774 | 235,417 |
| design | 110 | 1,045 | 318,608 |
| accounting | 139 | 1,199 | 365,795 |
| data-analyst | 108 | 1,195 | 347,200 |
| business-analyst | 110 | 933 | 285,482 |
| logistics | 100 | 1,101 | 340,674 |
| **TOTAL** | **1,265** | **13,461** | **4,056,139** |

See `kb/stats.json` for the full breakdown including per-topic counts and sample documents.

## CLI Commands

```bash
node bin/kb.js query "your question"          # search all domains
node bin/kb.js query "question" -d coding     # filter by domain
node bin/kb.js query "question" -k 10         # top-10 results
node bin/kb.js list [domain]                  # browse documents
node bin/kb.js stats                          # database statistics
node bin/kb.js sources [domain]               # show source audit
node bin/kb.js rebuild-index                  # rebuild TF-IDF index
```

## Source Policy

All ingested content is **CC BY-SA 4.0** (Wikipedia contributors).
Every document includes attribution in its footer.

Proprietary sources (Investopedia, HubSpot, Apple HIG, SHRM, BABOK, Incoterms) are marked
`"recommend": "reference"` in `kb/sources/*.json` and were **not** ingested.

## Extending the KB

Add more topics by editing `kb/domains/<domain>-articles.js` and re-running:

```bash
npm run kb:ingest               # adds new articles, skips existing ones
```

To add a new domain, create `kb/domains/<slug>-articles.js` and `kb/sources/<slug>.json`,
then add the slug to the `DOMAINS` array in `scripts/kb-ingest.js`.

## Technical Notes

- **WikipediaFetcher User-Agent:** follows Wikimedia policy (`<client>/<version> (<contact>)`)
- **Rate limiting:** 220ms between requests (~4.5 req/s), well under the 200 req/s API limit
- **Retry logic:** exponential backoff (0.5s → 1s → 2s) on 429 / 5xx / network errors
- **FTS5 tokenizer:** `porter unicode61` — Porter stemming, Unicode-aware
- **Chunking:** 400-word windows with 80-word overlap, prefers paragraph boundaries
- **TF-IDF:** smoothed IDF, light Porter stemmer, English stop-word list
