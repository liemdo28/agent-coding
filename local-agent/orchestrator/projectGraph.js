// orchestrator/projectGraph.js — dependency graph between workspace projects
// Phase 12: scans package.json files, finds cross-project references

import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

/**
 * Build a project dependency graph for a workspace.
 * @param {string} workspaceRoot
 * @returns {{ nodes: Map<string,object>, edges: Map<string,string[]>, cycles: string[][] }}
 */
export function buildProjectGraph(workspaceRoot) {
  const nodes = new Map();
  const edges = new Map(); // projectName → [dep project names]

  // Discover all package.json files (one level deep + root)
  const pkgFiles = findPackageJsons(workspaceRoot);

  for (const pkgPath of pkgFiles) {
    try {
      const pkg  = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const name = pkg.name ?? basename(join(pkgPath, '..'));
      nodes.set(name, {
        name,
        version:    pkg.version ?? '0.0.0',
        pkgPath,
        deps:       Object.keys({ ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} }),
        scripts:    Object.keys(pkg.scripts ?? {}),
      });
      edges.set(name, []);
    } catch { /* skip malformed */ }
  }

  // Link cross-project edges
  const projectNames = new Set(nodes.keys());
  for (const [name, node] of nodes) {
    const crossDeps = node.deps.filter(d => projectNames.has(d));
    edges.set(name, crossDeps);
  }

  const cycles = detectCircularDeps({ nodes, edges, cycles: [] });
  return { nodes, edges, cycles };
}

/** Get direct dependencies of a project within the workspace graph. */
export function getProjectDependencies(graph, projectName) {
  return graph.edges.get(projectName) ?? [];
}

/** Get projects that depend on this project (reverse edges). */
export function getProjectDependents(graph, projectName) {
  const dependents = [];
  for (const [name, deps] of graph.edges) {
    if (deps.includes(projectName)) dependents.push(name);
  }
  return dependents;
}

/**
 * Detect circular dependencies using DFS.
 * @param {{ nodes: Map, edges: Map }} graph
 * @returns {string[][]} list of cycles
 */
export function detectCircularDeps(graph) {
  const visited = new Set();
  const stack   = new Set();
  const cycles  = [];

  function dfs(node, path) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const dep of (graph.edges.get(node) ?? [])) {
      dfs(dep, [...path]);
    }
    stack.delete(node);
  }

  for (const name of graph.nodes.keys()) dfs(name, []);
  return cycles;
}

/** Return summary stats about the graph. */
export function getGraphStats(graph) {
  const totalNodes = graph.nodes.size;
  const totalEdges = [...graph.edges.values()].reduce((s, deps) => s + deps.length, 0);
  const isolated   = [...graph.nodes.keys()].filter(n => (graph.edges.get(n) ?? []).length === 0);
  return { totalNodes, totalEdges, cycles: graph.cycles.length, isolated };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findPackageJsons(root, maxDepth = 3) {
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (['node_modules', '.git', 'dist', 'build'].includes(name)) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) walk(full, depth + 1);
        else if (name === 'package.json') results.push(full);
      } catch { /* skip */ }
    }
  }
  walk(root, 0);
  return results;
}
