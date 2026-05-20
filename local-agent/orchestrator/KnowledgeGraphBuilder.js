// orchestrator/KnowledgeGraphBuilder.js
// Builds KnowledgeGraph nodes + edges from the project registry.
// Runs after discoverProjects() to wire relationships.

import { join } from 'path';
import { homedir } from 'os';
import { loadRegistry } from './ProjectRegistry.js';
import { detectSharedDependencies, detectSameOrg, inspectRepo } from './ProjectAutoDiscovery.js';
import { openNodeStore, addNode, findNodes } from '../knowledge-graph/GraphNodeStore.js';
import { openEdgeStore, addEdge, findEdges } from '../knowledge-graph/GraphEdgeStore.js';

const DEFAULT_KG_DB = join(homedir(), '.local-agent', 'knowledge-graph.db');

// ── EDGE RELATIONS used here ──────────────────────────────────────────────────
const REL = {
  DEPENDS_ON:  'DEPENDS_ON',   // shared npm/pip dependency
  SAME_ORG:    'RELATED_TO',   // same GitHub org
  SIMILAR_TO:  'RELATED_TO',   // similar name / tech stack
};

// ── helpers ───────────────────────────────────────────────────────────────────

function openGraph(dbPath = DEFAULT_KG_DB) {
  const nodeStore = openNodeStore(dbPath);
  openEdgeStore(dbPath);          // ensure edge table exists in same file
  return nodeStore;               // same DB handle used for both
}

function edgeExists(db, sourceId, targetId, relation) {
  return db.prepare(
    `SELECT id FROM graph_edges WHERE source_id=? AND target_id=? AND relation=? LIMIT 1`
  ).get(sourceId, targetId, relation) != null;
}

function upsertProjectNode(db, project) {
  // Check if node already exists by label (project root)
  const existing = findNodes(db, { type: 'project' })
    .find(n => n.properties?.root === project.root || n.label === project.name);

  const props = {
    root:        project.root,
    framework:   project.framework,
    language:    project.language,
    status:      project.status,
    projectId:   project.projectId,
    lastScan:    project.lastScan,
  };

  if (existing) {
    db.prepare(
      `UPDATE graph_nodes SET properties=@properties, updated_at=@updated_at WHERE id=@id`
    ).run({ id: existing.id, properties: JSON.stringify(props), updated_at: new Date().toISOString() });
    return existing.id;
  }

  const node = addNode(db, {
    id:         `proj-${project.projectId}`,
    type:       'project',
    label:      project.name,
    properties: props,
  });
  return node.id;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Rebuild the KnowledgeGraph from the current registry.
 *
 * Steps:
 *  1. Upsert a graph node for every registered project
 *  2. Add DEPENDS_ON edges for shared npm packages (weight = shared count / 10)
 *  3. Add RELATED_TO edges for same-org projects
 *
 * @param {object} options
 * @param {string}   [options.dbPath]      — path to KG SQLite DB
 * @param {function} [options.onProgress]  — progress callback (msg: string)
 * @returns {{ nodes: number, edges: number, projects: number }}
 */
export async function buildKnowledgeGraph(options = {}) {
  const dbPath = options.dbPath     ?? DEFAULT_KG_DB;
  const log    = options.onProgress ?? (() => {});

  const db       = openGraph(dbPath);
  const projects = loadRegistry();

  log(`building KnowledgeGraph — ${projects.length} registered projects`);

  // ── 1. Upsert project nodes ────────────────────────────────────────────────
  const nodeIdMap = new Map(); // projectId → graph node id
  let nodeCount = 0;

  for (const p of projects) {
    const nodeId = upsertProjectNode(db, p);
    nodeIdMap.set(p.projectId, nodeId);
    nodeCount++;
    log(`  node: ${p.name}`);
  }

  // ── 2. Shared-dependency edges ─────────────────────────────────────────────
  let edgeCount = 0;
  const sharedPairs = detectSharedDependencies();
  log(`shared-dep pairs: ${sharedPairs.length}`);

  for (const pair of sharedPairs) {
    const srcId = nodeIdMap.get(pair.a.projectId);
    const tgtId = nodeIdMap.get(pair.b.projectId);
    if (!srcId || !tgtId) continue;

    if (!edgeExists(db, srcId, tgtId, REL.DEPENDS_ON)) {
      addEdge(db, {
        source_id:  srcId,
        target_id:  tgtId,
        relation:   REL.DEPENDS_ON,
        weight:     Math.min(1, pair.count / 10),
        properties: { sharedDeps: pair.shared.slice(0, 20) },
      });
      edgeCount++;
    }
    log(`  edge DEPENDS_ON: ${pair.a.name} ↔ ${pair.b.name} (${pair.count} shared)`);
  }

  // ── 3. Same-org edges ─────────────────────────────────────────────────────
  const orgs = detectSameOrg();
  log(`same-org groups: ${orgs.length}`);

  for (const { org, projects: orgProjects } of orgs) {
    for (let i = 0; i < orgProjects.length; i++) {
      for (let j = i + 1; j < orgProjects.length; j++) {
        const srcId = nodeIdMap.get(orgProjects[i].projectId);
        const tgtId = nodeIdMap.get(orgProjects[j].projectId);
        if (!srcId || !tgtId) continue;

        if (!edgeExists(db, srcId, tgtId, REL.SAME_ORG)) {
          addEdge(db, {
            source_id:  srcId,
            target_id:  tgtId,
            relation:   REL.SAME_ORG,
            weight:     0.6,
            properties: { org, reason: 'same-github-org' },
          });
          edgeCount++;
        }
      }
    }
    log(`  edge RELATED_TO (org ${org}): ${orgProjects.map(p => p.name).join(', ')}`);
  }

  // ── 4. Summary ──────────────────────────────────────────────────────────────
  const stats = db.prepare(`SELECT COUNT(*) as c FROM graph_nodes`).get();
  const eStats = db.prepare(`SELECT COUNT(*) as c FROM graph_edges`).get();

  log(`done — ${nodeCount} nodes upserted, ${edgeCount} new edges`);
  log(`total in DB: ${stats.c} nodes, ${eStats.c} edges`);

  return {
    projects: projects.length,
    nodes:    stats.c,
    edges:    eStats.c,
    newNodes: nodeCount,
    newEdges: edgeCount,
  };
}

/**
 * Query the graph for projects related to a given project.
 *
 * @param {string} projectId
 * @param {{ dbPath?: string, maxHops?: number }} options
 * @returns {Array<{ project, relation, weight, properties }>}
 */
export function getRelatedProjects(projectId, options = {}) {
  const dbPath = options.dbPath ?? DEFAULT_KG_DB;
  const db     = openGraph(dbPath);
  const nodeId = `proj-${projectId}`;

  const outEdges = findEdges(db, { source_id: nodeId });
  const inEdges  = findEdges(db, { target_id: nodeId });

  const registry = loadRegistry();
  const byNodeId = new Map();
  for (const p of registry) byNodeId.set(`proj-${p.projectId}`, p);

  const results = [];
  for (const e of [...outEdges, ...inEdges]) {
    const otherId = e.source_id === nodeId ? e.target_id : e.source_id;
    const project = byNodeId.get(otherId);
    if (project) {
      results.push({
        project,
        relation:   e.relation,
        weight:     e.weight,
        properties: e.properties ?? {},
      });
    }
  }

  return results.sort((a, b) => b.weight - a.weight);
}
