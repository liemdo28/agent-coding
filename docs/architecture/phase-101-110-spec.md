# AOS Phase 101-110 Architecture Specification
> Generated: 2026-05-20 | Project: agent-coding | Stack: Node.js ESM + better-sqlite3 + FTS5

---

## Existing Infrastructure Anchors

Before reading phase specs, understand what already exists and can be reused:

| Asset | Path | What it provides |
|---|---|---|
| ResourceMonitor | `accounting-engine/collectors/ResourceMonitor.js` | CPU %, heap MB, RSS MB samples via EventEmitter |
| BatchWriter | `accounting-engine/collectors/BatchWriter.js` | Batched SQLite inserts |
| DatabaseManager | `accounting-engine/core/DatabaseManager.js` | WAL-mode SQLite open/close pattern |
| TimelineStore | `local-agent/timeline/TimelineStore.js` | Append-only JSONL event log |
| TimelineEngine | `local-agent/timeline/TimelineEngine.js` | Typed event recording API |
| AnalyticsEngine | `local-agent/analytics/AnalyticsEngine.js` | QA trend, regression frequency from JSONL |
| FailureForecastEngine | `accounting-engine/analyzers/FailureForecastEngine.js` | Recency-weighted failure probability |
| PatternAbstractor | `local-agent/cross-project/PatternAbstractor.js` | Normalizes code snippets to structural patterns |
| CrossProjectLearning | `local-agent/cross-project/CrossProjectLearning.js` | Per-project pattern store with merge |
| KBQuery | `kb/KBQuery.js` | FTS5 SQLite KB query with ranked results |
| execution_summary.json | `.super-agent-fullauto-kpi/execution_summary.json` | 5532 task records: status, SLA, worker, duration |
| analytics.json | `.super-agent-fullauto-kpi/analytics.json` | Aggregated: completion_rate, sla_breach_rate, worker_utilization |
| baseline metrics | `metrics/baseline-2026-05-18.json` | KB query p50=106ms p99=373ms, scan=2400ms, RAM=43MB |

---

## Build Order (Dependency Graph)

```
Phase 101 (Sensor Fabric)
  ├─► Phase 102 (Strategic Consciousness)   [needs metric streams]
  ├─► Phase 104 (Execution Ecology)         [needs worker + queue metrics]
  └─► Phase 107 (Weather Engine)            [needs live sensor readings]

Phase 102 (Strategic Consciousness)
  └─► Phase 103 (Software Species)          [needs tradeoff score as input dimension]

Phase 103 (Software Species)
  └─► Phase 106 (Engineering DNA)           [health scores feed pattern inheritance]

Phase 104 (Execution Ecology)
  └─► Phase 105 (Autonomous Scientist)      [needs balanced queue to run experiments safely]

Phase 105 (Autonomous Scientist)
  └─► Phase 106 (Engineering DNA)           [experiment results become reusable patterns]

Phase 107 (Weather Engine)
  └─► Phase 108 (Reality Reconstruction)   [forecasts anchor causal analysis]

Phase 108 (Reality Reconstruction)
  └─► Phase 109 (Autonomous Design)        [execution state drives UI adaptation]

Phase 109 (Autonomous Design)
  └─► Phase 110 (Physics Engine)           [UI stability feeds entropy model]

Recommended build sequence:
  101 → 102 → 104 → 103 → 105 → 106 → 107 → 108 → 109 → 110
```

---

## Phase 101 — Global Sensor Fabric

**Goal:** A unified, low-overhead sensor bus that polls CPU, memory, KB query latency, queue depth, and worker utilization on a configurable interval. All downstream phases read from this bus instead of sampling hardware independently.

### Module: SensorBus

**Path:** `local-agent/sensors/SensorBus.js`

**Concrete inputs:**
- `process.cpuUsage()` / `process.memoryUsage()` (Node built-ins)
- `.super-agent-fullauto-kpi/execution_summary.json` (queue depth = DEV_RUNNING count)
- `.super-agent-fullauto-kpi/analytics.json` (worker_utilization map)
- `kb/KBQuery.js` → timed probe query to measure latency
- `accounting-engine/collectors/ResourceMonitor.js` (reuse existing sampler)

**Concrete outputs:**
- In-memory EventEmitter `'sample'` events (primary — zero disk I/O on hot path)
- `~/.local-agent/sensors.db` — SQLite table `sensor_readings` (ring-buffer, keep 24h)
- Optional: `.local-agent/sensors-latest.json` written every N samples (for dashboard polling)

**SQLite schema (`sensor_readings`):**
```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
  id          INTEGER PRIMARY KEY,
  ts          TEXT    NOT NULL,          -- ISO8601
  cpu_pct     REAL,
  heap_mb     REAL,
  rss_mb      REAL,
  kb_p50_ms   REAL,                      -- rolling median of last 20 KB probe queries
  queue_depth INTEGER,                   -- DEV_RUNNING count from execution_summary
  worker_busy INTEGER,                   -- workers with utilization > threshold
  worker_idle INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sr_ts ON sensor_readings(ts);
```

**Key functions/classes:**
```js
// SensorBus.js
export class SensorBus extends EventEmitter {
  constructor(options = {})
  // options.intervalMs   default 10000
  // options.dbPath       default ~/.local-agent/sensors.db
  // options.kbDbPath     path to KB SQLite file
  // options.kpiPath      path to .super-agent-fullauto-kpi/

  start()    // begins polling, returns this
  stop()     // clears interval, flushes last sample to DB
  latest()   // returns most-recent SensorReading object synchronously
  history(opts = { limitMs: 3600000 })  // returns SensorReading[] from DB
}

// SensorReading shape:
// { ts, cpu_pct, heap_mb, rss_mb, kb_p50_ms, queue_depth, worker_busy, worker_idle }
```

