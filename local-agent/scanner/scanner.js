// scanner/scanner.js - project scanner with streaming glob
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, relative, extname, resolve, dirname, basename } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fg from 'fast-glob';

// ── Project type markers ────────────────────────────────────────────────────
const PROJECT_TYPE_MARKERS = {
  nodejs:  ['package.json'],
  python:  ['requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg'],
  php:     ['composer.json'],
  rust:    ['Cargo.toml'],
  go:      ['go.mod'],
  ruby:    ['Gemfile'],
  java:    ['pom.xml', 'build.gradle'],
  dotnet:  ['*.csproj', '*.sln'],
};

// ── Framework fingerprints ──────────────────────────────────────────────────
const FRAMEWORK_SIGNALS = [
  { name: 'Next.js',    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'] },
  { name: 'Astro',      files: ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'] },
  { name: 'Nuxt',       files: ['nuxt.config.js', 'nuxt.config.ts'] },
  { name: 'SvelteKit',  files: ['svelte.config.js'] },
  { name: 'Vite',       files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'] },
  { name: 'Django',     files: ['manage.py', 'settings.py'] },
  { name: 'FastAPI',    files: ['main.py'] },
  { name: 'Flask',      files: ['app.py', 'wsgi.py'] },
  { name: 'Laravel',    files: ['artisan'] },
  { name: 'Rails',      files: ['config/routes.rb'] },
  { name: 'Express',    files: ['app.js', 'server.js', 'index.js'] },
  { name: 'Remix',      files: ['remix.config.js'] },
  { name: 'Gatsby',     files: ['gatsby-config.js', 'gatsby-config.ts'] },
];

// pkg.json deps → framework
const PKG_DEP_FRAMEWORKS = {
  next:           'Next.js',
  astro:          'Astro',
  nuxt:           'Nuxt',
  '@sveltejs/kit':'SvelteKit',
  gatsby:         'Gatsby',
  'react-dom':    'React',
  vue:            'Vue',
  '@angular/core':'Angular',
  svelte:         'Svelte',
  remix:          'Remix',
  express:        'Express',
  fastify:        'Fastify',
  hapi:           '@hapi/hapi',
  koa:            'Koa',
};

// ── Config file patterns ────────────────────────────────────────────────────
const CONFIG_FILE_PATTERNS = [
  'package.json', 'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'astro.config.mjs', 'astro.config.js', 'astro.config.ts',
  'svelte.config.js', 'nuxt.config.js', 'nuxt.config.ts',
  '.env.example', '.env.sample', '.env.template',
  'tsconfig.json', 'babel.config.js', 'babel.config.json',
  'webpack.config.js', 'jest.config.js', 'jest.config.ts',
  'vitest.config.js', 'vitest.config.ts',
  'tailwind.config.js', 'tailwind.config.ts',
  'eslint.config.js', '.eslintrc.js', '.eslintrc.json',
  'pyproject.toml', 'requirements.txt', 'composer.json',
];

// ── Route / page directories ────────────────────────────────────────────────
const ROUTE_DIRS = [
  'src/pages', 'src/routes', 'src/app', 'app', 'pages', 'routes',
];

// ── File extensions for source parsing ─────────────────────────────────────
const COMMENT_SOURCE_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.php', '.cs', '.cpp', '.c', '.h', '.swift',
  '.vue', '.svelte', '.astro', '.sh', '.bash', '.zsh',
]);

// ── Language detection ──────────────────────────────────────────────────────
const EXT_TO_LANGUAGE = {
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
  '.java': 'Java', '.kt': 'Kotlin', '.php': 'PHP', '.cs': 'C#',
  '.cpp': 'C++', '.c': 'C', '.swift': 'Swift',
  '.vue': 'Vue', '.svelte': 'Svelte',
};

// ── Package manager detection ───────────────────────────────────────────────
const PKG_MANAGER_MARKERS = {
  'yarn.lock':          'yarn',
  'pnpm-lock.yaml':     'pnpm',
  'package-lock.json':  'npm',
  'bun.lockb':          'bun',
  'Pipfile.lock':       'pipenv',
  'poetry.lock':        'poetry',
  'composer.lock':      'composer',
  'Cargo.lock':         'cargo',
  'go.sum':             'go modules',
  'Gemfile.lock':       'bundler',
};

// ── Secret patterns ─────────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  { name: 'Generic API Key',    re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/i },
  { name: 'Generic Secret',     re: /(?:secret[_-]?key|secret)\s*[:=]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/i },
  { name: 'Password',           re: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{6,})['"]/ },
  { name: 'Bearer Token',       re: /Bearer\s+([A-Za-z0-9\-_\.]{20,})/i },
  { name: 'OpenAI Key',         re: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'AWS Key',            re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token',       re: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'Private Key Header', re: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Connection String',  re: /(?:mongodb|mysql|postgres|postgresql|redis):\/\/[^:]+:[^@]+@/ },
  { name: 'Hardcoded Token',    re: /(?:token|auth)\s*[:=]\s*['"]([A-Za-z0-9\-_\.]{20,})['"]/ },
];

// ── Suspicious filenames (possible secret files) ────────────────────────────
const SECRET_FILENAME_PATTERNS = [
  /^\.env$/,
  /^\.env\.(local|dev|prod|staging|test)$/,
  /private[_-]?key/i,
  /secret/i,
  /credentials/i,
  /\.pem$/,
  /\.key$/,
  /\.pfx$/,
  /\.p12$/,
];

// ── API endpoint patterns ───────────────────────────────────────────────────
const API_ENDPOINT_PATTERNS = [
  // Express / Fastify / Koa: router.get('/path', ...)
  /(?:router|app)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"` ]+)['"`]/gi,
  // FastAPI: @app.get("/path")
  /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"` ]+)['"`]/gi,
  // Flask: @app.route("/path")
  /@(?:app|blueprint)\.route\s*\(\s*['"`]([^'"` ]+)['"`]/gi,
];

// ── Component patterns ──────────────────────────────────────────────────────
const COMPONENT_DIRS = [
  'src/components', 'components', 'src/ui', 'ui',
  'src/views', 'views', 'src/widgets', 'widgets',
];
const COMPONENT_EXTS = new Set(['.jsx', '.tsx', '.vue', '.svelte']);

const TODO_PATTERN      = /\/\/\s*(TODO|FIXME|HACK|XXX|NOTE|BUG)[:|\s](.+)/i;
const TODO_PATTERN_HASH = /#\s*(TODO|FIXME|HACK|XXX|NOTE|BUG)[:|\s](.+)/i;

const LARGE_FILE_THRESHOLD = 500 * 1024; // 500 KB

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildIgnorePatterns(config) {
  const ignoreList = config?.scanner?.ignore ?? [];
  return ignoreList.map((p) =>
    (!p.includes('*') && !p.includes('/')) ? `**/${p}/**` : p
  );
}

function detectProjectTypes(rootDir) {
  const detected = [];
  for (const [type, markers] of Object.entries(PROJECT_TYPE_MARKERS)) {
    for (const marker of markers) {
      if (marker.includes('*')) {
        try {
          const matches = fg.sync(marker, { cwd: rootDir, deep: 1, onlyFiles: true });
          if (matches.length > 0) { detected.push(type); break; }
        } catch { /* ignore */ }
      } else if (existsSync(join(rootDir, marker))) {
        detected.push(type);
        break;
      }
    }
  }
  return [...new Set(detected)];
}

