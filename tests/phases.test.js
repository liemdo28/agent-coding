// tests/phases.test.js — unit tests for Phase 101-110 modules
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function tmp() { return mkdtempSync(join(tmpdir(), 'phases-test-')); }

// ── Phase 102: StrategyScorer ──────────────────────────────────────────────

describe('StrategyScorer', () => {
  test('score() returns a valid StrategyScore with all required fields', async () => {
    const { StrategyScorer } = await import('../local-agent/strategy/StrategyScorer.js');
    const scorer = new StrategyScorer({ logPath: join(tmp(), 'strategy.jsonl') });
    const reading = {
      system:  { cpu_load_1m: 0.5, cpu_count: 4, mem_pct: 20, mem_used_mb: 400, mem_total_mb: 2000 },
      kb:      { query_p50_ms: 100, kb_chunks: 13000 },
      workers: { total_workers: 100, active_workers: 70, idle_workers: 30, queue_depth: 5, sla_breach_count: 10 },
      scan:    { last_scan_ms: 2400 },
    };
    const s = scorer.score(reading, { total_tasks: 100, qa_pass_rate: 0.85 });
    assert.ok(typeof s.composite === 'number', 'composite must be a number');
    assert.ok(s.composite >= 0 && s.composite <= 100, `composite out of range: ${s.composite}`);
    assert.ok(['run_full','run_lite','defer','alert'].includes(s.recommendation), `bad recommendation: ${s.recommendation}`);
    assert.ok(typeof s.performance.score === 'number');
    assert.ok(typeof s.cost.score === 'number');
    assert.ok(typeof s.maintainability.score === 'number');
    assert.ok(s.ts, 'ts must be present');
  });

  test('score() low cpu returns high performance score', async () => {
    const { StrategyScorer } = await import('../local-agent/strategy/StrategyScorer.js');
    const scorer = new StrategyScorer({ logPath: join(tmp(), 'strategy.jsonl') });
    const s = scorer.score({
      system: { cpu_load_1m: 0.01, cpu_count: 4 },
      kb: { query_p50_ms: 50 }, workers: { queue_depth: 0, total_workers: 100, idle_workers: 20, sla_breach_count: 0 },
    }, { total_tasks: 100, qa_pass_rate: 0.95 });
    assert.ok(s.performance.score >= 80, `expected high perf score, got ${s.performance.score}`);
  });

  test('getRecommendation returns alert when any axis < 15', async () => {
    const { StrategyScorer } = await import('../local-agent/strategy/StrategyScorer.js');
    const scorer = new StrategyScorer({ logPath: join(tmp(), 'strategy.jsonl') });
    const r = scorer.getRecommendation({
      composite: 60,
      performance: { score: 10 },
      cost: { score: 80 },
      maintainability: { score: 80 },
    });
    assert.strictEqual(r, 'alert');
  });

  test('getRecommendation returns defer when composite < 30', async () => {
    const { StrategyScorer } = await import('../local-agent/strategy/StrategyScorer.js');
    const scorer = new StrategyScorer({ logPath: join(tmp(), 'strategy.jsonl') });
    const r = scorer.getRecommendation({
      composite: 20,
      performance: { score: 20 }, cost: { score: 20 }, maintainability: { score: 20 },
    });
    assert.strictEqual(r, 'defer');
  });

  test('getRecommendation returns run_lite when composite 30-49', async () => {
    const { StrategyScorer } = await import('../local-agent/strategy/StrategyScorer.js');
    const scorer = new StrategyScorer({ logPath: join(tmp(), 'strategy.jsonl') });
    const r = scorer.getRecommendation({
      composite: 45,
      performance: { score: 45 }, cost: { score: 45 }, maintainability: { score: 45 },
    });
    assert.strictEqual(r, 'run_lite');
  });

  test('getRecommendation returns run_full when composite >= 50', async () => {
    const { StrategyScorer } = await import('../local-agent/strategy/StrategyScorer.js');
    const scorer = new StrategyScorer({ logPath: join(tmp(), 'strategy.jsonl') });
    const r = scorer.getRecommendation({
      composite: 75,
      performance: { score: 75 }, cost: { score: 75 }, maintainability: { score: 75 },
    });
    assert.strictEqual(r, 'run_full');
  });
});

// ── Phase 102: StrategyHistory ─────────────────────────────────────────────