```js
// local-agent/sensors/probes/KBLatencyProbe.js
export function probeKBLatency(kbDbPath, queryText = 'function error')
// Returns: { latency_ms: number, hit: boolean }
// Uses a fixed 'canary' query; measures time for KBQuery.search() round-trip

// local-agent/sensors/probes/QueueDepthProbe.js
export function probeQueueDepth(kpiPath)
// Reads execution_summary.json; counts { DEV_RUNNING, DEV_FAILED, DEV_DONE }
// Returns: { running: number, failed: number, done: number, depth: number }

// local-agent/sensors/probes/WorkerUtilizationProbe.js
export function probeWorkerUtilization(analyticsJsonPath, thresholdTasks = 15)
// Reads analytics.json worker_utilization map
// Returns: { busy: number, idle: number, overloaded: number, utilMap: Record<string,number> }
```

**Dependencies:**
- `better-sqlite3` (already in package.json)
- `accounting-engine/collectors/ResourceMonitor.js` (extend or wrap, do not duplicate CPU sampling)
- `kb/KBQuery.js`

**Effort estimate:** S (3-4 days)

---

## Phase 102 — Strategic Consciousness

**Goal:** A scoring engine that takes a snapshot of current sensor readings and produces a ranked tradeoff matrix across three axes: Performance, Cost, and Maintainability. Outputs a `StrategyScore` that other phases can query to decide whether to run expensive operations.

### Module: StrategyScorer

**Path:** `local-agent/strategy/StrategyScorer.js`

**Concrete inputs:**
- `SensorBus.latest()` → current sensor reading (Phase 101)
- `metrics/baseline-2026-05-18.json` → baseline values for normalization
- `.super-agent-fullauto-kpi/analytics.json` → sla_breach_rate, qa_pass_rate
- Optional: `~/.local-agent/sensors.db` history for trend slope calculation

**Concrete outputs:**
- In-memory `StrategyScore` object returned synchronously (no I/O on hot path)
- `~/.local-agent/strategy-log.jsonl` — append-only log of scores with timestamps (for audit/replay)

**StrategyScore schema:**
```js
{
  ts: string,           // ISO8601
  performance: {
    score: number,      // 0-100, higher = better current performance
    cpu_pressure: number,    // 0-1
    kb_latency_ratio: number, // actual/baseline (1.0 = at baseline)
    queue_pressure: number,   // 0-1
  },
  cost: {
    score: number,      // 0-100, higher = lower cost pressure
    worker_efficiency: number, // done_tasks / (busy_workers * elapsed_h)
    sla_breach_rate: number,
  },
  maintainability: {
    score: number,      // 0-100
    qa_pass_rate: number,
    kb_coverage: number,   // kb_chunks / js_loc ratio from baseline
  },
  composite: number,    // weighted sum, weights configurable
  recommendation: 'run_full' | 'run_lite' | 'defer' | 'alert'
}
```

**Key functions/classes:**
```js
// StrategyScorer.js
export class StrategyScorer {
  constructor(options = {})
  // options.weights = { performance: 0.4, cost: 0.3, maintainability: 0.3 }
  // options.baselinePath  path to baseline JSON
  // options.logPath       path to strategy-log.jsonl

  score(sensorReading, analyticsData)
  // Returns: StrategyScore — pure function, no side effects
  // Normalizes each metric against baseline, applies sigmoid clamp to 0-100

  scoreAsync(sensorBus, kpiPath)
  // Reads live data from SensorBus + KPI files, calls score(), logs result
  // Returns: Promise<StrategyScore>

  getRecommendation(strategyScore)
  // Returns: 'run_full' | 'run_lite' | 'defer' | 'alert'
  // Thresholds: composite < 30 → defer, < 50 → run_lite, >= 50 → run_full
  //             any single axis < 15 → alert
}

// local-agent/strategy/TradeoffMatrix.js
export function buildTradeoffMatrix(scores)
// Takes array of StrategyScore, returns a ranked comparison table
// Useful for CLI display: which axis is the binding constraint right now

// local-agent/strategy/StrategyHistory.js
export function appendStrategyLog(logPath, strategyScore)
export function readStrategyLog(logPath, opts = { limitMs: 86400000 })
// Reads last N ms of strategy-log.jsonl, returns StrategyScore[]
```

**Dependencies:**
- Phase 101 (SensorBus) must be running
- `metrics/baseline-2026-05-18.json` must exist (already present)

**Effort estimate:** S (2-3 days)

---

## Phase 103 — Software Species

**Goal:** A project health scoring system that rates each project on four dimensions — Adaptability, Stability, Scalability, Intelligence-Readiness — producing a "species classification" that guides which optimization strategies to apply.

### Module: SpeciesClassifier

**Path:** `local-agent/strategy/SpeciesClassifier.js`

**Concrete inputs:**
- `local-agent/orchestrator/ProjectHealthMonitor.js` (existing, reuse)
- `local-agent/orchestrator/projectPriorityEngine.js` (existing, reuse)
- `local-agent/timeline/TimelineStore.js` → regression rate, qa_run history
- `accounting-engine/analyzers/FailureForecastEngine.js` → forecast_score per module
- `StrategyScorer` (Phase 102) → composite strategy score as one input dimension
- `metrics/baseline-2026-05-18.json` → LOC, test counts for normalization

**Concrete outputs:**
- `SpeciesProfile` object per project (in-memory)
- `~/.local-agent/species-profiles.db` — SQLite table `species_scores` (one row per project per day)

**SQLite schema (`species_scores`):**
```sql
CREATE TABLE IF NOT EXISTS species_scores (
  id              INTEGER PRIMARY KEY,
  ts              TEXT NOT NULL,
  project_path    TEXT NOT NULL,
  adaptability    REAL,   -- 0-100: how quickly defects are fixed (regression→fix latency)
  stability       REAL,   -- 0-100: inverse of sla_breach_rate * failure_forecast avg
  scalability     REAL,   -- 0-100: queue throughput / worker count ratio headroom
  intelligence    REAL,   -- 0-100: kb_chunks/LOC ratio + test coverage proxy
  species_class   TEXT,   -- 'pioneer'|'workhorse'|'fragile'|'stagnant'|'optimal'
  composite       REAL
);
```