function detectFrameworks(rootDir, configFiles) {
  const frameworks = new Set();

  // File-based detection
  for (const sig of FRAMEWORK_SIGNALS) {
    if (sig.files.some((f) => existsSync(join(rootDir, f)))) {
      frameworks.add(sig.name);
    }
  }

  // package.json dependency detection
  const pkg = configFiles['package.json'];
  if (pkg && typeof pkg === 'object') {
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    for (const [dep, frameworkName] of Object.entries(PKG_DEP_FRAMEWORKS)) {
      if (allDeps[dep]) frameworks.add(frameworkName);
    }
  }

  return [...frameworks];
}

function detectLanguages(byType) {
  const langs = new Set();
  for (const ext of Object.keys(byType)) {
    const lang = EXT_TO_LANGUAGE[ext];
    if (lang) langs.add(lang);
  }
  return [...langs];
}

function detectPackageManager(rootDir) {
  for (const [lockFile, manager] of Object.entries(PKG_MANAGER_MARKERS)) {
    if (existsSync(join(rootDir, lockFile))) return manager;
  }
  return null;
}

function readConfigFile(rootDir, filename) {
  const filePath = join(rootDir, filename);
  if (!existsSync(filePath)) return null;
  if (filename.endsWith('.json')) {
    try { return JSON.parse(readFileSync(filePath, 'utf8')); }
    catch { return `<parse error: ${filename}>`; }
  }
  return filePath;
}

