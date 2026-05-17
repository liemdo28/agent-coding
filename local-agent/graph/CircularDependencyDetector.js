/**
 * CircularDependencyDetector - Detect circular dependencies
 */
const { DependencyGraphBuilder } = require('./DependencyGraphBuilder');

class CircularDependencyDetector {
  constructor(graphBuilder = null) {
    this.graphBuilder = graphBuilder || new DependencyGraphBuilder();
    this.cycles = [];
  }

  detectCircular() {
    const graph = this.graphBuilder.buildGraph();
    const nodes = graph.nodes;
    const edges = graph.edges;
    this.cycles = [];

    const adjacency = {};
    nodes.forEach(n => adjacency[n.id] = []);
    edges.forEach(e => {
      if (adjacency[e.source]) adjacency[e.source].push(e.target);
    });

    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacency[nodeId] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const result = dfs(neighbor);
          if (result) this.cycles.push(result);
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          this.cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }

      path.pop();
      recStack.delete(nodeId);
      return null;
    };

    nodes.forEach(n => {
      if (!visited.has(n.id)) dfs(n.id);
    });

    return this.cycles;
  }

  getCycle(node) {
    return this.cycles.filter(c => c.includes(node));
  }

  getCyclePath(cycle) {
    if (!cycle || cycle.length === 0) return '';
    return cycle.join(' -> ');
  }

  suggestFixes(cycle) {
    if (!cycle || cycle.length === 0) return [];

    const suggestions = [];
    const last = cycle[cycle.length - 1];
    const first = cycle[0];

    suggestions.push({
      type: 'extract',
      message: `Extract shared dependency from ${last} to a separate module`,
      modules: [last]
    });

    suggestions.push({
      type: 'dependency_inversion',
      message: `Consider using dependency injection instead of direct import`,
      modules: cycle
    });

    suggestions.push({
      type: 'interface',
      message: 'Create an interface/abstraction layer to break the cycle',
      modules: [last, first]
    });

    return suggestions;
  }

  exportCircularDeps() {
    return {
      cycles: this.cycles.map(c => ({
        path: this.getCyclePath(c),
        modules: c,
        suggestions: this.suggestFixes(c)
      })),
      totalCycles: this.cycles.length,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = { CircularDependencyDetector };