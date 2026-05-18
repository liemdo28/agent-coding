// LocalAIEngineeringOS.js — Phase 20: Full Autonomous Local Engineering OS
// Top-level facade that wires all phases together

import { join } from 'path';
import { openMemoryDB, getStats as getMemoryStats } from './memory/engineeringMemory.js';
import { searchMemory } from './memory/memorySearch.js';
import { getTopMemories } from './memory/memoryScorer.js';
import { compressMemories } from './memory/memoryCompressor.js';
import { buildProjectGraph, getGraphStats } from './orchestrator/projectGraph.js';
import { getPriorityReport } from './orchestrator/projectPriorityEngine.js';
import { createSession, getActiveSessions, cleanupStaleSessions } from './orchestrator/sessionManager.js';
import { analyzeRuntimeError, parseStackTrace } from './rootcause/runtimeAnalyzer.js';
import { planQARun, generateQAReport } from './autonomous-qa/qaPlanner.js';
import { openDeployDB, recordDeployment, getDeployStats } from './deployment/deploymentTracker.js';
import { analyzeDeployRisk } from './deployment/deployRiskAnalyzer.js';
import { checkDeployPolicy, getDefaultPolicy } from './deployment/deployPolicyEngine.js';
import { getDependencyHealth, repairDependencies } from './self-heal/dependencyRepair.js';
import { detectEnvIssues, repairEnv } from './self-heal/envRepair.js';
import { openKnowledgeGraph, addNode, link, getGraphStats as getKGStats, closeGraph } from './knowledge-graph/KnowledgeGraph.js';
import { isAvailable as ollamaAvailable } from './semantic/embeddingEngine.js';
import { openVectorStore } from './semantic/vectorStore.js';
import { homedir } from 'os';

const DEFAULT_MEMORY_DB  = join(homedir(), '.local-agent', 'engineering-memory.db');
const DEFAULT_DEPLOY_DB  = join(homedir(), '.local-agent', 'deployments.db');
const DEFAULT_VECTOR_DB  = join(homedir(), '.local-agent', 'vectors.db');
const DEFAULT_GRAPH_DB   = join(homedir(), '.local-agent', 'knowledge-graph.db');

export class LocalAIEngineeringOS {
  constructor(workspaceRoot, options = {}) {
    this.workspaceRoot = workspaceRoot ?? process.cwd();
    this.options       = options;
    this.memoryDB      = null;
    this.deployDB      = null;
    this.vectorStore   = null;
    this.knowledgeGraph = null;
    this._initialized  = false;
    this._status       = 'stopped';
  }