**Species classification rules:**
```
adaptability >= 70 AND stability >= 70 AND intelligence >= 60  → 'optimal'
adaptability >= 60 AND stability < 50                          → 'pioneer'   (fast but brittle)
stability >= 70 AND adaptability < 40                          → 'workhorse' (reliable but slow to evolve)
stability < 40 AND adaptability < 40                           → 'fragile'
else                                                           → 'stagnant'
```

**Key functions/classes:**
```js
// SpeciesClassifier.js
export class SpeciesClassifier {
  constructor(options = {})
  // options.dbPath     path to species-profiles.db
  // options.kpiPath    path to .super-agent-fullauto-kpi/

  classify(projectPath, strategyScore, timelineEvents)
  // Returns: SpeciesProfile — pure computation
  // Reads timeline, computes dimensions, assigns class

  classifyAsync(projectPath, sensorBus, strategyScorer)
  // Gathers all inputs, calls classify(), persists to DB
  // Returns: Promise<SpeciesProfile>

  getHistory(projectPath, days = 30)
  // Reads species_scores from DB, returns SpeciesProfile[]
  // Enables tracking evolution of species over time
}

// local-agent/strategy/AdaptabilityScorer.js
export function scoreAdaptability(timelineEvents)
// Inputs: qa_run + regression events from TimelineStore
// Computes: mean time from regression event to next qa_run PASS
// Returns: { score: number, mean_fix_h: number, regression_count: number }

// local-agent/strategy/IntelligenceReadinessScorer.js
export function scoreIntelligenceReadiness(baselineMetrics, kbStats)
// Computes: (kb_chunks / js_loc) * test_density * 100, clamped to 0-100
// Returns: { score: number, kb_density: number, test_density: number }
```

**Dependencies:**
- Phase 101 (SensorBus)
- Phase 102 (StrategyScorer)
- `local-agent/timeline/TimelineStore.js` (existing)
- `accounting-engine/analyzers/FailureForecastEngine.js` (existing)

**Effort estimate:** M (4-5 days)

---

## Phase 104 — Execution Ecology

**Goal:** Model the task queue as an ecosystem: tasks are "food", workers are "consumers". Detect over-feeding (queue overload), starvation (idle workers), and unsustainable throughput. Emit rebalancing recommendations.

### Module: EcologyBalancer

**Path:** `local-agent/ecology/EcologyBalancer.js`

**Concrete inputs:**
- `.super-agent-fullauto-kpi/execution_summary.json` — full task array (5532 records)
- `.super-agent-fullauto-kpi/analytics.json` — worker_utilization map, completion_rate
- `SensorBus.latest()` (Phase 101) — live queue_depth, worker_busy/idle counts
- `~/.local-agent/sensors.db` history — queue depth trend over last hour

**Concrete outputs:**
- `EcologyReport` object (in-memory)
- `~/.local-agent/ecology-log.jsonl` — timestamped ecology snapshots
- Emits EventEmitter `'rebalance'` events when thresholds crossed

**EcologyReport schema:**
```js
{
  ts: string,
  queue: {
    depth: number,
    inflow_rate_per_h: number,      // tasks entering DEV_RUNNING per hour (from history)
    outflow_rate_per_h: number,     // tasks completing per hour
    sustainable: boolean,           // outflow >= inflow
    pressure: 'low' | 'medium' | 'high' | 'critical'
  },
  workers: {
    total: number,
    busy: number,
    idle: number,
    overloaded: string[],           // worker IDs with utilization > 18 tasks
    underutilized: string[],        // worker IDs with utilization < 5 tasks
    skill_gaps: SkillGap[],         // skills where failed_tasks / total_tasks > 0.3
  },
  food_chain: FoodChainNode[],      // priority P1→P2→P3 consumption rates
  recommendation: RebalanceAction[]
}

// SkillGap: { skill: string, failure_rate: number, worker_count: number }
// FoodChainNode: { priority: string, count: number, completion_rate: number, avg_duration_h: number }
// RebalanceAction: { action: 'reassign'|'throttle'|'scale_skill', detail: string, urgency: 'low'|'high' }
```

**Key functions/classes:**
```js
// EcologyBalancer.js
export class EcologyBalancer extends EventEmitter {
  constructor(options = {})
  // options.kpiPath        path to .super-agent-fullauto-kpi/
  // options.sensorBus      SensorBus instance (Phase 101)
  // options.logPath        path to ecology-log.jsonl
  // options.overloadThreshold   default 18 tasks per worker
  // options.starveThreshold     default 5

  analyze()
  // Synchronously reads KPI files + SensorBus.latest()
  // Returns: EcologyReport

  watch(intervalMs = 60000)
  // Calls analyze() on interval, emits 'rebalance' when pressure >= 'high'
  // Returns: this (chainable)

  stop()
}

// local-agent/ecology/FoodChainAnalyzer.js
export function analyzeFoodChain(tasks)
// groups tasks by priority, computes consumption rates per priority tier
// Returns: FoodChainNode[]

// local-agent/ecology/SkillGapDetector.js
export function detectSkillGaps(tasks, threshold = 0.3)
// Groups tasks by worker_skill, computes failure rate per skill
// Returns: SkillGap[] sorted by failure_rate desc

// local-agent/ecology/WorkerEcosystem.js
export function classifyWorkers(workerUtilMap, tasks, overloadThreshold, starveThreshold)
// Returns: { busy, idle, overloaded[], underutilized[] }
```

**Dependencies:**
- Phase 101 (SensorBus) for live queue depth
- `.super-agent-fullauto-kpi/` files (existing data)

**Effort estimate:** M (3-4 days)

---

## Phase 105 — Autonomous Scientist

**Goal:** A lightweight A/B experiment engine. Engineer defines a hypothesis (e.g. "increasing worker skill X reduces SLA breaches"). The system runs a controlled comparison on historical or simulated data, validates statistical significance, and records the result as a reusable pattern.

### Module: ExperimentEngine