function extractCommandsFromPkg(configFiles) {
  const pkg = configFiles['package.json'];
  if (!pkg || typeof pkg !== 'object' || !pkg.scripts) return { all: [], build: null, test: null, lint: null };

  const scripts = pkg.scripts;
  const all = Object.keys(scripts).map((name) => `npm run ${name}`);

  const build = scripts.build ? `npm run build` : null;
  const test  = scripts.test  ? `npm run test`  :
                scripts.tests ? `npm run tests`  : null;
  const lint  = scripts.lint   ? `npm run lint`   :
                scripts.eslint ? `npm run eslint` : null;

  return { all, build, test, lint };
}

function detectSuspiciousFile(relPath) {
  const base = basename(relPath);
  return SECRET_FILENAME_PATTERNS.some((re) => re.test(base));
}

// ── Per-file streaming analysis ─────────────────────────────────────────────

async function analyzeSourceFile(filePath, relPath) {
  const todos       = [];
  const secrets     = [];
  const endpoints   = [];
  const lineContents = [];

  try {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      lineContents.push(line);

      // TODO / FIXME
      const todoMatch = line.match(TODO_PATTERN) || line.match(TODO_PATTERN_HASH);
      if (todoMatch) {
        todos.push({ file: relPath, line: lineNum, type: todoMatch[1].toUpperCase(), text: todoMatch[2].trim() });
      }

      // Secret patterns
      for (const { name, re } of SECRET_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(line)) {
          secrets.push({ file: relPath, line: lineNum, type: name, snippet: line.trim().slice(0, 80) });
          break; // one secret hit per line is enough
        }
      }

      // API endpoints — match against full line
      for (const pattern of API_ENDPOINT_PATTERNS) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(line)) !== null) {
          const method = m[1]?.toUpperCase() ?? 'ROUTE';
          const path   = m[2] ?? m[1];
          endpoints.push({ file: relPath, line: lineNum, method, path });
        }
      }
    }
  } catch {
    // skip unreadable files
  }

  return { todos, secrets, endpoints };
}

// ── Main scan function ───────────────────────────────────────────────────────

