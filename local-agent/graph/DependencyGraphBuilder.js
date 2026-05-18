/**
 * DependencyGraphBuilder - Build project dependency graph
 */
const fs = require('fs');
const path = require('path');

class DependencyGraphBuilder {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.nodes = new Map();
    this.edges = [];
  }

  buildGraph() {
    this.nodes.clear();
    this.edges = [];
    const sourceFiles = this.findSourceFiles();
    sourceFiles.forEach(file => {
      const deps = this.extractDependencies(file);
      this.addNode(file, 'source', { extensions: path.extname(file) });
      deps.forEach(dep => {
        this.addNode(dep, 'dependency', { isExternal: this.isExternal(dep) });
        this.addEdge(file, dep, 'import');
      });
    });
    return this.getGraph();
  }

  findSourceFiles() {
    const patterns = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue'];
    const files = [];
    const search = (dir) => {
      if (dir.includes('node_modules') || dir.includes('.git')) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) search(fullPath);
          else if (patterns.some(p => entry.name.match(p.replace('**/*', '.*')))) {
            files.push(fullPath);
          }
        });
      } catch {}
    };
    search(this.projectRoot);
    return files;
  }

  extractDependencies(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const deps = [];
      const patterns = [
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g
      ];
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const dep = match[1];
          if (!dep.startsWith('.') && !dep.startsWith('@')) deps.push(dep);
          else if (dep.startsWith('.')) {
            const resolved = path.resolve(path.dirname(filePath), dep);
            deps.push(resolved);
          }
        }
      });
      return [...new Set(deps)];
    } catch { return []; }
  }

  isExternal(dep) {
    return !dep.startsWith('.') && !dep.startsWith('/');
  }

  addNode(file, type, metadata = {}) {
    if (!this.nodes.has(file)) {
      this.nodes.set(file, { id: file, type, metadata, incoming: 0, outgoing: 0 });
    }
    return this.nodes.get(file);
  }

  addEdge(from, to, type) {
    const exists = this.edges.some(e => e.source === from && e.target === to);
    if (!exists) {
      this.edges.push({ source: from, target: to, type });
      if (this.nodes.has(from)) this.nodes.get(from).outgoing++;
      if (this.nodes.has(to)) this.nodes.get(to).incoming++;
    }
  }

  getGraph() {
    return { nodes: Array.from(this.nodes.values()), edges: this.edges };
  }

  findDependencies(file) {
    return this.edges.filter(e => e.source === file).map(e => e.target);
  }

  findDependents(file) {
    return this.edges.filter(e => e.target === file).map(e => e.source);
  }

  detectCircular() {
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();

    const dfs = (node, path) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const deps = this.findDependencies(node);
      for (const dep of deps) {
        if (!visited.has(dep)) {
          const result = dfs(dep, [...path]);
          if (result) cycles.push(result);
        } else if (recStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          cycles.push([...path.slice(cycleStart), dep]);
        }
      }
      recStack.delete(node);
      return null;
    };

    this.nodes.forEach((node, file) => {
      if (!visited.has(file)) dfs(file, []);
    });

    return cycles;
  }

  exportGraph() {
    return this.getGraph();
  }
}

module.exports = { DependencyGraphBuilder };