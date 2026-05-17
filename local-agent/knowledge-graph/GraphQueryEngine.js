// knowledge-graph/GraphQueryEngine.js — high-level query interface for the knowledge graph
// Phase 18: supports structured queries, error→fix chains, project knowledge, related fixes

import { findEdges } from './GraphEdgeStore.js';
import { findNodes, getNode } from './GraphNodeStore.js';
import { bfs } from './GraphTraversal.js';
import { listMemories } from '../memory/engineeringMemory.js';

/**
 * Run a structured query against the graph.
 * @param {object} graph  — { nodeStore, edgeStore }
 * @param {{ from?: string, via?: string, to?: string, limit?: number }} q
 * @returns {object[]}  matching nodes
 */
export function query(graph, q) {
  try {
    if (q.from && q.via) {
      // Traverse from a node via a specific relation
      const edges = findEdges(graph.edgeStore, { sourceId: q.from, relation: q.via });
      const nodes = edges.map(e => getNode(graph.nodeStore, e.targetId)).filter(Boolean);
      if (q.to) return nodes.filter(n => n.type === q.to);
      return nodes.slice(0, q.limit ?? 50);
    }

    if (q.to) {
      // Find all nodes of a given type
      return findNodes(graph.nodeStore, { type: q.to, limit: q.limit ?? 50 });
    }

    return [];
  } catch (err) {
    console.error('[GraphQueryEngine] query error:', err.message);
    return [];
  }
}

/**
 * Traverse the error→patch→fix→qa chain for an error node.
 * @param {string} errorNodeId
 * @returns {{ error: object|null, patches: object[], fixes: object[], qaResults: object[] }}
 */
export function findErrorFixChain(graph, errorNodeId) {
  try {
    const errorNode = getNode(graph.nodeStore, errorNodeId);
    const patches   = findEdges(graph.edgeStore, { sourceId: errorNodeId, relation: 'FIXED_BY' })
      .map(e => getNode(graph.nodeStore, e.targetId)).filter(Boolean);

    const fixes = [];
    const qaResults = [];

    for (const patch of patches) {
      const fixEdges = findEdges(graph.edgeStore, { sourceId: patch.id, relation: 'SUCCEEDED' });
      const qaEdges  = findEdges(graph.edgeStore, { sourceId: patch.id, relation: 'PART_OF' });
      fixes.push(...fixEdges.map(e => getNode(graph.nodeStore, e.targetId)).filter(Boolean));
      qaResults.push(...qaEdges.map(e => getNode(graph.nodeStore, e.targetId)).filter(Boolean));
    }

    return { error: errorNode, patches, fixes, qaResults };
  } catch (err) {
    console.error('[GraphQueryEngine] findErrorFixChain error:', err.message);
    return { error: null, patches: [], fixes: [], qaResults: [] };
  }
}

/**
 * Get all nodes connected to a project node.
 * @param {string} projectId  node id of the project
 * @returns {object[]}
 */
export function getProjectKnowledge(graph, projectId) {
  try {
    return bfs(graph, projectId, 3);
  } catch { return []; }
}

/**
 * Suggest related fixes for a given error node by traversing the graph
 * and correlating with engineering memory.
 * @param {string} errorId  node id
 * @param {import('better-sqlite3').Database|null} memoryDB
 * @returns {object[]}
 */
export function suggestRelatedFixes(graph, errorId, memoryDB = null) {
  try {
    const errorNode = getNode(graph.nodeStore, errorId);
    if (!errorNode) return [];

    const suggestions = [];

    // Graph: find FIXED_BY patches for similar error nodes
    const similarErrors = findNodes(graph.nodeStore, { type: 'error', label: errorNode.label, limit: 10 })
      .filter(n => n.id !== errorId);

    for (const err of similarErrors) {
      const fixEdges = findEdges(graph.edgeStore, { sourceId: err.id, relation: 'FIXED_BY' });
      for (const e of fixEdges) {
        const fix = getNode(graph.nodeStore, e.targetId);
        if (fix) suggestions.push({ ...fix, _source: 'graph', _similarError: err.label });
      }
    }

    // Memory DB: find ERROR_FIX entries matching the error label
    if (memoryDB) {
      const memories = listMemories(memoryDB, { type: 'ERROR_FIX', limit: 20 })
        .filter(m => m.title?.toLowerCase().includes((errorNode.label ?? '').toLowerCase().slice(0, 20)));
      for (const m of memories) {
        suggestions.push({ id: m.id, label: m.title, type: 'memory_fix', _source: 'memory', _confidence: m.confidence });
      }
    }

    return suggestions.slice(0, 10);
  } catch (err) {
    console.error('[GraphQueryEngine] suggestRelatedFixes error:', err.message);
    return [];
  }
}