export async function scanProject(targetDir, config) {
  const rootDir = resolve(targetDir);
  const maxFileSizeBytes = config?.scanner?.maxFileSizeBytes ?? 1048576;
  const ignorePatterns   = buildIgnorePatterns(config);

  // --- Config files ---
  const configFiles = {};
  for (const cfgFile of CONFIG_FILE_PATTERNS) {
    const value = readConfigFile(rootDir, cfgFile);
    if (value !== null) configFiles[cfgFile] = value;
  }

  // --- Basic detection ---
  const projectTypes   = detectProjectTypes(rootDir);
  const frameworks     = detectFrameworks(rootDir, configFiles);
  const packageManager = detectPackageManager(rootDir);
  const { all: buildCommands, build: buildCmd, test: testCmd, lint: lintCmd } =
    extractCommandsFromPkg(configFiles);

  // --- Glob all source files ---
  const allRelPaths = await fg('**/*', {
    cwd: rootDir,
    ignore: [...ignorePatterns, '**/.local-agent/**', '**/.git/**'],
    onlyFiles: true,
    followSymbolicLinks: config?.scanner?.followSymlinks ?? false,
    dot: true,
    absolute: false,
    suppressErrors: true,
  });

  // --- Build file list + classify ---
  const files        = [];
  const byType       = {};
  const largeFiles   = [];
  const suspiciousFiles = [];
  let   totalSize    = 0;

  const analysisQueue = []; // {absPath, relPath}

  for (const relPath of allRelPaths) {
    const absPath = join(rootDir, relPath);
    let size = 0, lastModified = null;
    try {
      const st = statSync(absPath);
      if (!st.isFile()) continue;
      size = st.size;
      lastModified = st.mtime.toISOString();
    } catch { continue; }

    if (size > maxFileSizeBytes) continue;

    const ext = extname(relPath).toLowerCase() || '(no ext)';
    byType[ext] = (byType[ext] ?? 0) + 1;
    totalSize += size;

    const entry = { path: relPath, size, type: ext.replace(/^\./, '') || 'unknown', lastModified };
    files.push(entry);

    if (size >= LARGE_FILE_THRESHOLD) {
      largeFiles.push({ path: relPath, size });
    }

    if (detectSuspiciousFile(relPath)) {
      suspiciousFiles.push(relPath);
    }

    if (COMMENT_SOURCE_EXTS.has(ext)) {
      analysisQueue.push({ absPath, relPath });
    }
  }

  // --- Parallel source analysis (batched) ---
  const allTodos     = [];
  const allSecrets   = [];
  const allEndpoints = [];

  const BATCH = 50;
  for (let i = 0; i < analysisQueue.length; i += BATCH) {
    const batch   = analysisQueue.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(({ absPath, relPath }) =>
      analyzeSourceFile(absPath, relPath)
    ));
    for (const r of results) {
      allTodos.push(...r.todos);
      allSecrets.push(...r.secrets);
      allEndpoints.push(...r.endpoints);
    }
  }

  // --- Detect routes, components ---
  const routes = [];
  const components = [];
  const docs = [];

  for (const relPath of allRelPaths) {
    // Routes
    for (const dir of ROUTE_DIRS) {
      if (relPath.startsWith(dir + '/')) { routes.push(relPath); break; }
    }
    // Components
    for (const dir of COMPONENT_DIRS) {
      if (relPath.startsWith(dir + '/') && COMPONENT_EXTS.has(extname(relPath).toLowerCase())) {
        components.push(relPath);
        break;
      }
    }
    // Docs / README
    const base = basename(relPath).toLowerCase();
    if (base === 'readme.md' || base.startsWith('readme') || base.includes('changelog') ||
        base.includes('contributing') || relPath.startsWith('docs/')) {
      docs.push(relPath);
    }
  }

  // --- Detect languages from file distribution ---
  const languages = detectLanguages(byType);

  // --- Env files ---
  const envFiles = allRelPaths.filter((p) => {
    const b = basename(p);
    return b === '.env.example' || b === '.env.sample' || b === '.env.template';
  });
  const hasMissingEnvExample = envFiles.length === 0 && (
    Object.keys(configFiles).some((f) => f === 'package.json')
  );

  // --- Assemble project map ---
  const projectMap = {
    scannedAt:    new Date().toISOString(),
    rootDir,
    projectTypes,
    frameworks,
    languages,
    packageManager,
    configFiles,
    commands: { build: buildCmd, test: testCmd, lint: lintCmd, all: buildCommands },
    buildCommands, // keep for backward compat
    files,
    routes,
    components,
    endpoints: allEndpoints,
    todos: allTodos,
    docs,
    envFiles,
    risks: {
      hardcodedSecrets: allSecrets,
      largeFiles,
      suspiciousFiles,
      missingEnvExample: hasMissingEnvExample,
    },
    stats: {
      totalFiles: files.length,
      totalSize,
      byType,
    },
  };

  // --- Write outputs ---
  const workspaceDir = join(rootDir, '.local-agent');
  if (existsSync(workspaceDir)) {
    writeFileSync(join(workspaceDir, 'project-map.json'), JSON.stringify(projectMap, null, 2), 'utf8');
    writeFileSync(join(workspaceDir, 'project-summary.md'), buildSummaryMarkdown(projectMap), 'utf8');

    const scanReport = buildScanReport(projectMap);
    writeFileSync(join(workspaceDir, 'scan-report.json'), JSON.stringify(scanReport, null, 2), 'utf8');

    // Timestamped markdown report in reports/
    const reportsDir = join(workspaceDir, 'reports');
    if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
    const reportTs = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(
      join(reportsDir, `scan-report-${reportTs}.md`),
      buildMarkdownReport(projectMap, scanReport),
      'utf8'
    );
  }

  return projectMap;
}