**Path:** `local-agent/experiments/ExperimentEngine.js`

**Concrete inputs:**
- `.super-agent-fullauto-kpi/execution_summary.json` — historical task dataset (control population)
- `EcologyBalancer.analyze()` (Phase 104) — current ecosystem state
- Experiment definition JSON (written by engineer or other phase)
- `~/.local-agent/experiments.db` — persisted hypotheses and results

**Concrete outputs:**
- `ExperimentResult` objects stored in `experiments.db`
- `~/.local-agent/experiment-patterns.jsonl` — validated patterns for Phase 106 pickup

**SQLite schema (`experiments`):**
```sql
CREATE TABLE IF NOT EXISTS experiments (
  id              TEXT PRIMARY KEY,    -- UUID
  created_at      TEXT NOT NULL,
  hypothesis      TEXT NOT NULL,       -- human-readable hypothesis string
  variable        TEXT NOT NULL,       -- what is being changed: 'worker_skill'|'queue_limit'|etc
  control_filter  TEXT,                -- JSON: filter applied to control group
  treatment_filter TEXT,               -- JSON: filter applied to treatment group
  metric          TEXT NOT NULL,       -- outcome metric: 'sla_breach_rate'|'completion_rate'|etc
  status          TEXT DEFAULT 'pending',  -- pending|running|complete|rejected
  control_n       INTEGER,
  treatment_n     INTEGER,
  control_mean    REAL,
  treatment_mean  REAL,
  p_value         REAL,
  significant     INTEGER,             -- 1/0 boolean
  effect_size     REAL,                -- Cohen's d or relative % change
  conclusion      TEXT,
  completed_at    TEXT
);
```

**Key functions/classes:**
```js
// ExperimentEngine.js
export class ExperimentEngine {
  constructor(options = {})
  // options.dbPath     path to experiments.db
  // options.kpiPath    path to .super-agent-fullauto-kpi/
  // options.alpha      significance threshold, default 0.05

  defineExperiment(hypothesis)
  // hypothesis: { hypothesis: string, variable: string, metric: string,
  //               controlFilter: object, treatmentFilter: object }
  // Validates fields, persists to DB with status='pending'
  // Returns: { id: string, ...hypothesis }

  runExperiment(experimentId)
  // Loads experiment from DB, loads task data, applies filters to get control/treatment groups
  // Calls StatsTester.tTest(control, treatment)
  // Updates DB with results, sets status='complete'|'rejected'
  // If significant AND effect_size > 0.1, appends to experiment-patterns.jsonl
  // Returns: ExperimentResult

  listExperiments(status = null)
  // Returns: experiment rows from DB, optionally filtered by status

  getResult(experimentId)
  // Returns: ExperimentResult with all fields
}

// local-agent/experiments/StatsTester.js
export function tTest(controlValues, treatmentValues)
// Welch's t-test implementation (no external dependencies)
// Returns: { t_stat: number, p_value: number, significant: boolean, effect_size: number }
// Uses: sample mean, variance, pooled degrees of freedom

export function splitByFilter(tasks, filter)
// filter: { worker_skill?: string, priority?: string, sla_breach?: boolean, company?: string }
// Returns: number[] — values of the target metric for matching tasks

// local-agent/experiments/HypothesisBuilder.js
export function suggestHypotheses(ecologyReport)
// Given an EcologyReport from Phase 104, suggests 3-5 experiment hypotheses
// targeting the highest-pressure areas (skill gaps, overloaded workers)
// Returns: HypothesisSuggestion[]
// HypothesisSuggestion: { hypothesis, variable, metric, controlFilter, treatmentFilter }
```

**Dependencies:**
- Phase 104 (EcologyBalancer) for ecosystem context and hypothesis suggestions
- `.super-agent-fullauto-kpi/execution_summary.json` (existing)

**Effort estimate:** M (4-5 days)

---

## Phase 106 — Engineering DNA

**Goal:** A persistent pattern library where successful fixes, experiment outcomes, and cross-project learnings are stored as reusable "genes". New projects inherit applicable patterns. A mutation sandbox lets engineers test pattern variants safely before committing them.

### Module: PatternLibrary + MutationSandbox

**Path:** `local-agent/dna/PatternLibrary.js`, `local-agent/dna/MutationSandbox.js`

**Concrete inputs:**
- `local-agent/cross-project/PatternAbstractor.js` (existing) — normalizes code to structural patterns
- `local-agent/cross-project/CrossProjectLearning.js` (existing) — per-project pattern store
- `~/.local-agent/experiment-patterns.jsonl` (Phase 105 output) — validated experiment results
- `SpeciesClassifier` (Phase 103) — species class filters which patterns are applicable
- `local-agent/knowledge/KnowledgeStore.js` (existing) — persistent knowledge store

**Concrete outputs:**
- `~/.local-agent/dna.db` — SQLite gene library
- `~/.local-agent/mutations/` — directory of sandboxed mutation attempts (JSON files)

**SQLite schema (`genes`):**
```sql
CREATE TABLE IF NOT EXISTS genes (
  id              TEXT PRIMARY KEY,    -- UUID
  created_at      TEXT NOT NULL,
  source          TEXT NOT NULL,       -- 'experiment'|'cross_project'|'manual'
  source_ref      TEXT,                -- experiment ID or project path
  category        TEXT NOT NULL,       -- 'fix_recipe'|'queue_strategy'|'worker_config'|'test_pattern'
  pattern_hash    TEXT NOT NULL,       -- SHA1 of normalized pattern for dedup
  description     TEXT,
  pattern_json    TEXT NOT NULL,       -- serialized pattern object
  applicability   TEXT,                -- JSON: { species_classes: [], min_queue_depth: N }
  success_count   INTEGER DEFAULT 0,
  failure_count   INTEGER DEFAULT 0,
  last_applied_at TEXT,
  active          INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_genes_category ON genes(category);
CREATE INDEX IF NOT EXISTS idx_genes_hash ON genes(pattern_hash);
```

