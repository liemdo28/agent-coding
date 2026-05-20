// LocalAIEngineeringOS.js — Phase 30: AI Civilization Core
// Full Autonomous Local Engineering OS - All Phases Integrated

import { join } from 'path';
import { homedir } from 'os';

// Phase 1-20: Existing imports
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

// Phase 21: AI Ecosystem Engine
import { detectSharedModules, analyzeProjectDuplication, openSharedModulesDB } from './ecosystem/shared-module-detector.js';
import { registerModule, listModules, searchModules, getModuleInstallStats } from './ecosystem/ai-marketplace.js';
import { proposeRefactoring } from './ecosystem/ai-refactor-engine.js';

// Phase 22: AI Organizational Intelligence
import { deliverySpeed, blockerAnalytics, qaFailurePatterns, rollbackPatterns, flowHealthScore } from './org-intelligence/flow-analyzer.js';
import { suggestTeamOptimization, suggestResourceDistribution, suggestBottleneckReduction } from './org-intelligence/autonomous-optimizer.js';
import { buildHealthMap, getAgentHealth, getProjectHealth, getSystemHealth } from './org-intelligence/health-map.js';

// Phase 23: AI Design System
import { UIGenerator } from './design-system/ui-generator.js';
import { DesignTokenEngine, getDesignTokens, exportAsCSS, exportAsJSON } from './design-system/design-token-engine.js';
import { analyzeUIHealth, detectDeadUI, detectPoorUX, detectInconsistentComponents } from './design-system/ui-health-analyzer.js';

// Phase 24: AI Performance Engine
import { getPerformanceGraph, recordRenderSpeed, recordWebsocketLatency, recordMemoryUsage } from './perf-engine/performance-graph.js';
import { getAutoOptimizer, suggestLazyLoading, suggestQueryOptimization } from './perf-engine/auto-optimizer.js';
import { predictBottleneck, predictMemoryLeak, predictQueueOverload } from './perf-engine/performance-predictor.js';

// Phase 25: AI Code Intelligence
import { analyzeSemantics, getCodeOwnership, getArchitecture } from './code-intelligence/semantic-engine.js';
import { executeRefactorCommand, suggestRefactoring } from './code-intelligence/refactor-assistant.js';
import { scoreCodeQuality, getMaintainabilityScore, getComplexityScore } from './code-intelligence/quality-engine.js';

// Phase 26: AI Productivity Engine
import { detectFlowState, findIdleWorkers, findBlockedTasks } from './productivity/flow-detector.js';
import { batchTasks, preloadContext, predictNextAction } from './productivity/execution-accelerator.js';
import { prioritizeTasks, suggestRebalance } from './productivity/task-prioritizer.js';

// Phase 27: AI Deployment System
import { createSandbox, deployToSandbox, teardownSandbox } from './ai-deployment/staging-sandbox.js';
import { validateRelease, runValidationSuite } from './ai-deployment/release-validator.js';
import { monitorDeployment, shouldRollback, executeRollback } from './ai-deployment/autonomous-rollback.js';

// Phase 28: AI Multimodal Engine
import { analyzeScreenshot, analyzeLayout, extractUXInsights } from './multimodal/ui-understanding.js';
import { detectVisualBugs, checkOverlap, validateStates } from './multimodal/visual-bug-detector.js';
import { understandScreen, explainFlow, suggestRedesign } from './multimodal/screen-reasoning.js';

// Phase 29: AI Strategic System
import { analyzeStrategicDirection, assessTechnicalDebt, evaluateScalability, measureBusinessValue } from './strategic/analysis-engine.js';
import { generateSuggestions, prioritizeSuggestions } from './strategic/suggestion-engine.js';
import { suggestResourceReallocation, shouldPauseProject, accelerateInitiative, restructureAgentHierarchy } from './strategic/corporate-decisions.js';

// Phase 30: AI Civilization Core
import { initializeGlobalMemory, storeGlobalMemory, getGlobalMemory, syncMemory, getSharedLearnings } from './civilization/global-memory.js';
import { initializeEvolutionEngine, evolvePrompt, evolveArchitecture, suggestImprovements } from './civilization/evolution-engine.js';
import { initializeSelfExpanding, createAgent, createWorkflow, createMonitoring, expandCapabilities } from './civilization/self-expanding.js';

