/**
 * CLI Commands for Phases 19-23
 * Local Git Intelligence, Skills, Graph, Runtime, Command Center
 */
const { GitHistoryAnalyzer } = require('../git/GitHistoryAnalyzer');
const { CommitRiskAnalyzer } = require('../git/CommitRiskAnalyzer');
const { DiffSummarizer } = require('../git/DiffSummarizer');
const { BranchInspector } = require('../git/BranchInspector');
const { RegressionCorrelation } = require('../git/RegressionCorrelation');
const { SkillRegistry } = require('../skills/SkillRegistry');
const { SkillRunner } = require('../skills/SkillRunner');
const { DependencyGraphBuilder } = require('../graph/DependencyGraphBuilder');
const { RouteGraph } = require('../graph/RouteGraph');
const { APIFlowGraph } = require('../graph/APIFlowGraph');
const { CircularDependencyDetector } = require('../graph/CircularDependencyDetector');
const { SandboxRunner } = require('../runtime/SandboxRunner');
const { RuntimeAudit } = require('../runtime/RuntimeAudit');
const fs = require('fs');
const path = require('path');

const gitCommands = {
  async history(args) {
    const analyzer = new GitHistoryAnalyzer();
    const report = analyzer.generateReport(args.range || '--all');
    console.log(JSON.stringify(report, null, 2));
  },
  
  async analyze(args) {
    const analyzer = new GitHistoryAnalyzer();
    const range = args.range || 'HEAD~5..HEAD';
    const report = analyzer.generateReport(range);
    console.log(JSON.stringify(report, null, 2));
  },
  
  async 'risky-commits'(args) {
    const riskAnalyzer = new CommitRiskAnalyzer();
    const historyAnalyzer = new GitHistoryAnalyzer();
    const commits = historyAnalyzer.getCommits(args.range || 'HEAD~20..HEAD');
    const report = riskAnalyzer.generateRiskReport(commits);
    console.log(JSON.stringify(report, null, 2));
  },
  
  async regression(args) {
    const correlation = new RegressionCorrelation();
    const report = correlation.generateRegressionReport();
    console.log(JSON.stringify(report, null, 2));
  },
  
  async summary(args) {
    const summarizer = new DiffSummarizer();
    const range = args.range || 'HEAD~1';
    const report = summarizer.generateDiffReport(range);
    console.log(JSON.stringify(report, null, 2));
  }
};

const skillCommands = {
  async list(args) {
    const registry = new SkillRegistry();
    const skills = args.category ? registry.listSkills(args.category) : registry.listSkills();
    console.log(JSON.stringify(skills, null, 2));
  },
  
  async run(args) {
    const registry = new SkillRegistry();
    const runner = new SkillRunner(registry);
    const result = await runner.runSkill(args.skillId, args.context || {});
    console.log(JSON.stringify(result, null, 2));
  },
  
  async validate(args) {
    const registry = new SkillRegistry();
    const runner = new SkillRunner(registry);
    const result = runner.validateSkill(args.skillId);
    console.log(JSON.stringify(result, null, 2));
  },
  
  async export(args) {
    const registry = new SkillRegistry();
    const skills = registry.exportSkills();
    console.log(JSON.stringify(skills, null, 2));
  }
};

const graphCommands = {
  async build(args) {
    const builder = new DependencyGraphBuilder();
    const graph = builder.buildGraph();
    console.log(JSON.stringify(graph, null, 2));
  },
  
  async routes(args) {
    const routeGraph = new RouteGraph();
    const routes = routeGraph.detectRoutes();
    console.log(JSON.stringify(routes, null, 2));
  },
  
  async apis(args) {
    const apiGraph = new APIFlowGraph();
    const graph = apiGraph.buildAPIGraph();
    console.log(JSON.stringify(graph, null, 2));
  },
  
  async circular(args) {
    const builder = new DependencyGraphBuilder();
    const detector = new CircularDependencyDetector(builder);
    const cycles = detector.detectCircular();
    console.log(JSON.stringify({ cycles }, null, 2));
  },
  
  async visualize(args) {
    const builder = new DependencyGraphBuilder();
    const graph = builder.buildGraph();
    console.log(JSON.stringify(graph, null, 2));
  }
};

const runtimeCommands = {
  async sandbox(args) {
    const runner = new SandboxRunner();
    const result = runner.run(args.command);
    console.log(JSON.stringify(result, null, 2));
  },
  
  async inspect(args) {
    const runner = new SandboxRunner();
    const stats = runner.getSandboxStats();
    console.log(JSON.stringify(stats, null, 2));
  },
  
  async limits(args) {
    const limiter = require('../runtime/ProcessLimiter');
    const limits = new limiter();
    console.log(JSON.stringify(limits.getProcessList(), null, 2));
  },
  
  async audit(args) {
    const audit = new RuntimeAudit();
    const log = audit.getAuditLog(100);
    console.log(JSON.stringify(log, null, 2));
  }
};

const centerCommands = {
  async default(args) {
    console.log('Engineering Command Center');
    console.log('Usage: local-agent center [report|export]');
    console.log('');
    console.log('Available commands:');
    console.log('  local-agent center report  - Generate full report');
    console.log('  local-agent center export - Export all data');
  },
  
  async report(args) {
    const report = {
      git: {},
      skills: {},
      graph: {},
      runtime: {},
      generatedAt: new Date().toISOString()
    };
    
    try {
      const gitAnalyzer = new GitHistoryAnalyzer();
      report.git = gitAnalyzer.generateReport();
    } catch (e) {
      report.git.error = e.message;
    }
    
    try {
      const registry = new SkillRegistry();
      report.skills = { count: registry.listSkills().length };
    } catch (e) {
      report.skills.error = e.message;
    }
    
    console.log(JSON.stringify(report, null, 2));
  },
  
  async export(args) {
    const exportData = {
      git: {},
      skills: {},
      graph: {},
      generatedAt: new Date().toISOString()
    };
    
    try {
      const gitAnalyzer = new GitHistoryAnalyzer();
      exportData.git = gitAnalyzer.generateReport();
    } catch (e) {}
    
    try {
      const registry = new SkillRegistry();
      exportData.skills = registry.exportSkills();
    } catch (e) {}
    
    console.log(JSON.stringify(exportData, null, 2));
  }
};

module.exports = {
  gitCommands,
  skillCommands,
  graphCommands,
  runtimeCommands,
  centerCommands
};