**Key functions/classes:**
```js
// PatternLibrary.js
export class PatternLibrary {
  constructor(options = {})
  // options.dbPath       path to dna.db
  // options.mutationDir  path to mutations/ directory

  ingest(source, patternObj)
  // source: 'experiment'|'cross_project'|'manual'
  // patternObj: normalized pattern from PatternAbstractor
  // Deduplicates via pattern_hash, inserts or updates success_count
  // Returns: { id, isNew: boolean }

  query(opts = {})
  // opts: { category?, speciesClass?, minSuccessRate? }
  // Returns: Gene[] sorted by success_count / (success_count + failure_count) desc

  recordOutcome(geneId, success)
  // Increments success_count or failure_count, updates last_applied_at
  // If failure_count / total > 0.5 after 10+ trials, sets active=0

  inherit(targetProjectPath, speciesClass)
  // Queries active genes applicable to speciesClass
  // Returns: Gene[] — patterns recommended for inheritance
}

// MutationSandbox.js
export class MutationSandbox {
  constructor(options = {})
  // options.mutationDir  path to mutations/ directory
  // options.library      PatternLibrary instance

  proposeMutation(geneId, mutationSpec)
  // mutationSpec: { description: string, changes: object }
  // Writes mutation proposal to mutations/{geneId}-{timestamp}.json
  // Does NOT modify the live gene
  // Returns: { mutationId, path }

  evaluateMutation(mutationId, outcomeData)
  // Loads mutation file, applies outcomeData (success/failure, metrics)
  // If success rate of mutation > original gene, promotes to library via ingest()
  // Returns: { promoted: boolean, geneId?: string }

  listMutations(status = 'pending')
  // Reads mutations/ directory, filters by status field in JSON
  // Returns: MutationProposal[]
}

// local-agent/dna/GeneIngester.js
export async function ingestFromExperiments(experimentPatternsPath, library)
// Reads experiment-patterns.jsonl, calls PatternAbstractor.abstract() on each
// Calls library.ingest() for each abstracted pattern
// Returns: { ingested: number, skipped: number }

export async function ingestFromCrossProject(workspaceRoot, library)
// Calls CrossProjectLearning to get learned patterns from all projects
// Abstracts and ingests them
// Returns: { ingested: number, skipped: number }
```

**Dependencies:**
- Phase 103 (SpeciesClassifier) for applicability filtering
- Phase 105 (ExperimentEngine) for validated experiment patterns
- `local-agent/cross-project/PatternAbstractor.js` (existing)
- `local-agent/cross-project/CrossProjectLearning.js` (existing)

**Effort estimate:** L (6-8 days — DB design + dedup logic + mutation sandbox is non-trivial)

---

## Phase 107 — Weather Engine

**Goal:** Predict execution "weather" — when SLA storms are likely, what queue pressure will look like in the next 1-4 hours, which workers are heading toward exhaustion. Uses trend lines from sensor history, not ML models.

### Module: WeatherEngine

**Path:** `local-agent/weather/WeatherEngine.js`

**Concrete inputs:**
- `~/.local-agent/sensors.db` (Phase 101) — queue_depth, worker_busy over time
- `.super-agent-fullauto-kpi/execution_summary.json` — task start timestamps for arrival rate model
- `accounting-engine/analyzers/FailureForecastEngine.js` (existing) — module failure probabilities
- `StrategyScorer` history from `~/.local-agent/strategy-log.jsonl` (Phase 102)

**Concrete outputs:**
- `WeatherForecast` object (in-memory, computed on demand)
- `~/.local-agent/weather-forecasts.jsonl` — append-only forecast log

**WeatherForecast schema:**
```js
{
  ts: string,
  horizon_h: number,            // forecast horizon (1, 2, 4)
  queue_forecast: {
    predicted_depth: number,
    trend: 'rising' | 'stable' | 'falling',
    slope_per_h: number,        // linear regression slope from last 60 min
    storm_probability: number,  // 0-1: P(queue_depth > 2x current within horizon_h)
  },
  sla_forecast: {
    predicted_breach_rate: number,
    delta_vs_current: number,   // positive = getting worse
    at_risk_tasks: number,      // estimated DEV_RUNNING tasks that will breach SLA
  },
  worker_exhaustion: {
    at_risk_workers: string[],  // worker IDs trending toward overload
    predicted_idle_surplus: number,
  },
  pressure_index: number,       // 0-100, 100 = critical storm imminent
  alert_level: 'clear' | 'watch' | 'warning' | 'storm'
}
```

**Key functions/classes:**
```js
// WeatherEngine.js
export class WeatherEngine {
  constructor(options = {})
  // options.sensorDbPath     path to sensors.db
  // options.kpiPath          path to .super-agent-fullauto-kpi/
  // options.forecastLogPath  path to weather-forecasts.jsonl

  forecast(horizonH = 2)
  // Reads sensor history, computes linear regression on queue_depth
  // Applies Poisson arrival model for task inflow based on task start timestamps
  // Returns: WeatherForecast

  forecastAsync(horizonH = 2)
  // Same as forecast() but also appends result to forecastLogPath
  // Returns: Promise<WeatherForecast>

  getAlertLevel(forecast)
  // Threshold logic: pressure_index > 80 → storm, > 60 → warning, > 40 → watch
  // Returns: 'clear'|'watch'|'warning'|'storm'
}

// local-agent/weather/TrendAnalyzer.js
export function linearRegression(timeSeries)
// timeSeries: Array<{ ts: string, value: number }>
// Returns: { slope: number, intercept: number, r_squared: number }
// Pure function, no dependencies

export function predictAt(regression, futureTs)
// Returns: predicted value at futureTs using y = mx + b

// local-agent/weather/ArrivalRateModel.js
export function computeArrivalRate(tasks, windowMs = 3600000)
// Reads tasks array, counts tasks started within windowMs
// Computes exponential moving average of arrival rate
// Returns: { rate_per_h: number, ema_rate: number, peak_rate: number }

// local-agent/weather/SLAStormDetector.js
export function detectSLAStorm(tasks, queueForecast)
// Estimates how many currently-running tasks will exceed their SLA deadline
// Based on task duration distribution (median + 90th pct from historical data)
// Returns: { at_risk: number, breach_probability: number }
```