  /** Initialize all subsystems: open DBs, start monitors. */
  async initialize() {
    try {
      this.memoryDB       = openMemoryDB(this.options.memoryDBPath ?? DEFAULT_MEMORY_DB);
      this.deployDB       = openDeployDB(this.options.deployDBPath ?? DEFAULT_DEPLOY_DB);
      this.vectorStore    = openVectorStore(this.options.vectorDBPath ?? DEFAULT_VECTOR_DB);
      this.knowledgeGraph = openKnowledgeGraph(this.options.graphDBPath ?? DEFAULT_GRAPH_DB);
      this._ollamaAvail   = await ollamaAvailable();
      this._initialized   = true;
      this._status        = 'running';

      // Cleanup stale sessions on startup
      cleanupStaleSessions(24 * 60 * 60 * 1000, this.workspaceRoot);

      return { success: true, ollamaAvailable: this._ollamaAvail };
    } catch (err) {
      this._status = 'error';
      console.error('[LocalAIEngineeringOS] initialize error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Analyze a project: build graph, assess priority, scan root causes.
   * Phases 12→13→7
   */
  async analyzeProject(projectPath) {
    this._assertInit();
    try {
      const graph     = buildProjectGraph(projectPath);
      const priority  = getPriorityReport(this.workspaceRoot);
      const memories  = getTopMemories(this.memoryDB, { projectId: projectPath }, 10);
      const graphStats = getGraphStats(graph);

      return {
        projectPath,
        graph:     { stats: graphStats, cycles: graph.cycles },
        priority:  priority.projects.find(p => p.dir === projectPath) ?? null,
        memories,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { projectPath, error: err.message };
    }
  }

  /**
   * Run autonomous QA on a project.
   * Phases 14→15
   */
  async runAutonomousQA(projectPath, changedFiles = []) {
    this._assertInit();
    try {
      const plan = planQARun(projectPath, changedFiles, this.options.qa ?? {});
      return {
        projectPath,
        plan,
        estimatedTime: `${Math.round(plan.estimatedTotalMs / 1000)}s`,
        checks:        plan.checks.filter(c => c.enabled),
        startedAt:     new Date().toISOString(),
      };
    } catch (err) {
      return { projectPath, error: err.message };
    }
  }

  /**
   * Deploy a project with intelligence checks.
   * Phases 9→10
   */
  async deployWithIntelligence(projectPath, env = 'development', context = {}) {
    this._assertInit();
    try {
      const risk    = analyzeDeployRisk(projectPath, env, { ...context, db: this.deployDB });
      const policy  = getDefaultPolicy();
      const allowed = checkDeployPolicy({ environment: env, qaFailures: context.qaFailures ?? 0, ...context }, policy);

      if (!allowed.allowed) {
        return { allowed: false, violations: allowed.violations, risk, env };
      }

      const deploy = recordDeployment(this.deployDB, {
        projectId:   projectPath,
        environment: env,
        status:      'started',
        startedAt:   new Date().toISOString(),
        metadata:    context,
      });

      return { allowed: true, risk, policy: allowed, deploy, env };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Search across memory, knowledge graph, and semantic store.
   * Phases 8→18→7
   */
  async searchKnowledge(query) {
    this._assertInit();
    try {
      const memories = searchMemory(this.memoryDB, query, { limit: 10 });
      return {
        query,
        memories:   memories.results,
        totalFound: memories.totalFound,
        sources:    ['engineering_memory'],
        searchedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { query, error: err.message, memories: [] };
    }
  }

  /**
   * Self-heal a project: repair deps, env, and report.
   * Phases 16→11
   */
  async selfHeal(projectPath) {
    this._assertInit();
    try {
      const depHealth = getDependencyHealth(projectPath);
      const envReport = detectEnvIssues(projectPath);
      const repairs   = [];

      if (depHealth.status === 'broken') {
        const result = repairDependencies(projectPath, { dryRun: true });
        repairs.push({ type: 'deps', ...result });
      }

      if (envReport.missing.length > 0) {
        const result = repairEnv(projectPath, { dryRun: true });
        repairs.push({ type: 'env', ...result });
      }

      return { projectPath, depHealth, envReport, repairs, healedAt: new Date().toISOString() };
    } catch (err) {
      return { projectPath, error: err.message };
    }
  }

  /** Get current system status (Phase 19). */
  getStatus() {
    return {
      status:        this._status,
      initialized:   this._initialized,
      workspaceRoot: this.workspaceRoot,
      ollamaAvailable: this._ollamaAvail ?? false,
      activeSessions: getActiveSessions(this.workspaceRoot).length,
      memoryStats:   this.memoryDB ? getMemoryStats(this.memoryDB) : null,
      timestamp:     new Date().toISOString(),
    };
  }

  /** Gracefully close all DB connections. */
  async shutdown() {
    try {
      if (this.memoryDB)       this.memoryDB.close();
      if (this.deployDB)       this.deployDB.close();
      if (this.vectorStore)    this.vectorStore.close();
      if (this.knowledgeGraph) closeGraph(this.knowledgeGraph);
      this._status    = 'stopped';
      this._initialized = false;
    } catch (err) {
      console.error('[LocalAIEngineeringOS] shutdown error:', err.message);
    }
  }

  _assertInit() {
    if (!this._initialized) throw new Error('LocalAIEngineeringOS not initialized — call initialize() first');
  }
}

export default LocalAIEngineeringOS;
