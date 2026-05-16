// qa/FailureClassifier.js - classify parsed errors and derive probable causes

export const ERROR_TYPES = {
  BUILD_ERROR:       'BUILD_ERROR',
  TYPE_ERROR:        'TYPE_ERROR',
  RUNTIME_ERROR:     'RUNTIME_ERROR',
  IMPORT_ERROR:      'IMPORT_ERROR',
  ENV_ERROR:         'ENV_ERROR',
  AUTH_ERROR:        'AUTH_ERROR',
  API_ERROR:         'API_ERROR',
  ROUTE_ERROR:       'ROUTE_ERROR',
  DATABASE_ERROR:    'DATABASE_ERROR',
  TEST_FAILURE:      'TEST_FAILURE',
  DEPLOYMENT_ERROR:  'DEPLOYMENT_ERROR',
  UNKNOWN_ERROR:     'UNKNOWN_ERROR',
};

// Risk level for each error type (0=low, 1=high)
const TYPE_RISK = {
  BUILD_ERROR:      0.3,
  TYPE_ERROR:       0.2,
  RUNTIME_ERROR:    0.5,
  IMPORT_ERROR:     0.2,
  ENV_ERROR:        0.6,
  AUTH_ERROR:       0.9,
  API_ERROR:        0.5,
  ROUTE_ERROR:      0.3,
  DATABASE_ERROR:   0.8,
  TEST_FAILURE:     0.2,
  DEPLOYMENT_ERROR: 0.7,
  UNKNOWN_ERROR:    0.5,
};

// Human-readable probable causes keyed by error type
const PROBABLE_CAUSES = {
  BUILD_ERROR:     'Syntax or compilation error in source files. Check the indicated file and line number.',
  TYPE_ERROR:      'TypeScript type mismatch. The value passed does not match the expected type.',
  RUNTIME_ERROR:   'The program crashed at runtime. Check stack trace for the origin of the error.',
  IMPORT_ERROR:    'A module or file cannot be found. Run npm install or check import path spelling.',
  ENV_ERROR:       'A required environment variable is missing. Check .env.example and create a .env file.',
  AUTH_ERROR:      'Authentication or permission failure. Check API keys, tokens, or file permissions.',
  API_ERROR:       'An API call failed. Check network connectivity or the API endpoint configuration.',
  ROUTE_ERROR:     'A route or page is missing or misconfigured. Check router configuration.',
  DATABASE_ERROR:  'Database connection or query error. Check database config and schema migrations.',
  TEST_FAILURE:    'One or more tests failed. Check test assertions and the code under test.',
  DEPLOYMENT_ERROR:'Deployment step failed. Check build output and deployment configuration.',
  UNKNOWN_ERROR:   'Unclassified error. Review the raw output for more details.',
};

/**
 * Classify a list of parsed errors and produce a grouped failure summary.
 *
 * @param {ParsedError[]} errors
 * @returns {ClassificationResult}
 */
export function classifyFailures(errors) {
  if (!errors.length) {
    return { hasFailures: false, groups: {}, dominant: null, riskScore: 0, summary: [] };
  }

  const groups = {};
  for (const e of errors) {
    const type = e.errorType ?? 'UNKNOWN_ERROR';
    if (!groups[type]) groups[type] = [];
    groups[type].push(e);
  }

  // Dominant type = most frequent
  const dominant = Object.entries(groups)
    .sort(([, a], [, b]) => b.length - a.length)[0][0];

  // Overall risk score = weighted average of type risks
  const riskScore = Math.min(1,
    errors.reduce((acc, e) => acc + (TYPE_RISK[e.errorType] ?? 0.5), 0) / errors.length
  );

  const summary = Object.entries(groups).map(([type, errs]) => ({
    type,
    count: errs.length,
    risk: TYPE_RISK[type] ?? 0.5,
    probableCause: PROBABLE_CAUSES[type] ?? PROBABLE_CAUSES.UNKNOWN_ERROR,
    files: [...new Set(errs.map((e) => e.file).filter(Boolean))].slice(0, 5),
    examples: errs.slice(0, 3).map((e) => e.message),
  }));

  return {
    hasFailures: true,
    groups,
    dominant,
    riskScore: +riskScore.toFixed(3),
    summary,
    probableCause: PROBABLE_CAUSES[dominant],
  };
}

/**
 * Determine if it's safe to attempt an automated fix for a given classification.
 */
export function isSafeToAutoFix(classification, retryConfig = {}) {
  const maxRisk = retryConfig.maxPatchRisk ?? 0.75;

  if (!classification.hasFailures) return { safe: true, reason: 'No failures' };
  if (classification.riskScore > maxRisk) {
    return { safe: false, reason: `Risk score ${classification.riskScore} exceeds limit ${maxRisk}` };
  }

  // Never auto-fix auth, database, or deployment errors
  const highRiskTypes = ['AUTH_ERROR', 'DATABASE_ERROR', 'DEPLOYMENT_ERROR'];
  for (const type of highRiskTypes) {
    if (classification.groups[type]?.length > 0) {
      return { safe: false, reason: `Auto-fix blocked for ${type} — requires human review` };
    }
  }

  return { safe: true, reason: 'Risk within acceptable limits' };
}

export { TYPE_RISK, PROBABLE_CAUSES };