**Dependencies:**
- Phase 101 (SensorBus + sensors.db)
- Phase 102 (StrategyScorer history)
- `accounting-engine/analyzers/FailureForecastEngine.js` (existing)

**Effort estimate:** M (4-5 days)

---

## Phase 108 — Reality Reconstruction

**Goal:** Given a past execution window (e.g. "what happened between 14:00-16:00 yesterday"), replay events from the timeline, reconstruct the causal chain of failures, and simulate alternative outcomes ("what if we had reassigned worker W0271 at 14:30?").

### Module: ReplayEngine + CausalReconstructor

**Path:** `local-agent/replay/ReplayEngine.js`, `local-agent/replay/CausalReconstructor.js`

**Concrete inputs:**
- `local-agent/timeline/TimelineStore.js` (existing) — all events by time range
- `.super-agent-fullauto-kpi/execution_summary.json` — task records with timestamps
- `~/.local-agent/weather-forecasts.jsonl` (Phase 107) — forecasts made during the window
- `~/.local-agent/strategy-log.jsonl` (Phase 102) — strategy scores during the window
- `local-agent/simulation/BuildFailureSimulator.js` (existing) — reuse simulation primitives

**Concrete outputs:**
- `ReplaySession` object with ordered event stream
- `CausalChain` object linking events to outcomes
- `~/.local-agent/replays/` directory — saved replay sessions as JSON

**ReplaySession schema:**
```js
{
  id: string,               // UUID
  window: { from: string, to: string },
  events: ReplayEvent[],    // ordered by ts
  kpi_snapshot: object,     // analytics.json state inferred for that window
  summary: {
    total_events: number,
    failure_events: number,
    sla_breaches: number,
    timeline_gaps: TimelineGap[]  // periods with no events > 5min
  }
}

// ReplayEvent: { ts, type, payload, causal_parent?: string }
// TimelineGap: { from: string, to: string, gap_ms: number }
```

**CausalChain schema:**
```js
{
  root_event: ReplayEvent,
  chain: CausalLink[],
  counterfactuals: Counterfactual[]
}
// CausalLink: { cause: ReplayEvent, effect: ReplayEvent, lag_ms: number, confidence: number }
// Counterfactual: { intervention: string, simulated_outcome: string, estimated_sla_saved: number }
```

**Key functions/classes:**
```js
// ReplayEngine.js
export class ReplayEngine {
  constructor(options = {})
  // options.timelineRoot   workspace root for TimelineStore
  // options.kpiPath        path to .super-agent-fullauto-kpi/
  // options.replayDir      path to replays/ directory

  buildSession(from, to)
  // Queries TimelineStore for all events in [from, to]
  // Merges with KPI task records that started/completed in window
  // Returns: ReplaySession

  saveSession(session)
  // Writes session to replays/{session.id}.json
  // Returns: { path: string }

  loadSession(sessionId)
  // Reads replays/{sessionId}.json
  // Returns: ReplaySession
}

// CausalReconstructor.js
export class CausalReconstructor {
  constructor(options = {})

  reconstruct(replaySession)
  // Iterates ReplayEvent[] looking for temporal co-occurrence patterns
  // Heuristic rules:
  //   - regression event within 30s of file_change → file_change caused regression
  //   - sla_breach within 60s of queue_depth spike → queue caused breach
  //   - DEV_FAILED task + worker in overloaded list → overload caused failure
  // Returns: CausalChain

  simulateIntervention(causalChain, intervention)
  // intervention: { at: string, action: 'reassign_worker'|'throttle_queue'|'add_worker', params: object }
  // Re-runs causal chain with intervention applied, estimates outcome difference
  // Returns: Counterfactual
}

// local-agent/replay/TimelineGapDetector.js
export function detectGaps(events, thresholdMs = 300000)
// Scans sorted ReplayEvent[] for consecutive events with gap > thresholdMs
// Returns: TimelineGap[]
```

**Dependencies:**
- Phase 107 (WeatherEngine) — forecasts anchor causal analysis
- Phase 102 (StrategyScorer) — strategy log provides context
- `local-agent/timeline/TimelineStore.js` (existing)
- `local-agent/simulation/BuildFailureSimulator.js` (existing, reuse patterns)

**Effort estimate:** L (7-9 days — causal heuristics require careful tuning against real data)

---

## Phase 109 — Autonomous Design

**Goal:** Generate a live-updating HTML dashboard that adapts its layout and color palette to reflect current execution state. No manual CSS tweaking — the UI is programmatically generated from sensor + ecology + weather data. Replaces static dashboard files.

### Module: UIGenerator

**Path:** `local-agent/ui/UIGenerator.js`

**Concrete inputs:**
- `SensorBus.latest()` (Phase 101) — raw metrics
- `StrategyScore` (Phase 102) — composite score for overall health color
- `EcologyReport` (Phase 104) — worker/queue state
- `WeatherForecast` (Phase 107) — alert level drives color scheme
- `local-agent/ui/backend/server.js` (existing) — plug generated HTML into existing server

**Concrete outputs:**
- `~/.local-agent/dashboard/index.html` — generated on each render call
- `~/.local-agent/dashboard/data.json` — live data payload for client-side polling
- Extends existing `local-agent/ui/` backend, no new server needed

**Color/theme state mapping:**
```
WeatherForecast.alert_level:
  'clear'   → green palette (#1a7a4a bg, white text)
  'watch'   → amber palette (#b58900 bg, dark text)
  'warning' → orange palette (#cb4b16 bg, white text)
  'storm'   → red palette (#dc322f bg, white text, pulsing animation)

StrategyScore.recommendation:
  'run_full'  → all panels active
  'run_lite'  → analytics panels collapsed
  'defer'     → only critical panels visible
  'alert'     → alert banner injected at top
```

