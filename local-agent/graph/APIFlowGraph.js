/**
 * APIFlowGraph - Build API call graph
 */
const fs = require('fs');
const path = require('path');

class APIFlowGraph {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.apis = [];
    this.calls = [];
  }

  detectAPIs() {
    this.apis = [];
    const patterns = [
      { dir: 'api', ext: 'js' },
      { dir: 'routes', ext: 'js' },
      { dir: 'endpoints', ext: 'js' }
    ];

    patterns.forEach(({ dir, ext }) => {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        this.scanDir(dirPath, dir);
      }
    });

    return this.apis;
  }

  scanDir(dir, base) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanDir(fullPath, base);
        } else if (entry.name.endsWith(`.${this.ext || 'js'}`)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const methods = this.extractMethods(content);
          methods.forEach(method => {
            this.apis.push({
              path: fullPath,
              method,
              base
            });
          });
        }
      });
    } catch {}
  }

  extractMethods(content) {
    const methods = [];
    const methodPatterns = [
      /app\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/gi,
      /router\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/gi,
      /export\s+(?:async\s+)?function\s+(\w+)/g,
      /export\s+(?:async\s+)?(?:const|let|var)\s+(\w+)\s*=/g
    ];

    methodPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        methods.push({
          type: match[1] ? 'http' : 'function',
          name: match[2] || match[1]
        });
      }
    });

    return methods;
  }

  detectAPICalls() {
    this.calls = [];
    const srcDir = path.join(this.projectRoot, 'src');
    if (!fs.existsSync(srcDir)) return this.calls;

    const search = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) search(fullPath);
          else if (entry.name.match(/\.(js|jsx|ts|tsx)$/)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const calls = this.extractAPICalls(content, fullPath);
            this.calls.push(...calls);
          }
        });
      } catch {}
    };

    search(srcDir);
    return this.calls;
  }

  extractAPICalls(content, filePath) {
    const calls = [];
    const patterns = [
      /fetch\s*\(\s*['"]([^'"]+)['"]/g,
      /axios\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
      /\$\.((?:get|post|put|delete|patch))\s*\(\s*['"]([^'"]+)['"]/g,
      /api\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        calls.push({
          file: filePath,
          call: match[0],
          endpoint: match[2] || match[1]
        });
      }
    });

    return calls;
  }

  buildAPIGraph() {
    const apis = this.detectAPIs();
    const calls = this.detectAPICalls();

    return {
      apis: apis.map(a => ({ id: a.path, ...a })),
      consumers: calls.map(c => ({ id: c.file, ...c })),
      connections: calls.map(c => ({
        from: c.file,
        to: c.endpoint
      }))
    };
  }

  findUnusedAPIs() {
    const graph = this.buildAPIGraph();
    const usedEndpoints = new Set(graph.connections.map(c => c.to));

    return graph.apis.filter(api => !usedEndpoints.has(api.path));
  }

  getAPIConsumers(api) {
    const graph = this.buildAPIGraph();
    return graph.connections
      .filter(c => c.to === api)
      .map(c => c.from);
  }

  exportAPIMap() {
    return this.buildAPIGraph();
  }
}

module.exports = { APIFlowGraph };