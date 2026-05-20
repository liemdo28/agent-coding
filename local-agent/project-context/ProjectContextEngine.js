/**
 * Project Context Engine
 * When user references a project (rawwwebsite, dashboard, AI project),
 * this engine locates the repo, reads README, package.json, src/, docs/
 * and builds comprehensive context for intelligent answers.
 */

import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import fg from 'fast-glob';

const PROJECT_ALIASES = {
  'rawwwebsite': ['rawwwebsite', 'raw-website', 'raw_website'],
  'dashboard': ['dashboard', 'dash', 'dash-bakudanramen', 'bakudanramen'],
  'ai': ['ai-project', 'agent-coding', 'local-agent'],
};

export class ProjectContextEngine {
  constructor() {
    this.cache = new Map();
  }

  resolveProjectPath(alias) {
    const cleanAlias = alias.toLowerCase().trim();
    // 1. Try to read from global-index.json
    const indexPath = '/Users/liemdo/.super-agent-ai/index/global-index.json';
    if (existsSync(indexPath)) {
      try {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));
        if (index && Array.isArray(index.projects)) {
          // Resolve all valid aliases for this key
          const aliases = (PROJECT_ALIASES[cleanAlias] || [cleanAlias]).map(a => a.toLowerCase());
          
          // First, exact match on name
          let found = index.projects.find(p => aliases.includes(p.name.toLowerCase()));
          if (found) return found.path;

          // Second, check path ending with alias
          found = index.projects.find(p => aliases.some(a => p.path.toLowerCase().endsWith('/' + a) || p.path.toLowerCase().endsWith('\\' + a)));
          if (found) return found.path;
        }
      } catch (e) {
        console.error('[ProjectContextEngine] Failed reading global index:', e.message);
      }
    }

    // 2. Fall back to manual filesystem search
    const searchRoots = ['/Users/liemdo/Projects', '/Users/liemdo/Documents', '/Users/liemdo/Desktop', '/Users/liemdo'];
    for (const root of searchRoots) {
      if (!existsSync(root)) continue;
      const exact = join(root, alias);
      if (existsSync(exact)) return exact;
      const aliases = PROJECT_ALIASES[cleanAlias] || [alias];
      for (const a of aliases) {
        const p = join(root, a);
        if (existsSync(p)) return p;
        try {
          const matches = fg.globSync([`**/${a}/**`], { cwd: root, onlyDirectories: true, deep: 1 });
          if (matches.length) return join(root, matches[0]);
        } catch {}
      }
    }
    return null;
  }

  async buildContext(projectAlias, options = {}) {
    const start = Date.now();
    const ctx = { alias: projectAlias, found: false, buildTime: 0, error: null };

    try {
      const path = this.resolveProjectPath(projectAlias);
      if (!path) { ctx.error = `Project not found: ${projectAlias}`; return ctx; }
      ctx.resolvedPath = path;
      ctx.found = true;

      const cacheKey = path;
      if (this.cache.has(cacheKey) && !options.forceRefresh) return this.cache.get(cacheKey);

      ctx.readme = this._readme(path);
      ctx.packageJson = this._pkg(path);
      ctx.language = this._detectLang(path);
      ctx.techStack = this._techStack(path, ctx.packageJson);
      ctx.features = this._features(ctx.readme, ctx.packageJson);
      ctx.structure = this._structure(path);
      ctx.srcFiles = this._srcFiles(path);
      ctx.docsFiles = this._docsFiles(path);
      ctx.configFiles = this._configFiles(path);
      ctx.dependencies = Object.keys(ctx.packageJson?.dependencies || {});
      ctx.devDependencies = Object.keys(ctx.packageJson?.devDependencies || {});
      ctx.scripts = Object.keys(ctx.packageJson?.scripts || {});
      ctx.buildTime = Date.now() - start;
      this.cache.set(cacheKey, ctx);
    } catch (err) {
      ctx.error = err.message;
      ctx.buildTime = Date.now() - start;
    }
    return ctx;
  }

  _readme(dir) {
    const names = ['README.md', 'README.txt', 'readme.md'];
    for (const n of names) {
      const p = join(dir, n);
      if (existsSync(p)) {
        try {
          const c = readFileSync(p, 'utf8');
          return { path: p, name: n, preview: c.substring(0, 800).replace(/[#*`]/g, '') };
        } catch {}
      }
    }
    return null;
  }

  _pkg(dir) {
    const p = join(dir, 'package.json');
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, 'utf8')); } catch {}
    }
    return null;
  }

  _detectLang(dir) {
    const exts = { '.js': 'JavaScript', '.ts': 'TypeScript', '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby' };
    try {
      const files = fg.globSync(['**/*'], { cwd: dir, onlyFiles: true, ignore: ['node_modules/**', '.git/**'] });
      const counts = {};
      for (const f of files.slice(0, 1000)) {
        const ext = f.substring(f.lastIndexOf('.'));
        if (exts[ext]) counts[ext] = (counts[ext] || 0) + 1;
      }
      let max = 0, lang = 'Unknown';
      for (const [e, c] of Object.entries(counts)) { if (c > max) { max = c; lang = exts[e]; } }
      return lang;
    } catch { return 'Unknown'; }
  }

  _techStack(dir, pkg) {
    const stack = [];
    if (pkg) {
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const map = { 'react': 'React', 'next': 'Next.js', 'vue': 'Vue', 'express': 'Express', 'fastify': 'Fastify', 'django': 'Django', 'flask': 'Flask', 'vite': 'Vite', 'tailwindcss': 'Tailwind CSS', 'prisma': 'Prisma' };
      for (const [k, v] of Object.entries(map)) { if (k in deps && !stack.includes(v)) stack.push(v); }
    }
    if (existsSync(join(dir, 'vite.config.js'))) stack.push('Vite');
    if (existsSync(join(dir, 'docker-compose.yml'))) stack.push('Docker');
    return stack;
  }

  _features(readme, pkg) {
    const feats = [];
    if (readme?.preview) {
      const bullets = readme.preview.match(/^[-*]\s+(.+)/gm);
      if (bullets) feats.push(...bullets.map(b => b.replace(/^[-*]\s+/, '').trim()).slice(0, 10));
    }
    if (pkg?.description) feats.unshift(pkg.description);
    if (pkg?.keywords) feats.push(...pkg.keywords.slice(0, 5));
    return [...new Set(feats)].slice(0, 15);
  }

  _structure(dir, depth = 0) {
    if (depth > 2) return null;
    const { readdirSync, statSync } = require('fs');
    try {
      const entries = readdirSync(dir).filter(e => !e.startsWith('.') && !['node_modules', 'dist', 'build'].includes(e)).slice(0, 20);
      return entries.map(e => {
        const p = join(dir, e);
        try {
          const s = statSync(p);
          return { name: e, type: s.isDirectory() ? 'dir' : 'file' };
        } catch { return { name: e, type: 'file' }; }
      });
    } catch { return []; }
  }

  _srcFiles(dir) {
    try { return fg.globSync(['src/**/*', 'lib/**/*'], { cwd: dir, onlyFiles: true }).slice(0, 30); } catch { return []; }
  }

  _docsFiles(dir) {
    try { return fg.globSync(['docs/**/*', '*.md'], { cwd: dir, onlyFiles: true }).slice(0, 20); } catch { return []; }
  }

  _configFiles(dir) {
    const names = ['package.json', 'tsconfig.json', 'vite.config.js', 'tailwind.config.js', 'docker-compose.yml'];
    return names.filter(n => existsSync(join(dir, n)));
  }

  classifyIntent(text) {
    const t = text.toLowerCase();
    if (t.includes('post') || t.includes('linkedin') || t.includes('marketing')) return 'marketing';
    if (t.includes('feature') || t.includes('capability')) return 'feature';
    if (t.includes('tech') || t.includes('stack') || t.includes('architecture')) return 'technical';
    if (t.includes('status') || t.includes('health')) return 'status';
    return 'general';
  }

  generateResponse(alias, intent) {
    const ctx = this.buildContext(alias);
    if (!ctx.found) return { type: 'not_found', message: `Project "${alias}" not found.`, suggestions: ['Check project name', 'Run global indexer'] };

    const name = ctx.packageJson?.name || basename(ctx.resolvedPath);
    const desc = ctx.packageJson?.description || ctx.readme?.preview || '';

    if (intent === 'marketing') {
      return { type: 'marketing', project: name, tagline: desc, keyFeatures: ctx.features.slice(0, 5), techHighlights: ctx.techStack.slice(0, 3) };
    }
    if (intent === 'feature') return { type: 'features', project: name, features: ctx.features, techStack: ctx.techStack };
    if (intent === 'technical') return { type: 'technical', project: name, language: ctx.language, techStack: ctx.techStack, dependencies: ctx.dependencies, scripts: ctx.scripts };
    if (intent === 'status') return { type: 'status', project: name, version: ctx.packageJson?.version || '0.0.0', path: ctx.resolvedPath, hasReadme: !!ctx.readme, language: ctx.language, dependencyCount: ctx.dependencies.length };

    return { type: 'overview', project: name, description: desc, techStack: ctx.techStack, features: ctx.features.slice(0, 5), path: ctx.resolvedPath };
  }

  clearCache() { this.cache.clear(); }
}

export default ProjectContextEngine;