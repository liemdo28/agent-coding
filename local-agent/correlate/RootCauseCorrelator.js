// correlate/RootCauseCorrelator.js — correlate multiple failures to a single root cause
import { queryEvents } from '../timeline/TimelineStore.js';

const CORRELATION_WINDOW_MS = 30 * 60 * 1000; // 30 min — failures within this window are co-related

// Known co-occurrence → root cause mappings
const KNOWN_PATTERNS = [
  {
    id:        'env-missing',
    symptoms:  ['build_fail', 'test_fail', 'missing_module', 'missing_file'],
    rootCause: 'Missing or incorrect environment variable / config',
    remedy:    'Check .env file; run: local-agent config scan',
  },
  {
    id:        'db-corruption',
    symptoms:  ['db_corruption', 'crash_loop', 'severe_regression'],
    rootCause: 'Database corruption or incompatible schema change',
    remedy:    'Run: local-agent incident create --category db_corruption; local-agent heal recover-runtime',
  },
  {
    id:        'dependency-mismatch',
    symptoms:  ['missing_module', 'runtime_error', 'build_fail'],
    rootCause: 'Dependency version mismatch or missing install',
    remedy:    'Run: npm install; local-agent deps scan',
  },
  {
    id:        'port-conflict',
    symptoms:  ['port_in_use', 'crash_loop'],
    rootCause: 'Port conflict — another process is already bound',
    remedy:    'Run: lsof -i :<port> && kill <pid>',
  },
  {
    id:        'workspace-corruption',
    symptoms:  ['corrupted_workspace', 'missing_file', 'empty_index'],
    rootCause: 'Workspace files corrupted or incomplete',
    remedy:    'Run: local-agent heal; local-agent scan',
  },
];

/**
 * Correlate a list of failure descriptions into root causes.
 * @param {string[]} failureDescriptions — free-text failure messages
 * @returns {CorrelationResult}
 */
export function correlateFailures(failureDescriptions) {
  const symptomSet = new Set();

  for (const desc of failureDescriptions) {
    const lower = desc.toLowerCase();
    if (/build.*fail|failed to compile/i.test(lower))          symptomSet.add('build_fail');
    if (/test.*fail|jest.*fail/i.test(lower))                  symptomSet.add('test_fail');
    if (/cannot find module|missing module/i.test(lower))      symptomSet.add('missing_module');
    if (/no such file|enoent/i.test(lower))                    symptomSet.add('missing_file');
    if (/eaddrinuse|port.*in use/i.test(lower))                symptomSet.add('port_in_use');
    if (/typeerror|syntaxerror|runtime/i.test(lower))          symptomSet.add('runtime_error');
    if (/corrupt|integrity/i.test(lower))                      symptomSet.add('db_corruption');
    if (/crash.*loop|restart.*loop/i.test(lower))              symptomSet.add('crash_loop');
    if (/regression/i.test(lower))                             symptomSet.add('severe_regression');
    if (/workspace.*corrupt|corrupt.*workspace/i.test(lower))  symptomSet.add('corrupted_workspace');
    if (/empty.*index|index.*empty/i.test(lower))              symptomSet.add('empty_index');
  }

  const matches = KNOWN_PATTERNS
    .map((pattern) => {
      const hits = pattern.symptoms.filter((s) => symptomSet.has(s));
      return { ...pattern, hits, confidence: +(hits.length / pattern.symptoms.length * 100).toFixed(0) };
    })
    .filter((m) => m.hits.length >= 2)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    symptoms:    [...symptomSet],
    matches,
    topCause:    matches[0] ?? null,
    unmatched:   failureDescriptions.length - symptomSet.size,
  };
}

/**
 * Correlate recent timeline failures automatically.
 * @param {string} workspaceRoot
 * @param {{ windowMs?: number }} opts
 * @returns {CorrelationResult}
 */
export function correlateTimelineFailures(workspaceRoot, { windowMs = CORRELATION_WINDOW_MS } = {}) {
  const since  = new Date(Date.now() - windowMs).toISOString();
  const events = queryEvents(workspaceRoot, { since, limit: 200 });

  const failEvents = events.filter((e) =>
    e.type === 'regression' ||
    (e.type === 'qa_run'   && !e.passed) ||
    (e.type === 'patch'    && e.action === 'rolled_back')
  );

  if (!failEvents.length) return { symptoms: [], matches: [], topCause: null, message: 'No recent failures in timeline' };

  const descriptions = failEvents.map((e) => JSON.stringify(e));
  return { ...correlateFailures(descriptions), eventCount: failEvents.length, window: `${windowMs / 60000}min` };
}

/**
 * Correlate build vs runtime failures.
 * @param {string} workspaceRoot
 * @returns {CorrelationResult}
 */
export function correlateBuildRuntime(workspaceRoot) {
  const allEvents   = queryEvents(workspaceRoot, { limit: 500 });
  const buildFails  = allEvents.filter((e) => e.type === 'qa_run' && !e.passed);
  const regressions = allEvents.filter((e) => e.type === 'regression');

  // Check temporal overlap: regressions that coincide with build failures
  const correlatedPairs = [];
  for (const bf of buildFails) {
    const bfMs = new Date(bf.ts).getTime();
    const nearby = regressions.filter((r) =>
      Math.abs(new Date(r.ts).getTime() - bfMs) < 15 * 60_000 // within 15 min
    );
    if (nearby.length) correlatedPairs.push({ buildFail: bf, regressions: nearby });
  }

  const rootCause = correlatedPairs.length > 0
    ? { id: 'build-regression-loop', rootCause: 'Recurring build failures causing test regressions',
        remedy: 'Fix underlying build error first; run: local-agent build && local-agent qa' }
    : null;

  return {
    buildFailures: buildFails.length,
    regressions:   regressions.length,
    correlatedPairs: correlatedPairs.length,
    topCause:      rootCause,
  };
}