// Database paths
const DEFAULT_MEMORY_DB = join(homedir(), '.local-agent', 'engineering-memory.db');
const DEFAULT_DEPLOY_DB = join(homedir(), '.local-agent', 'deployments.db');
const DEFAULT_VECTOR_DB = join(homedir(), '.local-agent', 'vectors.db');
const DEFAULT_GRAPH_DB = join(homedir(), '.local-agent', 'knowledge-graph.db');

export class LocalAIEngineeringOS {
  constructor(workspaceRoot, options = {}) {
    this.workspaceRoot = workspaceRoot ?? process.cwd();
    this.options = options;
    this.memoryDB = null;
    this.deployDB = null;
    this.vectorStore = null;
    this.knowledgeGraph = null;
    this._initialized = false;
    this._status = 'stopped';
    this._civilization = null;
  }

  /** Initialize all subsystems: open DBs, start monitors. */
  async initialize() {
    try {
      this.memoryDB = openMemoryDB(this.options.memoryDBPath ?? DEFAULT_MEMORY_DB);
      this.deployDB = openDeployDB(this.options.deployDBPath ?? DEFAULT_DEPLOY_DB);
      this.vectorStore = openVectorStore(this.options.vectorDBPath ?? DEFAULT_VECTOR_DB);
      this.knowledgeGraph = openKnowledgeGraph(this.options.graphDBPath ?? DEFAULT_GRAPH_DB);
      this._ollamaAvail = await ollamaAvailable();

      // Phase 30: Initialize Civilization Core
      this._civilization = await this._initializeCivilization();

      this._initialized = true;
      this._status = 'running';

      // Cleanup stale sessions on startup
      cleanupStaleSessions(24 * 60 * 60 * 1000, this.workspaceRoot);

      return { success: true, ollamaAvailable: this._ollamaAvail, civilization: !!this._civilization };
    } catch (err) {
      this._status = 'error';
      console.error('[LocalAIEngineeringOS] initialize error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /** Initialize Phase 30: Civilization Core */
  async _initializeCivilization() {
    try {
      await initializeGlobalMemory();
      await initializeEvolutionEngine();
      await initializeSelfExpanding();
      return { initialized: true, at: new Date().toISOString() };
    } catch (err) {
      console.error('[Civilization] init error:', err.message);
      return { initialized: false, error: err.message };
    }
  }

  // =========================================================================
  // PHASE 1-20: EXISTING METHODS
  // =========================================================================

  /** Analyze a project: build graph, assess priority, scan root causes. */
  async analyzeProject(projectPath) {
    this._assertInit();
    try {
      const graph = buildProjectGraph(projectPath);
      const priority = getPriorityReport(this.workspaceRoot);
      const memories = getTopMemories(this.memoryDB, { projectId: projectPath }, 10);
      const graphStats = getGraphStats(graph);

      return {
        projectPath,
        graph: { stats: graphStats, cycles: graph.cycles },
        priority: priority.projects.find(p => p.dir === projectPath) ?? null,
        memories,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { projectPath, error: err.message };
    }
  }

  /** Run autonomous QA on a project. */
  async runAutonomousQA(projectPath, changedFiles = []) {
    this._assertInit();
    try {
      const plan = planQARun(projectPath, changedFiles, this.options.qa ?? {});
      return {
        projectPath,
        plan,
        estimatedTime: `${Math.round(plan.estimatedTotalMs / 1000)}s`,
        checks: plan.checks.filter(c => c.enabled),
        startedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { projectPath, error: err.message };
    }
  }

  /** Deploy a project with intelligence checks. */
  async deployWithIntelligence(projectPath, env = 'development', context = {}) {
    this._assertInit();
    try {
      const risk = analyzeDeployRisk(projectPath, env, { ...context, db: this.deployDB });
      const policy = getDefaultPolicy();
      const allowed = checkDeployPolicy({ environment: env, qaFailures: context.qaFailures ?? 0, ...context }, policy);

      if (!allowed.allowed) {
        return { allowed: false, violations: allowed.violations, risk, env };
      }

      const deploy = recordDeployment(this.deployDB, {
        projectId: projectPath,
        environment: env,
        status: 'started',
        startedAt: new Date().toISOString(),
        metadata: context,
      });

      return { allowed: true, risk, policy: allowed, deploy, env };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Search across memory, knowledge graph, and semantic store. */
  async searchKnowledge(query) {
    this._assertInit();
    try {
      const memories = searchMemory(this.memoryDB, query, { limit: 10 });
      return {
        query,
        memories: memories.results,
        totalFound: memories.totalFound,
        sources: ['engineering_memory'],
        searchedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { query, error: err.message, memories: [] };
    }
  }

  /** Self-heal a project: repair deps, env, and report. */
  async selfHeal(projectPath) {
    this._assertInit();
    try {
      const depHealth = getDependencyHealth(projectPath);
      const envReport = detectEnvIssues(projectPath);
      const repairs = [];

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

  // =========================================================================
  // PHASE 21: AI ECOSYSTEM ENGINE
  // =========================================================================

  /** Detect shared modules across projects. */
  async detectSharedModules(projectPaths) {
    this._assertInit();
    try {
      return await detectSharedModules(projectPaths, { workspaceRoot: this.workspaceRoot });
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Search the internal AI marketplace. */
  async searchMarketplace(query, category) {
    this._assertInit();
    try {
      const modules = await searchModules(query, { category });
      return { query, modules, count: modules.length };
    } catch (err) {
      return { error: err.message, modules: [] };
    }
  }

  /** Get available marketplace modules. */
  async getMarketplaceModules() {
    this._assertInit();
    try {
      const modules = await listModules();
      return { modules, count: modules.length };
    } catch (err) {
      return { error: err.message, modules: [] };
    }
  }

  /** Propose refactoring suggestions. */
  async proposeRefactoring(projectPath) {
    this._assertInit();
    try {
      return await proposeRefactoring(projectPath);
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 22: AI ORGANIZATIONAL INTELLIGENCE
  // =========================================================================

  /** Get engineering flow analysis. */
  async getFlowAnalysis() {
    this._assertInit();
    try {
      const speed = deliverySpeed(this.workspaceRoot);
      const blockers = blockerAnalytics(this.workspaceRoot);
      const qaFailures = qaFailurePatterns(this.workspaceRoot);
      const rollbacks = rollbackPatterns(this.workspaceRoot);
      const health = flowHealthScore(this.workspaceRoot);

      return {
        deliverySpeed: speed,
        blockers,
        qaFailures,
        rollbacks,
        healthScore: health,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get engineering health map. */
  async getHealthMap() {
    this._assertInit();
    try {
      const healthMap = await buildHealthMap(this.workspaceRoot);
      return { healthMap, generatedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Suggest organizational optimizations. */
  async suggestOptimizations() {
    this._assertInit();
    try {
      const teamOpt = await suggestTeamOptimization(this.workspaceRoot);
      const resourceOpt = await suggestResourceDistribution(this.workspaceRoot);
      const bottleneckOpt = await suggestBottleneckReduction(this.workspaceRoot);

      return {
        teamOptimization: teamOpt,
        resourceDistribution: resourceOpt,
        bottleneckReduction: bottleneckOpt,
        suggestedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 23: AI DESIGN SYSTEM
  // =========================================================================

  /** Generate UI based on natural language request. */
  async generateUI(request) {
    this._assertInit();
    try {
      const generator = new UIGenerator();
      const result = generator.generate(request);
      return { request, result, generatedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get design tokens. */
  async getDesignTokens(theme = 'default') {
    this._assertInit();
    try {
      const tokens = getDesignTokens(theme);
      const css = exportAsCSS(tokens);
      const json = exportAsJSON(tokens);
      return { tokens, css, json };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Analyze UI health. */
  async analyzeUIHealth(projectPath) {
    this._assertInit();
    try {
      const analysis = await analyzeUIHealth(projectPath);
      return { projectPath, analysis, analyzedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 24: AI PERFORMANCE ENGINE
  // =========================================================================

  /** Get performance metrics. */
  async getPerformanceMetrics() {
    this._assertInit();
    try {
      const graph = getPerformanceGraph();
      return {
        metrics: graph.getDashboard(),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Record performance metric. */
  recordMetric(type, value) {
    try {
      switch (type) {
        case 'render': return recordRenderSpeed(value);
        case 'websocket': return recordWebsocketLatency(value);
        case 'memory': return recordMemoryUsage(value);
        default: return { error: 'Unknown metric type' };
      }
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get auto-optimization suggestions. */
  async getOptimizationSuggestions() {
    this._assertInit();
    try {
      const optimizer = getAutoOptimizer();
      const lazyLoading = optimizer.suggestLazyLoading();
      const queryOpt = optimizer.suggestQueryOptimization();
      const renderOpt = optimizer.suggestRenderOptimization();

      return {
        lazyLoading,
        queryOptimization: queryOpt,
        renderOptimization: renderOpt,
        suggestedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Predict performance issues. */
  async predictPerformanceIssues() {
    this._assertInit();
    try {
      const bottleneck = await predictBottleneck();
      const memoryLeak = await predictMemoryLeak();
      const queueOverload = await predictQueueOverload();

      return {
        predictedBottleneck: bottleneck,
        predictedMemoryLeak: memoryLeak,
        predictedQueueOverload: queueOverload,
        predictedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 25: AI CODE INTELLIGENCE
  // =========================================================================

  /** Analyze code semantics. */
  async analyzeCodeSemantics(projectPath) {
    this._assertInit();
    try {
      const semantics = await analyzeSemantics(projectPath);
      const architecture = await getArchitecture(projectPath);
      const ownership = await getCodeOwnership(projectPath);

      return {
        projectPath,
        semantics,
        architecture,
        ownership,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Execute refactor command. */
  async executeRefactor(command, projectPath) {
    this._assertInit();
    try {
      return await executeRefactorCommand(command, projectPath);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get code quality score. */
  async getCodeQuality(projectPath) {
    this._assertInit();
    try {
      const quality = await scoreCodeQuality(projectPath);
      const maintainability = await getMaintainabilityScore(projectPath);
      const complexity = await getComplexityScore(projectPath);

      return {
        projectPath,
        overall: quality,
        maintainability,
        complexity,
        scoredAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 26: AI PRODUCTIVITY ENGINE
  // =========================================================================

  /** Detect flow state. */
  async detectFlowState(tasks) {
    this._assertInit();
    try {
      const state = await detectFlowState(tasks);
      const idleWorkers = await findIdleWorkers(tasks);
      const blockedTasks = await findBlockedTasks(tasks);

      return {
        flowState: state,
        idleWorkers,
        blockedTasks,
        detectedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Batch tasks for optimization. */
  async batchTasks(tasks) {
    this._assertInit();
    try {
      return await batchTasks(tasks);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Prioritize tasks. */
  async prioritizeTasks(tasks, context = {}) {
    this._assertInit();
    try {
      const prioritized = await prioritizeTasks(tasks, context);
      const rebalance = await suggestRebalance(tasks, context);
      return { prioritized, rebalance, prioritizedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 27: AI DEPLOYMENT SYSTEM
  // =========================================================================

  /** Create staging sandbox. */
  async createStagingSandbox(projectPath) {
    this._assertInit();
    try {
      return await createSandbox(projectPath);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Validate release. */
  async validateRelease(build) {
    this._assertInit();
    try {
      const result = await validateRelease(build);
      const suite = await runValidationSuite(build);
      return { validation: result, suite, validatedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Monitor deployment and auto-rollback if needed. */
  async monitorDeployment(deployId) {
    this._assertInit();
    try {
      const metrics = await monitorDeployment(deployId);
      const shouldRoll = await shouldRollback(metrics);
      return { deployId, metrics, shouldRollback: shouldRoll, monitoredAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Execute rollback. */
  async executeRollback(deployId) {
    this._assertInit();
    try {
      return await executeRollback(deployId);
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 28: AI MULTIMODAL ENGINE
  // =========================================================================

  /** Analyze screenshot. */
  async analyzeScreenshot(imagePath) {
    this._assertInit();
    try {
      const analysis = await analyzeScreenshot(imagePath);
      const visualBugs = await detectVisualBugs(imagePath);
      const understanding = await understandScreen(imagePath);

      return {
        imagePath,
        analysis,
        visualBugs,
        understanding,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Explain UI flow. */
  async explainUIFlow(screenshot) {
    this._assertInit();
    try {
      const flow = await explainFlow(screenshot);
      return { flow, explainedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Suggest redesign. */
  async suggestRedesign(screenshot, goal) {
    this._assertInit();
    try {
      return await suggestRedesign(screenshot, goal);
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 29: AI STRATEGIC SYSTEM
  // =========================================================================

  /** Analyze strategic direction. */
  async analyzeStrategicDirection(projectPath) {
    this._assertInit();
    try {
      const direction = await analyzeStrategicDirection(projectPath);
      const techDebt = await assessTechnicalDebt(projectPath);
      const scalability = await evaluateScalability(projectPath);
      const businessValue = await measureBusinessValue(projectPath);

      return {
        projectPath,
        direction,
        technicalDebt: techDebt,
        scalability,
        businessValue,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Generate strategic suggestions. */
  async generateSuggestions(projectPath) {
    this._assertInit();
    try {
      const suggestions = await generateSuggestions(projectPath);
      const prioritized = await prioritizeSuggestions(suggestions.suggestions);
      return { projectPath, suggestions: prioritized, generatedAt: new Date().toISOString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Suggest resource reallocation. */
  async suggestResourceReallocation(portfolio) {
    this._assertInit();
    try {
      return await suggestResourceReallocation(portfolio);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Assess if project should be paused. */
  async shouldPauseProject(project) {
    this._assertInit();
    try {
      return await shouldPauseProject(project);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Accelerate initiative. */
  async accelerateInitiative(initiative, options = {}) {
    this._assertInit();
    try {
      return await accelerateInitiative(initiative, options);
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // PHASE 30: AI CIVILIZATION CORE
  // =========================================================================

  /** Store in global memory. */
  async storeGlobalKnowledge(key, value, options = {}) {
    this._assertInit();
    try {
      return await storeGlobalMemory(key, value, options);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get from global memory. */
  async getGlobalKnowledge(key) {
    this._assertInit();
    try {
      const value = await getGlobalMemory(key);
      return { key, value, found: value !== null };
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Sync memory between projects. */
  async syncProjects(projectA, projectB) {
    this._assertInit();
    try {
      return await syncMemory(projectA, projectB);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get shared learnings. */
  async getSharedLearnings(options = {}) {
    this._assertInit();
    try {
      return await getSharedLearnings(options);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Evolve prompt based on outcome. */
  async evolvePrompt(promptId, outcome) {
    this._assertInit();
    try {
      return await evolvePrompt(promptId, outcome);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Get improvement suggestions. */
  async getImprovementSuggestions(context = {}) {
    this._assertInit();
    try {
      return await suggestImprovements(context);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Create new agent autonomously. */
  async createAgent(spec, options = {}) {
    this._assertInit();
    try {
      return await createAgent(spec, options);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Create new workflow autonomously. */
  async createWorkflow(spec, options = {}) {
    this._assertInit();
    try {
      return await createWorkflow(spec, options);
    } catch (err) {
      return { error: err.message };
    }
  }

  /** Expand capabilities autonomously. */
  async expandCapabilities(context = {}) {
    this._assertInit();
    try {
      return await expandCapabilities(context);
    } catch (err) {
      return { error: err.message };
    }
  }

  // =========================================================================
  // SYSTEM STATUS
  // =========================================================================

  /** Get current system status. */
  getStatus() {
    return {
      status: this._status,
      initialized: this._initialized,
      workspaceRoot: this.workspaceRoot,
      ollamaAvailable: this._ollamaAvail ?? false,
      activeSessions: getActiveSessions(this.workspaceRoot).length,
      memoryStats: this.memoryDB ? getMemoryStats(this.memoryDB) : null,
      civilization: this._civilization,
      phases: {
        1: 'Project Analysis',
        2: 'Memory & Learning',
        3: 'Task Planning',
        4: 'Code Generation',
        5: 'Testing & QA',
        6: 'Deployment',
        7: 'Knowledge Graph',
        8: 'Semantic Search',
        9: 'Risk Analysis',
        10: 'Policy Engine',
        11: 'Self-Healing',
        12: 'Orchestration',
        13: 'Session Management',
        14: 'Autonomous QA',
        15: 'QA Autopilot',
        16: 'Root Cause Analysis',
        17: 'Release Management',
        18: 'Context Management',
        19: 'System Health',
        20: 'Full Integration',
        21: 'AI Ecosystem Engine',
        22: 'Organizational Intelligence',
        23: 'AI Design System',
        24: 'Performance Engine',
        25: 'Code Intelligence',
        26: 'Productivity Engine',
        27: 'Deployment System',
        28: 'Multimodal Engine',
        29: 'Strategic System',
        30: 'Civilization Core',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /** Gracefully close all DB connections. */
  async shutdown() {
    try {
      if (this.memoryDB) this.memoryDB.close();
      if (this.deployDB) this.deployDB.close();
      if (this.vectorStore) this.vectorStore.close();
      if (this.knowledgeGraph) closeGraph(this.knowledgeGraph);
      this._status = 'stopped';
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