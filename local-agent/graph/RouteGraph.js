/**
 * RouteGraph - Build route dependency graph
 */
const fs = require('fs');
const path = require('path');

class RouteGraph {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.routes = [];
  }

  detectRoutes() {
    this.routes = [];
    this.detectNextRoutes();
    this.detectReactRouterRoutes();
    this.detectExpressRoutes();
    return this.routes;
  }

  detectNextRoutes() {
    const pagesDir = path.join(this.projectRoot, 'pages');
    const appDir = path.join(this.projectRoot, 'app');
    if (fs.existsSync(pagesDir)) {
      this.scanDir(pagesDir, 'pages', 'next');
    }
    if (fs.existsSync(appDir)) {
      this.scanDir(appDir, 'app', 'next');
    }
  }

  detectReactRouterRoutes() {
    const srcDir = path.join(this.projectRoot, 'src');
    if (fs.existsSync(srcDir)) {
      const search = (dir) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          entries.forEach(entry => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) search(fullPath);
            else if (entry.name.match(/\\.(js|jsx|ts|tsx)$/)) {
              const content = fs.readFileSync(fullPath, 'utf8');
              if (/Routes?|Route|useRoutes|BrowserRouter|HashRouter/.test(content)) {
                this.routes.push({ path: fullPath, type: 'react-router', framework: 'react' });
              }
            }
          });
        } catch {}
      };
      search(srcDir);
    }
  }

  detectExpressRoutes() {
    const routesDir = path.join(this.projectRoot, 'routes');
    if (fs.existsSync(routesDir)) {
      this.scanDir(routesDir, 'routes', 'express');
    }
    const apiDir = path.join(this.projectRoot, 'api');
    if (fs.existsSync(apiDir)) {
      this.scanDir(apiDir, 'api', 'express');
    }
  }

  scanDir(dir, base, framework) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanDir(fullPath, base, framework);
        } else if (entry.name.match(/\\.(js|jsx|ts|tsx)$/)) {
          const routePath = this.getRoutePath(fullPath, dir, base);
          this.routes.push({ path: fullPath, route: routePath, type: 'file', framework });
        }
      });
    } catch {}
  }

  getRoutePath(filePath, dir, base) {
    const rel = path.relative(dir, filePath);
    const withoutExt = rel.replace(/\\.(js|jsx|ts|tsx)$/, '');
    const parts = withoutExt.split(path.sep);
    if (parts[parts.length - 1] === 'index') parts.pop();
    return '/' + parts.join('/');
  }

  buildRouteGraph() {
    this.detectRoutes();
    const graph = { nodes: [], edges: [] };
    this.routes.forEach(route => {
      graph.nodes.push({ id: route.route || route.path, ...route });
      const content = fs.readFileSync(route.path, 'utf8');
      const deps = this.extractRouteDeps(content);
      deps.forEach(dep => {
        graph.edges.push({ from: route.route || route.path, to: dep });
      });
    });
    return graph;
  }

  extractRouteDeps(content) {
    const deps = [];
    const patterns = [
      /import\\s+.*\\s+from\\s+['\"]([^'\"]+)['\"]/g,
      /require\\s*\\(['\"]([^'\"]+)['\"]\\s*\\)/g
    ];
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1].includes('component') || match[1].includes('handler')) {
          deps.push(match[1]);
        }
      }
    });
    return deps;
  }

  getRouteFlow() {
    return this.buildRouteGraph();
  }

  findDeadRoutes() {
    const graph = this.buildRouteGraph();
    const entryPoints = graph.nodes.filter(n => !graph.edges.some(e => e.to === (n.route || n.path)));
    return entryPoints;
  }

  getRouteParams(route) {
    const paramPattern = /\[:([^\]]+)\]|\{([^}]+)\}/g;
    const params = [];
    let match;
    while ((match = paramPattern.exec(route)) !== null) {
      params.push(match[1] || match[2]);
    }
    return params;
  }

  exportRouteFlow() {
    return { routes: this.routes, graph: this.buildRouteGraph() };
  }
}

module.exports = { RouteGraph };