**Key functions/classes:**
```js
// UIGenerator.js
export class UIGenerator {
  constructor(options = {})
  // options.outputDir     default ~/.local-agent/dashboard/
  // options.templateDir   local-agent/ui/templates/ (static HTML partials)

  render(uiState)
  // uiState: { sensor, strategy, ecology, weather }
  // Selects theme from alert_level, composes HTML from templates
  // Writes index.html + data.json to outputDir
  // Returns: { path: string, theme: string, panelsRendered: number }

  renderAsync(sensorBus, strategyScorer, ecologyBalancer, weatherEngine)
  // Gathers all inputs, calls render()
  // Returns: Promise<{ path, theme, panelsRendered }>

  watch(intervalMs = 5000, deps)
  // Calls renderAsync() on interval
  // Returns: { stop: () => void }
}

// local-agent/ui/panels/SensorPanel.js
export function renderSensorPanel(sensorReading)
// Returns: HTML string for CPU/memory/KB latency cards

// local-agent/ui/panels/EcologyPanel.js
export function renderEcologyPanel(ecologyReport)
// Returns: HTML string for worker heatmap + queue flow chart
// Uses ASCII-art bar charts (no external charting library)

// local-agent/ui/panels/WeatherPanel.js
export function renderWeatherPanel(weatherForecast)
// Returns: HTML string for storm probability gauge + queue trend sparkline

// local-agent/ui/panels/SpeciesPanel.js
export function renderSpeciesPanel(speciesProfile)
// Returns: HTML string for project species classification radar

// local-agent/ui/ThemeEngine.js
export function selectTheme(alertLevel, strategyRecommendation)
// Returns: ThemeConfig { bgColor, textColor, accentColor, pulsing: boolean, collapsedPanels: string[] }

export function applyTheme(htmlTemplate, themeConfig)
// String-replaces theme variables in template
// Returns: themed HTML string
```

**File layout:**
```
local-agent/ui/
  UIGenerator.js          ← new
  templates/
    base.html             ← new (shell with {{THEME_*}} placeholders)
    sensor-panel.html     ← new
    ecology-panel.html    ← new
    weather-panel.html    ← new
    species-panel.html    ← new
  panels/
    SensorPanel.js        ← new
    EcologyPanel.js       ← new
    WeatherPanel.js       ← new
    SpeciesPanel.js       ← new
  ThemeEngine.js          ← new
  backend/                ← existing (add route: GET /dashboard → serve generated index.html)
```

**Dependencies:**
- Phase 101, 102, 104, 107 must be producing data
- Phase 103 (SpeciesClassifier) for SpeciesPanel
- `local-agent/ui/backend/server.js` (existing) — add one route, do not rewrite

**Effort estimate:** M (4-6 days — HTML templating is straightforward; adaptive logic is the work)

---

## Phase 110 — Physics Engine

**Goal:** Model execution stability using simple physics analogies: force fields (pressures that push the system away from equilibrium), entropy (disorder accumulating over time), and restoration forces (fixes, rebalancing). Produces a "stability equation" output — a single signed number indicating whether the system is converging or diverging from stable operation.

### Module: PhysicsEngine

**Path:** `local-agent/physics/PhysicsEngine.js`

**Concrete inputs:**
- All Phase 101-109 outputs as input dimensions (aggregated snapshot)
- `WeatherForecast.pressure_index` (Phase 107)
- `EcologyReport.queue.sustainable` (Phase 104)
- `SpeciesProfile.composite` (Phase 103)
- `StrategyScore.composite` (Phase 102)
- `~/.local-agent/physics-log.jsonl` — previous stability readings (for entropy accumulation)

**Concrete outputs:**
- `StabilityEquation` object (in-memory)
- `~/.local-agent/physics-log.jsonl` — append-only stability readings
- Feeds `UIGenerator` (Phase 109) with a stability-aware panel

**StabilityEquation schema:**
```js
{
  ts: string,
  forces: {
    queue_pressure: number,       // positive = destabilizing force
    sla_breach_force: number,     // positive = destabilizing
    skill_gap_force: number,      // positive = destabilizing
    kb_latency_drag: number,      // positive = friction/slowdown
    ecology_restoration: number,  // negative = stabilizing (from balancer actions)
    pattern_inheritance: number,  // negative = stabilizing (from DNA phase)
  },
  net_force: number,              // sum of forces; positive = diverging, negative = converging
  entropy: {
    current: number,              // 0-100; accumulated disorder score
    delta: number,                // change since last reading
    trend: 'increasing' | 'stable' | 'decreasing'
  },
  stability_index: number,        // -100 to +100; positive = stable, negative = unstable
  phase_state: 'stable' | 'meta_stable' | 'oscillating' | 'diverging' | 'critical',
  restoration_actions: RestorationAction[]
}

// RestorationAction: { force: string, action: string, estimated_delta: number }
```

**Physics model (concrete formulas):**
```
queue_pressure      = queue.depth / 50 * 40                      // max 40 units at depth=50
sla_breach_force    = sla_breach_rate * 30                        // max 30 units at 100% breach
skill_gap_force     = skill_gaps.length * 5                       // 5 units per gap
kb_latency_drag     = (kb_p50_ms / baseline_p50_ms - 1) * 10     // 0 at baseline, positive when slow
ecology_restoration = ecology.sustainable ? -15 : 0              // -15 if queue is sustainable
pattern_inheritance = (gene_success_count / 100) * -10            // up to -10 for mature library

net_force = sum(forces)
entropy   = prev_entropy + max(0, net_force * 0.1) - max(0, -net_force * 0.05)
            // entropy grows when net_force > 0, slowly decays when net_force < 0
            // clamped to [0, 100]

stability_index = clamp(-100, 100, -net_force * 2 - entropy * 0.5)
```

**Phase state thresholds:**
```
stability_index >= 60                          → 'stable'
stability_index >= 20 AND entropy < 40         → 'meta_stable'
|stability_index| < 20 AND entropy > 40        → 'oscillating'
stability_index < -20                          → 'diverging'
stability_index < -50 OR entropy > 80          → 'critical'
```

