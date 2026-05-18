// rootcause/causalGraph.js — builds causal chains from errors, patches, QA results
// Phase 13: links cause→effect edges and traverses backwards to find root

/**
 * Build a causal graph from an array of events.
 * @param {Array<{ id?: string, type: string, timestamp: string, data: object }>} events
 * @returns {{ nodes: Map<string,object>, edges: Map<string,string[]>, reverseEdges: Map<string,string[]> }}
 */
export function buildCausalGraph(events) {
  const nodes        = new Map();
  const edges        = new Map();  // cause → [effects]
  const reverseEdges = new Map();  // effect → [causes]

  // Index events by id
  const sortedEvents = [...events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const ev of sortedEvents) {
    const id = ev.id ?? `${ev.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    nodes.set(id, { ...ev, id });
    edges.set(id, []);
    reverseEdges.set(id, []);
  }

  // Link consecutive events of compatible types (heuristic causal chain)
  const TYPE_ORDER = ['ERROR', 'PATCH', 'QA', 'DEPLOY', 'ROLLBACK'];
  const nodeList   = [...nodes.values()];

  for (let i = 0; i < nodeList.length - 1; i++) {
    const a = nodeList[i];
    const b = nodeList[i + 1];

    // Link if within 30 minutes and types are causally compatible
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff < 30 * 60_000) {
      const aIdx = TYPE_ORDER.indexOf(a.type);
      const bIdx = TYPE_ORDER.indexOf(b.type);
      if (aIdx >= 0 && bIdx > aIdx) {
        edges.get(a.id).push(b.id);
        reverseEdges.get(b.id).push(a.id);
      }
    }

    // Also link events with explicit parentId
    if (b.data?.parentId && nodes.has(b.data.parentId)) {
      const pId = b.data.parentId;
      if (!edges.get(pId).includes(b.id)) edges.get(pId).push(b.id);
      if (!reverseEdges.get(b.id).includes(pId)) reverseEdges.get(b.id).push(pId);
    }
  }

  return { nodes, edges, reverseEdges };
}

/**
 * Find the root cause of a target event by traversing backwards.
 * @returns {object|null} the root node
 */
export function findRootCause(graph, targetEvent) {
  const id = targetEvent?.id ?? targetEvent;
  if (!graph.nodes.has(id)) return null;

  let current = id;
  const visited = new Set();

  while (true) {
    if (visited.has(current)) break; // cycle guard
    visited.add(current);
    const causes = graph.reverseEdges.get(current) ?? [];
    if (causes.length === 0) break;
    current = causes[0]; // follow first cause
  }

  return graph.nodes.get(current) ?? null;
}

/**
 * Return the ordered causal chain from root to target event.
 * @param {object} graph
 * @param {string} eventId
 * @returns {object[]}
 */
export function getCausalChain(graph, eventId) {
  if (!graph.nodes.has(eventId)) return [];
  const chain   = [];
  let current   = eventId;
  const visited = new Set();

  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    chain.unshift(graph.nodes.get(current));
    const causes = graph.reverseEdges.get(current) ?? [];
    current = causes[0];
  }

  return chain;
}

/**
 * ASCII representation of the causal graph.
 * @param {object} graph
 * @returns {string}
 */
export function visualizeCausal(graph) {
  const lines = ['=== Causal Graph ==='];
  for (const [id, node] of graph.nodes) {
    const effects = graph.edges.get(id) ?? [];
    const label   = `[${node.type}] ${id}`;
    if (effects.length > 0) {
      for (const eff of effects) {
        const effNode = graph.nodes.get(eff);
        lines.push(`  ${label} --> [${effNode?.type ?? '?'}] ${eff}`);
      }
    } else {
      lines.push(`  ${label} (leaf)`);
    }
  }
  return lines.join('\n');
}
