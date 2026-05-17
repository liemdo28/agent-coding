// knowledge-graph/GraphTraversal.js — graph traversal algorithms
// Phase 18: BFS, DFS, shortest path (Dijkstra-lite), connected components, cycle detection

import { findEdges } from './GraphEdgeStore.js';
import { getNode } from './GraphNodeStore.js';

/**
 * Breadth-first search from a start node.
 * @param {object} graph  — { nodeStore, edgeStore }
 * @param {string} startId
 * @param {number} maxDepth
 * @returns {object[]} visited nodes in BFS order
 */
export function bfs(graph, startId, maxDepth = 5) {
  const visited = new Map(); // id → depth
  const queue   = [{ id: startId, depth: 0 }];
  const result  = [];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (visited.has(id) || depth > maxDepth) continue;
    visited.set(id, depth);

    const node = getNode(graph.nodeStore, id);
    if (node) result.push({ ...node, _depth: depth });

    const edges = findEdges(graph.edgeStore, { sourceId: id });
    for (const e of edges) {
      if (!visited.has(e.targetId)) queue.push({ id: e.targetId, depth: depth + 1 });
    }
  }

  return result;
}

/**
 * Depth-first search from a start node.
 * @param {object} graph
 * @param {string} startId
 * @param {number} maxDepth
 * @returns {object[]} visited nodes in DFS order
 */
export function dfs(graph, startId, maxDepth = 5) {
  const visited = new Set();
  const result  = [];

  function traverse(id, depth) {
    if (visited.has(id) || depth > maxDepth) return;
    visited.add(id);
    const node = getNode(graph.nodeStore, id);
    if (node) result.push({ ...node, _depth: depth });

    const edges = findEdges(graph.edgeStore, { sourceId: id });
    for (const e of edges) traverse(e.targetId, depth + 1);
  }

  traverse(startId, 0);
  return result;
}

/**
 * Find shortest path using Dijkstra-lite (edge weights used).
 * @param {object} graph
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ path: string[], totalWeight: number }}
 */
export function findShortestPath(graph, fromId, toId) {
  const dist    = { [fromId]: 0 };
  const prev    = {};
  const visited = new Set();
  const queue   = new Set([fromId]);

  while (queue.size > 0) {
    // Pick unvisited with smallest distance
    let current = null;
    let minDist = Infinity;
    for (const id of queue) {
      if ((dist[id] ?? Infinity) < minDist) { minDist = dist[id]; current = id; }
    }

    if (!current || current === toId) break;
    queue.delete(current);
    visited.add(current);

    const edges = findEdges(graph.edgeStore, { sourceId: current });
    for (const e of edges) {
      if (visited.has(e.targetId)) continue;
      const newDist = (dist[current] ?? Infinity) + (e.weight ?? 1);
      if (newDist < (dist[e.targetId] ?? Infinity)) {
        dist[e.targetId] = newDist;
        prev[e.targetId] = current;
        queue.add(e.targetId);
      }
    }
  }

  if (!prev[toId] && fromId !== toId) return { path: [], totalWeight: Infinity };

  const path = [];
  let cur    = toId;
  while (cur) { path.unshift(cur); cur = prev[cur]; }

  return { path, totalWeight: dist[toId] ?? Infinity };
}

/**
 * Get all connected components via BFS from all unvisited nodes.
 * @param {object} graph
 * @param {string[]} allNodeIds
 * @returns {string[][]} array of components (each is array of node ids)
 */
export function getConnectedComponents(graph, allNodeIds = []) {
  const visited    = new Set();
  const components = [];

  for (const startId of allNodeIds) {
    if (visited.has(startId)) continue;
    const component = bfs(graph, startId, 100).map(n => n.id);
    for (const id of component) visited.add(id);
    if (component.length > 0) components.push(component);
  }

  return components;
}

/**
 * Detect cycles in the graph using DFS with a recursion stack.
 * @param {object} graph
 * @param {string[]} allNodeIds
 * @returns {boolean}
 */
export function detectCycles(graph, allNodeIds = []) {
  const visited = new Set();
  const stack   = new Set();

  function hasCycle(id) {
    visited.add(id);
    stack.add(id);
    const edges = findEdges(graph.edgeStore, { sourceId: id });
    for (const e of edges) {
      if (!visited.has(e.targetId)) {
        if (hasCycle(e.targetId)) return true;
      } else if (stack.has(e.targetId)) {
        return true;
      }
    }
    stack.delete(id);
    return false;
  }

  for (const id of allNodeIds) {
    if (!visited.has(id) && hasCycle(id)) return true;
  }
  return false;
}
