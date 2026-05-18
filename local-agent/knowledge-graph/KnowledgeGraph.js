// knowledge-graph/KnowledgeGraph.js — main knowledge graph facade
// Phase 18: combines node and edge stores into a unified graph API

import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Import node/edge store functions
import { openNodeStore, addNode as addNodeRaw, getNode, findNodes, getNodeStats } from './GraphNodeStore.js';
import { openEdgeStore, addEdge as addEdgeRaw, findEdges, getEdge, deleteEdge } from './GraphEdgeStore.js';

const require  = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DEFAULT_DB = join(homedir(), '.local-agent', 'knowledge-graph.db');

/**
 * Open the knowledge graph (both node + edge tables in one DB file).
 * @param {string} dbPath
 * @returns {{ db, nodeStore, edgeStore }}
 */
export function openKnowledgeGraph(dbPath = DEFAULT_DB) {
  const nodeStore = openNodeStore(dbPath);
  // Edge store reuses the same DB file/connection
  openEdgeStore(dbPath); // ensures edge table exists
  return { db: nodeStore, nodeStore, edgeStore: nodeStore }; // same DB handle
}

/** Add a node to the graph. */
export function addNode(graph, node) {
  return addNodeRaw(graph.nodeStore, node);
}

/** Add an edge between two nodes. */
export function addEdge(graph, edge) {
  return addEdgeRaw(graph.edgeStore, edge);
}

/**
 * Create a typed edge between two existing nodes.
 * @param {string} sourceId
 * @param {string} relation
 * @param {string} targetId
 * @param {number} weight
 */
export function link(graph, sourceId, relation, targetId, weight = 1.0) {
  return addEdge(graph, { sourceId, targetId, relation, weight });
}

/**
 * Get all neighbors of a node up to a given depth.
 * @param {string} nodeId
 * @param {number} depth  max traversal depth
 * @returns {object[]}
 */
export function getNeighbors(graph, nodeId, depth = 1) {
  const visited = new Set([nodeId]);
  const result  = [];

  function expand(ids, d) {
    if (d === 0 || ids.length === 0) return;
    const nextIds = [];
    for (const id of ids) {
      const outEdges = findEdges(graph.edgeStore, { sourceId: id });
      const inEdges  = findEdges(graph.edgeStore, { targetId: id });
      for (const e of [...outEdges, ...inEdges]) {
        const nId = e.sourceId === id ? e.targetId : e.sourceId;
        if (!visited.has(nId)) {
          visited.add(nId);
          const node = getNode(graph.nodeStore, nId);
          if (node) { result.push({ ...node, _edge: e }); nextIds.push(nId); }
        }
      }
    }
    expand(nextIds, d - 1);
  }

  expand([nodeId], depth);
  return result;
}

/**
 * Find shortest path between two nodes using BFS.
 * @returns {string[]}  ordered list of node ids, empty if no path
 */
export function findPath(graph, fromId, toId) {
  const queue   = [[fromId]];
  const visited = new Set([fromId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    if (last === toId) return path;

    const edges = findEdges(graph.edgeStore, { sourceId: last });
    for (const e of edges) {
      if (!visited.has(e.targetId)) {
        visited.add(e.targetId);
        queue.push([...path, e.targetId]);
      }
    }
  }

  return [];
}

/** Get a subgraph (node + all neighbors) up to depth. */
export function getSubgraph(graph, nodeId, depth = 2) {
  const center    = getNode(graph.nodeStore, nodeId);
  const neighbors = getNeighbors(graph, nodeId, depth);
  return { center, neighbors, nodeCount: 1 + neighbors.length };
}

/** Return combined stats for nodes and edges. */
export function getGraphStats(graph) {
  const nodeStats = getNodeStats(graph.nodeStore);
  const edgeCount = graph.edgeStore.prepare('SELECT COUNT(*) as n FROM graph_edges').get()?.n ?? 0;
  return { ...nodeStats, edgeCount };
}

/** Close the graph DB connection. */
export function closeGraph(graph) {
  try { graph.db?.close(); } catch { /* ignore */ }
}