describe('StrategyHistory', () => {
  test('appendStrategyLog + readStrategyLog round-trip', async () => {
    const { appendStrategyLog, readStrategyLog } = await import('../local-agent/strategy/StrategyHistory.js');
    const dir = tmp();
    const logPath = join(dir, 'strategy.jsonl');
    try {
      const entry = { ts: new Date().toISOString(), composite: 77, recommendation: 'run_full' };
      await appendStrategyLog(logPath, entry);
      const results = readStrategyLog(logPath, { limit: 10 });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].composite, 77);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('readStrategyLog returns empty array when file missing', async () => {
    const { readStrategyLog } = await import('../local-agent/strategy/StrategyHistory.js');
    const results = readStrategyLog('/tmp/no-such-strategy-log-xyz.jsonl');
    assert.deepStrictEqual(results, []);
  });

  test('readStrategyLog respects limitMs filter', async () => {
    const { appendStrategyLog, readStrategyLog } = await import('../local-agent/strategy/StrategyHistory.js');
    const dir = tmp();
    const logPath = join(dir, 'strategy.jsonl');
    try {
      const old = { ts: new Date(Date.now() - 200_000_000).toISOString(), composite: 10 };
      const recent = { ts: new Date().toISOString(), composite: 90 };
      await appendStrategyLog(logPath, old);
      await appendStrategyLog(logPath, recent);
      const results = readStrategyLog(logPath, { limitMs: 3_600_000 }); // last hour only
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].composite, 90);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

// ── Phase 102: TradeoffMatrix ──────────────────────────────────────────────

describe('TradeoffMatrix', () => {
  test('buildTradeoffMatrix returns empty on empty input', async () => {
    const { buildTradeoffMatrix } = await import('../local-agent/strategy/TradeoffMatrix.js');
    const m = buildTradeoffMatrix([]);
    assert.strictEqual(m.binding_constraint, 'unknown');
    assert.deepStrictEqual(m.axes, []);
  });

  test('buildTradeoffMatrix identifies binding constraint as lowest-score axis', async () => {
    const { buildTradeoffMatrix } = await import('../local-agent/strategy/TradeoffMatrix.js');
    const score = {
      ts: new Date().toISOString(), composite: 60, recommendation: 'run_full',
      performance:     { score: 90, cpu_pressure: 0.1, kb_latency_ratio: 1, queue_pressure: 0 },
      cost:            { score: 40, worker_efficiency: 0.5, sla_breach_rate: 0.1 },
      maintainability: { score: 70, qa_pass_rate: 0.8, kb_coverage: 1 },
    };
    const m = buildTradeoffMatrix([score]);
    assert.strictEqual(m.binding_constraint, 'cost');
    assert.strictEqual(m.axes[0].name, 'performance'); // best first
  });

  test('formatTradeoffMatrix returns non-empty string', async () => {
    const { buildTradeoffMatrix, formatTradeoffMatrix } = await import('../local-agent/strategy/TradeoffMatrix.js');
    const score = {
      ts: new Date().toISOString(), composite: 75, recommendation: 'run_full',
      performance: { score: 80, cpu_pressure: 0.1, kb_latency_ratio: 1, queue_pressure: 0 },
      cost: { score: 70, worker_efficiency: 0.8, sla_breach_rate: 0.05 },
      maintainability: { score: 75, qa_pass_rate: 0.9, kb_coverage: 1 },
    };
    const m = buildTradeoffMatrix([score]);
    const out = formatTradeoffMatrix(m);
    assert.ok(out.includes('Tradeoff'), `expected header, got: ${out.slice(0,60)}`);
    assert.ok(out.includes('performance'));
    assert.ok(out.includes('run_full'));
  });
});

// ── Phase 103: AdaptabilityScorer ─────────────────────────────────────────

describe('AdaptabilityScorer', () => {
  test('returns neutral score with no regressions', async () => {
    const { scoreAdaptability } = await import('../local-agent/strategy/AdaptabilityScorer.js');
    const r = scoreAdaptability([]);
    assert.strictEqual(r.regression_count, 0);
    assert.strictEqual(r.score, 80);
    assert.strictEqual(r.mean_fix_h, 0);
  });

  test('fast fix (1h) returns score near 96', async () => {
    const { scoreAdaptability } = await import('../local-agent/strategy/AdaptabilityScorer.js');
    const now = Date.now();
    const events = [
      { ts: new Date(now - 3_600_000).toISOString(), type: 'regression' },
      { ts: new Date(now).toISOString(),              type: 'qa_run', passed: true },
    ];
    const r = scoreAdaptability(events);
    assert.strictEqual(r.regression_count, 1);
    assert.ok(r.score >= 90, `expected high score for 1h fix, got ${r.score}`);
  });

  test('slow fix (24h) returns score near 4', async () => {
    const { scoreAdaptability } = await import('../local-agent/strategy/AdaptabilityScorer.js');
    const now = Date.now();
    const events = [
      { ts: new Date(now - 86_400_000).toISOString(), type: 'regression' },
      { ts: new Date(now).toISOString(),               type: 'qa_run', passed: true },
    ];
    const r = scoreAdaptability(events);
    assert.ok(r.score <= 10, `expected low score for 24h fix, got ${r.score}`);
  });
});

// ── Phase 103: IntelligenceReadinessScorer ────────────────────────────────

describe('IntelligenceReadinessScorer', () => {
  test('returns score in 0-100 range', async () => {
    const { scoreIntelligenceReadiness } = await import('../local-agent/strategy/IntelligenceReadinessScorer.js');
    const r = scoreIntelligenceReadiness(
      { counts: { js_loc: 35728, tests_pass: 31 } },
      { kb_chunks: 13461 },
    );
    assert.ok(r.score >= 0 && r.score <= 100, `score out of range: ${r.score}`);
    assert.ok(r.kb_density > 0, 'kb_density must be positive');
    assert.ok(r.test_density > 0, 'test_density must be positive');
  });

  test('higher KB chunks → higher score', async () => {
    const { scoreIntelligenceReadiness } = await import('../local-agent/strategy/IntelligenceReadinessScorer.js');
    const baseline = { counts: { js_loc: 10000, tests_pass: 50 } };
    const lo = scoreIntelligenceReadiness(baseline, { kb_chunks: 1000 });
    const hi = scoreIntelligenceReadiness(baseline, { kb_chunks: 50000 });
    assert.ok(hi.score >= lo.score, `hi (${hi.score}) should be >= lo (${lo.score})`);
  });
});

// ── Phase 104: FoodChainAnalyzer ──────────────────────────────────────────

describe('FoodChainAnalyzer', () => {
  const tasks = [
    { priority: 'P1', dev_status: 'DEV_DONE',    qa_status: 'QA_PASS', sla_breach: false, duration_h: 2 },
    { priority: 'P1', dev_status: 'DEV_FAILED',  qa_status: 'QA_SKIP', sla_breach: true,  duration_h: 5 },
    { priority: 'P2', dev_status: 'DEV_DONE',    qa_status: 'QA_PASS', sla_breach: false, duration_h: 3 },
    { priority: 'P3', dev_status: 'DEV_RUNNING', qa_status: 'QA_SKIP', sla_breach: false, duration_h: 1 },
  ];

  test('analyzeFoodChain returns 3 tiers in P1→P3 order', async () => {
    const { analyzeFoodChain } = await import('../local-agent/ecology/FoodChainAnalyzer.js');
    const fc = analyzeFoodChain(tasks);
    assert.strictEqual(fc.length, 3);
    assert.strictEqual(fc[0].priority, 'P1');
    assert.strictEqual(fc[1].priority, 'P2');
    assert.strictEqual(fc[2].priority, 'P3');
  });

  test('P1 tier: done=1, failed=1, completion_rate=0.5', async () => {
    const { analyzeFoodChain } = await import('../local-agent/ecology/FoodChainAnalyzer.js');
    const fc = analyzeFoodChain(tasks);
    const p1 = fc[0];
    assert.strictEqual(p1.done, 1);
    assert.strictEqual(p1.failed, 1);
    assert.strictEqual(p1.completion_rate, 0.5);
    assert.strictEqual(p1.sla_breach_count, 1);
  });

  test('empty tasks returns zeros for all tiers', async () => {
    const { analyzeFoodChain } = await import('../local-agent/ecology/FoodChainAnalyzer.js');
    const fc = analyzeFoodChain([]);
    for (const tier of fc) {
      assert.strictEqual(tier.count, 0);
      assert.strictEqual(tier.completion_rate, 0);
    }
  });

  test('foodChainPressure critical when P1 undone > 20', async () => {
    const { analyzeFoodChain, foodChainPressure } = await import('../local-agent/ecology/FoodChainAnalyzer.js');
    const bigP1 = Array.from({ length: 25 }, () => ({ priority: 'P1', dev_status: 'DEV_RUNNING', sla_breach: false, duration_h: 1 }));
    const fc = analyzeFoodChain(bigP1);
    assert.strictEqual(foodChainPressure(fc), 'critical');
  });

  test('foodChainPressure low when no P1 backlog', async () => {
    const { analyzeFoodChain, foodChainPressure } = await import('../local-agent/ecology/FoodChainAnalyzer.js');
    const easy = [{ priority: 'P1', dev_status: 'DEV_DONE', sla_breach: false, duration_h: 1 }];
    const fc = analyzeFoodChain(easy);
    assert.strictEqual(foodChainPressure(fc), 'low');
  });
});

// ── Phase 104: SkillGapDetector ───────────────────────────────────────────

describe('SkillGapDetector', () => {
  test('detectSkillGaps returns gap when failure_rate > threshold', async () => {
    const { detectSkillGaps } = await import('../local-agent/ecology/SkillGapDetector.js');
    const tasks = [
      { worker_skill: 'ml', assigned_worker: 'W001', dev_status: 'DEV_FAILED', sla_breach: false },
      { worker_skill: 'ml', assigned_worker: 'W001', dev_status: 'DEV_FAILED', sla_breach: false },
      { worker_skill: 'ml', assigned_worker: 'W002', dev_status: 'DEV_DONE',   sla_breach: false },
      { worker_skill: 'dev', assigned_worker: 'W003', dev_status: 'DEV_DONE',  sla_breach: false },
    ];
    const gaps = detectSkillGaps(tasks, 0.3);
    assert.strictEqual(gaps.length, 1);
    assert.strictEqual(gaps[0].skill, 'ml');
    assert.ok(gaps[0].failure_rate > 0.3);
  });

  test('detectSkillGaps returns empty array when no gaps', async () => {
    const { detectSkillGaps } = await import('../local-agent/ecology/SkillGapDetector.js');
    const tasks = [
      { worker_skill: 'dev', assigned_worker: 'W001', dev_status: 'DEV_DONE', sla_breach: false },
      { worker_skill: 'dev', assigned_worker: 'W002', dev_status: 'DEV_DONE', sla_breach: false },
    ];
    const gaps = detectSkillGaps(tasks, 0.3);
    assert.strictEqual(gaps.length, 0);
  });

  test('detectSkillGaps sorted by failure_rate descending', async () => {
    const { detectSkillGaps } = await import('../local-agent/ecology/SkillGapDetector.js');
    const tasks = [
      ...Array.from({ length: 4 }, () => ({ worker_skill: 'ml',  assigned_worker: 'W1', dev_status: 'DEV_FAILED', sla_breach: false })),
      ...Array.from({ length: 1 }, () => ({ worker_skill: 'ml',  assigned_worker: 'W1', dev_status: 'DEV_DONE',   sla_breach: false })),
      ...Array.from({ length: 2 }, () => ({ worker_skill: 'qa',  assigned_worker: 'W2', dev_status: 'DEV_FAILED', sla_breach: false })),
      ...Array.from({ length: 3 }, () => ({ worker_skill: 'qa',  assigned_worker: 'W2', dev_status: 'DEV_DONE',   sla_breach: false })),
    ];
    const gaps = detectSkillGaps(tasks, 0.3);
    assert.ok(gaps[0].failure_rate >= gaps[1]?.failure_rate ?? 0);
  });
});

// ── Phase 104: WorkerEcosystem ────────────────────────────────────────────

describe('WorkerEcosystem', () => {
  test('buildWorkerUtilMap counts tasks per worker', async () => {
    const { buildWorkerUtilMap } = await import('../local-agent/ecology/WorkerEcosystem.js');
    const tasks = [
      { assigned_worker: 'W1', dev_status: 'DEV_DONE',    worker_skill: 'dev' },
      { assigned_worker: 'W1', dev_status: 'DEV_RUNNING', worker_skill: 'dev' },
      { assigned_worker: 'W2', dev_status: 'DEV_FAILED',  worker_skill: 'qa'  },
    ];
    const map = buildWorkerUtilMap(tasks);
    assert.strictEqual(map.get('W1').total, 2);
    assert.strictEqual(map.get('W1').running, 1);
    assert.strictEqual(map.get('W2').failed, 1);
  });

  test('classifyWorkers identifies overloaded worker', async () => {
    const { buildWorkerUtilMap, classifyWorkers } = await import('../local-agent/ecology/WorkerEcosystem.js');
    const tasks = Array.from({ length: 20 }, () => ({
      assigned_worker: 'W1', dev_status: 'DEV_DONE', worker_skill: 'dev',
    }));
    const map = buildWorkerUtilMap(tasks);
    const r   = classifyWorkers(map, 18, 5);
    assert.ok(r.overloaded.includes('W1'), 'W1 should be overloaded');
  });

  test('classifyWorkers identifies underutilized worker', async () => {
    const { buildWorkerUtilMap, classifyWorkers } = await import('../local-agent/ecology/WorkerEcosystem.js');
    const tasks = [
      { assigned_worker: 'W1', dev_status: 'DEV_DONE', worker_skill: 'dev' },
      { assigned_worker: 'W1', dev_status: 'DEV_DONE', worker_skill: 'dev' },
    ];
    const map = buildWorkerUtilMap(tasks);
    const r   = classifyWorkers(map, 18, 5);
    assert.ok(r.underutilized.includes('W1'), 'W1 should be underutilized');
  });
});

// ── Phase 105: StatsTester ────────────────────────────────────────────────

describe('StatsTester', () => {
  test('tTest returns significant result for clearly different distributions', async () => {
    const { tTest } = await import('../local-agent/experiments/StatsTester.js');
    const control   = [1, 1.1, 0.9, 1.05, 0.95, 1.0, 1.02, 0.98];
    const treatment = [5, 5.1, 4.9, 5.05, 4.95, 5.0, 5.02, 4.98];
    const r = tTest(control, treatment);
    assert.ok(r.p_value < 0.05, `expected p < 0.05, got ${r.p_value}`);
    assert.ok(r.significant, 'should be significant');
    assert.ok(Math.abs(r.effect_size) > 1, `expected large effect, got ${r.effect_size}`);
  });

  test('tTest returns non-significant for identical distributions', async () => {
    const { tTest } = await import('../local-agent/experiments/StatsTester.js');
    const arr = [1, 1, 1, 1, 1, 1, 1, 1];
    const r   = tTest(arr, arr);
    assert.ok(r.p_value > 0.05 || !r.significant);
  });

  test('tTest handles fewer than 2 elements gracefully', async () => {
    const { tTest } = await import('../local-agent/experiments/StatsTester.js');
    const r = tTest([1], [2]);
    assert.strictEqual(r.significant, false);
    assert.strictEqual(r.p_value, 1);
  });

  test('splitByFilter extracts sla_breach as number', async () => {
    const { splitByFilter } = await import('../local-agent/experiments/StatsTester.js');
    const tasks = [
      { worker_skill: 'dev', sla_breach: true  },
      { worker_skill: 'dev', sla_breach: false },
      { worker_skill: 'qa',  sla_breach: true  },
    ];
    const vals = splitByFilter(tasks, { worker_skill: 'dev' }, 'sla_breach');
    assert.deepStrictEqual(vals, [1, 0]);
  });

  test('splitByFilter filters by priority', async () => {
    const { splitByFilter } = await import('../local-agent/experiments/StatsTester.js');
    const tasks = [
      { priority: 'P1', duration_h: 2 },
      { priority: 'P1', duration_h: 4 },
      { priority: 'P2', duration_h: 8 },
    ];
    const vals = splitByFilter(tasks, { priority: 'P1' }, 'duration_h');
    assert.deepStrictEqual(vals, [2, 4]);
  });
});

// ── Phase 107: TrendAnalyzer ──────────────────────────────────────────────

describe('TrendAnalyzer', () => {
  test('linearRegression computes correct slope for y=2x', async () => {
    const { linearRegression } = await import('../local-agent/weather/TrendAnalyzer.js');
    const base = Date.now();
    const ts = [0, 1, 2, 3, 4].map((i) => ({
      ts:    new Date(base + i * 3600_000).toISOString(),
      value: i * 2,
    }));
    const r = linearRegression(ts);
    assert.ok(Math.abs(r.slope - 2 / 3600) < 0.001, `slope should be ~2/3600, got ${r.slope}`);
    assert.ok(r.r_squared > 0.99, `r² should be near 1, got ${r.r_squared}`);
  });

  test('linearRegression returns flat line for single point', async () => {
    const { linearRegression } = await import('../local-agent/weather/TrendAnalyzer.js');
    const r = linearRegression([{ ts: new Date().toISOString(), value: 42 }]);
    assert.strictEqual(r.slope, 0);
    assert.strictEqual(r.intercept, 42);
  });

  test('predictAt returns intercept when offsetSeconds=0', async () => {
    const { predictAt } = await import('../local-agent/weather/TrendAnalyzer.js');
    const pred = predictAt({ slope: 2, intercept: 10 }, 0);
    assert.strictEqual(pred, 10);
  });

  test('predictAt extrapolates correctly', async () => {
    const { predictAt } = await import('../local-agent/weather/TrendAnalyzer.js');
    const pred = predictAt({ slope: 3, intercept: 5 }, 10);
    assert.strictEqual(pred, 35);
  });
});

// ── Phase 107: ArrivalRateModel ───────────────────────────────────────────

describe('ArrivalRateModel', () => {
  test('computeArrivalRate returns 0 for empty tasks', async () => {
    const { computeArrivalRate } = await import('../local-agent/weather/ArrivalRateModel.js');
    const r = computeArrivalRate([]);
    assert.strictEqual(r.rate_per_h, 0);
    assert.strictEqual(r.ema_rate, 0);
    assert.strictEqual(r.peak_rate, 0);
  });

  test('computeArrivalRate counts tasks in window', async () => {
    const { computeArrivalRate } = await import('../local-agent/weather/ArrivalRateModel.js');
    const now = Date.now();
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      started_at: new Date(now - i * 60_000).toISOString(),
    }));
    const r = computeArrivalRate(tasks, 3_600_000);
    assert.strictEqual(r.rate_per_h, 10);
  });
});

// ── Phase 107: SLAStormDetector ───────────────────────────────────────────

describe('SLAStormDetector', () => {
  test('detectSLAStorm returns 0 at_risk for empty tasks', async () => {
    const { detectSLAStorm } = await import('../local-agent/weather/SLAStormDetector.js');
    const r = detectSLAStorm([], {});
    assert.strictEqual(r.at_risk, 0);
    assert.strictEqual(r.breach_probability, 0);
  });

  test('detectSLAStorm counts already-breached running tasks', async () => {
    const { detectSLAStorm } = await import('../local-agent/weather/SLAStormDetector.js');
    const tasks = [
      { dev_status: 'DEV_RUNNING', sla_breach: true,  priority: 'P1', duration_h: 5 },
      { dev_status: 'DEV_RUNNING', sla_breach: false, priority: 'P2', duration_h: 1 },
      { dev_status: 'DEV_DONE',    sla_breach: true,  priority: 'P1', duration_h: 2 },
    ];
    const r = detectSLAStorm(tasks, {});
    assert.ok(r.at_risk >= 1, `expected at least 1 at-risk, got ${r.at_risk}`);
    assert.ok(r.running_count === 2);
  });
});

// ── Phase 108: TimelineGapDetector ────────────────────────────────────────

describe('TimelineGapDetector', () => {
  test('detectGaps returns empty for consecutive events within threshold', async () => {
    const { detectGaps } = await import('../local-agent/replay/TimelineGapDetector.js');
    const base = Date.now();
    const events = [0, 1, 2].map((i) => ({ ts: new Date(base + i * 60_000).toISOString() }));
    assert.deepStrictEqual(detectGaps(events, 300_000), []);
  });

  test('detectGaps finds gap larger than threshold', async () => {
    const { detectGaps } = await import('../local-agent/replay/TimelineGapDetector.js');
    const base = Date.now();
    const events = [
      { ts: new Date(base).toISOString() },
      { ts: new Date(base + 600_000).toISOString() }, // 10 min gap
    ];
    const gaps = detectGaps(events, 300_000);
    assert.strictEqual(gaps.length, 1);
    assert.ok(gaps[0].gap_ms >= 600_000);
  });

  test('detectGaps returns empty for single event', async () => {
    const { detectGaps } = await import('../local-agent/replay/TimelineGapDetector.js');
    assert.deepStrictEqual(detectGaps([{ ts: new Date().toISOString() }]), []);
  });
});

// ── Phase 109: ThemeEngine ────────────────────────────────────────────────

describe('ThemeEngine', () => {
  test('selectTheme returns storm theme for storm alert', async () => {
    const { selectTheme } = await import('../local-agent/ui/ThemeEngine.js');
    const t = selectTheme('storm', 'run_full');
    assert.strictEqual(t.label, 'storm');
    assert.strictEqual(t.pulsing, true);
    assert.strictEqual(t.alertBanner, true);
  });

  test('selectTheme returns clear theme for clear alert', async () => {
    const { selectTheme } = await import('../local-agent/ui/ThemeEngine.js');
    const t = selectTheme('clear', 'run_full');
    assert.strictEqual(t.label, 'clear');
    assert.strictEqual(t.pulsing, false);
    assert.deepStrictEqual(t.collapsedPanels, []);
  });

  test('selectTheme collapses panels for run_lite', async () => {
    const { selectTheme } = await import('../local-agent/ui/ThemeEngine.js');
    const t = selectTheme('clear', 'run_lite');
    assert.ok(t.collapsedPanels.length > 0, 'run_lite should collapse some panels');
  });

  test('applyTheme replaces THEME_ACCENT placeholder', async () => {
    const { selectTheme, applyTheme } = await import('../local-agent/ui/ThemeEngine.js');
    const t    = selectTheme('watch', 'run_full');
    const html = applyTheme('<div style="color:{{THEME_ACCENT}}">test</div>', t);
    assert.ok(!html.includes('{{THEME_ACCENT}}'), 'placeholder should be replaced');
    assert.ok(html.includes(t.accentColor), 'accent color should appear in output');
  });

  test('applyTheme replaces all known placeholders', async () => {
    const { selectTheme, applyTheme } = await import('../local-agent/ui/ThemeEngine.js');
    const t    = selectTheme('warning', 'defer');
    const tmpl = '{{THEME_BG}} {{THEME_ACCENT}} {{THEME_BORDER}} {{THEME_TEXT}} {{THEME_DIM}} {{THEME_LABEL}}';
    const html = applyTheme(tmpl, t);
    assert.ok(!html.includes('{{THEME_'), 'all placeholders should be replaced');
  });
});

// ── Phase 110: ForceCalculator ────────────────────────────────────────────

describe('ForceCalculator', () => {
  test('computeForces returns 6 force dimensions', async () => {
    const { computeForces } = await import('../local-agent/physics/ForceCalculator.js');
    const forces = computeForces({
      ecology:  { queue: { depth: 10, sustainable: true }, workers: { skill_gaps: [] } },
      strategy: { cost: { sla_breach_rate: 0.05 } },
      sensor:   { kb: { query_p50_ms: 100 } },
    }, { performance: { kb_query_p50_ms: 100 } });
    assert.ok('queue_pressure' in forces);
    assert.ok('sla_breach_force' in forces);
    assert.ok('skill_gap_force' in forces);
    assert.ok('kb_latency_drag' in forces);
    assert.ok('ecology_restoration' in forces);
    assert.ok('pattern_inheritance' in forces);
  });

  test('ecology_restoration is -15 when queue sustainable', async () => {
    const { computeForces } = await import('../local-agent/physics/ForceCalculator.js');
    const f = computeForces({ ecology: { queue: { depth: 0, sustainable: true }, workers: { skill_gaps: [] } },
                               strategy: {}, sensor: {} }, {});
    assert.strictEqual(f.ecology_restoration, -15);
  });

  test('ecology_restoration is 0 when queue not sustainable', async () => {
    const { computeForces } = await import('../local-agent/physics/ForceCalculator.js');
    const f = computeForces({ ecology: { queue: { depth: 0, sustainable: false }, workers: { skill_gaps: [] } },
                               strategy: {}, sensor: {} }, {});
    assert.strictEqual(f.ecology_restoration, 0);
  });

  test('netForce sums all forces', async () => {
    const { netForce } = await import('../local-agent/physics/ForceCalculator.js');
    const nf = netForce({ a: 10, b: -5, c: 3 });
    assert.strictEqual(nf, 8);
  });

  test('queue_pressure scales with depth', async () => {
    const { computeForces } = await import('../local-agent/physics/ForceCalculator.js');
    const lo = computeForces({ ecology: { queue: { depth: 10, sustainable: true }, workers: { skill_gaps: [] } }, strategy: {}, sensor: {} }, {});
    const hi = computeForces({ ecology: { queue: { depth: 50, sustainable: true }, workers: { skill_gaps: [] } }, strategy: {}, sensor: {} }, {});
    assert.ok(hi.queue_pressure > lo.queue_pressure);
    assert.strictEqual(hi.queue_pressure, 40); // depth=50 → max 40
  });
});

// ── Phase 110: EntropyTracker ─────────────────────────────────────────────

describe('EntropyTracker', () => {
  test('accumulateEntropy grows when net_force > 0', async () => {
    const { accumulateEntropy } = await import('../local-agent/physics/EntropyTracker.js');
    const r = accumulateEntropy(20, 10);
    assert.ok(r.newEntropy > 20, `entropy should grow, got ${r.newEntropy}`);
    assert.strictEqual(r.trend, 'increasing');
  });

  test('accumulateEntropy decays when net_force < 0', async () => {
    const { accumulateEntropy } = await import('../local-agent/physics/EntropyTracker.js');
    const r = accumulateEntropy(50, -20);
    assert.ok(r.newEntropy < 50, `entropy should decay, got ${r.newEntropy}`);
    assert.strictEqual(r.trend, 'decreasing');
  });

  test('accumulateEntropy clamped to [0, 100]', async () => {
    const { accumulateEntropy } = await import('../local-agent/physics/EntropyTracker.js');
    const hi = accumulateEntropy(99, 1000);
    assert.strictEqual(hi.newEntropy, 100);
    const lo = accumulateEntropy(0, -1000);
    assert.strictEqual(lo.newEntropy, 0);
  });

  test('readLastEntropy returns 0 for missing file', async () => {
    const { readLastEntropy } = await import('../local-agent/physics/EntropyTracker.js');
    const r = readLastEntropy('/tmp/no-such-physics-log-xyz.jsonl');
    assert.strictEqual(r, 0);
  });
});

// ── Phase 110: PhysicsEngine.getPhaseState ────────────────────────────────

describe('PhysicsEngine.getPhaseState', () => {
  test('stable when stability_index >= 60', async () => {
    const { PhysicsEngine } = await import('../local-agent/physics/PhysicsEngine.js');
    const engine = new PhysicsEngine({ logPath: join(tmp(), 'physics.jsonl') });
    assert.strictEqual(engine.getPhaseState({ stability_index: 70, entropy: { current: 10 } }), 'stable');
  });

  test('meta_stable when stability 20-59, entropy < 40', async () => {
    const { PhysicsEngine } = await import('../local-agent/physics/PhysicsEngine.js');
    const engine = new PhysicsEngine({ logPath: join(tmp(), 'physics.jsonl') });
    assert.strictEqual(engine.getPhaseState({ stability_index: 35, entropy: { current: 20 } }), 'meta_stable');
  });

  test('oscillating when |stability| < 20, entropy > 40', async () => {
    const { PhysicsEngine } = await import('../local-agent/physics/PhysicsEngine.js');
    const engine = new PhysicsEngine({ logPath: join(tmp(), 'physics.jsonl') });
    assert.strictEqual(engine.getPhaseState({ stability_index: 5, entropy: { current: 55 } }), 'oscillating');
  });

  test('critical when entropy > 80', async () => {
    const { PhysicsEngine } = await import('../local-agent/physics/PhysicsEngine.js');
    const engine = new PhysicsEngine({ logPath: join(tmp(), 'physics.jsonl') });
    assert.strictEqual(engine.getPhaseState({ stability_index: 0, entropy: { current: 90 } }), 'critical');
  });

  test('critical when stability < -50', async () => {
    const { PhysicsEngine } = await import('../local-agent/physics/PhysicsEngine.js');
    const engine = new PhysicsEngine({ logPath: join(tmp(), 'physics.jsonl') });
    assert.strictEqual(engine.getPhaseState({ stability_index: -60, entropy: { current: 10 } }), 'critical');
  });

  test('diverging when stability < -20', async () => {
    const { PhysicsEngine } = await import('../local-agent/physics/PhysicsEngine.js');
    const engine = new PhysicsEngine({ logPath: join(tmp(), 'physics.jsonl') });
    assert.strictEqual(engine.getPhaseState({ stability_index: -30, entropy: { current: 10 } }), 'diverging');
  });
});

// ── Phase 106: PatternLibrary ─────────────────────────────────────────────

describe('PatternLibrary', () => {
  test('ingest + query round-trip', async () => {
    const { PatternLibrary } = await import('../local-agent/dna/PatternLibrary.js');
    const dir = tmp();
    const lib = new PatternLibrary({ dbPath: join(dir, 'dna.db'), mutationDir: join(dir, 'mutations') });
    try {
      const { id, isNew } = lib.ingest('manual', { category: 'fix_recipe', description: 'test pattern', key: 'val' });
      assert.ok(isNew, 'first insert should be new');
      const genes = lib.query({ category: 'fix_recipe' });
      assert.strictEqual(genes.length, 1);
      assert.strictEqual(genes[0].id, id);
    } finally { lib.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('ingest deduplicates by pattern hash', async () => {
    const { PatternLibrary } = await import('../local-agent/dna/PatternLibrary.js');
    const dir = tmp();
    const lib = new PatternLibrary({ dbPath: join(dir, 'dna.db'), mutationDir: join(dir, 'mutations') });
    try {
      const pattern = { category: 'fix_recipe', description: 'dup test', val: 42 };
      const r1 = lib.ingest('manual', pattern);
      const r2 = lib.ingest('manual', pattern);
      assert.ok(r1.isNew);
      assert.ok(!r2.isNew);
      assert.strictEqual(r1.id, r2.id);
      assert.strictEqual(lib.count(), 1);
    } finally { lib.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('recordOutcome auto-deactivates gene after >50% failure over 10+ trials', async () => {
    const { PatternLibrary } = await import('../local-agent/dna/PatternLibrary.js');
    const dir = tmp();
    const lib = new PatternLibrary({ dbPath: join(dir, 'dna.db'), mutationDir: join(dir, 'mutations') });
    try {
      const { id } = lib.ingest('manual', { category: 'fix_recipe', description: 'bad gene' });
      for (let i = 0; i < 6; i++) lib.recordOutcome(id, false);
      for (let i = 0; i < 4; i++) lib.recordOutcome(id, true);
      const genes = lib.query({});
      // 6 failures / 10 total = 60% failure → should be deactivated
      assert.strictEqual(genes.length, 0, 'gene should be deactivated after >50% failure over 10 trials');
    } finally { lib.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
