// audit/AuditEngine.js — mandatory pre-build audit engine
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// ── Constants ──────────────────────────────────────────────────────────────────

// Required directories for the full system (relative to workspaceRoot)
const REQUIRED_DIRS = [
  'marketing-db/core',
  'marketing-db/db',
  'marketing-db/importers',
  'marketing-db/search',
  'marketing-db/qa',
  'marketing-db/audit',
  'marketing-db/local-seo',
  'marketing-db/content-calendar',
  'marketing-db/social',
  'marketing-db/reviews',
  'marketing-db/competitors',
  'marketing-db/kpi',
  'marketing-db/multi-brand',
  'marketing-db/memory',
  'marketing-db/agent',
  'marketing-db/dashboard',
  'marketing-db/assets',
  'marketing-db/approval',
  'marketing-db/export',
  'marketing-db/ecosystem',
  'reports/audit',
  'seed-data',
];

const REQUIRED_TABLES = [
  'brands', 'locations', 'campaigns', 'content_posts', 'keywords',
  'nap_records', 'competitors', 'reviews', 'kpi_metrics', 'marketing_memory',
  'assets', 'approval_queue', 'content_calendar', 'audit_log', 'phase_completion',
];

const REQUIRED_FILES = [
  'bin/marketing-db.js',
  'marketing-db/core/Config.js',
  'marketing-db/core/OfflineGuard.js',
  'marketing-db/core/Logger.js',
  'marketing-db/db/MarketingDB.js',
  'marketing-db/audit/AuditEngine.js',
  'marketing-db/qa/QAEngine.js',
];