// ── scan-report.json ─────────────────────────────────────────────────────────

function buildScanReport(map) {
  const secretCount = map.risks.hardcodedSecrets.length;
  const largeCount  = map.risks.largeFiles.length;
  const suspCount   = map.risks.suspiciousFiles.length;
  const todoCount   = map.todos.length;

  let result = 'PASS';
  const warnings = [];
  const failures  = [];

  if (secretCount > 0) {
    result = 'FAIL';
    failures.push(`${secretCount} possible hardcoded secret(s) detected`);
  }
  if (map.risks.missingEnvExample) {
    result = result === 'FAIL' ? 'FAIL' : 'WARNING';
    warnings.push('No .env.example file found — consider adding one');
  }
  if (largeCount > 0) {
    if (result !== 'FAIL') result = 'WARNING';
    warnings.push(`${largeCount} large file(s) over 500 KB`);
  }
  if (suspCount > 0) {
    if (result !== 'FAIL') result = 'WARNING';
    warnings.push(`${suspCount} suspicious file name(s) detected`);
  }
  if (todoCount > 10) {
    warnings.push(`${todoCount} open TODO/FIXME items`);
  }

  // QA score 0–100
  let score = 100;
  score -= secretCount * 20;
  score -= largeCount  * 5;
  score -= suspCount   * 10;
  score -= Math.min(todoCount, 10) * 1;
  if (map.risks.missingEnvExample) score -= 10;
  score = Math.max(0, score);

  return {
    generatedAt: new Date().toISOString(),
    projectName: (() => {
      const pkg = map.configFiles['package.json'];
      return (pkg && pkg.name) ? pkg.name : map.rootDir.split('/').pop();
    })(),
    projectRoot:    map.rootDir,
    frameworks:     map.frameworks,
    languages:      map.languages,
    packageManager: map.packageManager,
    commands: {
      build: map.commands.build,
      test:  map.commands.test,
      lint:  map.commands.lint,
    },
    filesScanned:   map.stats.totalFiles,
    filesIgnored:   0, // scanner doesn't count ignored files yet
    risks: {
      hardcodedSecrets: map.risks.hardcodedSecrets,
      largeFiles:       map.risks.largeFiles,
      suspiciousFiles:  map.risks.suspiciousFiles,
      missingEnvExample: map.risks.missingEnvExample,
      todos:            map.todos.length,
    },
    warnings,
    failures,
    qaScore: score,
    result,
  };
}

// ── Markdown report ──────────────────────────────────────────────────────────

