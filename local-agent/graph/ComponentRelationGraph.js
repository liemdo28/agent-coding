/**
 * ComponentRelationGraph - Build component relationship graph
 */
const fs = require('fs');
const path = require('path');

class ComponentRelationGraph {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.components = [];
    this.relations = [];
  }

  detectComponents() {
    this.components = [];
    const patterns = [
      { dir: 'components', ext: ['jsx', 'tsx', 'vue'] },
      { dir: 'src/components', ext: ['jsx', 'tsx', 'vue'] },
      { dir: 'ui', ext: ['jsx', 'tsx', 'vue'] }
    ];

    patterns.forEach(({ dir, ext }) => {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        this.scanDir(dirPath, dir);
      }
    });

    return this.components;
  }

  scanDir(dir, base) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          this.scanDir(fullPath, base);
        } else if (entry.name.match(/\.(jsx|tsx|vue)$/)) {
          const name = entry.name.replace(/\.(jsx|tsx|vue)$/, '');
          this.components.push({
            name,
            path: fullPath,
            directory: base
          });
        }
      });
    } catch {}
  }

  detectComponentDeps() {
    this.relations = [];
    this.components.forEach(comp => {
      try {
        const content = fs.readFileSync(comp.path, 'utf8');
        const deps = this.extractImports(content);
        deps.forEach(dep => {
          const target = this.components.find(c => c.name === dep || c.path.endsWith(dep));
          if (target && target.path !== comp.path) {
            this.relations.push({
              from: comp.path,
              to: target.path,
              fromName: comp.name,
              toName: target.name
            });
          }
        });
      } catch {}
    });
    return this.relations;
  }

  extractImports(content) {
    const imports = [];
    const patterns = [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const imp = match[1];
        if (imp.includes('component') || imp.includes('/components/')) {
          imports.push(imp.split('/').pop().replace(/\.(js|jsx|tsx|vue)$/, ''));
        }
      }
    });

    return imports;
  }

  buildComponentGraph() {
    this.detectComponents();
    this.detectComponentDeps();

    return {
      nodes: this.components.map(c => ({
        id: c.path,
        name: c.name,
        directory: c.directory
      })),
      edges: this.relations.map(r => ({
        source: r.from,
        target: r.to,
        sourceName: r.fromName,
        targetName: r.toName
      }))
    };
  }

  findCoupling(file) {
    const relations = this.relations.filter(r => r.from === file || r.to === file);
    return relations.length;
  }

  detectSharedState() {
    const hooks = ['useState', 'useReducer', 'useContext', 'Redux', 'Zustand', 'Jotai'];
    const statePatterns = {};

    this.components.forEach(comp => {
      try {
        const content = fs.readFileSync(comp.path, 'utf8');
        hooks.forEach(hook => {
          if (content.includes(hook)) {
            if (!statePatterns[hook]) statePatterns[hook] = [];
            statePatterns[hook].push(comp.name);
          }
        });
      } catch {}
    });

    return statePatterns;
  }

  exportComponentGraph() {
    return this.buildComponentGraph();
  }
}

module.exports = { ComponentRelationGraph };