const FAKE_PATTERNS = [
  { pattern: /\bTODO\b/,                           label: 'TODO placeholder' },
  { pattern: /placeholder/i,                        label: 'placeholder' },
  { pattern: /mock\s+response/i,                    label: 'mock response' },
  { pattern: /hardcoded result/i,                   label: 'hardcoded result' },
  { pattern: /fake scoring/i,                       label: 'fake scoring' },
  { pattern: /empty engine/i,                       label: 'empty engine' },
  { pattern: /return true\s*;?\s*\/\/\s*fake/i,     label: 'fake return true' },
  { pattern: /return\s+['"]sample['"]/i,            label: 'return sample' },
  { pattern: /return\s+\[\]\s*;?\s*\/\/\s*stub/i,  label: 'empty stub return array' },
  { pattern: /not implemented/i,                    label: 'not implemented' },
];

const INTERNET_PATTERNS = [
  { pattern: /\bfetch\s*\(/,                                     label: 'fetch() call' },
  { pattern: /require\s*\(\s*['"]axios['"]\s*\)/,               label: 'axios require' },
  { pattern: /from\s+['"]axios['"]/,                             label: 'axios import' },
  { pattern: /from\s+['"]node-fetch['"]/,                        label: 'node-fetch import' },
  { pattern: /openai/i,                                          label: 'OpenAI SDK' },
  { pattern: /anthropic/i,                                       label: 'Anthropic SDK' },
  { pattern: /googleapis/i,                                      label: 'Google APIs' },
  { pattern: /firebase/i,                                        label: 'Firebase' },
];

const TELEMETRY_PATTERNS = [
  { pattern: /posthog/i,              label: 'PostHog' },
  { pattern: /mixpanel/i,             label: 'Mixpanel' },
  { pattern: /segment\.io/i,          label: 'Segment' },
  { pattern: /analytics\.track/i,     label: 'analytics.track' },
  { pattern: /ga4|gtag|google-analytics/i, label: 'Google Analytics' },
  { pattern: /datadog/i,              label: 'Datadog' },
  { pattern: /sentry\.io/i,           label: 'Sentry cloud' },
];

// Engine/Manager filenames considered "core" — fake implementations here are failures
const CORE_MODULE_SUFFIXES = ['Engine', 'Manager', 'Analyzer', 'Importer', 'Processor'];

// Files that intentionally contain pattern strings as detection rules — exclude from self-scan.
// Without this, AuditEngine.js flags itself (FAKE_PATTERNS contains "placeholder"),
// OfflineGuard.js flags itself (BLOCKED_PATTERNS contains "openai", "anthropic"), etc.
const SELF_SCAN_EXCLUDE = [
  'marketing-db/audit/AuditEngine.js',
  'marketing-db/core/OfflineGuard.js',
  'bin/marketing-db.js',
  'bin/local-agent.js',
];

// ── File scanning helpers ──────────────────────────────────────────────────────

/**
 * Recursively collect files from a directory with the given extensions.
 * Silently skips unreadable entries.
 */
function scanDir(dir, exts = ['.js']) {
  if (!existsSync(dir)) return [];
  const files = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      files.push(...scanDir(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Run a list of { pattern, label } checks against source text.
 * Returns the labels of every pattern that matched.
 */
function checkPatterns(source, patterns) {
  return patterns
    .filter((p) => p.pattern.test(source))
    .map((p) => p.label);
}

/**
 * Return true when a file basename (without extension) contains any of the
 * known core-module suffixes that should never carry fake implementations.
 */
function isCoreModule(filePath) {
  const base = filePath.split('/').pop().replace(/\.js$/, '');
  return CORE_MODULE_SUFFIXES.some((s) => base.includes(s));
}

// ── Import-path resolution ────────────────────────────────────────────────────

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

/**
 * Check every import in a source file.
 * Returns an array of unresolvable relative import paths.
 */
function checkBrokenImports(sourceText, sourceFile) {
  const broken = [];
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(sourceText)) !== null) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue; // bare specifiers are package deps
    const candidates = [
      specifier,
      `${specifier}.js`,
      `${specifier}/index.js`,
    ].map((s) => resolve(sourceFile, '..', s));
    if (!candidates.some((c) => existsSync(c))) {
      broken.push(specifier);
    }
  }
  return broken;
}

// ── Main audit function ───────────────────────────────────────────────────────

/**
 * Run the full pre-build audit.
 *
 * @param {string} workspaceRoot  Absolute path to the project root.
 * @returns {object}              Detailed audit report object.
 */
export async function runAudit(workspaceRoot) {
  const report = {
    timestamp:          new Date().toISOString(),
    workspaceRoot,
    passed:             true,
    folderStructure:    { ok: true, missing: [] },
    requiredFiles:      { ok: true, missing: [] },
    schemaCheck:        { ok: true, missingTables: [], error: null },
    fakeImplementation: { ok: true, violations: [] },
    brokenImports:      { ok: true, violations: [] },
    internetPolicy:     { ok: true, violations: [] },
    telemetryCheck:     { ok: true, violations: [] },
    duplicateModules:   { ok: true, duplicates: [] },
    phaseCompletion:    { phases: [] },
    summary:            '',
  };

  // ── 1. Folder structure ────────────────────────────────────────────────────
  for (const dir of REQUIRED_DIRS) {
    if (!existsSync(join(workspaceRoot, dir))) {
      report.folderStructure.missing.push(dir);
      report.folderStructure.ok = false;
    }
  }

  // ── 2. Required files ──────────────────────────────────────────────────────
  for (const f of REQUIRED_FILES) {
    if (!existsSync(join(workspaceRoot, f))) {
      report.requiredFiles.missing.push(f);
      report.requiredFiles.ok = false;
    }
  }

  // ── 3. SQLite schema check ─────────────────────────────────────────────────
  const dbPath = join(workspaceRoot, '.marketing-db/marketing.db');
  if (existsSync(dbPath)) {
    try {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const existingTables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => r.name);
      for (const t of REQUIRED_TABLES) {
        if (!existingTables.includes(t)) {
          report.schemaCheck.missingTables.push(t);
          report.schemaCheck.ok = false;
        }
      }
      db.close();
    } catch (e) {
      report.schemaCheck.ok = false;
      report.schemaCheck.error = e.message;
    }
  } else {
    report.schemaCheck.ok = false;
    report.schemaCheck.error = 'Database not initialised — run: marketing-db init';
  }

  // ── 4. Source-file scans ───────────────────────────────────────────────────
  const sourceFiles = [
    ...scanDir(join(workspaceRoot, 'marketing-db')),
    ...scanDir(join(workspaceRoot, 'bin')),
  ];

  for (const file of sourceFiles) {
    let source;
    try { source = readFileSync(file, 'utf8'); } catch { continue; }
    const rel = relative(workspaceRoot, file);

    // Skip files that are part of the audit/guard infrastructure — they contain
    // detection pattern strings by design and would otherwise self-flag.
    const isSelfExcluded = SELF_SCAN_EXCLUDE.some(
      (ex) => rel === ex || rel.endsWith('/' + ex.split('/').pop())
    );

    // 4a — Fake / placeholder detection (skip audit/guard infra files)
    if (!isSelfExcluded) {
      const fakeHits = checkPatterns(source, FAKE_PATTERNS);
      if (fakeHits.length) {
        report.fakeImplementation.violations.push({ file: rel, issues: fakeHits });
        // Failures only count in core engine/manager files
        if (isCoreModule(file)) {
          report.fakeImplementation.ok = false;
        }
      }
    }

    // 4b — Broken relative imports
    const brokenPaths = checkBrokenImports(source, file);
    if (brokenPaths.length) {
      report.brokenImports.violations.push({ file: rel, imports: brokenPaths });
      report.brokenImports.ok = false;
    }

    // 4c — Internet policy (skip audit/guard infra files)
    if (!isSelfExcluded) {
      const internetHits = checkPatterns(source, INTERNET_PATTERNS);
      if (internetHits.length) {
        report.internetPolicy.violations.push({ file: rel, issues: internetHits });
        report.internetPolicy.ok = false;
      }
    }

    // 4d — Telemetry (skip audit/guard infra files)
    if (!isSelfExcluded) {
      const telemetryHits = checkPatterns(source, TELEMETRY_PATTERNS);
      if (telemetryHits.length) {
        report.telemetryCheck.violations.push({ file: rel, issues: telemetryHits });
        report.telemetryCheck.ok = false;
      }
    }
  }

  // ── 5. Duplicate module detection ─────────────────────────────────────────
  // Two files are "duplicates" if their normalised basename is identical.
  const engineFiles = sourceFiles.filter(
    (f) => CORE_MODULE_SUFFIXES.some((s) => f.endsWith(`${s}.js`))
  );
  const seen = {};
  for (const file of engineFiles) {
    const rel  = relative(workspaceRoot, file);
    const name = file.split('/').pop().replace(/\.js$/, '').toLowerCase();
    if (seen[name]) {
      report.duplicateModules.duplicates.push({ name, files: [seen[name], rel] });
      report.duplicateModules.ok = false;
    } else {
      seen[name] = rel;
    }
  }

  // ── 6. Phase completion (from DB if available) ────────────────────────────
  if (existsSync(dbPath)) {
    try {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      report.phaseCompletion.phases = db
        .prepare('SELECT * FROM phase_completion ORDER BY phase')
        .all();
      db.close();
    } catch { /* non-fatal — DB might not have the table yet */ }
  }

  // ── 7. Overall pass / fail ────────────────────────────────────────────────
  report.passed =
    report.folderStructure.ok &&
    report.requiredFiles.ok &&
    report.schemaCheck.ok &&
    report.fakeImplementation.ok &&
    report.brokenImports.ok &&
    report.internetPolicy.ok &&
    report.telemetryCheck.ok;

  const issues = [];
  if (!report.folderStructure.ok)
    issues.push(`Missing dirs: ${report.folderStructure.missing.join(', ')}`);
  if (!report.requiredFiles.ok)
    issues.push(`Missing files: ${report.requiredFiles.missing.join(', ')}`);
  if (!report.schemaCheck.ok)
    issues.push(`Schema issues: ${report.schemaCheck.error ?? report.schemaCheck.missingTables.join(', ')}`);
  if (!report.fakeImplementation.ok)
    issues.push('Fake/placeholder implementations detected in core modules');
  if (!report.brokenImports.ok)
    issues.push('Broken relative imports detected');
  if (!report.internetPolicy.ok)
    issues.push('Internet policy violations detected');
  if (!report.telemetryCheck.ok)
    issues.push('Telemetry violations detected');

  report.summary = report.passed
    ? 'AUDIT PASSED — system ready'
    : `AUDIT FAILED — ${issues.join(' | ')}`;

  // ── 8. Write report files ─────────────────────────────────────────────────
  const reportDir = join(workspaceRoot, 'reports/audit');
  mkdirSync(reportDir, { recursive: true });

  writeFileSync(join(reportDir, 'audit-summary.md'),       generateMarkdownReport(report));
  writeFileSync(join(reportDir, 'missing-modules.json'),   JSON.stringify(report.requiredFiles,      null, 2));
  writeFileSync(join(reportDir, 'duplicate-modules.json'), JSON.stringify(report.duplicateModules,   null, 2));
  writeFileSync(join(reportDir, 'fake-implementation.json'), JSON.stringify(report.fakeImplementation, null, 2));
  writeFileSync(join(reportDir, 'broken-imports.json'),    JSON.stringify(report.brokenImports,      null, 2));
  writeFileSync(join(reportDir, 'security-report.json'),   JSON.stringify(report.internetPolicy,     null, 2));
  writeFileSync(join(reportDir, 'telemetry-check.json'),   JSON.stringify(report.telemetryCheck,     null, 2));
  writeFileSync(join(reportDir, 'phase-completion.json'),  JSON.stringify(report.phaseCompletion,    null, 2));

  return report;
}

// ── Markdown report generator ─────────────────────────────────────────────────

function generateMarkdownReport(report) {
  const status = report.passed ? '✅ PASSED' : '❌ FAILED';

  const fmtViolations = (violations, keyFn) =>
    violations.length
      ? violations.map((v) => `- \`${v.file}\`: ${keyFn(v)}`).join('\n')
      : 'None detected';

  return `# Marketing-DB Audit Report

**Status:** ${status}
**Generated:** ${report.timestamp}

## Summary
${report.summary}

## Folder Structure
${report.folderStructure.ok ? '✅ OK' : '❌ FAILED'}
${report.folderStructure.missing.map((d) => `- Missing: \`${d}\``).join('\n')}

## Required Files
${report.requiredFiles.ok ? '✅ OK' : '❌ FAILED'}
${report.requiredFiles.missing.map((f) => `- Missing: \`${f}\``).join('\n')}

## SQLite Schema
${report.schemaCheck.ok ? '✅ OK' : '❌ FAILED'}
${report.schemaCheck.error ? `Error: ${report.schemaCheck.error}\n` : ''}${report.schemaCheck.missingTables.map((t) => `- Missing table: \`${t}\``).join('\n')}

## Fake / Placeholder Detection
${report.fakeImplementation.ok ? '✅ OK' : '❌ FAILED'}
${fmtViolations(report.fakeImplementation.violations, (v) => v.issues.join(', '))}

## Broken Imports
${report.brokenImports.ok ? '✅ OK' : '❌ FAILED'}
${fmtViolations(report.brokenImports.violations, (v) => v.imports.join(', '))}

## Internet Policy
${report.internetPolicy.ok ? '✅ OK' : '❌ FAILED'}
${fmtViolations(report.internetPolicy.violations, (v) => v.issues.join(', '))}

## Telemetry Check
${report.telemetryCheck.ok ? '✅ OK' : '❌ FAILED'}
${fmtViolations(report.telemetryCheck.violations, (v) => v.issues.join(', '))}

## Duplicate Modules
${report.duplicateModules.ok ? '✅ OK' : '❌ FAILED'}
${report.duplicateModules.duplicates.length
    ? report.duplicateModules.duplicates.map((d) => `- \`${d.name}\`: ${d.files.join(' vs ')}`).join('\n')
    : 'No duplicates found'}

## Phase Completion
${report.phaseCompletion.phases.length
    ? report.phaseCompletion.phases.map((p) => `- Phase ${p.phase}: ${p.name} — **${p.status}**`).join('\n')
    : 'Database not initialised — no phase data available'}
`;
}
