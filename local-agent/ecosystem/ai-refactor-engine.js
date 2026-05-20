/**
 * Phase 21 - AI Refactor Engine
 * Proposes architecture cleanup, repo merge, service split, microservice extraction.
 *
 * Reference: DependencyGraphBuilder.js (graph analysis), CrossProjectLearning.js (pattern learning)
 */

import { createRequire } from 'module';
import { readdirSync, statSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname, basename, dirname, relative } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'ecosystem-refactor.db');

// ------------------------------------------------------------------
// Database
// ------------------------------------------------------------------

export function openRefactorDB(dbPath = DEFAULT_DB) {
  const dir = join(dbPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id           TEXT PRIMARY KEY,
      project_path TEXT,
      type         TEXT,
      score        REAL,
      suggestions  TEXT DEFAULT '[]',
      created_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS refactor_history (
      id           TEXT PRIMARY KEY,
      project_path TEXT,
      action       TEXT,
      before       TEXT,
      after        TEXT,
      executed_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ana_project ON analyses(project_path);
    CREATE INDEX IF NOT EXISTS idx_ana_type   ON analyses(type);
  `);

  return db;
}

// ------------------------------------------------------------------
// Core Refactor Analysis
// ------------------------------------------------------------------

/**
 * Analyze a project and return architecture refactor suggestions.
 *
 * @param {string} projectPath
 * @param {object} options
 * @returns {object} Analysis results with suggestions
 */
export function analyzeRefactor(projectPath, options = {}) {
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const {
    detectGodClasses = true,
    detectCyclicDeps = true,
    detectLargeFiles = true,
    detectDeepModules = true,
    detectTightCoupling = true,
  } = options;

  const files = collectSourceFiles(projectPath);
  const graph = buildImportGraph(files);
  const suggestions = [];

  if (detectGodClasses) {
    suggestions.push(...detectGodClassesSuggestions(files));
  }
  if (detectCyclicDeps) {
    suggestions.push(...detectCyclicDependenciesSuggestions(graph));
  }
  if (detectLargeFiles) {
    suggestions.push(...detectLargeFilesSuggestions(files));
  }
  if (detectDeepModules) {
    suggestions.push(...detectDeepModuleSuggestions(projectPath));
  }
  if (detectTightCoupling) {
    suggestions.push(...detectTightCouplingSuggestions(graph));
  }

  // General architecture suggestions
  suggestions.push(...generateArchitectureSuggestions(graph, files));

  // Prioritize and score
  const scored = suggestions.map(s => ({
    ...s,
    impactScore: computeImpactScore(s, graph),
  }));
  scored.sort((a, b) => b.impactScore - a.impactScore);

  return {
    projectPath,
    totalFiles: files.length,
    graphNodes: graph.nodes.size,
    graphEdges: graph.edges.length,
    suggestions: scored,
    summary: summarizeSuggestions(scored),
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Propose a monorepo merge for a set of related repositories.
 *
 * @param {string[]} projectPaths
 * @returns {object} Monorepo extraction plan
 */
export function proposeMonorepoMerge(projectPaths, options = {}) {
  const { targetPath = null } = options;
  const validProjects = projectPaths.filter(p => existsSync(p));

  if (validProjects.length < 2) {
    return { error: 'Need at least 2 valid project paths for a monorepo merge' };
  }

  const projectMeta = validProjects.map(p => ({
    path: p,
    name: basename(p),
    packageJson: loadPackageJson(p),
    hasTests: existsSync(join(p, 'test')) || existsSync(join(p, '__tests__')),
    hasEslint: existsSync(join(p, '.eslintrc')) || existsSync(join(p, 'eslint.config')),
    techStack: detectTechStack(p),
  }));

  // Find shared dependencies
  const sharedDeps = findSharedDependencies(projectMeta);

  // Find shared source patterns
  const sharedPatterns = findSharedSourcePatterns(projectMeta);

  // Categorize: should merge, should stay separate, unclear
  const decisions = projectMeta.map(p => {
    const sharedDepCount = sharedDeps.filter(d => d.projects.includes(p.path)).length;
    const sharedPatternCount = sharedPatterns.filter(s => s.projects.includes(p.path)).length;

    if (sharedDepCount >= 3 && sharedPatternCount >= 2) {
      return { ...p, recommendation: 'merge', confidence: 0.8 };
    } else if (sharedDepCount === 0 && sharedPatternCount === 0) {
      return { ...p, recommendation: 'keep_separate', confidence: 0.7 };
    } else {
      return { ...p, recommendation: 'review', confidence: 0.5 };
    }
  });

  const mergeCandidates = decisions.filter(d => d.recommendation === 'merge');
  const packageName = targetPath ? basename(targetPath) : `monorepo-${Date.now()}`;

  return {
    projects: projectMeta,
    decisions,
    mergeCandidates: mergeCandidates.map(d => d.path),
    sharedDependencies: sharedDeps,
    sharedPatterns,
    monorepoPlan: {
      name: packageName,
      recommendedStructure: proposeMonorepoStructure(mergeCandidates, sharedDeps),
      migrationSteps: generateMigrationSteps(mergeCandidates, packageName),
      estimatedComplexity: mergeCandidates.length > 5 ? 'high' : 'medium',
    },
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Propose microservice extraction from a monolith.
 *
 * @param {string} projectPath
 * @returns {object} Extraction plan
 */
export function proposeMicroserviceExtraction(projectPath) {
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const files = collectSourceFiles(projectPath);
  const graph = buildImportGraph(files);

  // Identify service boundary candidates
  const services = identifyServiceBoundaries(graph, files);

  // Score each service for extraction readiness
  const scoredServices = services.map(svc => ({
    ...svc,
    extractionScore: scoreServiceExtraction(svc, graph),
    risk: assessExtractionRisk(svc, graph),
    complexity: assessExtractionComplexity(svc),
  }));

  scoredServices.sort((a, b) => b.extractionScore - a.extractionScore);

  const recommendations = scoredServices.map(svc => ({
    serviceName: svc.name,
    recommended: svc.extractionScore >= 0.6,
    extractionScore: svc.extractionScore,
    risk: svc.risk,
    complexity: svc.complexity,
    apiSurface: svc.publicAPIs,
    dataStores: svc.dataStores,
    dependencies: svc.dependencies,
    migrationSteps: generateServiceMigrationSteps(svc),
    estimatedEffort: estimateEffort(svc),
  }));

  return {
    projectPath,
    serviceCandidates: recommendations,
    totalServices: services.length,
    recommendedExtractions: recommendations.filter(r => r.recommended).length,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Propose code ownership rules and team structure.
 *
 * @param {string} projectPath
 * @returns {object} Team structure recommendations
 */
export function analyzeTeamStructure(projectPath) {
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const files = collectSourceFiles(projectPath);
  const graph = buildImportGraph(files);

  // Group files by directory/module
  const modules = groupFilesByModule(projectPath, files);

  // Analyze coupling within each module
  const moduleHealth = modules.map(mod => {
    const modFiles = mod.files.map(f => graph.nodes.get(f));
    const avgIncoming = modFiles.reduce((s, n) => s + (n?.incoming ?? 0), 0) / modFiles.length;
    const avgOutgoing = modFiles.reduce((s, n) => s + (n?.outgoing ?? 0), 0) / modFiles.length;
    const circularCount = countCircularDependencies(mod.files, graph);

    return {
      name: mod.name,
      path: mod.path,
      fileCount: mod.files.length,
      avgIncoming: parseFloat(avgIncoming.toFixed(2)),
      avgOutgoing: parseFloat(avgOutgoing.toFixed(2)),
      circularDeps: circularCount,
      health: computeModuleHealth(avgIncoming, avgOutgoing, circularCount),
    };
  });

  // Group modules into ownership domains
  const domains = groupIntoDomains(moduleHealth);

  return {
    projectPath,
    modules: moduleHealth,
    domains,
    ownershipRules: generateOwnershipRules(domains),
    analyzedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------
// Graph Analysis
// ------------------------------------------------------------------

function collectSourceFiles(projectPath) {
  const files = [];
  const patterns = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'];
  const IGNORE = ['node_modules', '.git', 'dist', 'build', '.next'];

  function walk(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || IGNORE.includes(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && patterns.some(p => entry.name.match(p.replace('**/*', '.*')))) {
          files.push(fullPath);
        }
      }
    } catch { /* skip */ }
  }

  walk(projectPath);
  return files;
}

function buildImportGraph(files) {
  const nodes = new Map();
  const edges = [];

  for (const file of files) {
    nodes.set(file, { id: file, incoming: 0, outgoing: 0, fanOut: new Set(), fanIn: new Set() });
  }

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8');
      const patterns = [
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const dep = match[1];
          if (dep.startsWith('.')) {
            const resolved = join(dirname(file), dep);
            const extMatch = ['', '.js', '.jsx', '.ts', '.tsx'].map(e => resolved + e);
            const resolvedFile = extMatch.find(e => nodes.has(e) || files.includes(e));
            if (resolvedFile && nodes.has(resolvedFile)) {
              edges.push({ source: file, target: resolvedFile });
              nodes.get(file).outgoing++;
              nodes.get(file).fanOut.add(resolvedFile);
              nodes.get(resolvedFile).incoming++;
              nodes.get(resolvedFile).fanIn.add(file);
            }
          }
        }
      }
    } catch { /* skip unreadable */ }
  }

  return { nodes, edges };
}

function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const recStack = new Set();

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const target of graph.nodes.get(node)?.fanOut ?? []) {
      if (!visited.has(target)) {
        const result = dfs(target, [...path]);
        if (result) cycles.push(result);
      } else if (recStack.has(target)) {
        const start = path.indexOf(target);
        cycles.push([...path.slice(start), target]);
      }
    }

    recStack.delete(node);
    return null;
  }

  for (const node of graph.nodes.keys()) {
    if (!visited.has(node)) dfs(node, []);
  }

  return cycles;
}

// ------------------------------------------------------------------
// Detection Suggestions
// ------------------------------------------------------------------

function detectGodClassesSuggestions(files) {
  const suggestions = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      const functionCount = (content.match(/\bfunction\s+\w+/g) || []).length;
      const classCount = (content.match(/\bclass\s+\w+/g) || []).length;
      const methodCount = (content.match(/\b\s{2,4}\w+\s*\([^)]*\)\s*[{=]/g) || []).length;

      // God class: too many lines, too many functions/methods
      if (lines > 500 && (functionCount + methodCount) > 30) {
        suggestions.push({
          type: 'god_class',
          severity: lines > 1000 ? 'high' : 'medium',
          file,
          lines,
          functionCount: functionCount + methodCount,
          description: `File has ${lines} lines and ${functionCount + methodCount} functions — consider splitting`,
          action: 'split_file',
          suggestedModules: suggestFileSplit(content, lines),
        });
      }
    } catch { /* skip */ }
  }

  return suggestions;
}

function detectCyclicDependenciesSuggestions(graph) {
  const cycles = findCycles(graph);
  return cycles.map(cycle => ({
    type: 'cyclic_dependency',
    severity: cycle.length > 3 ? 'high' : 'medium',
    cycle,
    description: `Circular dependency: ${cycle.map(f => basename(f)).join(' → ')}`,
    action: 'break_cycle',
    suggestion: suggestCycleBreak(cycle, graph),
  }));
}

function detectLargeFilesSuggestions(files) {
  return files
    .filter(file => {
      try { return statSync(file).size / 1024 > 50; } catch { return false; }
    })
    .map(file => {
      const lines = readFileSync(file, 'utf8').split('\n').length;
      return {
        type: 'large_file',
        severity: lines > 1000 ? 'high' : lines > 500 ? 'medium' : 'low',
        file,
        lines,
        description: `File has ${lines} lines — consider splitting or extracting logic`,
        action: 'review_and_split',
      };
    });
}

function detectDeepModuleSuggestions(projectPath) {
  const MAX_DEPTH = 5;
  const suggestions = [];

  function measureDepth(dir, depth = 0) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules');
      if (dirs.length > 0) {
        for (const d of dirs) {
          const full = join(dir, d.name);
          if (depth > MAX_DEPTH) {
            suggestions.push({
              type: 'deep_module',
              severity: depth > 7 ? 'high' : 'medium',
              path: full,
              depth,
              description: `Directory depth ${depth} exceeds recommended max of ${MAX_DEPTH}`,
              action: 'flatten_structure',
              suggestion: `Consider flattening or grouping related subdirectories at ${full}`,
            });
          }
          measureDepth(full, depth + 1);
        }
      }
    } catch { /* skip */ }
  }

  measureDepth(projectPath);
  return suggestions;
}

function detectTightCouplingSuggestions(graph) {
  const suggestions = [];

  for (const [node, data] of graph.nodes) {
    // High fan-out: module depends on too many things
    if (data.fanOut.size > 15) {
      suggestions.push({
        type: 'tight_coupling',
        subtype: 'high_fan_out',
        severity: data.fanOut.size > 30 ? 'high' : 'medium',
        file: node,
        fanOut: data.fanOut.size,
        description: `${basename(node)} has ${data.fanOut.size} dependencies — consider extracting a facade/abstraction layer`,
        action: 'extract_facade',
      });
    }

    // High fan-in: too many things depend on this (brittle central module)
    if (data.fanIn.size > 20) {
      suggestions.push({
        type: 'tight_coupling',
        subtype: 'high_fan_in',
        severity: data.fanIn.size > 40 ? 'high' : 'medium',
        file: node,
        fanIn: data.fanIn.size,
        description: `${basename(node)} is a central hub with ${data.fanIn.size} dependents — risk of cascade failures`,
        action: 'introduce_interface',
      });
    }
  }

  return suggestions;
}

function generateArchitectureSuggestions(graph, files) {
  const suggestions = [];

  // Check for flat structure (no modules)
  const topLevelDirs = new Set();
  for (const file of files) {
    const rel = relative(projectPath ?? '', file);
    const parts = rel.split('/');
    if (parts.length > 1) topLevelDirs.add(parts[0]);
  }

  if (topLevelDirs.size === 0) {
    suggestions.push({
      type: 'architecture',
      subtype: 'flat_structure',
      severity: 'low',
      description: 'Project has a flat structure — consider organizing into logical modules/packages',
      action: 'introduce_modules',
    });
  }

  // Check for missing test files
  const testCoverage = files.filter(f =>
    f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__')
  ).length;
  if (testCoverage < files.length * 0.3 && files.length > 10) {
    suggestions.push({
      type: 'architecture',
      subtype: 'low_test_coverage',
      severity: 'medium',
      description: `Only ${Math.round(testCoverage / files.length * 100)}% of files have tests`,
      action: 'add_tests',
    });
  }

  return suggestions;
}

// ------------------------------------------------------------------
// Monorepo Support
// ------------------------------------------------------------------

function loadPackageJson(projectPath) {
  try {
    const pkgPath = join(projectPath, 'package.json');
    return existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null;
  } catch { return null; }
}

function detectTechStack(projectPath) {
  const stack = [];
  const files = collectSourceFiles(projectPath);
  const content = files.map(f => {
    try { return readFileSync(f, 'utf8'); } catch { return ''; }
  }).join(' ');

  const techs = {
    react: /\bReact\b|import\s+['"]react['"]/.test(content),
    vue: /\bVue\b|import\s+['"]vue['"]/.test(content),
    angular: /\bAngular\b|import\s+['"]@angular/.test(content),
    next: /\bNext\b|import\s+['"]next['"]/.test(content),
    express: /\bexpress\b|import\s+['"]express['"]/.test(content),
    fastify: /\bfastify\b|import\s+['"]fastify['"]/.test(content),
    typescript: /\.tsx?/.test(files.join('')),
    database: /\b(sql|postgres|mysql|mongodb|sqlite|knex|prisma)\b/i.test(content),
  };

  for (const [tech, detected] of Object.entries(techs)) {
    if (detected) stack.push(tech);
  }
  return stack;
}

function findSharedDependencies(projects) {
  const depMaps = projects.map(p => ({
    path: p.path,
    deps: new Set([
      ...Object.keys(p.packageJson?.dependencies ?? {}),
      ...Object.keys(p.packageJson?.devDependencies ?? {}),
    ]),
  }));

  const allDeps = new Set();
  for (const d of depMaps) d.deps.forEach(dep => allDeps.add(dep));

  const shared = [];
  for (const dep of allDeps) {
    const projectsWith = depMaps.filter(d => d.deps.has(dep)).map(d => d.path);
    if (projectsWith.length >= 2) {
      shared.push({ dependency: dep, projects: projectsWith, count: projectsWith.length });
    }
  }

  return shared.sort((a, b) => b.count - a.count);
}

function findSharedSourcePatterns(projects) {
  // Look for same filename patterns across projects
  const fileNameMap = new Map();

  for (const p of projects) {
    const files = collectSourceFiles(p.path);
    for (const f of files) {
      const name = basename(f);
      if (!fileNameMap.has(name)) fileNameMap.set(name, []);
      fileNameMap.get(name).push(p.path);
    }
  }

  return Array.from(fileNameMap.entries())
    .filter(([, paths]) => paths.length >= 2)
    .map(([name, paths]) => ({ pattern: name, projects: paths, count: paths.length }));
}

function proposeMonorepoStructure(mergeCandidates, sharedDeps) {
  return {
    packages: mergeCandidates.map(p => ({ name: basename(p), path: relative(process.cwd(), p) })),
    sharedDependencies: sharedDeps.slice(0, 5).map(d => d.dependency),
    structure: `packages/\n  ${mergeCandidates.map(p => `  ${basename(p)}/`).join('\n  ')}`,
  };
}

function generateMigrationSteps(mergeCandidates, packageName) {
  return [
    `1. Create monorepo root: mkdir ${packageName} && cd ${packageName} && npm init -y`,
    '2. Add workspace config (npm/pnpm/yarn workspaces)',
    ...mergeCandidates.map((p, i) => `3.${i + 1}. Move ${basename(p)} → packages/${basename(p)}`),
    '4. Deduplicate shared dependencies at root level',
    '5. Update import paths in all packages',
    '6. Run tests, fix broken references',
  ];
}

// ------------------------------------------------------------------
// Microservice Extraction Support
// ------------------------------------------------------------------

function identifyServiceBoundaries(graph, files) {
  // Group files by top-level directory
  const dirGroups = new Map();
  for (const file of files) {
    const parts = relative(process.cwd(), file).split('/');
    const topDir = parts[0] || 'root';
    if (!dirGroups.has(topDir)) dirGroups.set(topDir, []);
    dirGroups.get(topDir).push(file);
  }

  return Array.from(dirGroups.entries()).map(([name, groupFiles]) => {
    // Find public APIs (files that are imported from outside the group)
    const publicAPIs = groupFiles.filter(f => {
      const node = graph.nodes.get(f);
      return node && node.incoming > 0 && ![...node.fanIn].every(dep => groupFiles.includes(dep));
    });

    // Find data stores (files that look like DB access)
    const dataStores = groupFiles.filter(f => {
      try {
        const content = readFileSync(f, 'utf8');
        return /\b(sql|query|db\.|knex|prisma|sequelize|mongoose)\b/i.test(content);
      } catch { return false; }
    });

    // External dependencies
    const externalDeps = new Set();
    for (const f of groupFiles) {
      const node = graph.nodes.get(f);
      if (node) {
        for (const dep of node.fanOut) {
          if (!groupFiles.includes(dep)) externalDeps.add(dep);
        }
      }
    }

    return {
      name,
      files: groupFiles,
      fileCount: groupFiles.length,
      publicAPIs: publicAPIs.map(basename),
      dataStores: dataStores.map(basename),
      dependencies: Array.from(externalDeps).map(basename),
    };
  });
}

function scoreServiceExtraction(service, graph) {
  let score = 0.5; // base

  // Good: has clear API surface
  if (service.publicAPIs.length > 0) score += 0.1;

  // Good: self-contained data
  if (service.dataStores.length > 0) score += 0.15;

  // Bad: too many external dependencies
  if (service.dependencies.length > 20) score -= 0.2;
  else if (service.dependencies.length < 5) score += 0.15;

  // Bad: too large
  if (service.fileCount > 50) score -= 0.1;

  return Math.max(0, Math.min(1, score));
}

function assessExtractionRisk(service, graph) {
  if (service.dependencies.length > 20) return 'high';
  if (service.dependencies.length > 10) return 'medium';
  return 'low';
}

function assessExtractionComplexity(service) {
  if (service.fileCount > 30 || service.dependencies.length > 15) return 'high';
  if (service.fileCount > 10 || service.dependencies.length > 5) return 'medium';
  return 'low';
}

function generateServiceMigrationSteps(service) {
  return [
    `1. Extract ${service.name} into packages/${service.name}`,
    `2. Define API contract for ${service.publicAPIs.join(', ') || 'main exports'}`,
    `3. Replace direct imports with HTTP/RPC calls`,
    `4. Extract ${service.dataStores.length > 0 ? 'data layer to separate DB: ' + service.dataStores.join(', ') : 'shared DB access'}`,
    `5. Deploy as ${service.complexity === 'high' ? 'separate service with orchestration' : 'independent microservice'}`,
    '6. Add service-level tests',
    '7. Set up API gateway routing',
  ];
}

function estimateEffort(service) {
  const fileHours = service.fileCount * 0.5;
  const depHours = service.dependencies.length * 1.5;
  return { hours: Math.round(fileHours + depHours), complexity: service.complexity };
}

// ------------------------------------------------------------------
// Team Structure Support
// ------------------------------------------------------------------

function groupFilesByModule(projectPath, files) {
  const moduleMap = new Map();

  for (const file of files) {
    const rel = relative(projectPath, file);
    const parts = rel.split('/');
    const modulePath = parts.length > 1 ? join(...parts.slice(0, -1)) : 'root';
    if (!moduleMap.has(modulePath)) moduleMap.set(modulePath, []);
    moduleMap.get(modulePath).push(file);
  }

  return Array.from(moduleMap.entries()).map(([path, files]) => ({
    name: basename(path) || 'root',
    path,
    files,
  }));
}

function countCircularDependencies(moduleFiles, graph) {
  let count = 0;
  for (const f of moduleFiles) {
    const node = graph.nodes.get(f);
    if (!node) continue;
    for (const dep of node.fanOut) {
      if (moduleFiles.includes(dep)) {
        const depNode = graph.nodes.get(dep);
        if (depNode?.fanOut.has(f)) count++;
      }
    }
  }
  return Math.floor(count / 2);
}

function computeModuleHealth(avgIncoming, avgOutgoing, circularCount) {
  if (circularCount > 5 || avgIncoming > 15) return 'poor';
  if (circularCount > 2 || avgIncoming > 8) return 'fair';
  return 'good';
}

function groupIntoDomains(modules) {
  // Simple heuristic: group by name similarity or directory depth
  const auth = modules.filter(m => /auth|login|user|account/i.test(m.name));
  const api = modules.filter(m => /api|route|endpoint|controller/i.test(m.name));
  const ui = modules.filter(m => /ui|component|view|page|render/i.test(m.name));
  const data = modules.filter(m => /db|model|store|query|data/i.test(m.name));
  const util = modules.filter(m => !auth.length && !api.length && !ui.length && !data.length);

  return [
    { domain: 'Authentication', modules: auth },
    { domain: 'API Layer', modules: api },
    { domain: 'UI Layer', modules: ui },
    { domain: 'Data Layer', modules: data },
    { domain: 'Utilities', modules: util },
  ].filter(d => d.modules.length > 0);
}

function generateOwnershipRules(domains) {
  return domains.map(d => ({
    domain: d.domain,
    teams: suggestTeamForDomain(d.domain),
    modules: d.modules.map(m => m.name),
    health: d.modules[0]?.health ?? 'unknown',
  }));
}

function suggestTeamForDomain(domain) {
  const teamMap = {
    'Authentication': ['security-team', 'backend-team'],
    'API Layer': ['backend-team', 'platform-team'],
    'UI Layer': ['frontend-team', 'design-team'],
    'Data Layer': ['backend-team', 'data-team'],
    'Utilities': ['platform-team'],
  };
  return teamMap[domain] ?? ['platform-team'];
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function computeImpactScore(suggestion, graph) {
  const weights = { high: 3, medium: 2, low: 1 };
  const base = weights[suggestion.severity] ?? 1;

  // Boost based on file impact
  let multiplier = 1;
  if (suggestion.file) {
    const node = graph.nodes.get(suggestion.file);
    if (node) {
      multiplier += (node.incoming + node.outgoing) * 0.05;
    }
  }

  return parseFloat((base * multiplier).toFixed(2));
}

function suggestFileSplit(content, totalLines) {
  // Suggest splitting by function or class groups
  const classes = content.match(/class\s+\w+/g) || [];
  if (classes.length > 2) {
    return classes.map(c => `extract class ${c.replace('class ', '')} to separate file`);
  }

  const mid = Math.floor(totalLines / 2);
  return [
    `split at line ${mid} — move helper functions to utils/`,
    `extract business logic to services/`,
    `move types/interfaces to types/`,
  ];
}

function suggestCycleBreak(cycle, graph) {
  // Find the edge with least dependents to break
  const candidates = cycle.map((node, i) => {
    const next = cycle[(i + 1) % cycle.length];
    const nodeData = graph.nodes.get(node);
    return { from: node, to: next, dependents: nodeData?.fanIn.size ?? 0 };
  });

  candidates.sort((a, b) => a.dependents - b.dependents);
  const best = candidates[0];

  return {
    breakEdge: [best.from, best.to],
    rationale: `Breaking ${basename(best.from)} → ${basename(best.to)} affects fewest dependents (${best.dependents})`,
    approach: `Extract shared interface or use event-driven communication instead of direct import`,
  };
}

function summarizeSuggestions(suggestions) {
  const byType = {};
  for (const s of suggestions) {
    if (!byType[s.type]) byType[s.type] = { count: 0, high: 0, medium: 0, low: 0 };
    byType[s.type].count++;
    byType[s.type][s.severity] = (byType[s.type][s.severity] ?? 0) + 1;
  }

  const highPriority = suggestions.filter(s => s.severity === 'high').length;
  const mediumPriority = suggestions.filter(s => s.severity === 'medium').length;

  return {
    total: suggestions.length,
    byType,
    highPriority,
    mediumPriority,
    overallHealth: highPriority > 5 ? 'poor' : highPriority > 0 ? 'fair' : 'good',
  };
}

// ------------------------------------------------------------------
// Persistence
// ------------------------------------------------------------------

export function saveAnalysis(db, analysis) {
  try {
    const id = `ana_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO analyses (id, project_path, type, score, suggestions, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      analysis.projectPath,
      'full',
      analysis.summary?.overallHealth === 'good' ? 1.0 : analysis.summary?.overallHealth === 'fair' ? 0.6 : 0.2,
      JSON.stringify(analysis.suggestions),
      new Date().toISOString()
    );
    return { success: true, id };
  } catch (err) {
    console.warn('[ai-refactor-engine] saveAnalysis error:', err.message);
    return { success: false, error: err.message };
  }
}

export function getAnalysisHistory(db, projectPath, limit = 10) {
  try {
    const rows = db.prepare(
      'SELECT * FROM analyses WHERE project_path = ? ORDER BY created_at DESC LIMIT ?'
    ).all(projectPath, limit);
    return rows.map(r => ({ ...r, suggestions: tryParseJSON(r.suggestions) }));
  } catch { return []; }
}

function tryParseJSON(val) {
  try { return JSON.parse(val); } catch { return val; }
}

export default {
  openRefactorDB,
  analyzeRefactor,
  proposeMonorepoMerge,
  proposeMicroserviceExtraction,
  analyzeTeamStructure,
  saveAnalysis,
  getAnalysisHistory,
};