function buildMarkdownReport(map, report) {
  const sizeKb = (map.stats.totalSize / 1024).toFixed(1);

  const secretLines = report.risks.hardcodedSecrets.slice(0, 10)
    .map((s) => `  - \`${s.file}:${s.line}\` — **${s.type}**: \`${s.snippet}\``)
    .join('\n') || '  _None detected_';

  const largeLines = report.risks.largeFiles.slice(0, 10)
    .map((f) => `  - \`${f.path}\` (${(f.size / 1024).toFixed(0)} KB)`)
    .join('\n') || '  _None_';

  const suspLines = report.risks.suspiciousFiles.slice(0, 10)
    .map((f) => `  - \`${f}\``)
    .join('\n') || '  _None_';

  const resultIcon = report.result === 'PASS' ? '✅ PASS' :
                     report.result === 'WARNING' ? '⚠️ WARNING' : '❌ FAIL';

  const warningLines = report.warnings.map((w) => `- ⚠️  ${w}`).join('\n') || '_None_';
  const failureLines = report.failures.map((f) => `- ❌ ${f}`).join('\n') || '_None_';

  return `# Local Agent Phase 1 Scan Report

_Generated: ${report.generatedAt}_

## Project

| Field | Value |
|-------|-------|
| **Name** | ${report.projectName} |
| **Root** | \`${report.projectRoot}\` |
| **Framework** | ${report.frameworks.join(', ') || 'Unknown'} |
| **Language** | ${report.languages.join(', ') || 'Unknown'} |
| **Package Manager** | ${report.packageManager || 'Unknown'} |

## Commands Detected

| Type | Command |
|------|---------|
| Build | \`${report.commands.build || 'not detected'}\` |
| Test  | \`${report.commands.test  || 'not detected'}\` |
| Lint  | \`${report.commands.lint  || 'not detected'}\` |

## Files Scanned

| Metric | Value |
|--------|-------|
| **Total** | ${report.filesScanned} |
| **Total Size** | ${sizeKb} KB |
| **Routes** | ${map.routes.length} |
| **Components** | ${map.components.length} |
| **API Endpoints** | ${map.endpoints.length} |
| **Open TODOs / FIXMEs** | ${report.risks.todos} |

## Risks

### Hardcoded Secrets

${secretLines}

### Large Files (>500 KB)

${largeLines}

### Suspicious File Names

${suspLines}

### Missing .env.example

${report.risks.missingEnvExample ? '⚠️  No `.env.example` found' : '✅  Present'}

## Warnings

${warningLines}

## Failures

${failureLines}

## Result

**QA Score: ${report.qaScore}/100**

# ${resultIcon}
`;
}

// ── project-summary.md ────────────────────────────────────────────────────────

function buildSummaryMarkdown(map) {
  const sizeKb       = (map.stats.totalSize / 1024).toFixed(1);
  const typesStr     = map.projectTypes.length > 0 ? map.projectTypes.join(', ') : 'unknown';
  const frameworkStr = map.frameworks.length > 0    ? map.frameworks.join(', ')  : 'unknown';

  const byTypeLines = Object.entries(map.stats.byType)
    .sort(([, a], [, b]) => b - a).slice(0, 15)
    .map(([ext, count]) => `  - \`${ext}\`: ${count} files`)
    .join('\n');

  const cmdLines = map.buildCommands.slice(0, 10)
    .map((c) => `  - \`${c}\``)
    .join('\n') || '  _None detected_';

  const routeLines = map.routes.slice(0, 20)
    .map((r) => `  - ${r}`)
    .join('\n') || '  _None detected_';

  const todoLines = map.todos.slice(0, 30)
    .map((t) => `  - \`${t.file}:${t.line}\` **${t.type}**: ${t.text}`)
    .join('\n') || '  _None found_';

  const secretLines = map.risks.hardcodedSecrets.slice(0, 10)
    .map((s) => `  - \`${s.file}:${s.line}\` ${s.type}`)
    .join('\n') || '  _None detected_';

  return `# Project Summary

> Auto-generated by local-agent on ${map.scannedAt}

## Overview

- **Root**: \`${map.rootDir}\`
- **Project Types**: ${typesStr}
- **Frameworks**: ${frameworkStr}
- **Languages**: ${map.languages.join(', ') || 'unknown'}
- **Package Manager**: ${map.packageManager || 'unknown'}
- **Total Files**: ${map.stats.totalFiles}
- **Total Size**: ${sizeKb} KB

## Build & Test Commands

${cmdLines}

## File Types

${byTypeLines || '  _None_'}

## Routes / Pages

${routeLines}

## API Endpoints (${map.endpoints.length})

${map.endpoints.slice(0, 20).map((e) => `  - \`${e.method} ${e.path}\` — ${e.file}:${e.line}`).join('\n') || '  _None detected_'}

## Components (${map.components.length})

${map.components.slice(0, 20).map((c) => `  - ${c}`).join('\n') || '  _None_'}

## Security Risks — Possible Hardcoded Secrets

${secretLines}

## Open TODOs / FIXMEs (first 30)

${todoLines}
`;
}