**Key functions/classes:**
```js
// PhysicsEngine.js
export class PhysicsEngine {
  constructor(options = {})
  // options.logPath          path to physics-log.jsonl
  // options.baselinePath     path to baseline metrics JSON
  // options.entropyDecayRate default 0.05

  compute(snapshot)
  // snapshot: { sensor, strategy, ecology, weather, species, geneLibrary }
  // Applies force formulas, reads previous entropy from log, computes stability_index
  // Returns: StabilityEquation — pure computation given snapshot + prior entropy

  computeAsync(deps)
  // deps: { sensorBus, strategyScorer, ecologyBalancer, weatherEngine, speciesClassifier, library }
  // Gathers snapshot from all deps, calls compute(), appends to physics-log.jsonl
  // Returns: Promise<StabilityEquation>

  getPhaseState(stabilityEquation)
  // Returns: phase_state string based on threshold table above

  suggestRestorations(stabilityEquation)
  // For each destabilizing force > 10 units, generates a RestorationAction
  // Returns: RestorationAction[]
}

// local-agent/physics/ForceCalculator.js
export function computeForces(snapshot, baselineMetrics)
// Returns: forces object with all six force dimensions
// Pure function — all inputs are explicit parameters

// local-agent/physics/EntropyTracker.js
export function accumulateEntropy(currentEntropy, netForce, decayRate = 0.05)
// Returns: { newEntropy: number, delta: number, trend: string }

export function readLastEntropy(physicsLogPath)
// Reads last line of physics-log.jsonl
// Returns: number (entropy value) or 0 if no prior log

// local-agent/physics/StabilityReport.js
export function formatStabilityReport(stabilityEquation)
// Returns: plain-text multi-line report for CLI output
// e.g.:
//   Stability Index: +42 (meta_stable)
//   Net Force: -8.3 (converging)
//   Entropy: 31 (stable, delta: -2.1)
//   Restoration: queue sustainable ✓, 2 skill gaps remain
```

**Dependencies:**
- All phases 101-109 (uses their outputs as force dimensions)
- `metrics/baseline-2026-05-18.json` (existing, for normalization)

**Effort estimate:** M (3-4 days — formulas are simple; integration across all phases is the work)

---

## Cross-Phase Integration Points

### Shared DB paths (all default to `~/.local-agent/`)

| File | Written by | Read by |
|---|---|---|
| `sensors.db` | Phase 101 | 102, 104, 107, 108 |
| `strategy-log.jsonl` | Phase 102 | 103, 108, 110 |
| `species-profiles.db` | Phase 103 | 106, 109 |
| `ecology-log.jsonl` | Phase 104 | 105, 110 |
| `experiments.db` | Phase 105 | 106 |
| `experiment-patterns.jsonl` | Phase 105 | 106 |
| `dna.db` | Phase 106 | 109, 110 |
| `mutations/` | Phase 106 | Phase 106 (self) |
| `weather-forecasts.jsonl` | Phase 107 | 108, 109, 110 |
| `replays/` | Phase 108 | Phase 108 (self) |
| `dashboard/` | Phase 109 | browser |
| `physics-log.jsonl` | Phase 110 | Phase 110 (self, for entropy) |

### Entry point wiring

All phases should be wired into `local-agent/LocalAIEngineeringOS.js` following the existing pattern:

```js
// LocalAIEngineeringOS.js additions
import { SensorBus } from './sensors/SensorBus.js';
import { StrategyScorer } from './strategy/StrategyScorer.js';
import { SpeciesClassifier } from './strategy/SpeciesClassifier.js';
import { EcologyBalancer } from './ecology/EcologyBalancer.js';
import { ExperimentEngine } from './experiments/ExperimentEngine.js';
import { PatternLibrary } from './dna/PatternLibrary.js';
import { WeatherEngine } from './weather/WeatherEngine.js';
import { ReplayEngine } from './replay/ReplayEngine.js';
import { UIGenerator } from './ui/UIGenerator.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
```

### CLI subcommands to add to `bin/local-agent.js`

Each phase adds 2-4 subcommands following the existing 56-command pattern:

```
sensors status          → SensorBus.latest() formatted report
sensors history --hours 2

strategy score          → StrategyScorer.scoreAsync()
strategy log --tail 10

species classify <path> → SpeciesClassifier.classifyAsync()
species history <path>

ecology report          → EcologyBalancer.analyze()
ecology watch

experiment define       → ExperimentEngine.defineExperiment() (interactive)
experiment run <id>
experiment list

dna query --category fix_recipe
dna ingest
mutation propose <geneId>
mutation evaluate <mutationId>

weather forecast --hours 2
weather alert

replay build --from <ts> --to <ts>
replay show <id>
replay simulate <id> --intervene <json>

dashboard render
dashboard watch

physics compute
physics report
```

---

## Effort Summary

| Phase | Module | Effort | Calendar days (1-2 engineers) |
|---|---|---|---|
| 101 | SensorBus | S | 3-4 |
| 102 | StrategyScorer | S | 2-3 |
| 103 | SpeciesClassifier | M | 4-5 |
| 104 | EcologyBalancer | M | 3-4 |
| 105 | ExperimentEngine | M | 4-5 |
| 106 | PatternLibrary + MutationSandbox | L | 6-8 |
| 107 | WeatherEngine | M | 4-5 |
| 108 | ReplayEngine + CausalReconstructor | L | 7-9 |
| 109 | UIGenerator | M | 4-6 |
| 110 | PhysicsEngine | M | 3-4 |
| **Total** | | | **40-53 days** |

Realistic delivery for 2 engineers working in sequence: **6-8 weeks** for 101-107, then **3-4 more weeks** for 108-110.

Minimum viable slice (phases that stand alone and deliver immediate value): **101 → 102 → 104 → 107**. These four phases give you live sensors, tradeoff scoring, worker ecosystem health, and storm prediction — all in ~2 weeks.
